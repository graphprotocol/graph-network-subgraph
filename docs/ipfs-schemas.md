
# IPFS Schemas

## Account Schema

This describes a basic account for the Explorer Dapp. This data is linked to an Ethereum account through an event emitted by the GNS. 

```javascript
{
    schemaId: "account_0.0.1",
    name: "davekaj",
    displayName: "Dave K",
    photo: "photo-string-here",
    accessToken: "123e9da7c87dd6e4ef4fc050e62df3be3d3209d834ce86cfb11c3",
}
```

### Required Fields:

| | |
|----|-----|
|**schemaId** | Must be set to `account_0.0.1` |
|**dappSchemaId** | The account name |
|**listingType** | The account display name |
|**accessToken** | Currently the access token is stored here unencrypted, but this will definetly change in later versions  |

### Optional Fields

| | |
|----|-----|
|**photo** | Photo is not required.|


## Organization Schema

This describes a organization account for the Explorer Dapp. This data is linked to an Ethereum account through an event emitted by the GNS. 

```javascript
{
    schemaId: "organization_0.0.1",
    name: "graphprotocol",
    displayName: "The Graph",
    photo: "photo-string-here",
    accessToken: "123e9da7c87dd6e4ef4fc050e62df3be3d3209d834ce86cfb11c3",
}
```

### Required Fields:

| | |
|----|-----|
|**schemaId** | Must be set to `account_0.0.1` |
|**dappSchemaId** | The account name |
|**listingType** | The account display name |
|**accessToken** | Currently the access token is stored here unencrypted, but this will definetly change in later versions  |

### Optional Fields

| | |
|----|-----|
|**photo** | Photo is not required.|

## Subgraph Schema

This describes a basic account for the Explorer Dapp. This data is linked to an Ethereum account through an event emitted by the GNS. 

```javascript
{
    name: "uniswap",
    displayName: "Uniswap",
    image: "photo-string-here",
    featured: "true",
    draft: "false",
    subtitle: "Uniswap is a decentralized protocol for automated token exchange on Ethereum",
    description: "The subgraph tracks event based data, which updates each exchange to index the live data. It also stores historical data entities, which can be used, and queried to build historical data, which can be used for charts.",
    accountID: "0xd9e2ab07df0795f25dbe062783b8b35e20ec1df7",
    accountName: "davekaj"
}
```

### Required Fields:

| | |
|----|-----|
|**name** | Name of the subgraph |
|**displayName** | Name displayed in the dapp |
|**image** | Photo string for the subgraph |
|**featured** | Boolean determining if the subgraph shows up in featured subgraphs. |
|**draft** | Boolean determining if the subgraph is a draft or published|
|**accountID** | The ethereum account that owns and deployed this subgraph. |
|**accountName** |  The name associated with the ethereum account|

### Optional Fields

| | |
|----|-----|
|**subtitle** | A short explanation about what the subgraph does|
|**description** | A detailed description of the subgraph explaining the features and functionality|