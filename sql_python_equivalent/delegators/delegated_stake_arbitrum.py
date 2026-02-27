#!/usr/bin/env python
# coding: utf-8

# Produces a flat table for the DelegatedStake entity from the graph-network
# subgraph.  One row per (delegator, indexer) pair.
#
# DelegatedStake entity fields (schema.graphql lines 1214-1263):
#   id, indexer, delegator, stakedTokens (cumulative), unstakedTokens (cumulative),
#   lockedTokens (current), shareAmount, personalExchangeRate, realizedRewards,
#   createdAt, lastDelegatedAt, lastUndelegatedAt
#
# personalExchangeRate is a weighted-average cost basis per share, updated ONLY
# on delegation events (staking.ts:236-246):
#   rate = (old_rate * old_shares + new_tokens) / (old_shares + new_shares)
# It does NOT change on undelegation — the cost basis per remaining share stays.
# This requires sequential event processing, done in Python below.

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
# Part 1: All delegation & undelegation events (ordered by time)
# Used to compute personalExchangeRate, shareAmount, and
# aggregate metrics per (delegator, indexer) pair in Python.
# ============================================================
events_query = f'''
SELECT
    delegator_id,
    indexer_id,
    tokens,
    shares,
    timestamp,
    'delegated' AS event_type
FROM "delegators/event_arbitrum_staking_stake_delegated@0.0.1"."event_arbitrum_staking_stake_delegated"

UNION ALL

SELECT
    delegator_id,
    indexer_id,
    tokens,
    shares,
    timestamp,
    'undelegated' AS event_type
FROM "data_science/event_arbitrum_stake_delegated_locked@0.0.2"."event_arbitrum_stake_delegated_locked"

ORDER BY delegator_id, indexer_id, timestamp
'''
events_df = process_query(client, events_query)

# %%
# ============================================================
# Part 2: Locked tokens = locked - withdrawn per (delegator, indexer)
# In the subgraph, legacy withdraw resets lockedTokens to 0
# (staking.ts:341). Since legacy withdraw always drains the full
# locked amount, SUM(locked) - SUM(withdrawn) produces the same
# result as the reset-to-0 approach.
# ============================================================
locked_query = f'''
WITH lock_events AS (
    SELECT delegator_id, indexer_id, tokens AS delta
    FROM "data_science/event_arbitrum_stake_delegated_locked@0.0.2"."event_arbitrum_stake_delegated_locked"
    UNION ALL
    SELECT delegator_id, indexer_id, -tokens AS delta
    FROM "data_science/event_arbitrum_stake_delegated_withdrawn@0.0.2"."event_arbitrum_stake_delegated_withdrawn"
)
SELECT
    delegator_id,
    indexer_id,
    SUM(delta) / POWER(10, 18) AS locked_tokens
FROM lock_events
GROUP BY 1, 2
'''
locked_df = process_query(client, locked_query)

# %%
# ============================================================
# Part 3: Compute per-(delegator, indexer) metrics in Python
#
# personalExchangeRate: weighted average cost basis (tokens/share),
#   only updated on delegation events.
# shareAmount: running sum of share deltas.
# stakedTokens / unstakedTokens: cumulative sums.
# ============================================================
def compute_stake_metrics(group):
    rate = 1.0
    shares = 0.0
    total_staked = 0.0
    total_unstaked = 0.0
    created_at = None
    last_delegated_at = None
    last_undelegated_at = None

    for _, ev in group.iterrows():
        tokens = float(ev['tokens'])
        ev_shares = float(ev['shares'])

        if ev['event_type'] == 'delegated':
            total_staked += tokens
            new_total_shares = shares + ev_shares
            if new_total_shares > 0:
                rate = (rate * shares + tokens) / new_total_shares
            shares = new_total_shares
            last_delegated_at = ev['timestamp']
            if created_at is None:
                created_at = ev['timestamp']
        else:
            total_unstaked += tokens
            shares -= ev_shares
            last_undelegated_at = ev['timestamp']

    return pd.Series({
        'personal_exchange_rate': rate,
        'share_amount': shares / 1e18,
        'total_staked_tokens': total_staked / 1e18,
        'total_unstaked_tokens': total_unstaked / 1e18,
        'staked_tokens': (total_staked - total_unstaked) / 1e18,
        'created_at': created_at,
        'last_delegated_at': last_delegated_at,
        'last_undelegated_at': last_undelegated_at,
    })

metrics_df = (
    events_df
    .groupby(['delegator_id', 'indexer_id'], sort=False)
    .apply(compute_stake_metrics)
    .reset_index()
)

metrics_df['current_delegation'] = (
    metrics_df['personal_exchange_rate'] * metrics_df['share_amount']
)

# %%
# ============================================================
# Merge with locked tokens and finalize
# ============================================================
result = metrics_df.merge(locked_df, on=['delegator_id', 'indexer_id'], how='left')
result['locked_tokens'] = result['locked_tokens'].fillna(0)

result = result.rename(columns={
    'delegator_id': 'delegator',
    'indexer_id': 'indexer',
})

result['created_at'] = pd.to_datetime(result['created_at'], unit='s', utc=True)

result = result[[
    'indexer', 'delegator',
    'personal_exchange_rate', 'share_amount', 'current_delegation',
    'created_at', 'last_delegated_at',
    'locked_tokens', 'staked_tokens',
    'total_staked_tokens', 'total_unstaked_tokens',
    'last_undelegated_at',
]]

# %%
# ============================================================
# Upload to BigQuery
# ============================================================
from google.cloud import bigquery

bq_client = bigquery.Client(project='graph-mainnet')
bq_client.delete_table('graph-mainnet.nozzle.delegated_stake_arbitrum', not_found_ok=True)

bucket_name = 'nozzle-data-science'
destination_blob_name = 'path/in/bucket/delegated_stake_arbitrum.parquet'
table_id = 'delegated_stake_arbitrum'
project_id = 'graph-mainnet'
save_or_upload_parquet(result, destination_blob_name, "upload", table_id, project_id=project_id)
