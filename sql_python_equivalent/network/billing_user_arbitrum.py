#!/usr/bin/env python
# coding: utf-8

# In[7]:


from nozzle.client import Client
from nozzle.util import process_query, save_or_upload_parquet, check_and_delete_table
import pandas as pd
client_url = "grpc+tls://gateway.amp.staging.thegraph.com:443"
client = Client(client_url)
pd.set_option('display.max_rows', None) 
pd.set_option('display.max_columns', None)


# In[8]:


query = f''' 
WITH 
tokens_added_event AS (
        SELECT 
            evm_decode(l.topic1, l.topic2, l.topic3, l.data, 'TokensAdded(address indexed user, uint256 amount)') AS event
        FROM 
            "edgeandnode/arbitrum_one@0.0.1".logs l
        WHERE 
            l.address = arrow_cast(x'1B07D3344188908Fb6DEcEac381f3eE63C48477a', 'FixedSizeBinary(20)')
            AND l.topic0 = evm_topic('TokensAdded(address indexed user, uint256 amount)')
),
tokens_removed_event AS (
    SELECT 
            evm_decode(l.topic1, l.topic2, l.topic3, l.data, 'TokensRemoved(address indexed from, address indexed to, uint256 amount)') AS event        
    FROM 
            "edgeandnode/arbitrum_one@0.0.1".logs l
        WHERE 
            l.address = arrow_cast(x'1B07D3344188908Fb6DEcEac381f3eE63C48477a', 'FixedSizeBinary(20)')
            AND l.topic0 = evm_topic('TokensRemoved(address indexed from, address indexed to, uint256 amount)')
),
tokens_pulled_event AS (
        SELECT 
            evm_decode(l.topic1, l.topic2, l.topic3, l.data, 'TokensPulled(address indexed user, uint256 amount)') AS event
        FROM 
            "edgeandnode/arbitrum_one@0.0.1".logs l
        WHERE 
            l.address = arrow_cast(x'1B07D3344188908Fb6DEcEac381f3eE63C48477a', 'FixedSizeBinary(20)')
            AND l.topic0 = evm_topic('TokensPulled(address indexed user, uint256 amount)')
),
all_events AS (
    -- TokensAdded events
    SELECT 
        event['user'] AS user_id,
        arrow_cast(event['amount'], 'Float32') as added_amount,
        0 as pulled_amount,
        0 as removed_amount
    FROM tokens_added_event

    UNION ALL

    -- TokensRemoved events
    SELECT 
        event['from'] AS user_id,
        0 as added_amount,
        0 as pulled_amount,
        arrow_cast(event['amount'], 'Float32') as removed_amount
    FROM tokens_removed_event

    UNION ALL

    -- TokensPulled events
    SELECT 
        event['user'] AS user_id,
        0 as added_amount,
        arrow_cast(event['amount'], 'Float32') as pulled_amount,
        0 as removed_amount
    FROM tokens_pulled_event
)
SELECT 
    user_id as id,
    SUM(added_amount - pulled_amount - removed_amount) / POWER(10, 18) as billing_balance,
    SUM(added_amount) / POWER(10, 18) as total_tokens_added,
    SUM(pulled_amount) / POWER(10, 18) as total_tokens_pulled,
    SUM(removed_amount) / POWER(10, 18) as total_tokens_removed
FROM all_events
GROUP BY user_id
'''
billing_users = process_query(client, query)


# In[9]:


from google.cloud import bigquery

bq_client = bigquery.Client(project='graph-mainnet')
bq_client.delete_table('graph-mainnet.nozzle.billing_user_arbitrum', not_found_ok=True)


destination_blob_name = 'path/in/bucket/billing_user_arbitrum.parquet'
table_id = "billing_user_arbitrum"
save_or_upload_parquet(billing_users, destination_blob_name, 'upload', table_id, project_id='graph-mainnet')

