#!/usr/bin/env python
"""
Validate Python-replicated entity tables against the live Graph Network subgraph.

Usage:
    python validate.py                          # validate all entities
    python validate.py signal                   # validate one entity
    python validate.py curator delegator        # validate multiple
    python validate.py --samples 20 signal      # change sample size
    python validate.py --tolerance 0.02 curator # change tolerance (2%)

Two modes:
  1. Schema coverage: list subgraph fields and whether your BQ table has a match.
  2. Value comparison: fetch a sample from the subgraph, load from BQ, compare.
"""

import argparse
import json
import logging
import sys
import textwrap
from dataclasses import dataclass, field
from typing import Optional

import pandas as pd
import requests
from google.cloud import bigquery

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

SUBGRAPH_URL = (
    "https://gateway.thegraph.com/api/subgraphs/id/"
    "DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp"
)
BQ_PROJECT = "graph-mainnet"
BQ_DATASET = "nozzle"

WEI = 1e18


# =====================================================================
# Field descriptor
# =====================================================================
@dataclass
class Field:
    """Describes how to compare one subgraph field with a BQ column."""
    subgraph_name: str
    bq_name: str
    scale: float = WEI       # divide subgraph value by this before comparing
    is_timestamp: bool = False
    is_string: bool = False
    is_int: bool = False      # exact integer comparison


# =====================================================================
# Entity definitions
# =====================================================================
@dataclass
class EntityConfig:
    name: str                          # e.g. "Signal"
    graphql_type: str                  # e.g. "signals"
    bq_table: str                     # e.g. "signal_arbitrum"
    id_field: str = "id"              # BQ column that matches subgraph id
    order_by: str = "createdAt"
    fields: list = field(default_factory=list)
    graphql_extra: str = ""           # extra fields in the GraphQL query
    sample_filter: str = ""           # GraphQL where clause


