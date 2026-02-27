#!/usr/bin/env python
# coding: utf-8

# In[21]:

import sys
import os
# Add the daily_nozzle_part_1 directory to Python path so we import from the correct nozzle module
try:
    script_dir = os.path.dirname(os.path.abspath(__file__))
except NameError:
    # Fallback if __file__ is not defined
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



part_1_query = f'''
WITH indexer_creation_p1 AS (
    SELECT 
        block_num,
        event['indexer'] AS indexer_id,
        event['geohash'] AS geo_hash,
        timestamp
    FROM arbitrum_service_registry.service_registered pc
    -- Find the latest ServiceRegistered event for each indexer
    INNER JOIN (
        SELECT 
            event['indexer'] AS indexer_id,
            MAX(block_num) AS latest_block_number 
        FROM arbitrum_service_registry.service_registered
        GROUP BY event['indexer']
    ) latest
    ON pc.event['indexer'] = latest.indexer_id
    AND pc.block_num = latest.latest_block_number 
),
indexer_creation_p2 AS (
    SELECT 
        event['indexer'] AS indexer_id, 
        '' AS geo_hash,
        block_num,
        timestamp
    FROM  
        arbitrum_staking.stake_deposited        
),
indexer_creation_p3 AS (
            SELECT 
                event['indexer'] AS indexer_id,
                '' AS geo_hash,
                block_num,
                timestamp
            FROM arbitrum_staking.stake_slashed 
        UNION ALL
            SELECT 
                event['indexer'] AS indexer_id,
                '' AS geo_hash,
                block_num,
                timestamp
            FROM arbitrum_staking.stake_withdrawn
        UNION ALL
            SELECT 
                event['indexer'] AS indexer_id,
                '' AS geo_hash,
                block_num,
                timestamp
            FROM arbitrum_staking.stake_delegated
),
geohash_check AS (
    SELECT 
        indexer_id,
        geo_hash,
        block_num,
        timestamp
    FROM indexer_creation_p1
    UNION ALL
    SELECT 
        indexer_id,
        geo_hash,
        block_num,
        timestamp
    FROM indexer_creation_p2
    UNION ALL
    SELECT 
        indexer_id,
        geo_hash,
        block_num,
        timestamp
    FROM indexer_creation_p3
),
distinct_geohash AS (
    SELECT 
        indexer_id,
        geo_hash,
        block_num,
        timestamp,
        ROW_NUMBER() OVER (PARTITION BY indexer_id ORDER BY block_num DESC) AS row_num
    FROM geohash_check
),
geohash AS (
SELECT 
    DISTINCT indexer_id, 
    geo_hash,
    block_num,
    timestamp
FROM distinct_geohash
WHERE row_num = 1),

ServiceUnregistered AS (
    SELECT 
        event['indexer'] AS indexer_id,
        MAX(block_num) AS latest_block_number 
    FROM arbitrum_service_registry.service_unregistered
    GROUP BY event['indexer']
),
indexer_geohash AS (
    SELECT 
        ig.indexer_id,
        ig.geo_hash,
        ig.timestamp
    FROM geohash ig
    LEFT JOIN ServiceUnregistered su
        ON ig.indexer_id = su.indexer_id
        AND ig.block_num < su.latest_block_number
    WHERE su.indexer_id IS NULL
),

            allocations AS (
                SELECT 
                    event['indexer'] AS indexer_id,
                    COUNT(event['allocationID']) AS total_allocations,
                    SUM(arrow_cast(event['tokens'], 'Float64')) AS allocated_tokens,
                    COUNT(event['allocationID']) AS allocation_count
                FROM arbitrum_staking.allocation_created
                GROUP BY 1
        
                UNION ALL
        
                SELECT 
                    event['indexer'] AS indexer_id,
                    -COUNT(event['allocationID']) AS total_allocations,
                    -SUM(arrow_cast(event['tokens'], 'Float64')) AS allocated_tokens,
                    0 AS allocation_count
                FROM arbitrum_staking.allocation_closed
                GROUP BY 1
                UNION ALL 
                SELECT 
                    event['indexer'] AS indexer_id,
                    -COUNT(event['allocationID']) AS total_allocations,
                    -SUM(arrow_cast(event['tokens'], 'Float64')) AS allocated_tokens,
                    0 AS allocation_count
                FROM (
                    SELECT 
                        evm_decode(l.topic1, l.topic2, l.topic3, l.data, 'AllocationClosed(address indexed indexer, bytes32 indexed subgraphDeploymentID, uint256 epoch, uint256 tokens, address indexed allocationID, uint256 effectiveAllocation, address sender, bytes32 poi, bool isPublic)') AS event,
                        l.address
                    FROM
                        "edgeandnode/arbitrum_one@0.0.1".logs l
                    WHERE
                        l.address = arrow_cast(x'00669A4CF01450B64E8A2A20E9b1FCB71E61eF03', 'FixedSizeBinary(20)')
                        AND l.topic0 = evm_topic(
                        'AllocationClosed(address indexed indexer, bytes32 indexed subgraphDeploymentID, uint256 epoch, uint256 tokens, address indexed allocationID, uint256 effectiveAllocation, address sender, bytes32 poi, bool isPublic)')
                )
                GROUP BY 1
            ),
      allocations_final AS (
            SELECT
                indexer_id, 
                SUM(total_allocations) AS total_allocations,
                SUM(allocated_tokens) AS allocated_tokens,
                SUM(allocation_count) AS allocation_count
            FROM allocations
            GROUP BY 1
        ),
query_fee AS (
    SELECT 
        indexer AS indexer_id, 
        SUM(queryFeeRebates) AS query_fee_rebates,
        SUM(queryFeesCollected) AS query_fees_collected
    FROM (
        SELECT 
            event['indexer'] AS indexer,
            arrow_cast(event['tokens'], 'Float64') AS queryFeeRebates,
            0 AS queryFeesCollected
        FROM arbitrum_staking.rebate_claimed
        UNION ALL 
        SELECT 
            event['indexer'] AS indexer,
            arrow_cast(event['queryRebates'], 'Float64') AS queryFeeRebates,
            arrow_cast(event['queryFees'], 'Float64') AS queryFeesCollected
        FROM arbitrum_staking.rebate_collected
        UNION ALL 
        SELECT 
            event['indexer'] AS indexer,
            0 AS queryFeeRebates,
            arrow_cast(event['rebateFees'], 'Float64') AS queryFeesCollected
        FROM arbitrum_staking.allocation_collected
    ) AS fees
    GROUP BY indexer
),
stakedTokens_1 AS (
    SELECT 
        event['indexer'] AS indexer,
        SUM(arrow_cast(event['tokens'], 'Float64')) AS stakedTokens
    FROM arbitrum_staking.stake_deposited
    GROUP BY event['indexer']
),
stakedTokens_3 AS (
    SELECT 
        event['indexer'] AS indexer,
        -SUM(arrow_cast(event['tokens'], 'Float64')) AS stakedTokens
    FROM arbitrum_staking.stake_slashed 
    GROUP BY event['indexer']
),
stakedTokens_4 AS (
    SELECT 
        event['indexer'] AS indexer,
        -SUM(arrow_cast(event['tokens'], 'Float64')) AS stakedTokens
    FROM arbitrum_staking.stake_withdrawn
    GROUP BY event['indexer']
),
stakedTokens_final AS (
    SELECT 
        indexer, 
        SUM(stakedTokens) AS staked_tokens 
    FROM (
        SELECT * FROM stakedTokens_1
        UNION ALL  
        SELECT * FROM stakedTokens_3
        UNION ALL 
        SELECT * FROM stakedTokens_4
    ) AS combined_staked_tokens
    GROUP BY indexer
),
delegated_tokens_1 AS (
    SELECT 
        event['indexer'] AS indexer,
        SUM(arrow_cast(event['tokens'], 'Float64')) AS tokens
    FROM arbitrum_staking.stake_delegated
    GROUP BY event['indexer']
),
delegated_tokens_2 AS (
    SELECT 
        event['indexer'] AS indexer, 
        SUM(arrow_cast(event['delegationFees'], 'Float64')) AS tokens
    FROM arbitrum_staking.rebate_claimed
    GROUP BY event['indexer']
),
delegated_tokens_4 AS (
    SELECT 
        event['indexer'] AS indexer, 
        -SUM(arrow_cast(event['tokens'], 'Float64')) AS tokens
    FROM arbitrum_staking.stake_delegated_locked
    GROUP BY event['indexer']
),

delegated_tokens_5 AS (
    SELECT 
        event['indexer'] AS indexer, 
        SUM(arrow_cast(event['delegationRewards'], 'Float64')) AS tokens
    FROM arbitrum_staking.rebate_collected
    GROUP BY event['indexer']
),
final_delegated_tokens AS (
    SELECT * FROM delegated_tokens_1
    UNION ALL 
    SELECT * FROM delegated_tokens_2
    UNION ALL 
    SELECT * FROM delegated_tokens_4
    UNION ALL 
    SELECT * FROM delegated_tokens_5
),
delegated_tokens AS (
    SELECT 
        indexer, 
        SUM(tokens) AS delegated_tokens
    FROM final_delegated_tokens 
    GROUP BY indexer
),
locked_tokens_1 AS (
    SELECT  
        event['indexer'] AS indexer,
        arrow_cast(event['tokens'], 'Float64') AS locked_tokens,
        timestamp,
        block_num
    FROM arbitrum_staking.stake_locked a
    INNER JOIN 
    (
        SELECT  
            event['indexer'] AS indexer,
            MAX(timestamp) AS max_timestamp
        FROM arbitrum_staking.stake_locked
        GROUP BY event['indexer']
    ) b ON a.event['indexer'] = b.indexer AND a.timestamp = b.max_timestamp
),
locked_tokens_2 AS (
    SELECT 
        indexer, 
        -SUM(tokens) AS locked_tokens_withdraw
    FROM (
        SELECT  
            w.block_num AS block_number,
            event['indexer'] AS indexer,
            arrow_cast(event['tokens'], 'Float64') AS tokens
        FROM arbitrum_staking.stake_withdrawn w
        LEFT JOIN locked_tokens_1 lt ON w.event['indexer'] = lt.indexer  
        WHERE w.block_num >= lt.block_num
    ) AS withdraw_tokens
    GROUP BY indexer
),
locked_tokens_final AS (
    SELECT 
        a.indexer,
        COALESCE(a.locked_tokens, 0) + COALESCE(b.locked_tokens_withdraw, 0) AS locked_tokens
    FROM 
        locked_tokens_1 a 
    LEFT JOIN 
        locked_tokens_2 b ON a.indexer = b.indexer
),
rewards_earned AS (
    SELECT 
        event['indexer'] AS indexer, 
        SUM(arrow_cast(event['amount'], 'Float64')) AS rewards_earned
    FROM arbitrum_rewards_manager.rewards_assigned
    GROUP BY 1)

SELECT 
    a.indexer_id AS indexer_wallet,
    a.timestamp AS created_at,
    b.allocated_tokens/ POWER(10, 18) AS allocated_tokens,
    b.total_allocations AS allocation_count,
    b.allocation_count AS total_allocation_count,
    c.query_fee_rebates / POWER(10, 18) AS query_fee_rebates,
    c.query_fees_collected / POWER(10, 18) AS query_fees_collected,
    d.staked_tokens / POWER(10, 18) AS staked_tokens,
    f.locked_tokens / POWER(10, 18) AS locked_tokens,
    g.rewards_earned / POWER(10, 18) AS rewards_earned,
    0 AS unstaked_tokens
FROM 
    indexer_geohash a
LEFT JOIN allocations_final b ON a.indexer_id = b.indexer_id
LEFT JOIN query_fee c ON a.indexer_id = c.indexer_id
LEFT JOIN stakedTokens_final d ON a.indexer_id = d.indexer
LEFT JOIN delegated_tokens e ON a.indexer_id = e.indexer
LEFT JOIN locked_tokens_final f ON a.indexer_id = f.indexer
LEFT JOIN rewards_earned g ON a.indexer_id = g.indexer

'''
part_1_query_res = process_query(client, part_1_query)


