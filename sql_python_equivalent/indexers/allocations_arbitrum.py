#!/usr/bin/env python
# coding: utf-8
"""
Allocation flat table for Arbitrum (graph-network subgraph).

Fields covered (schema.graphql lines 1058-1126):
- id: allocation/channel address (allocationID).
- indexer: Indexer entity id (address).
- subgraph_deployment: deployment id bytes32.
- allocated_tokens: latest tokens bonded to the allocation (GRT).
- created_at: timestamp when allocation opened (handleAllocationCreated / subgraphService.handleAllocationCreated).
- closed_at: timestamp when allocation closed (staking.ts handleAllocationClosed + CobbDouglas variant).
- status: 'Active' if no close recorded, otherwise 'Closed'.
- active_for_indexer: indexer id while allocation is open, null once closed.
- query_fees_collected: cumulative query fees net of curator/protocol tax (AllocationCollected + RebateCollected).
- query_fee_rebates: cumulative rebates claimed per allocation (RebateCollected + legacy RebateClaimed).

Event sources:
- allocation_created      → arbitrum_staking.allocation_created (staking.ts handleAllocationCreated).
- allocation_closed       → arbitrum_staking.allocation_closed (horizon) + legacy L1 AllocationClosed logs.
- allocation_collected    → arbitrum_staking.allocation_collected (staking.ts handleAllocationCollected).
- rebate_collected        → arbitrum_staking.rebate_collected (staking.ts handleRebateCollected).
- rebate_claimed          → arbitrum_staking.rebate_claimed (staking.ts handleRebateClaimed legacy path).

Known limitation: AllocationResized (horizon) updates allocatedTokens mid-flight; this script currently
uses the latest allocation_created tokens and does not replay resizes. This is surfaced in the verification table.
"""

import logging
import os
import sys
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

STAKING_ADDRESS = "0x00669A4CF01450B64E8A2A20E9B1FCB71E61EF03"
_STAKING_HEX = STAKING_ADDRESS.replace("0x", "")

logger.info("Starting Allocation extraction for Arbitrum.")

allocation_created_query = """
SELECT
    event['allocationID'] AS allocation_id,
    event['indexer'] AS indexer_id,
    event['subgraphDeploymentID'] AS subgraph_deployment_id,
    arrow_cast(event['tokens'], 'Float64') AS tokens_raw,
    event['epoch'] AS created_epoch,
    timestamp AS created_timestamp
FROM arbitrum_staking.allocation_created
"""

logger.info("Querying allocation creations...")
created_df = process_query(client, allocation_created_query)
logger.info("Fetched %s allocation creation rows.", len(created_df))

allocation_closed_query = f"""
WITH legacy_closed AS (
    SELECT
        evm_decode(
            l.topic1,
            l.topic2,
            l.topic3,
            l.data,
            'AllocationClosed(address indexed indexer, bytes32 indexed subgraphDeploymentID, uint256 epoch, uint256 tokens, address indexed allocationID, uint256 effectiveAllocation, address sender, bytes32 poi, bool isPublic)'
        ) AS event,
        l.timestamp
    FROM "edgeandnode/arbitrum_one@0.0.1".logs l
    WHERE l.address = arrow_cast(x'{_STAKING_HEX}', 'FixedSizeBinary(20)')
      AND l.topic0 = evm_topic('AllocationClosed(address indexed indexer, bytes32 indexed subgraphDeploymentID, uint256 epoch, uint256 tokens, address indexed allocationID, uint256 effectiveAllocation, address sender, bytes32 poi, bool isPublic)')
)
SELECT event['allocationID'] AS allocation_id, timestamp
FROM arbitrum_staking.allocation_closed
UNION ALL
SELECT event['allocationID'] AS allocation_id, timestamp
FROM legacy_closed
"""

logger.info("Querying allocation closures...")
closed_events_df = process_query(client, allocation_closed_query)
logger.info("Fetched %s allocation close events.", len(closed_events_df))

allocation_collected_query = """
SELECT
    event['allocationID'] AS allocation_id,
    SUM(arrow_cast(event['rebateFees'], 'Float64')) AS rebate_fees_raw
FROM arbitrum_staking.allocation_collected
GROUP BY 1
"""
logger.info("Aggregating allocation_collected fees...")
allocation_collected_df = process_query(client, allocation_collected_query)

rebate_collected_query = """
SELECT
    event['allocationID'] AS allocation_id,
    SUM(arrow_cast(event['queryFees'], 'Float64')) AS query_fees_raw,
    SUM(arrow_cast(event['queryRebates'], 'Float64')) AS query_rebates_raw
FROM arbitrum_staking.rebate_collected
GROUP BY 1
"""
logger.info("Aggregating rebate_collected fees...")
rebate_collected_df = process_query(client, rebate_collected_query)

rebate_claimed_query = """
SELECT
    event['allocationID'] AS allocation_id,
    SUM(arrow_cast(event['tokens'], 'Float64')) AS legacy_rebates_raw
FROM arbitrum_staking.rebate_claimed
GROUP BY 1
"""
logger.info("Aggregating legacy rebate_claimed events...")
rebate_claimed_df = process_query(client, rebate_claimed_query)

if created_df.empty:
    logger.warning("No allocations found; emitting empty table.")
    allocations_df = pd.DataFrame(
        columns=[
            "id",
            "indexer",
            "subgraph_deployment",
            "allocated_tokens",
            "created_at",
            "closed_at",
            "status",
            "active_for_indexer",
            "query_fees_collected",
            "query_fee_rebates",
        ]
    )
