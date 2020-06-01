import { crypto, ByteArray, Bytes, ipfs, json, BigInt } from '@graphprotocol/graph-ts'
import { SubgraphPublished, SubgraphUnpublished, SubgraphTransferred } from '../types/GNS/GNS'
import { Subgraph, SubgraphDeployment, SubgraphVersion, EthereumAccount } from '../types/schema'

import { jsonToString } from './utils'
import {
  createSubgraph,
  createSubgraphDeployment,
  getVersionNumber,
  addQm,
  createEthereumAccount,
} from './helpers'

// TODO - this isn't really in sync because I am in the middle of updating the GNS
// and there is no point in making this work with old code
// such as names being the basis for a Subgraph ID

/**
 * @dev handleSubgraphPublished - Publishes a SubgraphVersion. If it is the first SubgraphVersion,
 *                                it will also create the Subgraph
 * - Updates subgraph, creates if needed
 * - Creates subgraph version
 * - Creates subgraph deployment, if needed
 * - Create ethereum account, if needed
 */
export function handleSubgraphPublished(event: SubgraphPublished): void {
  let name = event.params.name
  let nameHash = crypto.keccak256(ByteArray.fromUTF8(name))
  let subgraphID = event.params.subgraphID.toHexString()
  let versionNumber = getVersionNumber(name, subgraphID, BigInt.fromI32(1))
  let versionID = name
    .concat('-')
    .concat(subgraphID)
    .concat('-')
    .concat(versionNumber.toString())

  // Update subgraph
  let subgraph = Subgraph.load(nameHash.toHexString())
  if (subgraph == null) {
    subgraph = createSubgraph(nameHash, name, event.params.owner, versionID, event.block.timestamp)
  } else {
    // It could have been unpublished. This allows for implicit unpublishing
    if (subgraph.currentVersion != null) {
      let pastVersions = subgraph.pastVersions
      pastVersions.push(subgraph.currentVersion)
      subgraph.pastVersions = pastVersions
    }
    subgraph.currentVersion = versionID
  }

  // IPFS hash contains SubgraphVersion metadata, as well as Subgraph metadata
  // Subgraph metadata is always updated completely, with the JSON upload having
  // all fields existing, even if the update is the exact same.
  let versionDescription = ''
  let label = ''

  let hexHash = addQm(event.params.metadataHash) as Bytes
  let base58Hash = hexHash.toBase58()
  let getVersionDataFromIPFS = ipfs.cat(base58Hash)
  if (getVersionDataFromIPFS !== null) {
    let data = json.fromBytes(getVersionDataFromIPFS as Bytes).toObject()
    subgraph.metadataHash = event.params.metadataHash
    subgraph.description = jsonToString(data.get('versionDesciption'))
    subgraph.image = jsonToString(data.get('image'))
    subgraph.name = jsonToString(data.get('name'))
    subgraph.codeRepository = jsonToString(data.get('codeRepository'))
    subgraph.website = jsonToString(data.get('website'))
    versionDescription = jsonToString(data.get('versionDesciption'))
    label = jsonToString(data.get('label'))
  }
  subgraph.save()

  // Create subgraph version
  let subgraphVersion = new SubgraphVersion(versionID)
  subgraphVersion.subgraph = nameHash.toHexString()
  subgraphVersion.subgraphDeployment = subgraphID
  subgraphVersion.version = versionNumber.toI32()
  subgraphVersion.createdAt = event.block.timestamp.toI32()
  subgraphVersion.updatedAt = event.block.timestamp.toI32()
  subgraphVersion.unpublished = false
  subgraphVersion.metadataHash = event.params.metadataHash
  subgraphVersion.description = versionDescription
  subgraphVersion.label = label
  subgraphVersion.save()

  // Create subgraph deployment, if needed
  // This can happen if the deployment has never been staked on
  let deployment = SubgraphDeployment.load(subgraphID)
  if (deployment == null) {
    createSubgraphDeployment(subgraphID, event.block.timestamp)
  }

  // Create Ethereum Account, if needed
  let accountID = event.params.owner.toHexString()
  let account = EthereumAccount.load(accountID)
  if (account == null) {
    createEthereumAccount(accountID)
  }
}

/**
 * @dev handleSubgraphUnpublished
 * - updates named subgraph
 * - updates subgraph version
 *    -  To unpublish a subgraph version is to make subgraph and subgraph null
 */
export function handleSubgraphUnpublished(event: SubgraphUnpublished): void {
  // update named subgraph
  let subgraph = Subgraph.load(event.params.nameHash.toHexString())
  let subgraphVersionID = subgraph.currentVersion
  subgraph.currentVersion = null
  subgraph.save()

  // update subgraph version
  let subgraphVersion = SubgraphVersion.load(subgraphVersionID)
  subgraphVersion.unpublished = true
  subgraphVersion.save()
}

/**
 * @dev handleSubgraphTransferred
 * - updates named subgraph
 */
export function handleSubgraphTransferred(event: SubgraphTransferred): void {
  let id = event.params.to.toHexString()

  // update named subgraph
  let subgraph = Subgraph.load(event.params.nameHash.toHexString())
  subgraph.owner = id
  subgraph.save()

  // create Ethereum Account, if needed
  let account = EthereumAccount.load(id)
  if (account == null) {
    createEthereumAccount(id)
  }
}
