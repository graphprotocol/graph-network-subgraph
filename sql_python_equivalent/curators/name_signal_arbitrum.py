#!/usr/bin/env python
# coding: utf-8

# Produces a flat table for the NameSignal entity from the graph-network subgraph.
#
# NameSignal entity fields (schema.graphql lines 1373-1433):
#   id (curatorAddress-subgraphID), curator, subgraph,
#   signalledTokens, unsignalledTokens, withdrawnTokens,
#   nameSignal, signal, lastNameSignalChange
#
# Sources (gns.ts):
#   signalledTokens  = CUMULATIVE tokensDeposited from SignalMinted
#   unsignalledTokens = CUMULATIVE tokensReceived from SignalBurned
#   withdrawnTokens  = withdrawnGRT from GRTWithdrawn (SET, not cumulative — fires once per deprecated subgraph)
#   nameSignal       = CURRENT nSignal = minted - burnt - withdrawn
#   signal           = CURRENT vSignal = minted - burnt (reset to 0 on GRTWithdrawn; also recalculated on subgraph upgrade — not captured here)
#   lastNameSignalChange = timestamp of last event

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
from nozzle.util import process_query, save_or_upload_parquet, convert_bigint_subgraph_id_to_base58
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client_url = "grpc+tls://gateway.amp.staging.thegraph.com:443"
client = Client(client_url)

GNS_ADDRESS = "ec9A7fb6CbC2E41926127929c2dcE6e9c5D33Bec"

logger.info("Starting name signal arbitrum data processing...")

# %%
# ============================================================
# Query: all NameSignal fields per (curator, subgraph)
#
# Uses pre-built tables for SignalMinted / SignalBurned.
# Uses raw log decode for GRTWithdrawn (no pre-built table).
# ============================================================
query = f'''
WITH
mint_events AS (
    SELECT
        curator_id,
        subgraph_id,
        n_signal_created AS name_signal_delta,
        v_signal_created AS signal_delta,
        tokens_deposited AS signalled_tokens,
        0 AS unsignalled_tokens,
        0 AS withdrawn_tokens,
        timestamp FROM "data_science/event_arbitrum_gns_signal_minted@0.0.2"."event_arbitrum_gns_signal_minted"
),
burn_events AS (
    SELECT
        curator_id,
        subgraph_id,
        -n_signal_burnt AS name_signal_delta,
        -v_signal_burnt AS signal_delta,
        0 AS signalled_tokens,
        tokens_received AS unsignalled_tokens,
        0 AS withdrawn_tokens,
        timestamp
    FROM "data_science/event_arbitrum_gns_signal_burned@0.0.2"."event_arbitrum_gns_signal_burned"
),
withdraw_events AS (
    SELECT
        curator_id AS curator_id,
        subgraph_id,
        -n_signal_burnt AS name_signal_delta,
        0 AS signal_delta,
        0 AS signalled_tokens,
        0 AS unsignalled_tokens,
        withdrawn_grt AS withdrawn_tokens,
        timestamp
    FROM "data_science/event_arbitrum_gns_grt_withdrawn@0.0.2"."event_arbitrum_gns_grt_withdrawn"
)

SELECT
    curator_id,
    subgraph_id,
    SUM(name_signal_delta) / POWER(10, 18) AS name_signal,
    SUM(signal_delta) / POWER(10, 18) AS signal,
    SUM(signalled_tokens) / POWER(10, 18) AS signalled_tokens,
    SUM(unsignalled_tokens) / POWER(10, 18) AS unsignalled_tokens,
    SUM(withdrawn_tokens) / POWER(10, 18) AS withdrawn_tokens,
    MAX(timestamp) AS last_name_signal_change
FROM (
    SELECT * FROM mint_events
    UNION ALL
    SELECT * FROM burn_events
    UNION ALL
    SELECT * FROM withdraw_events
) all_events
GROUP BY curator_id, subgraph_id
'''

logger.info("Executing query...")
result = process_query(client, query)

# %%
# Convert subgraph_id from bigint to base58 and build the entity id
result['subgraph_id'] = result['subgraph_id'].apply(
    lambda x: convert_bigint_subgraph_id_to_base58(int(x)) if pd.notnull(x) else x
)
result['id'] = result['curator_id'] + '-' + result['subgraph_id']

result['last_name_signal_change'] = pd.to_datetime(
    result['last_name_signal_change'], unit='s', utc=True
)

logger.info(f"Produced {len(result)} NameSignal rows")

# %%
# Upload to BigQuery
from google.cloud import bigquery

bq_client = bigquery.Client(project='graph-mainnet')
bq_client.delete_table('graph-mainnet.nozzle.name_signal_arbitrum', not_found_ok=True)

logger.info("Saving results to BigQuery...")
save_or_upload_parquet(
    result,
    destination_blob_name='path/in/bucket/name_signal_arbitrum.parquet',
    action="upload",
    table_id='name_signal_arbitrum',
    bucket_name='nozzle-data-science',
    project_id='graph-mainnet',
)

logger.info("Name signal arbitrum data processing completed successfully!")