else:
    created_df["created_at"] = pd.to_datetime(created_df["created_timestamp"], unit="s", utc=True)
    created_df["allocated_tokens"] = created_df["tokens_raw"] / 1e18

    allocations_df = created_df.rename(
        columns={
            "allocation_id": "id",
            "indexer_id": "indexer",
            "subgraph_deployment_id": "subgraph_deployment",
        }
    )[
        ["id", "indexer", "subgraph_deployment", "allocated_tokens", "created_at"]
    ].copy()

    if not closed_events_df.empty:
        closed_events_df["closed_at"] = pd.to_datetime(closed_events_df["timestamp"], unit="s", utc=True)
        closed_df = closed_events_df.groupby("allocation_id", as_index=False)["closed_at"].min()
        allocations_df = allocations_df.merge(
            closed_df.rename(columns={"allocation_id": "id"}), on="id", how="left"
        )
    else:
        allocations_df["closed_at"] = pd.NaT

    allocations_df["status"] = allocations_df["closed_at"].apply(
        lambda x: "Closed" if pd.notnull(x) else "Active"
    )
    allocations_df["active_for_indexer"] = allocations_df.apply(
        lambda row: row["indexer"] if row["status"] == "Active" else None, axis=1
    )

    fee_df = allocations_df[["id"]].copy()
    if not allocation_collected_df.empty:
        allocation_collected_df["rebate_fees"] = allocation_collected_df["rebate_fees_raw"] / 1e18
        fee_df = fee_df.merge(
            allocation_collected_df.rename(columns={"allocation_id": "id", "rebate_fees": "collected_rebate_fees"}),
            on="id",
            how="left",
        )
    else:
        fee_df["collected_rebate_fees"] = 0.0

    if not rebate_collected_df.empty:
        rebate_collected_df["query_fees"] = rebate_collected_df["query_fees_raw"] / 1e18
        rebate_collected_df["query_rebates"] = rebate_collected_df["query_rebates_raw"] / 1e18
        fee_df = fee_df.merge(
            rebate_collected_df.rename(
                columns={
                    "allocation_id": "id",
                    "query_fees": "rebate_query_fees",
                    "query_rebates": "rebate_query_rebates",
                }
            ),
            on="id",
            how="left",
        )
    else:
        fee_df["rebate_query_fees"] = 0.0
        fee_df["rebate_query_rebates"] = 0.0

    if not rebate_claimed_df.empty:
        rebate_claimed_df["legacy_rebates"] = rebate_claimed_df["legacy_rebates_raw"] / 1e18
        fee_df = fee_df.merge(
            rebate_claimed_df.rename(columns={"allocation_id": "id", "legacy_rebates": "legacy_query_rebates"}),
            on="id",
            how="left",
        )
    else:
        fee_df["legacy_query_rebates"] = 0.0

    fee_df.fillna(0.0, inplace=True)
    fee_df["query_fees_collected"] = fee_df["collected_rebate_fees"] + fee_df["rebate_query_fees"]
    fee_df["query_fee_rebates"] = fee_df["rebate_query_rebates"] + fee_df["legacy_query_rebates"]

    allocations_df = allocations_df.merge(
        fee_df[["id", "query_fees_collected", "query_fee_rebates"]], on="id", how="left"
    )
    allocations_df[["query_fees_collected", "query_fee_rebates"]] = allocations_df[
        ["query_fees_collected", "query_fee_rebates"]
    ].fillna(0.0)

allocations_df.sort_values(["created_at", "id"], inplace=True)
logger.info("Prepared %s allocation rows.", len(allocations_df))

verification_rows: List[Dict[str, str]] = [
    {
        "field": "allocated_tokens",
        "script_logic": "Tokens from AllocationCreated divided by 1e18 (latest value).",
        "subgraph_source": "staking.ts handleAllocationCreated / subgraphService.handleAllocationCreated",
        "notes": "AllocationResized events not replayed yet (documented limitation).",
    },
    {
        "field": "status / active_for_indexer",
        "script_logic": "Mark Closed if any AllocationClosed event observed; otherwise Active and active_for_indexer=indexer.",
        "subgraph_source": "staking.ts handleAllocationClosed / handleAllocationClosedCobbDouglas",
        "notes": "Closures sourced from both horizon (arbitrum_staking) and legacy L1 events.",
    },
    {
        "field": "query_fees_collected",
        "script_logic": "AllocationCollected.rebateFees + RebateCollected.queryFees (sum per allocation).",
        "subgraph_source": "staking.ts handleAllocationCollected + handleRebateCollected",
        "notes": "Matches allocation.queryFeesCollected updates; curator rewards not materialized here.",
    },
    {
        "field": "query_fee_rebates",
        "script_logic": "RebateCollected.queryRebates + legacy RebateClaimed.tokens.",
        "subgraph_source": "staking.ts handleRebateCollected + handleRebateClaimed",
        "notes": "Delegation rewards excluded to stay aligned with allocation.queryFeeRebates.",
    },
]

verification_table = pd.DataFrame(verification_rows)
logger.info("Verification table:\n%s", verification_table.to_string(index=False))

logger.info("Uploading Allocations snapshot to BigQuery...")
bq_client = bigquery.Client(project="graph-mainnet")
bq_table = "graph-mainnet.nozzle.allocations_arbitrum"
bq_client.delete_table(bq_table, not_found_ok=True)

destination_blob_name = "path/in/bucket/allocations_arbitrum.parquet"
table_id = "allocations_arbitrum"
save_or_upload_parquet(allocations_df, destination_blob_name, "upload", table_id, project_id="graph-mainnet")
logger.info("Allocations upload complete.")
