#!/usr/bin/env python
# coding: utf-8
"""
GraphAccount flat table for Arbitrum (graph-network subgraph).

Fields covered (schema.graphql lines 234-308):
- id: graph account address (hex string).
- balance: GRT balance tracked via GraphToken Transfer handler (graphToken.ts).
- created_at: earliest timestamp where createOrLoadGraphAccount could have run,
  approximated by the first appearance across GraphToken transfers, staking,
  curation, GNS, and Service Registry events.

Balance source:
- graphToken.handleTransfer updates GraphAccount.balance on each Transfer; we
  replicate the same netting logic by summing incoming and outgoing transfers.

Creation sources consulted for created_at:
- GraphToken transfers (graphToken.ts)
- ServiceRegistry service_registered (serviceRegistry.ts)
- Staking stakeDeposited / stakeDelegated (staking.ts)
- Curation Signalled (curation.ts)
- GNS SignalMinted / SignalBurned (gns.ts)

Pre-built nozzle tables for GraphToken transfers on Arbitrum are not yet
available, so we decode edgeandnode/arbitrum_one@0.0.1 logs for that component.
All other activity sources rely on curated event tables.
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

GRAPH_TOKEN_ADDRESS = "0x9623063377AD1B27544C965CCD7342F7EA7E88C7"
ZERO_ADDRESS_HEX = "0000000000000000000000000000000000000000"

_GRAPH_TOKEN_HEX = GRAPH_TOKEN_ADDRESS.replace("0x", "")

logger.info("Starting GraphAccount extraction for Arbitrum.")

graph_token_transfers_query = f"""
WITH decoded_transfers AS (
    SELECT
        evm_decode(l.topic1, l.topic2, l.topic3, l.data,
            'Transfer(address indexed from, address indexed to, uint256 value)') AS event,
        l.timestamp
    FROM "edgeandnode/arbitrum_one@0.0.1".logs l
    WHERE l.address = arrow_cast(x'{_GRAPH_TOKEN_HEX}', 'FixedSizeBinary(20)')
      AND l.topic0 = evm_topic('Transfer(address indexed from, address indexed to, uint256 value)')
)
SELECT
    event['to'] AS account_id,
    timestamp,
    arrow_cast(event['value'], 'Float64') AS token_delta
FROM decoded_transfers
WHERE event['to'] <> arrow_cast(x'{ZERO_ADDRESS_HEX}', 'FixedSizeBinary(20)')
UNION ALL
SELECT
    event['from'] AS account_id,
    timestamp,
    -arrow_cast(event['value'], 'Float64') AS token_delta
