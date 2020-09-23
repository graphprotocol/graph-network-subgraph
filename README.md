# Graph Network Subgraph

The Graph Network Subgraph.

# Deploying a subgraph

## Testing
```
yarn
yarn deploy-testing
```

### Staging
```
yarn
yarn deploy-staging
```

## Production
```
yarn
yarn deploy-production
```
Then you must inform jannis of the new subgraph ID. This should be done by releasing a new NPM
package! (See below)

> NOTE - you must also update `deployment.json` with the new ID

# NPM package

The npm package lives at:
- `@graphprotocol/testnet-subgraph`

When there is a new subgraph, that is stable, release a new package, and inform the team to update
the NPM package, and then they will have the correct subgraph deployment ID for the network.