import { crypto, ByteArray, Bytes, ipfs, json } from '@graphprotocol/graph-ts'
import {
  SubgraphPublished,
  SubgraphUnpublished,
  SubgraphTransferred,
} from '../../generated/GNS/GNS'
import { NamedSubgraph, Subgraph, SubgraphVersion } from '../../generated/schema'

import { createNamedSubgraph, createSubgraph, getVersionNumber, addQm } from './helpers'

/**
 * @dev handleSubgraphPublished
 * - updates named subgraph, creates if needed
 * - creates subgraph version
 * - creates subgraph, if needed
 */
export function handleSubgraphPublished(event: SubgraphPublished): void {
  let name = event.params.name
  let nameHash = crypto.keccak256(ByteArray.fromUTF8(name))
  let subgraphID = event.params.subgraphID.toHexString()
  let versionNumber = getVersionNumber(name, subgraphID, '1')
  let versionID = name
    .concat('-')
    .concat(subgraphID)
    .concat('-')
    .concat(versionNumber)

  // update named subgraph
  let namedSubgraph = NamedSubgraph.load(nameHash.toHexString())
  if (namedSubgraph == null) {
    namedSubgraph = createNamedSubgraph(nameHash, name, event.params.owner, versionID)
  } else {
    let pastVersions = namedSubgraph.pastVersions
    if (pastVersions == null) {
      pastVersions = []
    }
    pastVersions.push(namedSubgraph.currentVersion)
    namedSubgraph.pastVersions = pastVersions
    namedSubgraph.currentVersion = versionID
  }
  namedSubgraph.save()

  // update subgraph version
  let subgraphVersion = new SubgraphVersion(versionID)
  subgraphVersion.namedSubgraph = nameHash.toHexString()
  subgraphVersion.subgraph = subgraphID
  subgraphVersion.version = Number(versionNumber)
  subgraphVersion.createdAt = event.block.timestamp
  subgraphVersion.updatedAt = event.block.timestamp

  subgraphVersion.metadataHash = event.params.metadataHash

  let hexHash = addQm(event.params.metadataHash) as Bytes
  let base58Hash = hexHash.toBase58()

  // read subgraph metadata from IPFS
  let getVersionDataFromIPFS = ipfs.cat(base58Hash)
  if (getVersionDataFromIPFS !== null) {
    let data = json.fromBytes(getVersionDataFromIPFS as Bytes).toObject()
    if (data.get('description')) {
      subgraphVersion.description = data.get('description').toString()
    }
    if (data.get('image')) {
      subgraphVersion.image = data.get('image').toString()
    }
    if (data.get('subtitle')) {
      subgraphVersion.subtitle = data.get('subtitle').toString()
    }
    if (data.get('displayName')) {
      subgraphVersion.displayName = data.get('displayName').toString()
    }
    if (data.get('repoAddress')) {
      subgraphVersion.repoAddress = data.get('repoAddress').toString()
    }
    if (data.get('websiteURL')) {
      subgraphVersion.websiteURL = data.get('websiteURL').toString()
    }
    if (data.get('network')) {
      subgraphVersion.network = data.get('network').toString()
    }
  }
  subgraphVersion.save()

  // create subgraph, if needed
  let subgraph = Subgraph.load(subgraphID)
  if (subgraph == null){
    createSubgraph(subgraphID, event.block.timestamp)
  }

}

/**
 * @dev handleSubgraphUnpublished
 * - updates named subgraph
 * - updates subgraph version
 * - updates subgraph
 */
export function handleSubgraphUnpublished(event: SubgraphUnpublished): void {
  
}

/**
 * @dev handleSubgraphTransferred
 * - updates named subgraph
 */
export function handleSubgraphTransferred(event: SubgraphTransferred): void {}
