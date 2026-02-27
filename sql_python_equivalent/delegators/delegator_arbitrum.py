#!/usr/bin/env python
# coding: utf-8

# Produces a flat table for the Delegator entity from the graph-network subgraph.
#
# Delegator entity fields (schema.graphql lines 1186-1209):
#   id, totalStakedTokens, totalUnstakedTokens, createdAt,
#   totalRealizedRewards, stakesCount, activeStakesCount, defaultDisplayName
#
# Additionally derived (not on entity, but useful):
#   staked_tokens (net current), locked_tokens (net current),
#   last_delegated_at, last_undelegated_at, last_delegation
#
# Handler sources:
#   - handleStakeDelegated      (staking.ts)   — totalStakedTokens, stakesCount, activeStakesCount
#   - handleStakeDelegatedLocked (staking.ts)  — totalUnstakedTokens, activeStakesCount
#   - handleStakeDelegatedWithdrawn (staking.ts) — lockedTokens on DelegatedStake
#   - SetDefaultName             (gns.ts)       — defaultDisplayName

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
from nozzle.util import save_or_upload_parquet
import pandas as pd

client_url = "grpc+tls://gateway.amp.staging.thegraph.com:443"
client = Client(client_url)

# %%
# ============================================================
# Part 1: Core delegation metrics per delegator
# ============================================================
metrics_query = f'''
WITH delegated AS (
    SELECT delegator_id, indexer_id, tokens, shares, timestamp
    FROM "delegators/event_arbitrum_staking_stake_delegated@0.0.1"."event_arbitrum_staking_stake_delegated"
),
undelegated AS (
    SELECT delegator_id, indexer_id, tokens, shares, timestamp
    FROM "data_science/event_arbitrum_stake_delegated_locked@0.0.2"."event_arbitrum_stake_delegated_locked"
),
withdrawn AS (
    SELECT delegator_id, tokens
    FROM "data_science/event_arbitrum_stake_delegated_withdrawn@0.0.2"."event_arbitrum_stake_delegated_withdrawn"
),

total_staked AS (
    SELECT
        delegator_id,
        SUM(tokens) / POWER(10, 18) AS total_staked_tokens,
        MIN(timestamp) AS created_at,
        MAX(timestamp) AS last_delegated_at,
        COUNT(DISTINCT indexer_id) AS stakes_count
    FROM delegated
    GROUP BY 1
),
total_unstaked AS (
    SELECT
        delegator_id,
        SUM(tokens) / POWER(10, 18) AS total_unstaked_tokens,
        MAX(timestamp) AS last_undelegated_at
    FROM undelegated
    GROUP BY 1
),
net_staked AS (
    SELECT delegator_id, SUM(delta) / POWER(10, 18) AS staked_tokens
    FROM (
        SELECT delegator_id, tokens AS delta FROM delegated
        UNION ALL
        SELECT delegator_id, -tokens AS delta FROM undelegated
    ) t
    GROUP BY 1
),
net_locked AS (
    SELECT delegator_id, SUM(delta) / POWER(10, 18) AS locked_tokens
    FROM (
        SELECT delegator_id, tokens AS delta FROM undelegated
        UNION ALL
        SELECT delegator_id, -tokens AS delta FROM withdrawn
    ) t
    GROUP BY 1
)

SELECT
    s.delegator_id AS delegator_wallet,
    s.total_staked_tokens,
    COALESCE(u.total_unstaked_tokens, 0) AS total_unstaked_tokens,
    COALESCE(ns.staked_tokens, 0) AS staked_tokens,
    COALESCE(nl.locked_tokens, 0) AS locked_tokens,
    s.stakes_count,
    s.created_at,
    s.last_delegated_at,
    u.last_undelegated_at
FROM total_staked s
LEFT JOIN total_unstaked u ON s.delegator_id = u.delegator_id
LEFT JOIN net_staked ns ON s.delegator_id = ns.delegator_id
LEFT JOIN net_locked nl ON s.delegator_id = nl.delegator_id
'''
metrics_res = process_query(client, metrics_query)