FROM decoded_transfers
WHERE event['from'] <> arrow_cast(x'{ZERO_ADDRESS_HEX}', 'FixedSizeBinary(20)')
"""

logger.info("Querying GraphToken transfers...")
token_events = process_query(client, graph_token_transfers_query)
logger.info("Fetched %s token transfer legs.", len(token_events))

activity_events_query = """
SELECT event['indexer'] AS account_id, timestamp
FROM arbitrum_service_registry.service_registered
UNION ALL
SELECT event['indexer'] AS account_id, timestamp
FROM arbitrum_staking.stake_deposited
UNION ALL
SELECT delegator_id AS account_id, timestamp
FROM "delegators/event_arbitrum_staking_stake_delegated@0.0.1"."event_arbitrum_staking_stake_delegated"
UNION ALL
SELECT curator_id AS account_id, timestamp
FROM "data_science/event_arbitrum_curation_signalled@0.0.2"."event_arbitrum_curation_signalled"
UNION ALL
SELECT curator_id AS account_id, timestamp
FROM "data_science/event_arbitrum_gns_signal_minted@0.0.2"."event_arbitrum_gns_signal_minted"
UNION ALL
SELECT curator_id AS account_id, timestamp
FROM "data_science/event_arbitrum_gns_signal_burned@0.0.2"."event_arbitrum_gns_signal_burned"
"""

logger.info("Querying auxiliary activity events for created_at...")
activity_events = process_query(client, activity_events_query)
logger.info("Fetched %s activity events.", len(activity_events))

if token_events.empty and activity_events.empty:
    logger.warning("No GraphAccount activity detected; emitting empty table.")
    graph_accounts_df = pd.DataFrame(columns=["id", "balance", "created_at"])
else:
    balance_series = pd.Series(dtype=float)
    token_created_series = pd.Series(dtype="datetime64[ns, UTC]")

    if not token_events.empty:
        token_events["timestamp"] = pd.to_datetime(token_events["timestamp"], unit="s", utc=True)
        token_events["token_delta"] = token_events["token_delta"] / 1e18
        balance_series = token_events.groupby("account_id")["token_delta"].sum()
        token_created_series = token_events.groupby("account_id")["timestamp"].min()

    activity_created_series = pd.Series(dtype="datetime64[ns, UTC]")
    if not activity_events.empty:
        activity_events["timestamp"] = pd.to_datetime(activity_events["timestamp"], unit="s", utc=True)
        activity_created_series = activity_events.groupby("account_id")["timestamp"].min()

    all_account_ids = sorted(set(balance_series.index).union(activity_created_series.index))
    graph_accounts_df = pd.DataFrame({"id": all_account_ids})

    graph_accounts_df = graph_accounts_df.merge(
        balance_series.reset_index().rename(columns={"account_id": "id", "token_delta": "balance"}),
        on="id",
        how="left",
    )
    graph_accounts_df["balance"] = graph_accounts_df["balance"].fillna(0.0)

    created_df = (
        pd.concat(
            [
                token_created_series.rename("token_created_at"),
                activity_created_series.rename("activity_created_at"),
            ],
            axis=1,
        )
        .min(axis=1)
        .rename("created_at")
        .rename_axis("id")
        .reset_index()
    )

    graph_accounts_df = graph_accounts_df.merge(created_df, on="id", how="left")

graph_accounts_df["created_at"] = pd.to_datetime(graph_accounts_df["created_at"], utc=True)
graph_accounts_df.sort_values("id", inplace=True)

logger.info("Prepared %s GraphAccount rows.", len(graph_accounts_df))

verification_rows: List[Dict[str, str]] = [
    {
        "field": "balance",
        "script_logic": "Net sum of GraphToken Transfer legs (credits - debits) converted from wei",
        "subgraph_source": "graphToken.handleTransfer updates GraphAccount.balance",
        "notes": "Relies on L2 log stream; excludes zero-address legs to match subgraph behavior.",
    },
    {
        "field": "created_at",
        "script_logic": "Earliest timestamp across GraphToken transfer participation, staking, curation, GNS, and ServiceRegistry events",
        "subgraph_source": "createOrLoadGraphAccount invocations in graphToken.ts, staking.ts, curation.ts, gns.ts, serviceRegistry.ts",
        "notes": "Accounts that only interact through other handlers may need additional sources; documented limitation.",
    },
]

verification_table = pd.DataFrame(verification_rows)
logger.info("Verification table:\n%s", verification_table.to_string(index=False))

logger.info("Uploading GraphAccount snapshot to BigQuery...")
bq_client = bigquery.Client(project="graph-mainnet")
bq_table = "graph-mainnet.nozzle.graph_account_arbitrum"
bq_client.delete_table(bq_table, not_found_ok=True)

destination_blob_name = "path/in/bucket/graph_account_arbitrum.parquet"
table_id = "graph_account_arbitrum"
schema = [
    bigquery.SchemaField("id", "STRING"),
    bigquery.SchemaField("balance", "NUMERIC"),
    bigquery.SchemaField("created_at", "TIMESTAMP"),
]

save_or_upload_parquet(graph_accounts_df, destination_blob_name, "upload", table_id, schema=schema, project_id="graph-mainnet")
logger.info("GraphAccount upload complete.")
