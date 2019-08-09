
# IPFS Schemas

## Account Schema
*Not in use yet, need to plan with team.*

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
*Not in use yet, need to plan with team. It may become external, only managed with multi sigs.*

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
    displayName: "Uniswap",
    image: "photo-string-here",
    type: "owned",
    githubURL: "https://github.com/graphprotocol/uniswap-subgraph",
    subtitle: "Uniswap is a decentralized protocol for automated token exchange on Ethereum",
    description: "The subgraph tracks event based data, which updates each exchange to index the live data. It also stores historical data entities, which can be used, and queried to build historical data, which can be used for charts."
}
```

### Required Fields:

| | |
|----|-----|
|**displayName** | Name displayed in the dapp |
|**image** | Photo string for the subgraph |
|**type** | Commons or Owned subgraph |
|**githubURL** | Github url of the subgraph repo|

### Optional Fields

| | |
|----|-----|
|**subtitle** | A short explanation about what the subgraph does|
|**description** | A detailed description of the subgraph explaining the features and functionality|