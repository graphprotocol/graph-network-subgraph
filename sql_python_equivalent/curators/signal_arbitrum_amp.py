#!/usr/bin/env python
# coding: utf-8

# Produces a flat table for the Signal entity from the graph-network subgraph.
#
# Signal entity fields (schema.graphql lines 1334-1368):
#   id (curatorAddress-subgraphDeploymentID), curator, subgraphDeployment,
#   signalledTokens, unsignalledTokens, signal,
#   createdAt, lastUpdatedAt
#
# Sources (curation.ts only — Signal is NOT touched by GNS):
#   signalledTokens  = CUMULATIVE (tokens - curationTax) from Signalled events
#   unsignalledTokens = CUMULATIVE tokens from Burned events
#   signal           = CURRENT share balance = SUM(signal_minted) - SUM(signal_burned)
#   createdAt        = timestamp of first event per (curator, deployment)
#   lastUpdatedAt    = timestamp of last event per (curator, deployment)

# %%
import sys
import os

try:
    script_dir = os.path.dirname(os.path.abspath(__file__))
except NameError:
    script_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
project_root = os.path.abspath(os.path.join(script_dir, '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from nozzle.client import Client
from nozzle.util import process_query, save_or_upload_parquet
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client_url = "grpc+tls://gateway.amp.staging.thegraph.com:443"
client = Client(client_url)

logger.info("Starting signal arbitrum data processing...")

# %%
# ============================================================
# Query: all Signal fields per (curator, subgraph_deployment)
#
# Uses pre-built tables for Signalled / Burned from Curation contract.
# Signal entity is per (curator, deployment) — NOT aggregated across deployments.
# ============================================================
query = '''
SELECT
    curator_id,
    subgraph_deployment_id,
    SUM(signalled_tokens) / POWER(10, 18) AS signalled_tokens,
    SUM(unsignalled_tokens) / POWER(10, 18) AS unsignalled_tokens,
    SUM(signal_delta) / POWER(10, 18) AS signal,
    MIN(timestamp) AS created_at,
    MAX(timestamp) AS last_updated_at
FROM (
    SELECT
        curator_id,
        subgraph_deployment_id,
        (tokens - curation_tax) AS signalled_tokens,
        0 AS unsignalled_tokens,
        signal AS signal_delta,
        timestamp
    FROM "data_science/event_arbitrum_curation_signalled@0.0.2"."event_arbitrum_curation_signalled"
    UNION ALL
    SELECT
        curator_id,
        subgraph_deployment_id,
        0 AS signalled_tokens,
        tokens AS unsignalled_tokens,
        -signal AS signal_delta,
        timestamp
    FROM "data_science/event_arbitrum_curation_burned@0.0.2"."event_arbitrum_curation_burned"
) all_events
GROUP BY curator_id, subgraph_deployment_id
'''

logger.info("Executing query...")
result = process_query(client, query)

# %%
# Build the entity id: curatorAddress-subgraphDeploymentID
result['id'] = result['curator_id'] + '-' + result['subgraph_deployment_id']

result['created_at'] = pd.to_datetime(result['created_at'], unit='s', utc=True)
result['last_updated_at'] = pd.to_datetime(result['last_updated_at'], unit='s', utc=True)

logger.info(f"Produced {len(result)} Signal rows")

# %%
# Upload to BigQuery
from google.cloud import bigquery

bq_client = bigquery.Client(project='graph-mainnet')
bq_client.delete_table('graph-mainnet.nozzle.signal_arbitrum', not_found_ok=True)

logger.info("Saving results to BigQuery...")
save_or_upload_parquet(
    result,
    destination_blob_name='path/in/bucket/signal_arbitrum.parquet',
    action="upload",
    table_id='signal_arbitrum',
    bucket_name='nozzle-data-science',
    project_id='graph-mainnet',
)

logger.info("Signal arbitrum data processing completed successfully!")
