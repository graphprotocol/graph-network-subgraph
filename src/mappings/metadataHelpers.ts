import { json, ipfs, Bytes, JSONValueKind, log } from '@graphprotocol/graph-ts'
import { GraphAccount, Subgraph, SubgraphVersion, SubgraphDeployment } from '../types/schema'
import { jsonToString } from './utils'
import { createOrLoadSubgraphCategory, createOrLoadSubgraphCategoryRelation, createOrLoadNetwork } from './helpers'

export function fetchGraphAccountMetadata(graphAccount: GraphAccount, ipfsHash: string): void {
}

export function fetchSubgraphMetadata(subgraph: Subgraph, ipfsHash: string): Subgraph {
<<<<<<< HEAD
  let metadata = ipfs.cat(ipfsHash)
  if (metadata !== null) {
    let tryData = json.try_fromBytes(metadata as Bytes)
    if (tryData.isOk) {
      let data = tryData.value.toObject()
      subgraph.description = jsonToString(data.get('description'))
      subgraph.image = jsonToString(data.get('image'))
      subgraph.displayName = jsonToString(data.get('displayName'))
      subgraph.codeRepository = jsonToString(data.get('codeRepository'))
      subgraph.website = jsonToString(data.get('website'))
      let categories = data.get('categories')

      if(categories != null) {
        let categoriesArray = categories.toArray()

        for(let i = 0; i < categoriesArray.length; i++) {
          let categoryId = jsonToString(categoriesArray[i])
          createOrLoadSubgraphCategory(categoryId)
          createOrLoadSubgraphCategoryRelation(categoryId, subgraph.id)
        }
      }
    }
  }
=======
>>>>>>> Add in token lock wallets to the core subgraph
  return subgraph
}

export function fetchSubgraphVersionMetadata(subgraphVersion: SubgraphVersion, ipfsHash: string): SubgraphVersion {
  return subgraphVersion
}

export function fetchSubgraphDeploymentManifest(deployment: SubgraphDeployment, ipfsHash: string): SubgraphDeployment {
  let getManifestFromIPFS = ipfs.cat(ipfsHash)
  if (getManifestFromIPFS !== null) {
    deployment.manifest = getManifestFromIPFS.toString()

    let manifest = deployment.manifest
    // we take the right side of the split, since it's the one which will have the schema ipfs hash
    let schemaSplit = manifest.split('schema:\n', 2)[1]
    let schemaFileSplit = schemaSplit.split('/ipfs/', 2)[1]
    let schemaIpfsHash = schemaFileSplit.split('\n', 2)[0]
    deployment.schemaIpfsHash = schemaIpfsHash

    let getSchemaFromIPFS = ipfs.cat(schemaIpfsHash)
    if (getSchemaFromIPFS !== null) {
      deployment.schema = getSchemaFromIPFS.toString()
    }

    // We get the first occurrence of `network` since subgraphs can only have data sources for the same network
    let networkSplit = manifest.split('network: ', 2)[1]
    let network = networkSplit.split('\n', 2)[0]

    createOrLoadNetwork(network)
    deployment.network = network
  }
  return deployment as SubgraphDeployment
}
