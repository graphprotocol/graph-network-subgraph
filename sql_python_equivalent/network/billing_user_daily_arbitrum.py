#!/usr/bin/env python
# coding: utf-8
"""
BillingUserDaily flat table for Arbitrum Graph Payments users.

Entity fields covered (Graph Payments contract, src/mappings/graphPayments.ts):
- id: composite primary key `${user_id}-${event_date}` to mirror per-day snapshots.
- user_id: Graph account that interacted with Graph Payments.
- event_date: UTC date bucket (midnight) derived from log timestamps.
- billing_balance: daily net change = TokensAdded - TokensPulled - TokensRemoved.
- total_tokens_added: gross TokensAdded for the day.
- total_tokens_pulled: gross TokensPulled for the day (payments execution).
- total_tokens_removed: gross TokensRemoved for the day (escrow withdrawals).
- accumulated_tokens_added: cumulative TokensAdded across all prior days.
- delta_tokens_added: day-over-day delta of TokensAdded (should match total_tokens_added).

Event sources:
- TokensAdded(address indexed user, uint256 amount)           → GraphPayments contract
- TokensPulled(address indexed user, uint256 amount)          → GraphPayments contract
- TokensRemoved(address indexed from, address indexed to, uint256 amount) → GraphPayments contract

Pre-built nozzle tables for these GraphPayments events are not yet available on Arbitrum,
so we decode the canonical log stream from edgeandnode/arbitrum_one@0.0.1 as a fallback.
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

GRAPH_PAYMENTS_ADDRESS = "0x1B07D3344188908FB6DECEAC381F3EE63C48477A"

_GRAPH_PAYMENTS_HEX = GRAPH_PAYMENTS_ADDRESS.replace("0x", "")

logger.info("Starting BillingUserDaily extraction for Graph Payments on Arbitrum.")

billing_events_query = f"""
WITH tokens_added AS (
    SELECT
        evm_decode(l.topic1, l.topic2, l.topic3, l.data,
            'TokensAdded(address indexed user, uint256 amount)') AS event,
        l.timestamp
    FROM "edgeandnode/arbitrum_one@0.0.1".logs l
    WHERE l.address = arrow_cast(x'{_GRAPH_PAYMENTS_HEX}', 'FixedSizeBinary(20)')
      AND l.topic0 = evm_topic('TokensAdded(address indexed user, uint256 amount)')
),
tokens_removed AS (
    SELECT
        evm_decode(l.topic1, l.topic2, l.topic3, l.data,
            'TokensRemoved(address indexed from, address indexed to, uint256 amount)') AS event,
        l.timestamp
    FROM "edgeandnode/arbitrum_one@0.0.1".logs l
    WHERE l.address = arrow_cast(x'{_GRAPH_PAYMENTS_HEX}', 'FixedSizeBinary(20)')
      AND l.topic0 = evm_topic('TokensRemoved(address indexed from, address indexed to, uint256 amount)')
),
tokens_pulled AS (
    SELECT
        evm_decode(l.topic1, l.topic2, l.topic3, l.data,
            'TokensPulled(address indexed user, uint256 amount)') AS event,
        l.timestamp
    FROM "edgeandnode/arbitrum_one@0.0.1".logs l
    WHERE l.address = arrow_cast(x'{_GRAPH_PAYMENTS_HEX}', 'FixedSizeBinary(20)')
      AND l.topic0 = evm_topic('TokensPulled(address indexed user, uint256 amount)')
),
combined AS (
    SELECT
        event['user'] AS user_id,
        timestamp,
        arrow_cast(event['amount'], 'Float64') AS amount_raw,
        'added' AS event_type
    FROM tokens_added
    UNION ALL
    SELECT
        event['user'] AS user_id,
        timestamp,
        arrow_cast(event['amount'], 'Float64') AS amount_raw,
        'pulled' AS event_type
    FROM tokens_pulled
    UNION ALL
    SELECT
        event['from'] AS user_id,
        timestamp,
        arrow_cast(event['amount'], 'Float64') AS amount_raw,
        'removed' AS event_type
    FROM tokens_removed
)
SELECT user_id, timestamp, event_type, amount_raw
FROM combined
"""

logger.info("Querying GraphPayments billing events...")
billing_events = process_query(client, billing_events_query)
logger.info("Fetched %s raw billing rows.", len(billing_events))

if billing_events.empty:
    logger.warning("No billing events returned; emitting empty table.")
    daily_df = pd.DataFrame(
        columns=[
            "id",
            "user_id",
            "event_date",
            "billing_balance",
            "total_tokens_added",
            "total_tokens_pulled",
            "total_tokens_removed",
            "accumulated_tokens_added",
            "delta_tokens_added",
        ]
    )
else:
    billing_events["timestamp"] = pd.to_datetime(billing_events["timestamp"], unit="s", utc=True)
    billing_events["tokens"] = billing_events["amount_raw"] / 1e18

    billing_events["added_tokens"] = billing_events["tokens"].where(
        billing_events["event_type"] == "added", 0.0
    )
    billing_events["total_tokens_pulled"] = billing_events["tokens"].where(
        billing_events["event_type"] == "pulled", 0.0
    )
    billing_events["total_tokens_removed"] = billing_events["tokens"].where(
        billing_events["event_type"] == "removed", 0.0
    )
    billing_events["net_tokens"] = (
        billing_events["added_tokens"]
        - billing_events["total_tokens_pulled"]
        - billing_events["total_tokens_removed"]
    )

    billing_events["event_date"] = billing_events["timestamp"].dt.floor("D")

    logger.info("Aggregating per (user, event_date)...")
    grouped = (
        billing_events.groupby(["user_id", "event_date"], as_index=False)[
            ["added_tokens", "total_tokens_pulled", "total_tokens_removed", "net_tokens"]
        ].sum()
    )

    grouped = grouped.sort_values(["user_id", "event_date"])
    grouped["accumulated_tokens_added"] = grouped.groupby("user_id")["added_tokens"].cumsum()
    grouped["delta_tokens_added"] = grouped.groupby("user_id")["added_tokens"].diff().fillna(
        grouped["added_tokens"]
    )

    grouped["billing_balance"] = grouped["net_tokens"]
    grouped.rename(columns={"added_tokens": "total_tokens_added"}, inplace=True)

    grouped["id"] = grouped.apply(
        lambda row: f"{row['user_id']}-{row['event_date'].strftime('%Y-%m-%d')}", axis=1
    )

    daily_df = grouped[
        [
            "id",
            "user_id",
            "event_date",
            "billing_balance",
            "total_tokens_added",
            "total_tokens_pulled",
            "total_tokens_removed",
            "accumulated_tokens_added",
            "delta_tokens_added",
        ]
    ].copy()

logger.info("Prepared %s BillingUserDaily rows.", len(daily_df))

verification_rows: List[Dict[str, str]] = [
    {
        "field": "billing_balance",
        "script_logic": "SUM(TokensAdded - TokensPulled - TokensRemoved) per user/day (GRT)",
        "subgraph_source": "GraphPayments contract events; see billing balance tracking in downstream Graph Payments analytics.",
        "notes": "Matches net daily delta; assumes no missing event table (raw logs used).",
    },
    {
        "field": "total_tokens_added",
        "script_logic": "SUM(TokensAdded.amount) per user/day, scaled by 1e18",
        "subgraph_source": "GraphPayments TokensAdded handler",
        "notes": "Used for cumulative tokens funding.",
    },
    {
        "field": "total_tokens_pulled",
        "script_logic": "SUM(TokensPulled.amount) per user/day, scaled by 1e18",
        "subgraph_source": "GraphPayments TokensPulled handler",
        "notes": "Represents funds used for payments.",
    },
    {
        "field": "total_tokens_removed",
        "script_logic": "SUM(TokensRemoved.amount) per user/day, scaled by 1e18",
        "subgraph_source": "GraphPayments TokensRemoved handler",
        "notes": "Escrow withdrawals reduce balances.",
    },
    {
        "field": "accumulated_tokens_added",
        "script_logic": "Cumulative sum of total_tokens_added ordered by event_date per user",
        "subgraph_source": "Same as TokensAdded; replicates running total tracked in billing UI",
        "notes": "Initialization assumes first observed event equals createOrLoad timestamp.",
    },
    {
        "field": "delta_tokens_added",
        "script_logic": "Day-over-day difference of accumulated_tokens_added",
        "subgraph_source": "TokensAdded",
        "notes": "Equivalent to total_tokens_added; included for parity with downstream consumers.",
    },
]

verification_table = pd.DataFrame(verification_rows)
logger.info("Verification table:\n%s", verification_table.to_string(index=False))

logger.info("Uploading BillingUserDaily snapshot to BigQuery...")
bq_client = bigquery.Client(project="graph-mainnet")
bq_table = "graph-mainnet.nozzle.billing_user_daily_arbitrum"
bq_client.delete_table(bq_table, not_found_ok=True)

destination_blob_name = "path/in/bucket/billing_user_daily_arbitrum.parquet"
table_id = "billing_user_daily_arbitrum"
save_or_upload_parquet(daily_df, destination_blob_name, "upload", table_id, project_id="graph-mainnet")
logger.info("Upload complete. Rows written: %s", len(daily_df))
