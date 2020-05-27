import { crypto, ByteArray, Bytes, ipfs, json, BigInt } from '@graphprotocol/graph-ts'
import {
  SubgraphPublished,
  SubgraphUnpublished,
  SubgraphTransferred,
} from '../types/GNS/GNS'
import { NamedSubgraph, Subgraph, SubgraphVersion, Account } from '../types/schema'

import {
  createNamedSubgraph,
  createSubgraph,
  getVersionNumber,
  addQm,
  createAccount,
} from './helpers'

/**
 * @dev handleSubgraphPublished
 * - updates named subgraph, creates if needed
 * - creates subgraph version
 * - creates subgraph, if needed
 * - create account, if needed
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

  // update named subgraph
  let namedSubgraph = NamedSubgraph.load(nameHash.toHexString())
  if (namedSubgraph == null) {
    namedSubgraph = createNamedSubgraph(nameHash, name, event.params.owner, versionID)
  } else {
    let pastVersions = namedSubgraph.pastVersions
    pastVersions.push(namedSubgraph.currentVersion)
    namedSubgraph.pastVersions = pastVersions
    namedSubgraph.currentVersion = versionID
  }
  namedSubgraph.save()

  // update subgraph version
  let subgraphVersion = new SubgraphVersion(versionID)
  subgraphVersion.namedSubgraph = nameHash.toHexString()
  subgraphVersion.subgraph = subgraphID
  subgraphVersion.version = versionNumber.toI32()
  subgraphVersion.createdAt = event.block.timestamp.toI32()
  subgraphVersion.updatedAt = event.block.timestamp.toI32()
  subgraphVersion.unpublished = false

  subgraphVersion.metadataHash = event.params.metadataHash

  let hexHash = addQm(event.params.metadataHash) as Bytes
  let base58Hash = hexHash.toBase58()

  // read subgraph metadata from IPFS
  let getVersionDataFromIPFS = ipfs.cat(base58Hash)
  if (getVersionDataFromIPFS !== null) {
    let data = json.fromBytes(getVersionDataFromIPFS as Bytes).toObject()
    data.get('description')
      ? (subgraphVersion.description = data.get('description').toString())
      : (subgraphVersion.description = '')
    data.get('image')
      ? (subgraphVersion.image = data.get('image').toString())
      : (subgraphVersion.image = '')
    data.get('displayName')
      ? (subgraphVersion.displayName = data.get('displayName').toString())
      : (subgraphVersion.displayName = '')
    data.get('codeRepository')
      ? (subgraphVersion.codeRepository = data.get('codeRepository').toString())
      : (subgraphVersion.codeRepository = '')
    data.get('websiteURL')
      ? (subgraphVersion.websiteURL = data.get('websiteURL').toString())
      : (subgraphVersion.websiteURL = '')
    if (data.get('network')) {
      let networksJSONValue = data.get('network').toArray()
      let networks: Array<string>
      for (let i = 0; i < networksJSONValue.length; i++) {
        networks.push(networksJSONValue[i].toString())
      }
      subgraphVersion.networks = networks
    } else {
      subgraphVersion.networks = []
    }
    // When the subgraph cannot find the ipfs file
  } else {
    subgraphVersion.description = ''
    subgraphVersion.image = ''
    subgraphVersion.displayName = ''
    subgraphVersion.codeRepository = ''
    subgraphVersion.websiteURL = ''
    subgraphVersion.networks = []
  }
  subgraphVersion.save()

  // create subgraph, if needed
  let subgraph = Subgraph.load(subgraphID)
  if (subgraph == null) {
    createSubgraph(subgraphID, event.block.timestamp)
  }

  let accountID = event.params.owner.toHexString()
  let account = Account.load(accountID)
  if (account == null) {
    createAccount(accountID)
  }
}

/**
 * @dev handleSubgraphUnpublished
 * - updates named subgraph.
 * - updates subgraph version
 *    -  To unpublish a subgraph version is to make namedSubgraph and subgraph null
 */
export function handleSubgraphUnpublished(event: SubgraphUnpublished): void {
  // update named subgraph
  let namedSubgraph = NamedSubgraph.load(event.params.nameHash.toHexString())
  let subgraphVersionID = namedSubgraph.currentVersion
  namedSubgraph.currentVersion = null
  namedSubgraph.save()

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
  let namedSubgraph = NamedSubgraph.load(event.params.nameHash.toHexString())
  namedSubgraph.owner = id
  namedSubgraph.save()

  let account = Account.load(id)
  if (account == null) {
    createAccount(id)
  }
}
