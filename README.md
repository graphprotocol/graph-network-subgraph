# Graph Network Subgraph

The Graph Network Subgraph indexes all the contracts used to operate the Graph Network on Ethereum. Currently this involves the following contracts (Alpha version):
- GNS
- Service Registry
- Staking
- Graph Token

Instructions for setting up the environment for deploying the subgraph can be found in the README here https://github.com/graphprotocol/contracts. 

# Query

```graphql
{
  subgraphs {
    id
    name
    owner
    parent {
      id
    }
    children {
      id
    }
    versions {
      id
    }
    metadataHash
    description
    type
    image
    subtitle
    displayName
    githubURL
    websiteURL
    reserveRatio
    totalCurationStake
    totalCurationShares
    totalIndexingStake
    createdAt
    updatedAt
  }
  subgraphVersions {
    id
    subgraph {
      id
    }
    totalCurationStake
    totalIndexingStake
  }
  indexers {
    id
    url
    indexing {
      id
      subgraphID
      tokensStaked
      logoutStartTime
    }
  }
  indexerInfos{
    id
    user{
      id
    }
    subgraphID
    tokensStaked
    logoutStartTime
    
  }
  curators {
    id
    curating{
      id
      subgraphID
      tokensStaked
      shares
    }
  }
  graphTokens{
    id
    total
  }
  accounts{
    id
    balance
  }
}

```