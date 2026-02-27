#!/usr/bin/env python
# coding: utf-8

# Produces a flat table for the Curator entity from the graph-network subgraph.
#
# Curator entity fields (schema.graphql lines 1268-1329):
#   id, createdAt, totalSignalledTokens, totalUnsignalledTokens,
#   totalNameSignalledTokens, totalNameUnsignalledTokens, totalWithdrawnTokens,
#   totalSignal, totalNameSignal,
#   signalCount, activeSignalCount, nameSignalCount, activeNameSignalCount,
#   combinedSignalCount, activeCombinedSignalCount, defaultDisplayName
#
# Token sources (all handlers that mutate Curator token fields):
#   totalSignalledTokens   = Curation(tokens-tax) + GNS(tokensDeposited)   [curation.ts + gns.ts]
#   totalUnsignalledTokens = Curation(tokens)     + GNS(tokensReceived)    [curation.ts + gns.ts]
#   totalNameSignalledTokens   = GNS(tokensDeposited) only                 [gns.ts]
#   totalNameUnsignalledTokens = GNS(tokensReceived) only                  [gns.ts]
#   totalWithdrawnTokens       = GNS GRTWithdrawn(withdrawnGRT)            [gns.ts]
#
# Signal sources:
#   totalSignal     = Curation(vSignal) + GNS(vSignalCreated/Burnt)        [curation.ts + gns.ts]
#   totalNameSignal = GNS(nSignalCreated/Burnt) only                       [gns.ts]

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

GNS_ADDRESS = "ec9A7fb6CbC2E41926127929c2dcE6e9c5D33Bec"
CURATION_ADDRESS = "22d78fb4bc72e191C765807f8891B5e1785C8014"

logger.info("Starting curator arbitrum data processing...")

# %%
# ============================================================
# Part 1: totalSignalledTokens, totalUnsignalledTokens, createdAt
#
# totalSignalledTokens comes from BOTH Curation and GNS events.
# totalUnsignalledTokens comes from BOTH Curation and GNS events.
# createdAt is the EARLIEST timestamp (set once on first creation).
# ============================================================
part_1 = f'''
SELECT
    combined.curator_id,
    SUM(combined.signalled_tokens) / POWER(10, 18) AS total_signalled_tokens,
    SUM(combined.unsignalled_tokens) / POWER(10, 18) AS total_unsignalled_tokens,
    MIN(combined.timestamp) AS created_at
FROM (
    SELECT curator_id, (tokens - curation_tax) AS signalled_tokens, 0 AS unsignalled_tokens, timestamp
    FROM "data_science/event_arbitrum_curation_signalled@0.0.2"."event_arbitrum_curation_signalled"
    UNION ALL
    SELECT curator_id, 0 AS signalled_tokens, tokens AS unsignalled_tokens, timestamp
    FROM "data_science/event_arbitrum_curation_burned@0.0.2"."event_arbitrum_curation_burned"
    UNION ALL
    SELECT curator_id, tokens_deposited AS signalled_tokens, 0 AS unsignalled_tokens, timestamp
    FROM "data_science/event_arbitrum_gns_signal_minted@0.0.2"."event_arbitrum_gns_signal_minted"
    UNION ALL
    SELECT curator_id, 0 AS signalled_tokens, tokens_received AS unsignalled_tokens, timestamp
    FROM "data_science/event_arbitrum_gns_signal_burned@0.0.2"."event_arbitrum_gns_signal_burned"
) AS combined
GROUP BY combined.curator_id
'''

logger.info("Executing part 1 query...")
part_1_res = process_query(client, part_1)