ENTITIES = {
    "signal": EntityConfig(
        name="Signal",
        graphql_type="signals",
        bq_table="signal_arbitrum",
        order_by="signalledTokens",
        fields=[
            Field("signalledTokens",  "signalled_tokens"),
            Field("unsignalledTokens", "unsignalled_tokens"),
            Field("signal",            "signal"),
            Field("createdAt",         "created_at",      scale=1, is_timestamp=True),
            Field("lastUpdatedAt",     "last_updated_at", scale=1, is_timestamp=True),
        ],
        graphql_extra="curator { id } subgraphDeployment { id }",
    ),

    "name_signal": EntityConfig(
        name="NameSignal",
        graphql_type="nameSignals",
        bq_table="name_signal_arbitrum",
        order_by="signalledTokens",
        fields=[
            Field("signalledTokens",     "signalled_tokens"),
            Field("unsignalledTokens",   "unsignalled_tokens"),
            Field("withdrawnTokens",     "withdrawn_tokens"),
            Field("nameSignal",          "name_signal"),
            Field("signal",              "signal"),          # BigDecimal in wei
            Field("lastNameSignalChange","last_name_signal_change", scale=1, is_timestamp=True),
        ],
        graphql_extra="curator { id } subgraph { id }",
    ),

    "curator": EntityConfig(
        name="Curator",
        graphql_type="curators",
        bq_table="curator_arbitrum",
        id_field="curator_id",
        order_by="totalSignalledTokens",
        fields=[
            Field("totalSignalledTokens",      "total_signalled_tokens"),
            Field("totalUnsignalledTokens",     "total_unsignalled_tokens"),
            Field("totalNameSignalledTokens",   "total_name_signalled_tokens"),
            Field("totalNameUnsignalledTokens", "total_name_unsignalled_tokens"),
            Field("totalWithdrawnTokens",       "total_withdrawn_tokens"),
            Field("totalSignal",                "total_signal"),        # BigDecimal in wei
            Field("totalNameSignal",            "total_name_signal"),   # BigDecimal in wei
            Field("signalCount",                "signal_count",         scale=1, is_int=True),
            Field("activeSignalCount",          "active_signal_count",  scale=1, is_int=True),
            Field("nameSignalCount",            "name_signal_count",    scale=1, is_int=True),
            Field("activeNameSignalCount",      "active_name_signal_count", scale=1, is_int=True),
            Field("combinedSignalCount",        "combined_signal_count", scale=1, is_int=True),
            Field("activeCombinedSignalCount",  "active_combined_signal_count", scale=1, is_int=True),
            Field("createdAt",                  "created_at",           scale=1, is_timestamp=True),
        ],
    ),

    "delegator": EntityConfig(
        name="Delegator",
        graphql_type="delegators",
        bq_table="delegator_arbitrum",
        id_field="delegator_id",
        order_by="totalStakedTokens",
        fields=[
            Field("totalStakedTokens",   "total_staked_tokens"),
            Field("totalUnstakedTokens", "total_unstaked_tokens"),
            Field("stakesCount",         "stakes_count",         scale=1, is_int=True),
            Field("activeStakesCount",   "active_stakes_count",  scale=1, is_int=True),
            Field("createdAt",           "created_at",           scale=1, is_timestamp=True),
            Field("defaultDisplayName",  "default_display_name", scale=1, is_string=True),
        ],
    ),

    "delegated_stake": EntityConfig(
        name="DelegatedStake",
        graphql_type="delegatedStakes",
        bq_table="delegated_stake_arbitrum",
        order_by="stakedTokens",
        fields=[
            Field("stakedTokens",         "total_staked_tokens"),
            Field("unstakedTokens",       "total_unstaked_tokens"),
            Field("lockedTokens",         "locked_tokens"),
            Field("shareAmount",          "share_amount"),
            Field("personalExchangeRate", "personal_exchange_rate", scale=1),  # ratio, no wei
            Field("createdAt",            "created_at",             scale=1, is_timestamp=True),
            Field("lastDelegatedAt",      "last_delegated_at",      scale=1, is_timestamp=True),
            Field("lastUndelegatedAt",    "last_undelegated_at",    scale=1, is_timestamp=True),
        ],
        graphql_extra="indexer { id } delegator { id }",
    ),

    "subgraph_deployment": EntityConfig(
        name="SubgraphDeployment",
        graphql_type="subgraphDeployments",
        bq_table="subgraph_deployment_arbitrum",
        order_by="signalledTokens",
        fields=[
            Field("ipfsHash",        "ipfs_hash",         scale=1, is_string=True),
            Field("signalledTokens", "signalled_tokens"),
            Field("createdAt",       "created_at",        scale=1, is_timestamp=True),
        ],
    ),

    "indexer": EntityConfig(
        name="Indexer",
        graphql_type="indexers",
        bq_table="indexer_arbitrum",
        id_field="id",
        order_by="stakedTokens",
        fields=[
            Field("stakedTokens",         "staked_tokens"),
            Field("allocatedTokens",      "allocated_tokens"),
            Field("delegatedTokens",      "delegated_tokens"),
            Field("queryFeesCollected",   "query_fees_collected"),
            Field("rewardsEarned",        "rewards_earned"),
            Field("delegatorShares",      "delegator_shares"),
            Field("allocationCount",      "allocation_count",  scale=1, is_int=True),
            Field("createdAt",            "created_at",        scale=1, is_timestamp=True),
        ],
    ),

    "allocation": EntityConfig(
        name="Allocation",
        graphql_type="allocations",
        bq_table="allocations_arbitrum",
        order_by="allocatedTokens",
        fields=[
            Field("allocatedTokens",   "allocated_tokens"),
            Field("queryFeesCollected", "query_fees_collected"),
            Field("indexingRewards",    "indexing_rewards"),
            Field("createdAt",          "created_at",        scale=1, is_timestamp=True),
            Field("status",             "status",            scale=1, is_string=True),
        ],
        graphql_extra="indexer { id } subgraphDeployment { id }",
    ),
}


# =====================================================================
# Subgraph querying
# =====================================================================
def query_subgraph(graphql: str) -> dict:
    resp = requests.post(SUBGRAPH_URL, json={"query": graphql}, timeout=30)
    resp.raise_for_status()
    body = resp.json()
    if "errors" in body:
        raise RuntimeError(f"GraphQL errors: {json.dumps(body['errors'], indent=2)}")
    return body["data"]


def fetch_subgraph_sample(cfg: EntityConfig, n: int = 10) -> list[dict]:
    field_names = " ".join(f.subgraph_name for f in cfg.fields)
    where = f"where: {{ {cfg.sample_filter} }}," if cfg.sample_filter else ""
    q = f"""
    {{
      {cfg.graphql_type}(
        first: {n},
        orderBy: {cfg.order_by},
        orderDirection: desc,
        {where}
      ) {{
        id
        {field_names}
        {cfg.graphql_extra}
      }}
    }}
    """
    data = query_subgraph(q)
    return data[cfg.graphql_type]


# =====================================================================
# BigQuery loading
# =====================================================================
def load_bq_table(table: str) -> pd.DataFrame:
    client = bigquery.Client(project=BQ_PROJECT)
    ref = f"{BQ_PROJECT}.{BQ_DATASET}.{table}"
    logger.info(f"Loading {ref} ...")
    df = client.query(f"SELECT * FROM `{ref}`").to_dataframe()
    logger.info(f"  → {len(df)} rows, columns: {list(df.columns)}")
    return df


