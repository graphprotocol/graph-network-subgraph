import { json, ipfs, Bytes, JSONValueKind, log } from '@graphprotocol/graph-ts'
import { GraphAccount, Subgraph, SubgraphVersion, SubgraphDeployment } from '../types/schema'
import { jsonToString } from './utils'
import { createOrLoadSubgraphCategory, createOrLoadSubgraphCategoryRelation, createOrLoadNetwork } from './helpers/helpers'

export function fetchGraphAccountMetadata(graphAccount: GraphAccount, ipfsHash: string): void {
  {{#ipfs}}
  let ipfsData = ipfs.cat(ipfsHash)
  if (ipfsData !== null) {
    let tryData = json.try_fromBytes(ipfsData as Bytes)
    if(tryData.isOk) {
      let data = tryData.value.toObject()
      graphAccount.codeRepository = jsonToString(data.get('codeRepository'))
      graphAccount.description = jsonToString(data.get('description'))
      graphAccount.image = jsonToString(data.get('image'))
      graphAccount.displayName = jsonToString(data.get('displayName'))
      let isOrganization = data.get('isOrganization')
      if (isOrganization != null && isOrganization.kind === JSONValueKind.BOOL) {
        graphAccount.isOrganization = isOrganization.toBool()
      }
      graphAccount.website = jsonToString(data.get('website'))
      graphAccount.save()

      // Update all associated vesting contract addresses
      let tlws = graphAccount.tokenLockWallets
      for (let i = 0; i < tlws.length; i++) {
        let tlw = GraphAccount.load(tlws[i])!
        tlw.codeRepository = graphAccount.codeRepository
        tlw.description = graphAccount.description
        tlw.image = graphAccount.image
        tlw.displayName = graphAccount.displayName
        if (isOrganization != null && isOrganization.kind === JSONValueKind.BOOL) {
          tlw.isOrganization = isOrganization.toBool()
        }
        tlw.website = graphAccount.website
        tlw.save()
      }
    }
  }
  {{/ipfs}}
}

export function fetchSubgraphMetadata(subgraph: Subgraph, ipfsHash: string): Subgraph {
  {{#ipfs}}
  let metadata = ipfs.cat(ipfsHash)
  if (metadata !== null) {
    let tryData = json.try_fromBytes(metadata as Bytes)
    if (tryData.isOk) {
      let data = tryData.value.toObject()
      subgraph.description = jsonToString(data.get('description'))
      subgraph.displayName = jsonToString(data.get('displayName'))
      subgraph.codeRepository = jsonToString(data.get('codeRepository'))
      subgraph.website = jsonToString(data.get('website'))
      let categories = data.get('categories')

      if(categories != null && !categories.isNull()) {
        let categoriesArray = categories.toArray()

        for(let i = 0; i < categoriesArray.length; i++) {
          let categoryId = jsonToString(categoriesArray[i])
          createOrLoadSubgraphCategory(categoryId)
          createOrLoadSubgraphCategoryRelation(categoryId, subgraph.id)
          if(subgraph.linkedEntity != null) {
            createOrLoadSubgraphCategoryRelation(categoryId, subgraph.linkedEntity!)
          }
        }
      }
      let image = jsonToString(data.get('image'))
      let subgraphImage = data.get('subgraphImage')
      if (subgraphImage != null && subgraphImage.kind === JSONValueKind.STRING)  {
        subgraph.nftImage = image
        subgraph.image = jsonToString(subgraphImage)
      } else {
        subgraph.image = image
      }
    }
  }
  {{/ipfs}}
  return subgraph
}

export function fetchSubgraphVersionMetadata(subgraphVersion: SubgraphVersion, ipfsHash: string): SubgraphVersion {
  {{#ipfs}}
  let getVersionDataFromIPFS = ipfs.cat(ipfsHash)
  if (getVersionDataFromIPFS !== null) {
    let tryData = json.try_fromBytes(getVersionDataFromIPFS as Bytes)
    if (tryData.isOk) {
      let data = tryData.value.toObject()
      subgraphVersion.description = jsonToString(data.get('description'))
      subgraphVersion.label = jsonToString(data.get('label'))
    } else {
      subgraphVersion.description = ''
      subgraphVersion.label = ''
    }
  }
  {{/ipfs}}
  return subgraphVersion
}

export function fetchSubgraphDeploymentManifest(deployment: SubgraphDeployment, ipfsHash: string): SubgraphDeployment {
  {{#ipfs}}
  let getManifestFromIPFS = ipfs.cat(ipfsHash)
  if (getManifestFromIPFS !== null) {
    deployment.manifest = getManifestFromIPFS.toString()

    let manifest = deployment.manifest!
    // we take the right side of the split, since it's the one which will have the schema ipfs hash
    let schemaSplitTry = manifest.split('schema:\n', 2)
    if (schemaSplitTry.length == 2) {
      let schemaSplit = schemaSplitTry[1]

      let schemaFileSplitTry = schemaSplit.split('/ipfs/', 2)
      if (schemaFileSplitTry.length == 2) {
        let schemaFileSplit = schemaFileSplitTry[1]

        let schemaIpfsHashTry = schemaFileSplit.split('\n', 2)
        if (schemaIpfsHashTry.length == 2) {
          let schemaIpfsHash = schemaIpfsHashTry[0]
          deployment.schemaIpfsHash = schemaIpfsHash

          let getSchemaFromIPFS = ipfs.cat(schemaIpfsHash)
          if (getSchemaFromIPFS !== null) {
            deployment.schema = getSchemaFromIPFS.toString()
          }
        } else {
          log.warning("[MANIFEST PARSING FAIL] Deployment: {}, schema file hash can't be retrieved. Error: schemaIpfsHashTry.length isn't 2, actual length: {}", [ipfsHash, schemaIpfsHashTry.length.toString()])
        }
      } else {
        log.warning("[MANIFEST PARSING FAIL] Deployment: {}, schema file hash can't be retrieved. Error: schemaFileSplitTry.length isn't 2, actual length: {}", [ipfsHash, schemaFileSplitTry.length.toString()])
      }
    } else {
      log.warning("[MANIFEST PARSING FAIL] Deployment: {}, schema file hash can't be retrieved. Error: schemaSplitTry.length isn't 2, actual length: {}", [ipfsHash, schemaSplitTry.length.toString()])
    }

    // We get the first occurrence of `network` since subgraphs can only have data sources for the same network
    let networkSplitTry = manifest.split('network: ', 2)
    if (networkSplitTry.length == 2) {
      let networkSplit = networkSplitTry[1]
      let networkTry = networkSplit.split('\n', 2)
      if (networkTry.length == 2) {
        let network = networkTry[0]

        createOrLoadNetwork(network)
        deployment.network = network
      } else {
        log.warning("[MANIFEST PARSING FAIL] Deployment: {}, network can't be parsed. Error: networkTry.length isn't 2, actual length: {}", [ipfsHash, networkTry.length.toString()])
      }
    } else {
      log.warning("[MANIFEST PARSING FAIL] Deployment: {}, network can't be parsed. Error: networkSplitTry.length isn't 2, actual length: {}", [ipfsHash, networkSplitTry.length.toString()])
    }
  }
  {{/ipfs}}
  return deployment as SubgraphDeployment
}