# %%
# ============================================================
# Part 2: totalNameSignalledTokens, totalNameUnsignalledTokens
#
# These come ONLY from GNS events (SignalMinted, SignalBurned).
# ============================================================
part_2 = f'''
SELECT
    combined.curator_id,
    SUM(combined.name_signalled_tokens) / POWER(10, 18) AS total_name_signalled_tokens,
    SUM(combined.name_unsignalled_tokens) / POWER(10, 18) AS total_name_unsignalled_tokens
FROM (
    SELECT curator_id, tokens_deposited AS name_signalled_tokens, 0 AS name_unsignalled_tokens
    FROM "data_science/event_arbitrum_gns_signal_minted@0.0.2"."event_arbitrum_gns_signal_minted"
    UNION ALL
    SELECT curator_id, 0 AS name_signalled_tokens, tokens_received AS name_unsignalled_tokens
    FROM "data_science/event_arbitrum_gns_signal_burned@0.0.2"."event_arbitrum_gns_signal_burned"
) AS combined
GROUP BY combined.curator_id
'''

logger.info("Executing part 2 query...")
part_2_res = process_query(client, part_2)

# %%
# ============================================================
# Part 3: totalWithdrawnTokens, totalNameSignal
#
# totalWithdrawnTokens: from GRTWithdrawn events only (gns.ts).
# totalNameSignal: CURRENT nSignal = SUM(nSignalCreated) - SUM(nSignalBurnt)
#   from GNS SignalMinted/SignalBurned events.
# ============================================================
part_3 = f'''
WITH
name_signal_events AS (
    SELECT curator_id, n_signal_created AS name_signal_delta
    FROM "data_science/event_arbitrum_gns_signal_minted@0.0.2"."event_arbitrum_gns_signal_minted"
    UNION ALL
    SELECT curator_id, -n_signal_burnt AS name_signal_delta
    FROM "data_science/event_arbitrum_gns_signal_burned@0.0.2"."event_arbitrum_gns_signal_burned"
),
name_signal_totals AS (
    SELECT curator_id, SUM(name_signal_delta) / POWER(10, 18) AS total_name_signal
    FROM name_signal_events
    GROUP BY 1
),
withdrawn_totals AS (
    SELECT
        curator_id,
        sum(withdrawn_grt) / POWER(10, 18) AS total_withdrawn_tokens
    FROM "data_science/event_arbitrum_gns_grt_withdrawn@0.0.2"."event_arbitrum_gns_grt_withdrawn"
    GROUP BY 1
)

SELECT
    COALESCE(n.curator_id, w.curator_id) AS curator_id,
    COALESCE(n.total_name_signal, 0) AS total_name_signal,
    COALESCE(w.total_withdrawn_tokens, 0) AS total_withdrawn_tokens
FROM name_signal_totals n
FULL OUTER JOIN withdrawn_totals w ON n.curator_id = w.curator_id
'''

logger.info("Executing part 3 query...")
part_3_res = process_query(client, part_3)

# %%
# ============================================================
# Part 4: totalSignal (CURRENT summed vSignal)
#
# vSignal comes from BOTH Curation (Signalled/Burned) and
# GNS (SignalMinted/SignalBurned) events.
# ============================================================
part_4 = f'''
SELECT
    combined.curator_id,
    SUM(combined.signal_delta) / POWER(10, 18) AS total_signal
FROM (
    SELECT curator_id, signal AS signal_delta
    FROM "data_science/event_arbitrum_curation_signalled@0.0.2"."event_arbitrum_curation_signalled"
    UNION ALL
    SELECT curator_id, -signal AS signal_delta
    FROM "data_science/event_arbitrum_curation_burned@0.0.2"."event_arbitrum_curation_burned"
    UNION ALL
    SELECT curator_id, v_signal_created AS signal_delta
    FROM "data_science/event_arbitrum_gns_signal_minted@0.0.2"."event_arbitrum_gns_signal_minted"
    UNION ALL
    SELECT curator_id, -v_signal_burnt AS signal_delta
    FROM "data_science/event_arbitrum_gns_signal_burned@0.0.2"."event_arbitrum_gns_signal_burned"
) AS combined
GROUP BY combined.curator_id
'''

logger.info("Executing part 4 query...")
part_4_res = process_query(client, part_4)

