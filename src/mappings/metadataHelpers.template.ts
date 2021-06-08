import { json, ipfs, Bytes, JSONValueKind, log } from '@graphprotocol/graph-ts'
import { GraphAccount, Subgraph, SubgraphVersion } from '../types/schema'
import { jsonToString } from './utils'
import { createOrLoadSubgraphCategory, createOrLoadSubgraphCategoryRelation, createOrLoadNetwork } from './helpers'

export function fetchGraphAccountMetadata(graphAccount: GraphAccount, ipfsHash: string): void {
  {{#ipfs}}
  let ipfsData = ipfs.cat(ipfsHash)
  if (ipfsData != null) {
    let data = json.fromBytes(ipfsData as Bytes).toObject()
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
      subgraph.image = jsonToString(data.get('image'))
      subgraph.displayName = jsonToString(data.get('displayName'))
      subgraph.codeRepository = jsonToString(data.get('codeRepository'))
      subgraph.website = jsonToString(data.get('website'))
      let networkId = jsonToString(data.get('network'))
      if(networkId != '') {
        createOrLoadNetwork(networkId)
        subgraph.network = networkId
      }

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
