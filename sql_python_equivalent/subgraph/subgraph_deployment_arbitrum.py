#!/usr/bin/env python
# coding: utf-8

# Produces a flat table equivalent to the SubgraphDeployment entity from the
# graph-network subgraph, limited to: id, ipfs_hash, subgraph_id, signalled_tokens, created_at.
#
# Deployment sources (matching createOrLoadSubgraphDeployment call sites):
#   - SubgraphPublished   (gns.ts handleSubgraphPublished)
#   - SubgraphUpgraded    (gns.ts handleSubgraphUpgraded)
#   - SubgraphVersionUpdated (gns.ts handleSubgraphVersionUpdated)
#
# signalledTokens sources (all handlers that mutate deployment.signalledTokens):
#   1. Signalled:           += (tokens - curationTax)  [curation.ts handleSignalled]
#   2. Burned:              -= tokens                   [curation.ts handleBurned]
#   3. AllocationCollected: += curationFees             [staking.ts handleAllocationCollected]
#   4. RebateCollected:     += curationFees             [staking.ts handleRebateCollected]
# [TODO: Not implemented yet]  5. QueryFeesCollected:  += tokensCurators           [subgraphService.ts handleQueryFeesCollected]
#
# Note: one deployment can be used by multiple subgraphs.  We keep the most
# recent subgraph_id association per deployment for this flat output.

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
from nozzle.util import process_query
from nozzle.util import save_or_upload_parquet, convert_bigint_subgraph_id_to_base58
from nozzle.util import convert_to_base58
import pandas as pd

client_url = "grpc+tls://gateway.amp.staging.thegraph.com:443"
client = Client(client_url)

GNS_ADDRESS = "ec9A7fb6CbC2E41926127929c2dcE6e9c5D33Bec"
SUBGRAPH_SERVICE_ADDRESS = "b2Bb92d0DE618878E438b55D5846cfecD9301105"

# %%
# ============================================================
# Part 1: deployment <-> subgraph mappings from SubgraphPublished
# ============================================================
part_1_query = f"""
SELECT
    subgraph_id,
    subgraph_deployment_id AS id,
    timestamp
FROM
    "data_science/event_arbitrum_gns_subgraph_published@0.0.2"."event_arbitrum_gns_subgraph_published"
"""
part_1_res = process_query(client, part_1_query)

# %%
# ============================================================
# Part 2: deployment <-> subgraph mappings from SubgraphUpgraded
# ============================================================
part_2_query = f"""
SELECT
    subgraph_id,
    subgraph_deployment_id AS id,
    timestamp
FROM
    "data_science/event_arbitrum_gns_subgraph_upgraded@0.0.2"."event_arbitrum_gns_subgraph_upgraded"
"""
part_2_res = process_query(client, part_2_query)

# %%
# ============================================================
# Part 3: deployment <-> subgraph mappings from SubgraphVersionUpdated
# ============================================================
part_3_query = f"""
SELECT
    subgraph_id,
    subgraph_deployment_id AS id,
    timestamp
FROM
    "data_science/event_arbitrum_gns_subgraph_version_updated@0.0.2"."event_arbitrum_gns_subgraph_version_updated"
"""
part_3_res = process_query(client, part_3_query)

# %%
# ============================================================
# Combine all deployment sources and deduplicate
# ============================================================
all_deployments = pd.concat([
    part_1_res[['subgraph_id', 'id', 'timestamp']],
    part_2_res[['subgraph_id', 'id', 'timestamp']],
    part_3_res[['subgraph_id', 'id', 'timestamp']],
], ignore_index=True).drop_duplicates()

all_deployments['ipfs_hash'] = all_deployments['id'].apply(convert_to_base58)
all_deployments['subgraph_id'] = all_deployments['subgraph_id'].apply(
    lambda x: convert_bigint_subgraph_id_to_base58(int(x))
)

# createdAt in the subgraph is set once on first creation, so take the
# earliest timestamp per deployment across all event sources.
created_at = all_deployments.groupby('id')['timestamp'].min().reset_index()
created_at.rename(columns={'timestamp': 'created_at'}, inplace=True)
created_at['created_at'] = pd.to_datetime(created_at['created_at'], unit='s', utc=True)

# One deployment can map to multiple subgraphs.  For this flat table we keep
# the last (most recent) subgraph_id association per deployment.
deployments = all_deployments.drop_duplicates(subset='id', keep='last')
deployments = deployments.merge(created_at, on='id', how='left')

# %%
# ============================================================
# Part 4: Calculate signalledTokens per deployment
#
# Matches the subgraph logic — five event sources that mutate
# deployment.signalledTokens (see file header for references).
#
# The subgraph stores raw BigInt (wei).  We divide by 10^18 here
# to produce GRT values for the output table.
# ============================================================
signal_query = f'''
WITH subgraph_signalled AS (
    SELECT
        subgraph_deployment_id,
        tokens - curation_tax AS signalled_tokens
    FROM "data_science/event_arbitrum_curation_signalled@0.0.2"."event_arbitrum_curation_signalled"
),
subgraph_burned AS (
    SELECT
        subgraph_deployment_id,
        -tokens AS signalled_tokens
    FROM "data_science/event_arbitrum_curation_burned@0.0.2"."event_arbitrum_curation_burned"
),
allocation_collected AS (
    SELECT
        subgraph_deployment_id,
        curation_fees AS signalled_tokens
    FROM "data_science/event_arbitrum_staking_allocation_collected@0.0.2"."event_arbitrum_staking_allocation_collected"
),
rebate_collected AS (
    SELECT
        subgraph_deployment_id,
        curation_fees AS signalled_tokens
    FROM "data_science/event_arbitrum_staking_rebate_collected@0.0.2"."event_arbitrum_staking_rebate_collected"
)

SELECT
    subgraph_deployment_id AS id,
    SUM(signalled_tokens) / POWER(10, 18) AS signalled_tokens
FROM (
    SELECT subgraph_deployment_id, signalled_tokens FROM subgraph_signalled
    UNION ALL
    SELECT subgraph_deployment_id, signalled_tokens FROM subgraph_burned
    UNION ALL
    SELECT subgraph_deployment_id, signalled_tokens FROM allocation_collected
    UNION ALL
    SELECT subgraph_deployment_id, signalled_tokens FROM rebate_collected
 
) AS combined
GROUP BY 1
'''
signal_res = process_query(client, signal_query)

# %%
# ============================================================
# Join deployments with signalled tokens
# ============================================================
data = deployments.merge(signal_res, on='id', how='left')
data['signalled_tokens'] = data['signalled_tokens'].fillna(0)

data = data[['id', 'ipfs_hash', 'subgraph_id', 'signalled_tokens', 'created_at']]

# %%
# ============================================================
# Upload to BigQuery
# ============================================================
from google.cloud import bigquery

bq_client = bigquery.Client(project='graph-mainnet')
bq_client.delete_table('graph-mainnet.nozzle.subgraph_deployment_arbitrum', not_found_ok=True)

bucket_name = 'nozzle-data-science'
destination_blob_name = 'path/in/bucket/subgraph_deployment_arbitrum.parquet'
table_id = 'subgraph_deployment_arbitrum'
project_id = 'graph-mainnet'
save_or_upload_parquet(data, destination_blob_name, "upload", table_id, project_id=project_id)
