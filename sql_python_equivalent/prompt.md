Task: Revise Python scripts that replicate Graph Network subgraph entities using SQL + Python
You are working in the repo at /Users/vivianpeng/Work/graph-network-subgraph. The goal is to revise Python scripts in sql_python_equivalent/ so they accurately replicate the data of specific entities from The Graph Network subgraph (Arbitrum).
Context:
The subgraph's entity schema is defined in schema.graphql
The subgraph's mapping logic (how entities are created/updated from blockchain events) lives in src/mappings/*.ts, especially src/mappings/helpers/helpers.ts
The Python scripts query event data via SQL (using a nozzle client) and transform it with Pandas to produce flat tables matching the subgraph entities
Pre-built event tables exist at data_science/event_arbitrum_*@0.0.2 with flat column names (e.g., curator_id, signal_amount, timestamp). Always prefer these over raw log decoding (evm_decode). Only use raw log decode if no pre-built table exists for that event.
For each script, follow this process:
Read the entity definition from schema.graphql to understand all fields and their types (BigInt, BigDecimal, Int, String, etc.)
Trace the mapping logic by finding:
The createOrLoad* helper function in src/mappings/helpers/helpers.ts (shows entity ID format, initial values)
Every handler in src/mappings/*.ts that modifies the entity's fields (search for entity.fieldName = or entity.fieldName.plus/minus)
Pay attention to: which events update which fields, whether fields are cumulative (+=) vs current (net balance) vs SET (overwrite), and any sequential/state-dependent calculations
Compare the script's logic against the subgraph mappings field-by-field:
Is the GROUP BY correct? (e.g., Signal is per (curator, deployment), not just per curator)
Are the right events included? (e.g., totalSignalledTokens on Curator comes from BOTH Curation and GNS events)
Are the signs correct? (positive for mint/deposit, negative for burn/withdraw)
Is it tokens - curationTax or just tokens?
Is createdAt using MIN(timestamp) (not MAX)?
Are cumulative fields (signalledTokens) vs current-balance fields (signal) handled differently?
Revise the script with these conventions:
Use pre-built data_science/ tables instead of raw evm_decode where possible
Use process_query (not process_query_with_retry)
Remove notebook artifacts (# In[N]:, pd.set_option, diagnostic lines like .head(), .isnull().sum(), len())
Remove unused imports
Add logging (logging.basicConfig, logger = logging.getLogger(__name__))
Compute the entity id field (usually a composite like curatorAddress-deploymentID)
Convert timestamps to datetime with pd.to_datetime(..., unit='s', utc=True)
Use outer joins when merging multiple query results to avoid losing rows
Use contract address constants (e.g., GNS_ADDRESS, CURATION_ADDRESS)
BigQuery upload pattern: bq_client.delete_table(..., not_found_ok=True) then save_or_upload_parquet
Add a docstring comment at the top listing the entity fields and their sources
Report a field-by-field verification table showing what the script computes vs what the subgraph handler does, and flag any known limitations (e.g., vSignal recalculation on subgraph upgrade can't be captured with SUM approach)
Scripts to revise (in sql_python_equivalent/):
[list the specific files you want revised]
Do not add new fields beyond what the entity schema defines (plus useful derived fields like datetime conversions). Focus on correctness of the existing computations.