## Documentation

This file outlines nuances of the subgraph, and help shed light on some of the fields and types in
the schema.

## Schema Types

All types have their descriptions in the file `schema.graphql`. It was done this was so that
exploring the Subgraph with a GraphQL interface  like GraphiQL will show the descriptions.

## CUMULATIVE fields and CURRENT fields

In the descriptions of some fields, they are first labeled with CUMULATIVE or CURRENT. Each is
described below:
- CUMULATIVE - This is a field that continually sums a number, and never subtracts. For example,
  `curator.totalSignalledTokens` will only be added to, each time the curator signals some tokens.
- CURRENT - Current represents the true value of something stored on the blockchain. For example,
  `subgraphDeployment.stakedTokens` stores how many tokens are currently staked on a subgraph
  deployment. 

The reason for having these two so deliberatly pointed out, is to make it clear. There are
situations where you want to use a CUMULATIVE value for statistics, and so we label it to make
it clearer.

## Handling GRT and Other Big Numbers

GRT has 18 decimals, meaning on Ethereum, `1 GRT` is really represented as 
`1,000,000,000,000,000,000 GRT`. Therefore many of the numbers in the subgraph come out very big.
These numbers should be handled by anyone using the subgraph.

The result of these big numbers is that other fields that may represent ratios, or other values,
also have many decimal places. These should all be understood by the consumer of the subgraph.

## Network Issuance rate

Network Issuance is stored in an interesting way, and it is worth pointing out in more detail
here. To have an issuance rate of `3%`, one would do the following:

```
normalizedIssuanceRate = (networkGRTIssuance * 10^-18)^(blocksPerYear)
networkGRTIssuance = 1000000012184945188        // value from the subgraph
blocksPerYear = (365*60*60*24)/13  = 2425846.15 // A year in seconds, divided by Ethereum block time, ~13 seconds
networkGRTIssuance = 1.000000012184945188^(2425846.15) 
networkGRTIssuance = 1.03
```

The reason it is done this way is because each block that passes allows for more GRT to be minted
by the Rewards Manager, and thus we calculate the issuance based on blocks.


## Fields using Parts Per Million (ppm)

There are multiple fields that use Parts Per Million. This was chosen due to limitations of the
EVM. For example, a `protocolFeePercentage` of `1%` would be calculated like so:

```
protocolPercentage = 10,000 // value from the subgraph
normalizedProtocolPercentage = 10,000 / 1,000,000 = 0.01 = 1%
```

## Subgraph Versions

There is a field on `SubgraphVersion` named `label` which allows the subgraph developer to
provide a semantic version such as `v1.0.0` that is uploaded to IPFS. This allows the developer
to be in control of how they want to label their subgraph with a version.

This is different from the `subgraph.version`, which is just a counter for the number of
versions that have been created for a `Subgraph`. The subgraph developer need not worry about
this field, as it is used to created a UUID to store `SubgraphVersions`.