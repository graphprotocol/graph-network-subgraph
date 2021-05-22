import { json, ipfs, Bytes, JSONValueKind } from '@graphprotocol/graph-ts'
import { GraphAccount, Subgraph, SubgraphVersion } from '../types/schema'
import { jsonToString } from './utils'

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

export function fetchSubgraphMetadata(subgraph: Subgraph, ipfsHash: string): void {
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
    } else {
      subgraph.description = ''
      subgraph.image = ''
      subgraph.displayName = ''
      subgraph.codeRepository = ''
      subgraph.website = ''
    }
  }
  {{/ipfs}}
}

export function fetchSubgraphVersionMetadata(subgraph: SubgraphVersion, ipfsHash: string): void {
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
}
