# Graph Network Subgraph

This repository contains the code for the Graph Network Subgraph. The mainnet version of the
[subgraph can be explored through the playground here](https://thegraph.com/explorer/subgraph/graphprotocol/graph-network-mainnet?version=pending).

# Contributing to the repository

Contributions are always welcome! Likely you will want to create a PR against `mainnet-staging`. If you are unsure you can always reach out to us on discord.
## Submitting bugs

Please submit bugs as an issue in this repository.
## Maintaining the repository

This repository has three different configurations for the `testnet`, `mainnet`, and 
`mainnet-staging` subgraphs. These can be seen in the npm scripts.

We are using `mustache` to configure two different `subgraph.yaml` manifests. Each manifest
will have different contract addresses populated depending on whether we are using rinkeby or
mainnet. Ensure the npm package for `@graphprotocol/contracts` is set to the newest rinkeby
or mainnet package, [which you can find here](https://www.npmjs.com/package/@graphprotocol/contracts).


The setup for each branch is:

```
master -            The code on master will always match the subgraph deployed to 
                    graph-network-mainnet in the explorer, as well as the version of the subgraph
                    the gateway is using. All code must be reviewed before merging to master.
                    The front end team should also confirm mainnet-staging works before the
                    master branch can be updated.
                    When master is updated a hook will automatically deploy the subgraph to the
                    hosted service.

mainnet-staging -   This branch will be where mainnet subgraph updates are tested. We will let the
                    subgraph sync here, and confirm it works, before merging into master. 

testnet -           This branch will contain the testnet subgraph. Development work can be done 
                    here first, and then the commits brought into mainnet-staging. In general
                    it is likely this branch will be used more for new features that might not work
                    on mainnet-staging, such as contract upgrades. Then the new work would have
                    to be merged into mainnet-staging when it is appropriate to do so.

```

In general, the workflow should be:
- Develop on `mainnet-staging` and get it working, merge to `master` and the hook will auto deploy
  to the hosted service
- `testnet` can be rebased on top of `master` or `mainnet-staging`, with a single commit that
  changes the contracts package imported ny npm. `testnet` can also diverge onto it's own branch
  path if it has contract updates that do not yet exist on `mainnet`. And then care will have to
  be taken to cherry-pick these updates into `master` when the contract updates are on `mainnet`.

### Versioning

Everytime a new release is merged into `master` there will be a new github release, following semantic versioning.

# Deploying the subgraph

The deployment manifest IPFS handler uses the native YAML API from `graph-ts` 0.38.2
and requires **Graph Node 0.40.2 or newer** to resolve schema references directly,
including IPFS URIs and gateway/RPC URLs. Malformed manifests retain their raw
content. `startBlock` defaults to `0` and `poweredBySubstreams` to `false` when they
cannot be determined; missing or invalidly typed network/schema fields remain unset.
Extracted network and schema-reference strings are trimmed, bounded in length, and
checked for embedded control characters. Schema references are otherwise treated as
opaque metadata: Graph Node resolves the original reference and logs/skips invalid
IPFS sources. Common IPFS prefixes and simple gateway paths are normalized only for
metadata and entity IDs; URL query/fragment syntax is retained. A schema reference
can be present even if the schema file cannot be resolved. Schema entity IDs over
2048 UTF-8 bytes are hashed to stay within database index limits; reference metadata
is retained. Consumers must escape
metadata appropriately when displaying text or constructing links.

The npm scripts are set up to deploy the subgraphs in one command. Mainnet is connected to a hook
where it will be deployed automatically when the `master` branch is updated. Therefore, we never
have to use npm scripts to directly deploy to `graph-network-mainnet`.
### Mainnet Staging
```
yarn deploy-mainnet-staging
```

### Testnet
```
yarn deploy-testnet
```

### Testing the subgraph

If you need to test the subgraph on your personal account for the explorer (which you will have
to do if you are not part of the `graphprotocol` organization) you can run the following script:
```
yarn deploy-testing
```
Note that you will have to fill in your own subgraph name in the npm script, where it says
`<INSERT_SUBGRAPH_NAME>`. Depending if you are deploying to rinkeby or mainnet, you will also
have to fill in `prepare:rinkeby` or `prepare:mainnet` where it has `<INSERT_MAINNET_OR_RINKEBY>`.

## Documentation

For documentation on the subgraph, please see [DOCUMENTATION.md](./DOCUMENTATION.md).

This will outline nuances of the subgraph, and help shed light on some of the fields and types in
the schema.

## Copyright

Copyright &copy; 2020 The Graph Foundation.

Licensed under the [MIT license](./LICENSE).
