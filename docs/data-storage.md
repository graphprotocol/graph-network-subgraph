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
accessToken?: string
```
_note - stored in an ethereum mapping, and in the organizations mapping_

*IPFS Metadata*
```
name: string
displayName: string
role: (admin or member)
photo: string
```

*Subgraph only data*
```
subgraphs: [Relational] @accountID
totalSubgraphs: Int!
organizations: [Relational]
```

### Organization Schema


### Subgraph Schema

