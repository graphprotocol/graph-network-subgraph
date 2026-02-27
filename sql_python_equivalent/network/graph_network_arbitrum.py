#!/usr/bin/env python
# coding: utf-8
"""
GraphNetwork aggregate snapshot for Arbitrum (subset of schema.graphql lines 4-214).

Fields covered:
- total_grt_minted, total_grt_burned, total_supply                  → graphToken.handleTransfer
- total_indexing_rewards                                           → rewardsManager.handleRewardsAssigned
- total_curator_query_fees                                         → staking.handleAllocationCollected + handleRebateCollected
- total_indexer_query_fee_rebates, total_delegator_query_fee_rebates,
  total_unclaimed_query_fee_rebates                                → staking.handleRebateCollected + handleRebateClaimed
- total_indexer_query_fees_collected, total_query_fees,
  total_taxed_query_fees                                           → staking.handleAllocationCollected + handleRebateCollected
- total_tokens_allocated, total_tokens_signalled                   → staking.handleAllocationCreated/Closed + curation.handleSignalled/Burned
- allocation_count, active_allocation_count                        → staking.handleAllocationCreated/Closed
- delegator_count, active_delegator_count                          → staking.handleStakeDelegated/StakeDelegatedLocked
- delegation_count, active_delegation_count                        → staking.handleStakeDelegated/StakeDelegatedLocked
- subgraph_count, active_subgraph_count, subgraph_deployment_count → gns + staking + curation activity
- total_grt_deposited_confirmed, total_grt_minted_from_l2,
  total_grt_withdrawn                                              → L2 gateway bridge events
- total_tokens_staked, total_unstaked_tokens_locked,
  total_delegated_tokens                                           → staking contract events
- indexer_count, staked_indexers_count                             → ServiceRegistry + staking stake balances

Each query sticks to curated nozzle tables when available (arbitrum_staking, data_science, delegators).
Raw log decoding remains for contracts that lack published mirrors (GraphToken supply, RewardsAssigned, subgraph counts).
"""

import logging
import os
import sys
from collections import OrderedDict
from typing import List, Dict

import pandas as pd
from google.cloud import bigquery
from nozzle.client import Client
from nozzle.util import process_query, save_or_upload_parquet

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
except NameError:  # pragma: no cover
    SCRIPT_DIR = os.path.dirname(os.path.abspath(sys.argv[0]))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

CLIENT_URL = "grpc+tls://gateway.amp.staging.thegraph.com:443"
client = Client(CLIENT_URL)

GRAPH_TOKEN_ADDRESS = "0x9623063377AD1B27544C965CCD7342F7EA7E88C7"
STAKING_ADDRESS = "0x00669A4CF01450B64E8A2A20E9B1FCB71E61EF03"
REWARDS_MANAGER_ADDRESS = "0x971b9d3d0ae3eca029cab5ea1fb0f72c85e6a525"
CURATION_ADDRESS = "0x22d78fb4bc72e191c765807f8891b5e1785c8014"
GNS_ADDRESS = "0xec9A7fb6CbC2E41926127929c2dcE6e9c5D33Bec"
L2_GATEWAY_ADDRESS = "0x65E1a5e8946e7E87d9774f5288f41c30a99fD302"
ZERO_ADDRESS_HEX = "0000000000000000000000000000000000000000"

def addr_hex(address: str) -> str:
    return address.replace("0x", "")

GRAPH_TOKEN_HEX = addr_hex(GRAPH_TOKEN_ADDRESS)
STAKING_HEX = addr_hex(STAKING_ADDRESS)
REWARDS_MANAGER_HEX = addr_hex(REWARDS_MANAGER_ADDRESS)
CURATION_HEX = addr_hex(CURATION_ADDRESS)
GNS_HEX = addr_hex(GNS_ADDRESS)
L2_GATEWAY_HEX = addr_hex(L2_GATEWAY_ADDRESS)

