# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview
This is the Graph Network Subgraph repository, which indexes events from The Graph Protocol smart contracts on Ethereum mainnet, testnet networks, and Layer 2 networks like Arbitrum. The subgraph provides a GraphQL API for querying protocol data including staking, delegation, curation, disputes, and more.

## Key Commands

### Building and Code Generation
```bash
# Prepare configuration and generate TypeScript types for a specific network
yarn prepare:mainnet        # For mainnet deployment
yarn prepare:sepolia        # For Sepolia testnet
yarn prepare:arbitrum       # For Arbitrum mainnet
yarn prepare:arbitrum-sepolia  # For Arbitrum Sepolia

# Build the subgraph
yarn build
```

### Testing
```bash
# Run all tests
yarn test

# Run tests for L1 configuration
yarn test-l1

# Run tests for L2 configuration  
yarn test-l2
```

### Linting and Formatting
```bash
# Run ESLint
yarn lint

# Run ESLint with auto-fix
yarn lint-fix

# Check code formatting
yarn prettier

# Format code
yarn prettier-write
```

### Deployment
```bash
# Deploy to different networks (never deploy directly to mainnet)
yarn deploy-mainnet         # Deploy to mainnet (auto-deployed on master branch update)
yarn deploy-arbitrum        # Deploy to Arbitrum
yarn deploy-sepolia         # Deploy to Sepolia testnet
yarn deploy-arbitrum-sepolia # Deploy to Arbitrum Sepolia
```

## Architecture Overview

### Configuration System
The subgraph uses Mustache templating to generate network-specific configurations:
- Contract addresses are generated via TypeScript scripts in `config/` directory
- `subgraph.template.yaml` is processed with network-specific addresses to create `subgraph.yaml`
- Generated files (`subgraph.yaml`, `config/addresses.ts`, `src/types/`) are gitignored

### Core Components

**Data Sources** - Each smart contract has its own mapping file in `src/mappings/`:
- `controller.ts` - Protocol governance and configuration
- `staking.ts` / `horizonStaking.ts` - Indexer staking and delegation
- `curation.ts` - Subgraph curation and signaling
- `disputeManager.ts` / `horizonDisputeManager.ts` - Dispute resolution
- `gns.ts` - Graph Name Service for subgraph publishing
- `rewardsManager.ts` - Reward distribution
- `paymentsEscrow.ts` - Payment escrow for query fees
- `subgraphService.ts` - Subgraph service registry

**Cross-Layer Bridge Support**:
- `l1Gateway.ts` / `l2Gateway.ts` - Token bridging between L1 and L2
- `l1staking.ts` / `l2staking.ts` - Staking bridge handlers
- `l1gns.ts` / `l2gns.ts` - GNS bridge handlers

**Entity Schema** - Defined in `schema.graphql`, key entities include:
- `GraphNetwork` - Global protocol state and parameters
- `GraphAccount` - User accounts (indexers, delegators, curators)
- `Indexer` - Indexer-specific data and allocations
- `Delegator` / `DelegatedStake` - Delegation relationships
- `Subgraph` / `SubgraphDeployment` - Subgraph metadata and deployments
- `Allocation` - Indexer allocations to subgraph deployments
- `Dispute` - Dispute records

### Branch Workflow
- `master` - Production code auto-deployed to mainnet subgraph
- `mainnet-staging` - Testing ground for mainnet updates before merging to master
- `testnet` - Development branch for testnet deployments
- Feature branches should target `mainnet-staging` for mainnet changes

### Testing Strategy
Tests use Matchstick framework and are located in `tests/` directory. The subgraph supports both L1 and L2 test configurations that can be run separately. Tests cover critical mappings and helper functions.

## Important Notes
- Never commit generated files (`subgraph.yaml`, `config/addresses.ts`, `src/types/`)
- Always run the appropriate `prepare:*` command before building or testing
- The subgraph uses specific versions of Graph Protocol contracts from npm
- IPFS metadata fetching can be toggled via `prep:ipfs` and `prep:no-ipfs` commands
- When master branch is updated, it automatically deploys to the hosted service