# =====================================================================
# Schema coverage report
# =====================================================================
SCHEMA_FIELDS: dict[str, list[str]] = {
    "Signal": [
        "id", "curator", "subgraphDeployment",
        "signalledTokens", "unsignalledTokens", "signal",
        "averageCostBasis", "averageCostBasisPerSignal",
        "lastSignalChange", "realizedRewards",
        "createdAt", "lastUpdatedAt", "createdAtBlock", "lastUpdatedAtBlock",
    ],
    "NameSignal": [
        "id", "curator", "subgraph",
        "signalledTokens", "unsignalledTokens", "withdrawnTokens",
        "nameSignal", "signal",
        "lastNameSignalChange", "realizedRewards",
        "averageCostBasis", "averageCostBasisPerSignal",
        "nameSignalAverageCostBasis", "nameSignalAverageCostBasisPerSignal",
        "signalAverageCostBasis", "signalAverageCostBasisPerSignal",
        "entityVersion", "linkedEntity",
        "signalledTokensSentToL2", "signalledTokensReceivedOnL2",
        "transferredToL2", "transferredToL2At", "transferredToL2AtBlockNumber",
        "transferredToL2AtTx", "idOnL2", "idOnL1",
    ],
    "Curator": [
        "id", "createdAt", "account", "defaultDisplayName",
        "totalSignalledTokens", "totalUnsignalledTokens",
        "totalNameSignalledTokens", "totalNameUnsignalledTokens",
        "totalWithdrawnTokens",
        "realizedRewards", "annualizedReturn", "totalReturn", "signalingEfficiency",
        "totalNameSignal", "totalNameSignalAverageCostBasis",
        "totalAverageCostBasisPerNameSignal",
        "totalSignal", "totalSignalAverageCostBasis", "totalAverageCostBasisPerSignal",
        "signalCount", "activeSignalCount",
        "nameSignalCount", "activeNameSignalCount",
        "combinedSignalCount", "activeCombinedSignalCount",
    ],
    "Delegator": [
        "id", "account", "createdAt", "defaultDisplayName",
        "totalStakedTokens", "totalUnstakedTokens",
        "totalRealizedRewards",
        "stakesCount", "activeStakesCount",
    ],
    "DelegatedStake": [
        "id", "indexer", "delegator",
        "stakedTokens", "unstakedTokens",
        "lockedTokens", "lockedUntil",
        "legacyLockedTokens", "legacyLockedUntil",
        "shareAmount", "personalExchangeRate", "realizedRewards",
        "createdAt", "lastDelegatedAt", "lastUndelegatedAt",
        "transferredToL2", "transferredToL2At", "transferredToL2AtBlockNumber",
        "transferredToL2AtTx", "stakedTokensTransferredToL2", "idOnL2", "idOnL1",
        "dataService", "provision",
    ],
    "SubgraphDeployment": [
        "id", "ipfsHash", "createdAt", "deniedAt", "originalName",
        "stakedTokens", "indexingRewardAmount",
        "indexingIndexerRewardAmount", "indexingDelegatorRewardAmount",
        "queryFeesAmount", "queryFeeRebates", "curatorFeeRewards",
        "delegatorsQueryFeeRebates",
        "signalledTokens", "unsignalledTokens", "signalAmount", "pricePerShare",
        "reserveRatio",
        "subgraphCount", "activeSubgraphCount", "deprecatedSubgraphCount",
        "transferredToL2", "transferredToL2At", "transferredToL2AtBlockNumber",
        "transferredToL2AtTx", "signalledTokensSentToL2", "signalledTokensReceivedOnL2",
    ],
    "Indexer": [
        "id", "createdAt", "url", "geoHash", "defaultDisplayName",
        "stakedTokens", "allocatedTokens", "lockedTokens",
        "delegatedTokens", "delegatorShares", "delegationExchangeRate",
        "allocationCount", "totalAllocationCount",
        "queryFeesCollected", "queryFeeRebates",
        "rewardsEarned", "indexerIndexingRewards", "delegatorIndexingRewards",
        "indexingRewardCut", "queryFeeCut",
        "delegatedCapacity", "tokenCapacity", "availableStake",
        "ownStakeRatio", "delegatedStakeRatio",
    ],
    "Allocation": [
        "id", "indexer", "creator", "activeForIndexer",
        "subgraphDeployment", "allocatedTokens", "effectiveAllocation",
        "createdAtEpoch", "createdAtBlockNumber", "createdAt",
        "closedAtEpoch", "closedAtBlockNumber", "closedAt",
        "queryFeesCollected", "queryFeeRebates", "distributedRebates",
        "curatorRewards", "indexingRewards",
        "indexingIndexerRewards", "indexingDelegatorRewards",
        "delegationFees", "status", "poi",
        "isLegacy", "forceClosed",
    ],
}