QUERIES = OrderedDict(
    [
        (
            "supply",
            f"""
WITH transfer_event AS (
    SELECT
        evm_decode(l.topic1, l.topic2, l.topic3, l.data, 'Transfer(address indexed from, address indexed to, uint256 value)') AS event
    FROM "edgeandnode/arbitrum_one@0.0.1".logs l
    WHERE l.address = arrow_cast(x'{GRAPH_TOKEN_HEX}', 'FixedSizeBinary(20)')
      AND l.topic0 = evm_topic('Transfer(address indexed from, address indexed to, uint256 value)')
),
mint_transfer AS (
    SELECT SUM(arrow_cast(event['value'], 'Float64')) AS total_grt_minted
    FROM transfer_event
    WHERE event['from'] = arrow_cast(x'{ZERO_ADDRESS_HEX}', 'FixedSizeBinary(20)')
),
burn_transfer AS (
    SELECT SUM(arrow_cast(event['value'], 'Float64')) AS total_grt_burned
    FROM transfer_event
    WHERE event['to'] = arrow_cast(x'{ZERO_ADDRESS_HEX}', 'FixedSizeBinary(20)')
)
SELECT
    COALESCE(mint_transfer.total_grt_minted, 0) / POWER(10,18) AS total_grt_minted,
    COALESCE(burn_transfer.total_grt_burned, 0) / POWER(10,18) AS total_grt_burned,
    (COALESCE(mint_transfer.total_grt_minted, 0) - COALESCE(burn_transfer.total_grt_burned, 0)) / POWER(10,18) AS total_supply
FROM mint_transfer CROSS JOIN burn_transfer
""",
        ),
        (
            "indexing_rewards",
            f"""
SELECT
    COALESCE(SUM(arrow_cast(event['amount'], 'Float64')), 0) / POWER(10,18) AS total_indexing_rewards
FROM (
    SELECT evm_decode(l.topic1, l.topic2, l.topic3, l.data, 'RewardsAssigned(address indexed indexer, address indexed allocationID, uint256 epoch, uint256 amount)') AS event
    FROM "edgeandnode/arbitrum_one@0.0.1".logs l
    WHERE l.address = arrow_cast(x'{REWARDS_MANAGER_HEX}', 'FixedSizeBinary(20)')
      AND l.topic0 = evm_topic('RewardsAssigned(address indexed indexer, address indexed allocationID, uint256 epoch, uint256 amount)')
) rewards_assigned
""",
        ),
        (
            "curator_query_fees",
            """
WITH allocation_collected AS (
    SELECT COALESCE(SUM(arrow_cast(event['curationFees'], 'Float64')), 0) AS curation_fees_raw
    FROM arbitrum_staking.allocation_collected
),
rebate_collected AS (
    SELECT COALESCE(SUM(arrow_cast(event['curationFees'], 'Float64')), 0) AS curation_fees_raw
    FROM arbitrum_staking.rebate_collected
)
SELECT
    (allocation_collected.curation_fees_raw + rebate_collected.curation_fees_raw) / POWER(10,18) AS total_curator_query_fees
FROM allocation_collected CROSS JOIN rebate_collected
""",
        ),
        (
            "query_fee_rebates",
            """
WITH rebate_claimed_event AS (
    SELECT
        COALESCE(SUM(arrow_cast(event['tokens'], 'Float64')), 0) AS tokens,
        COALESCE(SUM(arrow_cast(event['delegationFees'], 'Float64')), 0) AS delegation_fees
    FROM arbitrum_staking.rebate_claimed
),
rebate_collected_event AS (
    SELECT
        COALESCE(SUM(arrow_cast(event['queryFees'], 'Float64')), 0) AS query_fees,
        COALESCE(SUM(arrow_cast(event['queryRebates'], 'Float64')), 0) AS query_rebates,
        COALESCE(SUM(arrow_cast(event['delegationRewards'], 'Float64')), 0) AS delegation_rewards
    FROM arbitrum_staking.rebate_collected
),
allocation_collected_event AS (
    SELECT
        COALESCE(SUM(arrow_cast(event['rebateFees'], 'Float64')), 0) AS rebateFees
    FROM arbitrum_staking.allocation_collected
)
SELECT
    (rebate_claimed_event.tokens + rebate_collected_event.query_rebates) / POWER(10,18) AS total_indexer_query_fee_rebates,
    (rebate_claimed_event.delegation_fees + rebate_collected_event.delegation_rewards) / POWER(10,18) AS total_delegator_query_fee_rebates,
    (
        allocation_collected_event.rebateFees
        - (rebate_claimed_event.delegation_fees + rebate_claimed_event.tokens)
        + rebate_collected_event.query_fees
        - (rebate_collected_event.delegation_rewards + rebate_collected_event.query_rebates)
    ) / POWER(10,18) AS total_unclaimed_query_fee_rebates
FROM rebate_claimed_event
CROSS JOIN rebate_collected_event
CROSS JOIN allocation_collected_event
""",
        ),
        (
            "global_totals",
            f"""
WITH rebate_claimed_event AS (
    SELECT
        COALESCE(SUM(arrow_cast(event['tokens'], 'Float64')), 0) AS tokens,
        COALESCE(SUM(arrow_cast(event['delegationFees'], 'Float64')), 0) AS delegation_fees
    FROM arbitrum_staking.rebate_claimed
),
rebate_collected_event AS (
    SELECT
        COALESCE(SUM(arrow_cast(event['queryFees'], 'Float64')), 0) AS query_fees,
        COALESCE(SUM(arrow_cast(event['queryRebates'], 'Float64')), 0) AS query_rebates,
        COALESCE(SUM(arrow_cast(event['delegationRewards'], 'Float64')), 0) AS delegation_rewards,
        COALESCE(SUM(arrow_cast(event['tokens'], 'Float64')), 0) AS tokens,
        COALESCE(SUM(arrow_cast(event['protocolTax'], 'Float64')), 0) AS protocol_tax
    FROM arbitrum_staking.rebate_collected
),
allocation_collected_event AS (
    SELECT
        COALESCE(SUM(arrow_cast(event['rebateFees'], 'Float64')), 0) AS rebateFees,
        COALESCE(SUM(arrow_cast(event['tokens'], 'Float64')), 0) AS tokens,
        COALESCE(SUM(arrow_cast(event['curationFees'], 'Float64')), 0) AS curationFees
    FROM arbitrum_staking.allocation_collected
),
allocation_created_event AS (
    SELECT COALESCE(SUM(arrow_cast(event['tokens'], 'Float64')), 0) AS tokens
    FROM arbitrum_staking.allocation_created
),
allocation_closed_event AS (
    SELECT COALESCE(SUM(arrow_cast(event['tokens'], 'Float64')), 0) AS tokens
    FROM arbitrum_staking.allocation_closed
),
legacy_allocation_closed AS (
    SELECT
        COALESCE(SUM(arrow_cast(event['tokens'], 'Float64')), 0) AS tokens
    FROM (
        SELECT evm_decode(
            l.topic1, l.topic2, l.topic3, l.data,
            'AllocationClosed(address indexed indexer, bytes32 indexed subgraphDeploymentID, uint256 epoch, uint256 tokens, address indexed allocationID, uint256 effectiveAllocation, address sender, bytes32 poi, bool isPublic)'
        ) AS event
        FROM "edgeandnode/arbitrum_one@0.0.1".logs l
        WHERE l.address = arrow_cast(x'{STAKING_HEX}', 'FixedSizeBinary(20)')
          AND l.topic0 = evm_topic('AllocationClosed(address indexed indexer, bytes32 indexed subgraphDeploymentID, uint256 epoch, uint256 tokens, address indexed allocationID, uint256 effectiveAllocation, address sender, bytes32 poi, bool isPublic)')
    )
),
signalled_event AS (
    SELECT
        COALESCE(SUM(tokens - curation_tax), 0) AS net_signalled
    FROM "data_science/event_arbitrum_curation_signalled@0.0.2"."event_arbitrum_curation_signalled"
),
burned_event AS (
    SELECT
        COALESCE(SUM(tokens), 0) AS burned_tokens
    FROM "data_science/event_arbitrum_curation_burned@0.0.2"."event_arbitrum_curation_burned"
)
SELECT
    (allocation_collected_event.rebateFees + rebate_collected_event.query_fees) / POWER(10,18) AS total_indexer_query_fees_collected,
    (allocation_collected_event.tokens + rebate_collected_event.tokens) / POWER(10,18) AS total_query_fees,
    (
        allocation_collected_event.tokens
        - (allocation_collected_event.rebateFees + allocation_collected_event.curationFees)
        + rebate_collected_event.protocol_tax
    ) / POWER(10,18) AS total_taxed_query_fees,
    (
        allocation_created_event.tokens
        - allocation_closed_event.tokens
        - legacy_allocation_closed.tokens
    ) / POWER(10,18) AS total_tokens_allocated,
    (
        signalled_event.net_signalled
        - burned_event.burned_tokens
    ) / POWER(10,18) AS total_tokens_signalled
FROM rebate_claimed_event
CROSS JOIN rebate_collected_event
CROSS JOIN allocation_collected_event
CROSS JOIN allocation_created_event
CROSS JOIN allocation_closed_event
CROSS JOIN legacy_allocation_closed
CROSS JOIN signalled_event
CROSS JOIN burned_event
""",
        ),
        (
            "allocation_counts",
            """
WITH allocation_created_event AS (
    SELECT COUNT(*) AS allocations_created
    FROM arbitrum_staking.allocation_created
),
allocation_closed_event AS (
    SELECT COUNT(*) AS allocations_closed
    FROM arbitrum_staking.allocation_closed
),
legacy_allocation_closed AS (
    SELECT COUNT(*) AS allocations_closed
    FROM (
        SELECT evm_decode(
            l.topic1, l.topic2, l.topic3, l.data,
            'AllocationClosed(address indexed indexer, bytes32 indexed subgraphDeploymentID, uint256 epoch, uint256 tokens, address indexed allocationID, uint256 effectiveAllocation, address sender, bytes32 poi, bool isPublic)'
        ) AS event
        FROM "edgeandnode/arbitrum_one@0.0.1".logs l
        WHERE l.address = arrow_cast(x'{STAKING_HEX}', 'FixedSizeBinary(20)')
          AND l.topic0 = evm_topic('AllocationClosed(address indexed indexer, bytes32 indexed subgraphDeploymentID, uint256 epoch, uint256 tokens, address indexed allocationID, uint256 effectiveAllocation, address sender, bytes32 poi, bool isPublic)')
    )
)
SELECT
    allocation_created_event.allocations_created AS allocation_count,
    allocation_created_event.allocations_created
    - allocation_closed_event.allocations_closed
    - legacy_allocation_closed.allocations_closed AS active_allocation_count
FROM allocation_created_event
CROSS JOIN allocation_closed_event
CROSS JOIN legacy_allocation_closed
""",
        ),
        (
            "delegator_counts",
            """
WITH stake_delegated_event AS (
    SELECT delegator_id, SUM(arrow_cast(shares, 'Float64')) AS shares
    FROM "delegators/event_arbitrum_staking_stake_delegated@0.0.1"."event_arbitrum_staking_stake_delegated"
    GROUP BY 1
),
stake_delegated_locked_event AS (
    SELECT delegator_id, -SUM(arrow_cast(shares, 'Float64')) AS shares
    FROM "data_science/event_arbitrum_stake_delegated_locked@0.0.2"."event_arbitrum_stake_delegated_locked"
    GROUP BY 1
),
combined AS (
    SELECT COALESCE(a.delegator_id, b.delegator_id) AS delegator_id,
           COALESCE(a.shares, 0) + COALESCE(b.shares, 0) AS net_shares
    FROM stake_delegated_event a
    FULL OUTER JOIN stake_delegated_locked_event b USING (delegator_id)
)
SELECT
    COUNT(*) AS delegator_count,
    COUNT(CASE WHEN net_shares > 0 THEN 1 END) AS active_delegator_count
FROM combined
""",
        ),
        (
            "delegation_counts",
            """
WITH stake_delegated_event AS (
    SELECT delegator_id, indexer_id, SUM(arrow_cast(shares, 'Float64')) AS shares
    FROM "delegators/event_arbitrum_staking_stake_delegated@0.0.1"."event_arbitrum_staking_stake_delegated"
    GROUP BY 1, 2
),
stake_delegated_locked_event AS (
    SELECT delegator_id, indexer_id, -SUM(arrow_cast(shares, 'Float64')) AS shares
    FROM "data_science/event_arbitrum_stake_delegated_locked@0.0.2"."event_arbitrum_stake_delegated_locked"
    GROUP BY 1, 2
),
combined AS (
    SELECT
        COALESCE(a.delegator_id, b.delegator_id) AS delegator_id,
        COALESCE(a.indexer_id, b.indexer_id) AS indexer_id,
        COALESCE(a.shares, 0) + COALESCE(b.shares, 0) AS net_shares
    FROM stake_delegated_event a
    FULL OUTER JOIN stake_delegated_locked_event b USING (delegator_id, indexer_id)
)
SELECT
    COUNT(*) AS delegation_count,
    COUNT(CASE WHEN net_shares > 0 THEN 1 END) AS active_delegation_count
FROM combined
""",
        ),
        (
            "subgraph_counts",
            f"""
WITH subgraph_published AS (
    SELECT COUNT(*) AS subgraphs_count
    FROM (
        SELECT evm_decode(l.topic1, l.topic2, l.topic3, l.data,
            'SubgraphPublished(address indexed graphAccount, uint256 indexed subgraphNumber, bytes32 indexed subgraphDeploymentID, bytes32 versionMetadata)') AS event
        FROM "edgeandnode/arbitrum_one@0.0.1".logs l
        WHERE l.address = arrow_cast(x'{GNS_HEX}', 'FixedSizeBinary(20)')
          AND l.topic0 = evm_topic('SubgraphPublished(address indexed graphAccount, uint256 indexed subgraphNumber, bytes32 indexed subgraphDeploymentID, bytes32 versionMetadata)')
    )
),
subgraph_published_v2 AS (
    SELECT COUNT(*) AS subgraphs_count
    FROM (
        SELECT evm_decode(l.topic1, l.topic2, l.topic3, l.data,
            'SubgraphPublished(uint256 indexed subgraphID, bytes32 indexed subgraphDeploymentID, uint32 reserveRatio)') AS event
        FROM "edgeandnode/arbitrum_one@0.0.1".logs l
        WHERE l.address = arrow_cast(x'{GNS_HEX}', 'FixedSizeBinary(20)')
          AND l.topic0 = evm_topic('SubgraphPublished(uint256 indexed subgraphID, bytes32 indexed subgraphDeploymentID, uint32 reserveRatio)')
    )
),
subgraph_deprecated AS (
    SELECT COUNT(*) AS subgraphs_count_deprecated
    FROM (
        SELECT evm_decode(l.topic1, l.topic2, l.topic3, l.data,
            'SubgraphDeprecated(address indexed graphAccount, uint256 indexed subgraphNumber)') AS event
        FROM "edgeandnode/arbitrum_one@0.0.1".logs l
        WHERE l.address = arrow_cast(x'{GNS_HEX}', 'FixedSizeBinary(20)')
          AND l.topic0 = evm_topic('SubgraphDeprecated(address indexed graphAccount, uint256 indexed subgraphNumber)')
    )
),
subgraph_deprecated_v2 AS (
    SELECT COUNT(*) AS subgraphs_count_deprecated
    FROM (
        SELECT evm_decode(l.topic1, l.topic2, l.topic3, l.data,
            'SubgraphDeprecated(uint256 indexed subgraphID, uint32 withdrawableGRT)') AS event
        FROM "edgeandnode/arbitrum_one@0.0.1".logs l
        WHERE l.address = arrow_cast(x'{GNS_HEX}', 'FixedSizeBinary(20)')
          AND l.topic0 = evm_topic('SubgraphDeprecated(uint256 indexed subgraphID, uint32 withdrawableGRT)')
    )
),
curation_signalled_event AS (
    SELECT DISTINCT subgraph_deployment_id
    FROM "data_science/event_arbitrum_curation_signalled@0.0.2"."event_arbitrum_curation_signalled"
),
gns_events AS (
    SELECT DISTINCT subgraphDeploymentID AS subgraph_deployment_id
    FROM (
        SELECT evm_decode(l.topic1, l.topic2, l.topic3, l.data,
            'SubgraphPublished(address indexed graphAccount, uint256 indexed subgraphNumber, bytes32 indexed subgraphDeploymentID, bytes32 versionMetadata)')['subgraphDeploymentID'] AS subgraphDeploymentID
        FROM "edgeandnode/arbitrum_one@0.0.1".logs l
        WHERE l.address = arrow_cast(x'{GNS_HEX}', 'FixedSizeBinary(20)')
          AND l.topic0 = evm_topic('SubgraphPublished(address indexed graphAccount, uint256 indexed subgraphNumber, bytes32 indexed subgraphDeploymentID, bytes32 versionMetadata)')
        UNION ALL
        SELECT evm_decode(l.topic1, l.topic2, l.topic3, l.data,
            'SubgraphPublished(uint256 indexed subgraphID, bytes32 indexed subgraphDeploymentID, uint32 reserveRatio)')['subgraphDeploymentID']
        FROM "edgeandnode/arbitrum_one@0.0.1".logs l
        WHERE l.address = arrow_cast(x'{GNS_HEX}', 'FixedSizeBinary(20)')
          AND l.topic0 = evm_topic('SubgraphPublished(uint256 indexed subgraphID, bytes32 indexed subgraphDeploymentID, uint32 reserveRatio)')
    )
),
staking_events AS (
    SELECT DISTINCT event['subgraphDeploymentID'] AS subgraph_deployment_id
    FROM arbitrum_staking.allocation_created
),
combined_events AS (
    SELECT subgraph_deployment_id FROM curation_signalled_event
    UNION
    SELECT subgraph_deployment_id FROM gns_events
    UNION
    SELECT subgraph_deployment_id FROM staking_events
),
subgraph_deployment_count AS (
    SELECT COUNT(DISTINCT subgraph_deployment_id) AS deployment_count
    FROM combined_events
)
SELECT
    subgraph_published.subgraphs_count + subgraph_published_v2.subgraphs_count AS subgraph_count,
    subgraph_published.subgraphs_count + subgraph_published_v2.subgraphs_count
        - subgraph_deprecated.subgraphs_count_deprecated
        - subgraph_deprecated_v2.subgraphs_count_deprecated AS active_subgraph_count,
    subgraph_deployment_count.deployment_count AS subgraph_deployment_count
FROM subgraph_published
CROSS JOIN subgraph_published_v2
CROSS JOIN subgraph_deprecated
CROSS JOIN subgraph_deprecated_v2
CROSS JOIN subgraph_deployment_count
""",
        ),
        (
            "bridge_totals",
            f"""
WITH deposit_finalized_event AS (
    SELECT COALESCE(SUM(arrow_cast(event['amount'], 'Float64')), 0) AS total_grt_deposited_confirmed
    FROM (
        SELECT evm_decode(l.topic1, l.topic2, l.topic3, l.data,
            'DepositFinalized(address indexed l1Token, address indexed from, address indexed to, uint256 amount)') AS event
        FROM "edgeandnode/arbitrum_one@0.0.1".logs l
        WHERE l.address = arrow_cast(x'{L2_GATEWAY_HEX}', 'FixedSizeBinary(20)')
          AND l.topic0 = evm_topic('DepositFinalized(address indexed l1Token, address indexed from, address indexed to, uint256 amount)')
    )
),
tokens_minted_from_l2_event AS (
    SELECT COALESCE(SUM(arrow_cast(event['amount'], 'Float64')), 0) AS total_grt_minted_from_l2
    FROM (
        SELECT evm_decode(l.topic1, l.topic2, l.topic3, l.data,
            'TokensMintedFromL2(uint256 amount)') AS event
        FROM eth_firehose.logs l
        WHERE l.address = arrow_cast(x'01cDC91B0A9bA741903aA3699BF4CE31d6C5cC06', 'FixedSizeBinary(20)')
          AND l.topic0 = evm_topic('TokensMintedFromL2(uint256 amount)')
    )
),
withdrawal_initiated_event AS (
    SELECT COALESCE(SUM(arrow_cast(event['amount'], 'Float64')), 0) AS total_grt_withdrawn
    FROM (
        SELECT evm_decode(l.topic1, l.topic2, l.topic3, l.data,
            'WithdrawalInitiated(address l1Token, address indexed from, address indexed to, uint256 indexed l2ToL1Id, uint256 exitNum, uint256 amount)') AS event
        FROM "edgeandnode/arbitrum_one@0.0.1".logs l
        WHERE l.address = arrow_cast(x'{L2_GATEWAY_HEX}', 'FixedSizeBinary(20)')
          AND l.topic0 = evm_topic('WithdrawalInitiated(address l1Token, address indexed from, address indexed to, uint256 indexed l2ToL1Id, uint256 exitNum, uint256 amount)')
    )
)
SELECT
    deposit_finalized_event.total_grt_deposited_confirmed / POWER(10,18) AS total_grt_deposited_confirmed,
    tokens_minted_from_l2_event.total_grt_minted_from_l2 / POWER(10,18) AS total_grt_minted_from_l2,
    withdrawal_initiated_event.total_grt_withdrawn / POWER(10,18) AS total_grt_withdrawn
FROM deposit_finalized_event
CROSS JOIN tokens_minted_from_l2_event
CROSS JOIN withdrawal_initiated_event
""",
        ),
        (
            "staking_totals",
            f"""
WITH stake_deposited_event AS (
    SELECT COALESCE(SUM(arrow_cast(event['tokens'], 'Float64')), 0) AS tokens
    FROM arbitrum_staking.stake_deposited
),
stake_locked_event AS (
    SELECT COALESCE(SUM(arrow_cast(event['tokens'], 'Float64')), 0) AS tokens
    FROM arbitrum_staking.stake_locked
),
stake_slashed_event AS (
    SELECT COALESCE(SUM(arrow_cast(event['tokens'], 'Float64')), 0) AS tokens
    FROM arbitrum_staking.stake_slashed
),
stake_withdrawn_event AS (
    SELECT COALESCE(SUM(arrow_cast(event['tokens'], 'Float64')), 0) AS tokens
    FROM arbitrum_staking.stake_withdrawn
),
stake_delegated_event AS (
    SELECT COALESCE(SUM(arrow_cast(event['tokens'], 'Float64')), 0) AS tokens
    FROM "delegators/event_arbitrum_staking_stake_delegated@0.0.1"."event_arbitrum_staking_stake_delegated"
),
stake_delegated_locked_event AS (
    SELECT COALESCE(SUM(arrow_cast(tokens, 'Float64')), 0) AS tokens
    FROM "data_science/event_arbitrum_stake_delegated_locked@0.0.2"."event_arbitrum_stake_delegated_locked"
),
rebate_claimed_event AS (
    SELECT COALESCE(SUM(arrow_cast(event['delegationFees'], 'Float64')), 0) AS delegation_fees
    FROM arbitrum_staking.rebate_claimed
),
rebate_collected_event AS (
    SELECT COALESCE(SUM(arrow_cast(event['delegationRewards'], 'Float64')), 0) AS delegation_rewards
    FROM arbitrum_staking.rebate_collected
),
rewards_assigned_event AS (
    SELECT COALESCE(SUM(arrow_cast(event['amount'], 'Float64')), 0) AS amount
    FROM (
        SELECT evm_decode(l.topic1, l.topic2, l.topic3, l.data,
            'RewardsAssigned(address indexed indexer, address indexed allocationID, uint256 epoch, uint256 amount)') AS event
        FROM "edgeandnode/arbitrum_one@0.0.1".logs l
        WHERE l.address = arrow_cast(x'{REWARDS_MANAGER_HEX}', 'FixedSizeBinary(20)')
          AND l.topic0 = evm_topic('RewardsAssigned(address indexed indexer, address indexed allocationID, uint256 epoch, uint256 amount)')
    )
)
SELECT
    (stake_deposited_event.tokens - stake_withdrawn_event.tokens - stake_slashed_event.tokens) / POWER(10,18) AS total_tokens_staked,
    (stake_locked_event.tokens - stake_withdrawn_event.tokens) / POWER(10,18) AS total_unstaked_tokens_locked,
    (
        stake_delegated_event.tokens
        - stake_delegated_locked_event.tokens
        + rebate_claimed_event.delegation_fees
        + rebate_collected_event.delegation_rewards
        + rewards_assigned_event.amount * 0.53
    ) / POWER(10,18) AS total_delegated_tokens
FROM stake_deposited_event
CROSS JOIN stake_locked_event
CROSS JOIN stake_slashed_event
CROSS JOIN stake_withdrawn_event
CROSS JOIN stake_delegated_event
CROSS JOIN stake_delegated_locked_event
CROSS JOIN rebate_claimed_event
CROSS JOIN rebate_collected_event
CROSS JOIN rewards_assigned_event
""",
        ),
        (
            "indexer_counts",
            """
WITH staked_tokens AS (
    SELECT
        event['indexer'] AS indexer,
        SUM(arrow_cast(event['tokens'], 'Float64')) / POWER(10,18) AS staked_tokens
    FROM arbitrum_staking.stake_deposited
    GROUP BY 1
    UNION ALL
    SELECT
        event['indexer'] AS indexer,
        -SUM(arrow_cast(event['tokens'], 'Float64')) / POWER(10,18) AS staked_tokens
    FROM arbitrum_staking.stake_withdrawn
    GROUP BY 1
),
aggregated AS (
    SELECT indexer, SUM(staked_tokens) AS net_staked_tokens
    FROM staked_tokens
    GROUP BY 1
)
SELECT
    COUNT(DISTINCT sr.event['indexer']) AS indexer_count,
    COUNT(DISTINCT CASE WHEN net_staked_tokens > 0 THEN aggregated.indexer END) AS staked_indexers_count
FROM arbitrum_service_registry.service_registered sr
LEFT JOIN aggregated ON sr.event['indexer'] = aggregated.indexer
""",
        ),
    ]
)