# %%
# ============================================================
# Part 2: activeStakesCount — count of (delegator, indexer)
# pairs where net shares > 0
# In the subgraph, activeStakesCount tracks stakes that still
# have non-zero shareAmount (incremented on delegation when
# shares go from 0 -> non-zero, decremented on full undelegation).
# ============================================================
active_query = f'''
WITH share_events AS (
    SELECT delegator_id, indexer_id, shares AS share_delta
    FROM "delegators/event_arbitrum_staking_stake_delegated@0.0.1"."event_arbitrum_staking_stake_delegated"
    UNION ALL
    SELECT delegator_id, indexer_id, -shares AS share_delta
    FROM "data_science/event_arbitrum_stake_delegated_locked@0.0.2"."event_arbitrum_stake_delegated_locked"
),
net_shares AS (
    SELECT delegator_id, indexer_id, SUM(share_delta) AS net_shares
    FROM share_events
    GROUP BY 1, 2
)
SELECT delegator_id AS delegator_wallet, COUNT(*) AS active_stakes_count
FROM net_shares
WHERE net_shares > 0
GROUP BY 1
'''
active_res = process_query(client, active_query)

# %%
# ============================================================
# Part 3: defaultDisplayName from latest GNS SetDefaultName event
# ============================================================
name_query = f'''
SELECT a.graph_account AS delegator_wallet, a.name AS default_display_name
FROM "delegators/event_arbitrum_gns_set_default_name@0.0.1"."event_arbitrum_gns_set_default_name" a
INNER JOIN (
    SELECT graph_account, MAX(block_number) AS latest_block
    FROM "delegators/event_arbitrum_gns_set_default_name@0.0.1"."event_arbitrum_gns_set_default_name"
    GROUP BY 1
) b ON a.graph_account = b.graph_account AND a.block_number = b.latest_block
'''
name_res = process_query(client, name_query)

# %%
# ============================================================
# Part 4: lastDelegation — most recent (delegator, indexer) pair
# ============================================================
last_delegation_query = f'''
SELECT a.delegator_id AS delegator_wallet, a.indexer_id AS last_delegation_indexer_id
FROM "delegators/event_arbitrum_staking_stake_delegated@0.0.1"."event_arbitrum_staking_stake_delegated" a
INNER JOIN (
    SELECT delegator_id, MAX(timestamp) AS max_ts
    FROM "delegators/event_arbitrum_staking_stake_delegated@0.0.1"."event_arbitrum_staking_stake_delegated"
    GROUP BY 1
) b ON a.delegator_id = b.delegator_id AND a.timestamp = b.max_ts
'''
last_del_res = process_query(client, last_delegation_query)
last_del_res = last_del_res.drop_duplicates(subset='delegator_wallet', keep='last')

# %%
# ============================================================
# Merge all parts
# ============================================================
result = metrics_res.merge(active_res, on='delegator_wallet', how='left')
result = result.merge(name_res, on='delegator_wallet', how='left')
result = result.merge(last_del_res, on='delegator_wallet', how='left')

result['active_stakes_count'] = result['active_stakes_count'].fillna(0).astype(int)
result['last_delegation'] = result.apply(
    lambda row: row['delegator_wallet'] + '-' + row['last_delegation_indexer_id']
    if pd.notna(row['last_delegation_indexer_id']) else None,
    axis=1,
)
result = result.drop(columns=['last_delegation_indexer_id'])

result['created_at'] = pd.to_datetime(result['created_at'], unit='s', utc=True)

# %%
# ============================================================
# Upload to BigQuery
# ============================================================
from google.cloud import bigquery

bq_client = bigquery.Client(project='graph-mainnet')
bq_client.delete_table('graph-mainnet.nozzle.delegator_arbitrum', not_found_ok=True)

save_or_upload_parquet(
    result,
    destination_blob_name='path/in/bucket/delegator_arbitrum.parquet',
    action="upload",
    table_id='delegator_arbitrum',
    bucket_name='nozzle-data-science',
    project_id='graph-mainnet')
