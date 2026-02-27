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


query = f''' 
WITH 
tokens_added_event AS (
        SELECT 
            evm_decode(l.topic1, l.topic2, l.topic3, l.data, 'TokensAdded(address indexed user, uint256 amount)') AS event,
            date_trunc('DAY', l.timestamp) AS event_date        
        FROM 
            "edgeandnode/arbitrum_one@0.0.1".logs l
        WHERE 
            l.address = arrow_cast(x'1B07D3344188908Fb6DEcEac381f3eE63C48477a', 'FixedSizeBinary(20)')
            AND l.topic0 = evm_topic('TokensAdded(address indexed user, uint256 amount)')
),
tokens_removed_event AS (
    SELECT 
            evm_decode(l.topic1, l.topic2, l.topic3, l.data, 'TokensRemoved(address indexed from, address indexed to, uint256 amount)') AS event,
            date_trunc('DAY', l.timestamp) AS event_date        
    FROM 
            "edgeandnode/arbitrum_one@0.0.1".logs l
        WHERE 
            l.address = arrow_cast(x'1B07D3344188908Fb6DEcEac381f3eE63C48477a', 'FixedSizeBinary(20)')
            AND l.topic0 = evm_topic('TokensRemoved(address indexed from, address indexed to, uint256 amount)')
),
tokens_pulled_event AS (
        SELECT 
            evm_decode(l.topic1, l.topic2, l.topic3, l.data, 'TokensPulled(address indexed user, uint256 amount)') AS event,
            date_trunc('DAY', l.timestamp) AS event_date        
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
        event_date,
        arrow_cast(event['amount'], 'Float32') as added_amount,
        0 as pulled_amount,
        0 as removed_amount
    FROM tokens_added_event

    UNION ALL

    -- TokensRemoved events
    SELECT 
        event['from'] AS user_id,
        event_date,
        0 as added_amount,
        0 as pulled_amount,
        COALESCE(arrow_cast(event['amount'], 'Float32'), 0) as removed_amount
    FROM tokens_removed_event

    UNION ALL

    -- TokensPulled events
    SELECT 
        event['user'] AS user_id,
        event_date,
        0 as added_amount,
        COALESCE(arrow_cast(event['amount'], 'Float32'), 0) as pulled_amount,
        0 as removed_amount
    FROM tokens_pulled_event
),
daily_balance AS (
    SELECT 
        event_date AS day_end,
        SUM(COALESCE(added_amount, 0) - COALESCE(pulled_amount, 0) - COALESCE(removed_amount, 0)) / POWER(10, 18) AS total_current_balance
    FROM all_events
    GROUP BY event_date
)
SELECT 
    day_end,
    SUM(total_current_balance) OVER (ORDER BY day_end) AS total_current_balance,
    total_current_balance - LAG(total_current_balance, 1, 0) OVER (ORDER BY day_end DESC) AS total_current_balance_delta
FROM daily_balance
ORDER BY day_end DESC;

'''
billing_users = process_query(client, query)
df = billing_users


# In[8]:


df = billing_users
# Assuming df is your DataFrame and 'day_end' is the date column
df['day_end'] = pd.to_datetime(df['day_end'])  # Ensure 'day_end' is a datetime type

# Create a complete date range from the minimum to the maximum date in 'day_end'
full_date_range = pd.date_range(start=df['day_end'].min(), end=df['day_end'].max(), freq='D')

# Reindex the DataFrame to include all dates in the range
df = df.set_index('day_end').reindex(full_date_range).rename_axis('day_end').reset_index()

# Fill missing values by carrying forward the last valid observation
df.fillna(method='ffill', inplace=True)


# In[9]:


from google.cloud import bigquery
from nozzle.util import process_query, save_or_upload_parquet, check_and_delete_table

bq_client = bigquery.Client(project='graph-mainnet')
bq_client.delete_table('graph-mainnet.nozzle.billing_daily_arbitrum', not_found_ok=True)


destination_blob_name = 'path/in/bucket/billing_daily_arbitrum.parquet'
table_id = "billing_daily_arbitrum"
save_or_upload_parquet(df, destination_blob_name, 'upload', table_id, project_id='graph-mainnet')


# In[ ]:




