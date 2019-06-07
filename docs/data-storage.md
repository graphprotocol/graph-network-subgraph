## How will the data be stored?

There are two ways data can be stored, and ultimately these will both be consumed by the subgraph, making the desired
data available to the front end of the graph-explorer. We will store absolutely necessary data on the ethereum
blockchain. We will store non-necessary, easily editable metadata on IPFS, with the IPFS hash stored on ethereum. 

There are three types of data right now:
- Accounts
- Organizations
- Subgraphs

Some data will be stored on ethereum, and some on IPFS. Some data will only exist within the subgraph, as the subgraph
will be used to derive information from ethereum events, that are only stored as events. 

Their schemas are split up below to show how they are stored:

### Account Schema
*Data on Ethereum*
```
id: string
```
_note - stored in an ethereum mapping, and in the organizations mapping_

*IPFS Metadata*
```
name: string
displayName: string
role: (admin or member) (NOTE - NOTE IN V1)
photo: string
accessToken?: string (note - will have to be encrypted. tbd if it will be stored on IPFS or Ethereum. IPFS for now as we are not encrypting it in V1)
```

*Subgraph only data*
```
subgraphs: [Subgraph!] @derivedFrom(field: accountID)
totalSubgraphs: Int!
organizations: [Organization!] @derivedFrom(field: accountID) (NOTE - NOT IN V1)
```

### Organization Schema

*Data on Ethereum*
```
id: string
```

_note - stored in the organizations mapping_

*IPFS Metadata* 
```
name: string
displayName: string
photo: string
accessToken?: string (note - will have to be encrypted. tbd if it will be stored on IPFS or Ethereum. IPFS for now as we are not encrypting it in V1)
```

*Subgraph only Data*
```
subgraphs: [Relational] @accountID
totalSubgraphs: Int!
```

### Subgraph Schema

*Data on Ethereum*
```
  subgraphId: string
```

_note - the account owner who made it, the subgraphID, and subdomains are linked_

*IPFS Metadata* 
```
  namespace: string (what is this, not in v1 until I know)
  name: string
  displayName: string
  image: string
  featured: boolean
  draft: boolean
  subtitle?: string
  description?: string
  accountID : string
  accountName: string
```
*Subgraph only Data*
```
  createdAt: string (when the name was stored)
  deployedAt?: string (when a subgraph is deployed to the GNS)
  status?: string - (subgraph would know this)
  owner: Account
  subdomainStuff: MULTIPLE
```


### Unsure, not V1 Schemas 

```
SubgraphVersions (versions seem very  different for stats compared to the normal subgraph
  id: string
  createdAt: string
  description: string
  repository: string
  deployment: string
  status: string
  endpoints: SubgraphVersionEndpoints
  entityCount: string
  ethereumNetwork: string
  exampleQuery: string
  processedEthereumBlocks?: string
  totalEthereumBlocks?: string

SavedQuery
  id?: string
  subgraphId: string
  versionId?: string
  name: string
  query: string
```