def print_schema_coverage(cfg: EntityConfig, bq_columns: list[str]):
    schema_fields = SCHEMA_FIELDS.get(cfg.name, [])
    if not schema_fields:
        logger.warning(f"No schema definition for {cfg.name}")
        return

    covered = {f.subgraph_name for f in cfg.fields}
    bq_set = set(bq_columns)

    print(f"\n{'='*70}")
    print(f"  {cfg.name} — Field Coverage")
    print(f"{'='*70}")
    print(f"  {'Subgraph Field':<42} {'BQ Column':<30} {'Status'}")
    print(f"  {'-'*42} {'-'*30} {'-'*10}")

    for sf in schema_fields:
        matching = [f for f in cfg.fields if f.subgraph_name == sf]
        if matching:
            bq_col = matching[0].bq_name
            in_bq = bq_col in bq_set
            status = "COVERED" if in_bq else "MAPPED (not in BQ)"
        else:
            status = "NOT COMPUTED"
            bq_col = "—"
        print(f"  {sf:<42} {bq_col:<30} {status}")

    n_covered = len([f for f in schema_fields if any(
        m.subgraph_name == f for m in cfg.fields
    )])
    print(f"\n  Coverage: {n_covered}/{len(schema_fields)} fields mapped")


# =====================================================================
# Value comparison
# =====================================================================
def to_unix(val) -> Optional[float]:
    """Convert a pandas Timestamp or numeric to unix seconds."""
    if pd.isna(val):
        return None
    if isinstance(val, pd.Timestamp):
        return val.timestamp()
    return float(val)


def compare_entity(
    entity_id: str,
    subgraph_row: dict,
    bq_row: pd.Series,
    fields: list[Field],
    tolerance: float = 0.01,
) -> tuple[int, int, list[str]]:
    """Compare one entity. Returns (passed, failed, detail_lines)."""
    passed = 0
    failed = 0
    details = []

    for f in fields:
        sg_val = subgraph_row.get(f.subgraph_name)
        bq_val = bq_row.get(f.bq_name)

        if sg_val is None and (bq_val is None or pd.isna(bq_val)):
            passed += 1
            details.append(f"    {f.subgraph_name:<35} both null                         OK")
            continue

        if f.is_string:
            sg_str = str(sg_val) if sg_val is not None else ""
            bq_str = str(bq_val) if bq_val is not None and not pd.isna(bq_val) else ""
            if sg_str.lower() == bq_str.lower():
                passed += 1
                details.append(f"    {f.subgraph_name:<35} \"{sg_str[:30]}\"                     OK")
            else:
                failed += 1
                details.append(f"    {f.subgraph_name:<35} sg=\"{sg_str[:20]}\"  bq=\"{bq_str[:20]}\"     MISMATCH")
            continue

        if f.is_timestamp:
            sg_ts = float(sg_val) if sg_val is not None else None
            bq_ts = to_unix(bq_val)
            if sg_ts is None and bq_ts is None:
                passed += 1
                details.append(f"    {f.subgraph_name:<35} both null                         OK")
            elif sg_ts is not None and bq_ts is not None and abs(sg_ts - bq_ts) < 2:
                passed += 1
                details.append(f"    {f.subgraph_name:<35} {int(sg_ts)}                          OK")
            else:
                failed += 1
                details.append(f"    {f.subgraph_name:<35} sg={sg_ts}  bq={bq_ts}     MISMATCH")
            continue

        try:
            expected = float(sg_val) / f.scale
        except (TypeError, ValueError):
            failed += 1
            details.append(f"    {f.subgraph_name:<35} sg={sg_val} (unparseable)          SKIP")
            continue

        try:
            actual = float(bq_val) if bq_val is not None and not pd.isna(bq_val) else 0.0
        except (TypeError, ValueError):
            actual = 0.0

        if f.is_int:
            if int(expected) == int(actual):
                passed += 1
                details.append(f"    {f.subgraph_name:<35} {int(expected):<20}              OK")
            else:
                failed += 1
                details.append(f"    {f.subgraph_name:<35} sg={int(expected)}  bq={int(actual)}         MISMATCH")
            continue

        if expected == 0 and actual == 0:
            passed += 1
            details.append(f"    {f.subgraph_name:<35} both 0                            OK")
            continue

        if expected == 0:
            diff_pct = abs(actual)
        else:
            diff_pct = abs(actual - expected) / abs(expected)

        ok = diff_pct <= tolerance
        if ok:
            passed += 1
            details.append(f"    {f.subgraph_name:<35} {expected:<20.6f} diff={diff_pct:.4%}  OK")
        else:
            failed += 1
            details.append(
                f"    {f.subgraph_name:<35} sg={expected:.6f}  bq={actual:.6f}  "
                f"diff={diff_pct:.4%}  MISMATCH"
            )

    return passed, failed, details