def run_query(label: str, query: str) -> pd.DataFrame:
    logger.info("Executing %s query...", label)
    df = process_query(client, query)
    if df is None or df.empty:
        logger.warning("%s query returned no rows; inserting zeros.", label)
        return pd.DataFrame({f"{label}_missing": [0]})
    logger.info("%s query returned %s rows.", label, len(df))
    return df

result_frames = [run_query(name, sql) for name, sql in QUERIES.items()]
graph_network_df = pd.concat(result_frames, axis=1)
logger.info("Combined GraphNetwork dataframe shape: %s", graph_network_df.shape)

verification_rows: List[Dict[str, str]] = [
    {"field": "total_grt_minted", "script_logic": "Sum of GraphToken Transfer mints / 1e18", "subgraph_source": "graphToken.handleTransfer", "notes": "Raw log decode; GraphToken L2 table not yet available."},
    {"field": "total_grt_burned", "script_logic": "Sum of GraphToken Transfer burns / 1e18", "subgraph_source": "graphToken.handleTransfer", "notes": "Same as above."},
    {"field": "total_supply", "script_logic": "total_grt_minted - total_grt_burned", "subgraph_source": "graphToken.handleTransfer", "notes": ""},
    {"field": "total_indexing_rewards", "script_logic": "Sum RewardsAssigned.amount / 1e18", "subgraph_source": "rewardsManager.handleRewardsAssigned", "notes": "Raw logs due to missing curated table."},
    {"field": "total_curator_query_fees", "script_logic": "AllocationCollected.curationFees + RebateCollected.curationFees", "subgraph_source": "staking.handleAllocationCollected/handleRebateCollected", "notes": ""},
    {"field": "total_indexer_query_fee_rebates", "script_logic": "RebateCollected.queryRebates + legacy RebateClaimed.tokens", "subgraph_source": "staking.handleRebateCollected/handleRebateClaimed", "notes": ""},
    {"field": "total_delegator_query_fee_rebates", "script_logic": "RebateCollected.delegationRewards + RebateClaimed.delegationFees", "subgraph_source": "staking.handleRebateCollected/handleRebateClaimed", "notes": ""},
    {"field": "total_unclaimed_query_fee_rebates", "script_logic": "AllocationCollected rebateFees minus claimed rebates + net queryFees adjustments", "subgraph_source": "staking.handleAllocationCollected/handleRebateCollected/handleRebateClaimed", "notes": ""},
    {"field": "total_indexer_query_fees_collected", "script_logic": "AllocationCollected.rebateFees + RebateCollected.queryFees", "subgraph_source": "staking.handleAllocationCollected/handleRebateCollected", "notes": ""},
    {"field": "total_query_fees", "script_logic": "AllocationCollected.tokens + RebateCollected.tokens", "subgraph_source": "staking.handleAllocationCollected/handleRebateCollected", "notes": ""},
    {"field": "total_taxed_query_fees", "script_logic": "Total tokens - curator fees - rebate fees + protocol tax", "subgraph_source": "staking.handleAllocationCollected/handleRebateCollected", "notes": ""},
    {"field": "total_tokens_allocated", "script_logic": "AllocationCreated.tokens - AllocationClosed.tokens (legacy + horizon)", "subgraph_source": "staking.handleAllocationCreated/handleAllocationClosed", "notes": "Resizes currently ignored but net tokens still tracked via closures."},
    {"field": "total_tokens_signalled", "script_logic": "Curation Signalled net (tokens-curationTax) minus Burned.tokens", "subgraph_source": "curation.handleSignalled/handleBurned", "notes": ""},
    {"field": "allocation_count", "script_logic": "COUNT(allocation_created)", "subgraph_source": "staking.handleAllocationCreated", "notes": ""},
    {"field": "active_allocation_count", "script_logic": "allocation_count - closed_count (legacy + horizon)", "subgraph_source": "staking.handleAllocationClosed", "notes": ""},
    {"field": "delegator_count", "script_logic": "COUNT(delegators) ever delegated", "subgraph_source": "staking.handleStakeDelegated", "notes": "Uses shares summary to infer non-zero history."},
    {"field": "active_delegator_count", "script_logic": "Delegators with net shares > 0", "subgraph_source": "staking.handleStakeDelegated/StakeDelegatedLocked", "notes": ""},
    {"field": "delegation_count", "script_logic": "COUNT(distinct delegator-indexer pairs)", "subgraph_source": "staking.handleStakeDelegated", "notes": ""},
    {"field": "active_delegation_count", "script_logic": "delegations where net shares > 0", "subgraph_source": "staking.handleStakeDelegated/StakeDelegatedLocked", "notes": ""},
    {"field": "subgraph_count", "script_logic": "SubgraphPublished V1 + V2 counts", "subgraph_source": "gns.handleSubgraphPublished", "notes": "Raw logs due to missing curated table."},
    {"field": "active_subgraph_count", "script_logic": "subgraph_count - deprecated counts", "subgraph_source": "gns.handleSubgraphDeprecated", "notes": ""},
    {"field": "subgraph_deployment_count", "script_logic": "Distinct deploymentIds across curation/staking/GNS", "subgraph_source": "curation.handleSignalled + gns + staking", "notes": "Union of multiple sources ensures coverage."},
    {"field": "total_grt_deposited_confirmed", "script_logic": "Sum DepositFinalized.amount / 1e18", "subgraph_source": "l2Gateway.handleDepositFinalized", "notes": ""},
    {"field": "total_grt_minted_from_l2", "script_logic": "Sum TokensMintedFromL2.amount / 1e18", "subgraph_source": "l1Gateway.handleTokensMintedFromL2", "notes": ""},
    {"field": "total_grt_withdrawn", "script_logic": "Sum WithdrawalInitiated.amount / 1e18", "subgraph_source": "l2Gateway.handleWithdrawalInitiated", "notes": ""},
    {"field": "total_tokens_staked", "script_logic": "StakeDeposited - StakeWithdrawn - StakeSlashed", "subgraph_source": "staking.handleStakeDeposited/StakeWithdrawn/StakeSlashed", "notes": ""},
    {"field": "total_unstaked_tokens_locked", "script_logic": "StakeLocked - StakeWithdrawn", "subgraph_source": "staking.handleStakeLocked/StakeWithdrawn", "notes": ""},
    {"field": "total_delegated_tokens", "script_logic": "StakeDelegated - StakeDelegatedLocked + rebate + rewards adjustments", "subgraph_source": "staking.handleStakeDelegated/StakeDelegatedLocked/handleRebateCollected/handleRebateClaimed/handleRewardsAssigned", "notes": "53% factor mirrors protocol split for delegated rewards."},
    {"field": "indexer_count", "script_logic": "Distinct ServiceRegistered indexers", "subgraph_source": "serviceRegistry.handleAllocationCreated", "notes": ""},
    {"field": "staked_indexers_count", "script_logic": "Indexers with net stake > 0", "subgraph_source": "staking.handleStakeDeposited/StakeWithdrawn", "notes": ""},
]

verification_table = pd.DataFrame(verification_rows)
logger.info("Verification table:\n%s", verification_table.to_string(index=False))

logger.info("Uploading GraphNetwork snapshot to BigQuery...")
bq_client = bigquery.Client(project="graph-mainnet")
bq_table = "graph-mainnet.nozzle.graph_network_arbitrum"
bq_client.delete_table(bq_table, not_found_ok=True)

destination_blob_name = "path/in/bucket/graph_network_arbitrum.parquet"
table_id = "graph_network_arbitrum"
save_or_upload_parquet(graph_network_df, destination_blob_name, "upload", table_id, project_id="graph-mainnet")
logger.info("GraphNetwork upload complete.")
