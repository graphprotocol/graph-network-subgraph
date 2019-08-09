A subgraph for the Graph Explorer, which only interacts with the GNS. Only running on Ganache right now for testing. 

Run the `setup.js` file in the `/scripts` folder. This will setup the the Graph Network contracts on the ganache testnet. 

Note that right now you need to reset the graph node and ganache, and drop and create the db in order to test again, everytime you want to test. 
 
A better solution will be made in the future that streamlines this process. 


# Query

```graphql
{
  accounts{
    id
    metadataHash
  }
  subgraphs{
    id
    name
    owner
    parent{
      id
    }
    children{
      id
    }
    versions{
      id
    }
    metadataHash
    description
    type
    image
    subtitle
    displayName
    githubUrl
    # curators
    # indexers
    reserveRatio
    totalCurationStake
    totalCurationShares
    totalIndexingStake
    
  }
  subgraphVersions{
    id
    subgraph{
      id
    }
    totalCurationStake
    totalIndexingStake
  }
}
```