# %%
# ============================================================
# Part 5: Signal counts
#
# signalCount / activeSignalCount: per (curator, deployment) from
#   Curation contract (Signalled/Burned).
# nameSignalCount / activeNameSignalCount: per (curator, subgraph)
#   from GNS contract (SignalMinted/SignalBurned).
# combinedSignalCount = signalCount + nameSignalCount
# activeCombinedSignalCount = activeSignalCount + activeNameSignalCount
# ============================================================
part_5 = f'''
WITH curation_signal_states AS (
    SELECT curator_id, subgraph_deployment_id, SUM(signal_delta) AS net_signal
    FROM (
        SELECT curator_id, subgraph_deployment_id, signal AS signal_delta
        FROM "data_science/event_arbitrum_curation_signalled@0.0.2"."event_arbitrum_curation_signalled"
        UNION ALL
        SELECT curator_id, subgraph_deployment_id, -signal AS signal_delta
        FROM "data_science/event_arbitrum_curation_burned@0.0.2"."event_arbitrum_curation_burned"
    ) t
    GROUP BY 1, 2
),
curation_counts AS (
    SELECT
        curator_id,
        COUNT(*) AS signal_count,
        COUNT(CASE WHEN net_signal > 0 THEN 1 END) AS active_signal_count
    FROM curation_signal_states
    GROUP BY 1
),
gns_signal_states AS (
    SELECT curator_id, subgraph_id, SUM(name_signal_delta) AS net_name_signal
    FROM (
        SELECT curator_id, subgraph_id, n_signal_created AS name_signal_delta
        FROM "data_science/event_arbitrum_gns_signal_minted@0.0.2"."event_arbitrum_gns_signal_minted"
        UNION ALL
        SELECT curator_id, subgraph_id, -n_signal_burnt AS name_signal_delta
        FROM "data_science/event_arbitrum_gns_signal_burned@0.0.2"."event_arbitrum_gns_signal_burned"
    ) t
    GROUP BY 1, 2
),
gns_counts AS (
    SELECT
        curator_id,
        COUNT(*) AS name_signal_count,
        COUNT(CASE WHEN net_name_signal > 0 THEN 1 END) AS active_name_signal_count
    FROM gns_signal_states
    GROUP BY 1
)

SELECT
    COALESCE(c.curator_id, g.curator_id) AS curator_id,
    COALESCE(c.signal_count, 0) AS signal_count,
    COALESCE(c.active_signal_count, 0) AS active_signal_count,
    COALESCE(g.name_signal_count, 0) AS name_signal_count,
    COALESCE(g.active_name_signal_count, 0) AS active_name_signal_count
FROM curation_counts c
FULL OUTER JOIN gns_counts g ON c.curator_id = g.curator_id
'''

logger.info("Executing part 5 query...")
part_5_res = process_query(client, part_5)

# %%
# ============================================================
# Merge all parts
# ============================================================
logger.info("Merging results...")
result = part_1_res
result = result.merge(part_2_res, on='curator_id', how='outer')
result = result.merge(part_3_res, on='curator_id', how='outer')
result = result.merge(part_4_res, on='curator_id', how='outer')
result = result.merge(part_5_res, on='curator_id', how='outer')

numeric_cols = [c for c in result.columns if c not in ('curator_id', 'created_at')]
result[numeric_cols] = result[numeric_cols].fillna(0)

result['combined_signal_count'] = result['signal_count'].astype(int) + result['name_signal_count'].astype(int)
result['active_combined_signal_count'] = result['active_signal_count'].astype(int) + result['active_name_signal_count'].astype(int)

result['created_at'] = pd.to_datetime(result['created_at'], unit='s', utc=True)

# %%
# ============================================================
# Upload to BigQuery
# ============================================================
from google.cloud import bigquery

bq_client = bigquery.Client(project='graph-mainnet')
bq_client.delete_table('graph-mainnet.nozzle.curator_arbitrum', not_found_ok=True)

logger.info("Saving results to BigQuery...")
save_or_upload_parquet(
    result,
    destination_blob_name='path/in/bucket/curator_arbitrum.parquet',
    action="upload",
    table_id='curator_arbitrum',
    bucket_name='nozzle-data-science',
    project_id='graph-mainnet',
)

logger.info("Curator arbitrum data processing completed successfully!")