# In[23]:


# attribute indexer exchange rate 
part_2_query = f''' 
WITH delegation_params AS (
    SELECT 
        event['indexer'] AS indexer_id,
        timestamp,
        event['indexingRewardCut']::integer as indexing_reward_cut,
        LEAD(timestamp) OVER (
            PARTITION BY event['indexer'] 
            ORDER BY timestamp ASC
        ) as next_update
    FROM (
    SELECT
        l.timestamp,
        evm_decode(l.topic1, l.topic2, l.topic3, l.data, 'DelegationParametersUpdated(address indexed indexer, uint32 indexingRewardCut, uint32 queryFeeCut, uint32 cooldownBlocks)') AS event
    FROM
        "edgeandnode/arbitrum_one@0.0.1".logs l
WHERE
    l.address = arrow_cast(x'00669A4CF01450B64E8A2A20E9b1FCB71E61eF03', 'FixedSizeBinary(20)')
    AND l.topic0 = evm_topic('DelegationParametersUpdated(address indexed indexer, uint32 indexingRewardCut, uint32 queryFeeCut, uint32 cooldownBlocks)')
    )
),
all_events AS (
    -- RewardsAssigned events with reward cut applied
    SELECT 
        e.event['indexer'] AS indexer_id,
        arrow_cast(e.event['amount'], 'Float64') - (arrow_cast(e.event['amount'], 'Float64') * COALESCE(d.indexing_reward_cut, 0) / 1000000)as tokens,
        0 as shares
    FROM arbitrum_rewards_manager.rewards_assigned e
    LEFT JOIN delegation_params d 
        ON e.event['indexer'] = d.indexer_id
        AND e.timestamp >= d.timestamp 
        AND (e.timestamp < d.next_update OR d.next_update IS NULL)


    UNION ALL

    -- StakeDelegated events 
    SELECT 
        a.event['indexer'] AS indexer_id,
        arrow_cast(a.event['tokens'], 'Float64') as tokens,
        arrow_cast(a.event['shares'], 'Float64') as shares
    FROM arbitrum_staking.stake_delegated a

    UNION ALL

    -- StakeDelegatedLocked events
    SELECT 
        a.event['indexer'] AS indexer_id,
        -arrow_cast(a.event['tokens'], 'Float64') as tokens,
        -arrow_cast(a.event['shares'], 'Float64') as shares
    FROM arbitrum_staking.stake_delegated_locked a

    UNION ALL

    -- RebateClaimed events
    SELECT 
        event['indexer'] AS indexer_id,
        arrow_cast(event['delegationFees'], 'Float64') as tokens,
        0 as shares
    FROM arbitrum_staking.rebate_claimed

    UNION ALL

    -- RebateCollected events
    SELECT 
        event['indexer'] AS indexer_id,
        arrow_cast(event['delegationRewards'], 'Float64') as tokens,
        0 as shares
    FROM arbitrum_staking.rebate_collected
),
final_balances AS (
    SELECT 
        indexer_id,
        SUM(tokens) as delegated_tokens,
        SUM(shares) as delegator_shares
    FROM all_events
    GROUP BY indexer_id
)
SELECT 
    indexer_id as indexer_wallet,
    delegated_tokens / POWER(10, 18) as delegated_tokens,
    delegator_shares / POWER(10, 18) as delegator_shares,
    CASE 
        WHEN delegator_shares = 0 THEN 1.0
        ELSE delegated_tokens/delegator_shares
    END as delegation_exchange_rate
FROM final_balances
'''


part_2_query_res = process_query(client, part_2_query)


# In[24]:


result = pd.merge(part_1_query_res, part_2_query_res, on=['indexer_wallet'], how='left')

result.fillna(0, inplace=True)
result['delegation_exchange_rate'] = result['delegation_exchange_rate'].replace(0, 1)

# # In[25]:


from google.cloud import bigquery

bq_client = bigquery.Client(project='graph-mainnet')
bq_client.delete_table('graph-mainnet.nozzle.indexer_arbitrum', not_found_ok=True)

bucket_name = 'nozzle-data-science'
destination_blob_name = 'path/in/bucket/indexer_arbitrum.parquet'
table_id = 'indexer_arbitrum'

save_or_upload_parquet(result, destination_blob_name, "upload", table_id, project_id='graph-mainnet')