def validate_entity(
    cfg: EntityConfig,
    n_samples: int = 10,
    tolerance: float = 0.01,
):
    """Full validation for one entity type."""
    print(f"\n{'#'*70}")
    print(f"  Validating: {cfg.name}")
    print(f"{'#'*70}")

    # 1. Load BQ table
    try:
        bq_df = load_bq_table(cfg.bq_table)
    except Exception as e:
        logger.error(f"Could not load BQ table {cfg.bq_table}: {e}")
        return False

    # 2. Schema coverage
    print_schema_coverage(cfg, list(bq_df.columns))

    # 3. Fetch subgraph sample
    logger.info(f"Fetching {n_samples} {cfg.graphql_type} from subgraph ...")
    try:
        sample = fetch_subgraph_sample(cfg, n_samples)
    except Exception as e:
        logger.error(f"Subgraph query failed: {e}")
        return False

    if not sample:
        logger.warning("No entities returned from subgraph")
        return False

    # 4. Compare each sampled entity
    total_passed = 0
    total_failed = 0
    missing = 0

    for entity in sample:
        eid = entity["id"]
        bq_match = bq_df[bq_df[cfg.id_field].astype(str).str.lower() == eid.lower()]
        if bq_match.empty:
            print(f"\n  MISSING in BQ: {eid}")
            missing += 1
            continue

        row = bq_match.iloc[0]
        p, f_count, details = compare_entity(eid, entity, row, cfg.fields, tolerance)
        total_passed += p
        total_failed += f_count

        status = "ALL OK" if f_count == 0 else f"{f_count} MISMATCHES"
        print(f"\n  Entity: {eid[:60]}...  [{status}]")
        for d in details:
            print(d)

    # 5. Summary
    print(f"\n  {'─'*50}")
    total = total_passed + total_failed
    print(f"  Summary: {total_passed}/{total} fields passed, "
          f"{total_failed} mismatches, {missing} missing in BQ")
    print(f"  Tolerance: {tolerance:.1%}")

    return total_failed == 0 and missing == 0


# =====================================================================
# Main
# =====================================================================
def main():
    parser = argparse.ArgumentParser(
        description="Validate entity tables against the Graph Network subgraph.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(f"""\
            Available entities:
              {', '.join(sorted(ENTITIES.keys()))}

            Examples:
              python validate.py                    # all entities
              python validate.py signal curator     # specific entities
              python validate.py --samples 20       # more samples
              python validate.py --tolerance 0.02   # 2% tolerance
              python validate.py --coverage-only     # schema coverage only
        """),
    )
    parser.add_argument("entities", nargs="*", help="Entity names to validate (default: all)")
    parser.add_argument("--samples", type=int, default=10, help="Number of sample entities")
    parser.add_argument("--tolerance", type=float, default=0.01, help="Relative tolerance (0.01 = 1%%)")
    parser.add_argument("--coverage-only", action="store_true", help="Only show field coverage, skip value comparison")
    args = parser.parse_args()

    targets = args.entities if args.entities else sorted(ENTITIES.keys())
    invalid = [t for t in targets if t not in ENTITIES]
    if invalid:
        logger.error(f"Unknown entities: {invalid}. Choose from: {sorted(ENTITIES.keys())}")
        sys.exit(1)

    all_ok = True
    for name in targets:
        cfg = ENTITIES[name]
        if args.coverage_only:
            try:
                bq_df = load_bq_table(cfg.bq_table)
                print_schema_coverage(cfg, list(bq_df.columns))
            except Exception as e:
                logger.error(f"Could not load {cfg.bq_table}: {e}")
                all_ok = False
        else:
            ok = validate_entity(cfg, args.samples, args.tolerance)
            if not ok:
                all_ok = False

    print(f"\n{'='*70}")
    print(f"  OVERALL: {'ALL PASSED' if all_ok else 'SOME FAILURES'}")
    print(f"{'='*70}")
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
