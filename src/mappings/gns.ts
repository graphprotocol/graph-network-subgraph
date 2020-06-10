import { Bytes, ipfs, json, BigInt, log } from '@graphprotocol/graph-ts'
import { SubgraphPublished, SubgraphDeprecated, GNS } from '../types/GNS/GNS'


import { Subgraph, SubgraphDeployment, SubgraphVersion, GraphAccount } from '../types/schema'

import { jsonToString } from './utils'
import {
  createSubgraph,
  createSubgraphDeployment,
  createGraphAccount,
  getVersionNumber,
  addQm,
  simpleNamehash,
  verifyName
} from './helpers'

/**
 * @dev handleSubgraphPublished - Publishes a SubgraphVersion. If it is the first SubgraphVersion,
 * it will also create the Subgraph
 * - Updates subgraph, creates if needed
 * - Creates subgraph version
 * - Creates subgraph deployment, if needed
 * - creates graph account, if needed
 */
export function handleSubgraphPublished(event: SubgraphPublished): void {
  let graphAccount = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = graphAccount.concat('-').concat(subgraphNumber)

  let versionNumber = getVersionNumber(graphAccount, subgraphNumber, BigInt.fromI32(1))
  let versionID = subgraphID.concat('-').concat(versionNumber.toString())

  // Resolve name
  let name = simpleNamehash(event.params.name, event.params.nameIdentifier.toHexString())

  // Verify name
  name = verifyName(graphAccount, name, event.params.nameIdentifier)

  // When name is not null, it is proven it is owned
  // Next, we must make sure that the name is not already in use
  // If it is, name is set to null
  if (name != null) {
    let gns = GNS.bind(event.address)
    let subgraphCount = gns.graphAccountSubgraphNumbers(event.params.graphAccount).toI32()
    for (let i = 0; i < subgraphCount; i++) {
      let counter = BigInt.fromI32(i).toString()
      let checkSubgraph = Subgraph.load(graphAccount.concat('-').concat(counter))
      if (checkSubgraph.name == name) {
        name = null
        break
      }
    }
  }

  // Update subgraph
  let subgraph = Subgraph.load(subgraphID)
  if (subgraph == null) {
    subgraph = createSubgraph(
      subgraphNumber,
      event.params.graphAccount,
      versionID,
      event.block.timestamp,
    )
  } else {
    // If null, it is unpublished, and no need to push into past version
    if (subgraph.currentVersion != null) {
      let pastVersions = subgraph.pastVersions
      pastVersions.push(subgraph.currentVersion)
      subgraph.pastVersions = pastVersions
    }
    subgraph.currentVersion = versionID
  }

  // Set name
  subgraph.name = name

  // IPFS hash contains SubgraphVersion metadata, as well as Subgraph metadata
  // Subgraph metadata is always updated completely, with the JSON upload having
  // all fields existing, even if the update is the exact same.
  let versionDescription = ''
  let label = ''

  let hexHash = addQm(event.params.metadataHash) as Bytes
  let base58Hash = hexHash.toBase58()
  let getVersionDataFromIPFS = ipfs.cat(base58Hash)
  subgraph.metadataHash = event.params.metadataHash
  if (getVersionDataFromIPFS !== null) {
    let tryData = json.try_fromBytes(getVersionDataFromIPFS as Bytes)
    if (tryData.isOk) {
      let data = tryData.value.toObject()
      subgraph.description = jsonToString(data.get('subgraphDescription'))
      subgraph.image = jsonToString(data.get('subgraphImage'))
      subgraph.name = jsonToString(data.get('subgraphName'))
      subgraph.codeRepository = jsonToString(data.get('subgraphCodeRepository'))
      subgraph.website = jsonToString(data.get('subgraphWebsite'))
      versionDescription = jsonToString(data.get('versionDescription'))
      label = jsonToString(data.get('versionLabel'))
    }
  }
  subgraph.save()

  // Create subgraph version
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  let subgraphVersion = new SubgraphVersion(versionID)
  subgraphVersion.subgraph = subgraphID
  subgraphVersion.subgraphDeployment = subgraphDeploymentID
  subgraphVersion.version = versionNumber.toI32()
  subgraphVersion.createdAt = event.block.timestamp.toI32()
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

  // Creates Graph Account, if needed
  let account = GraphAccount.load(graphAccount)
  if (account == null) {
    account = createGraphAccount(graphAccount, event.params.graphAccount)
  }
}

/**
 * @dev handleSubgraphDeprecated
 * - updates subgraph to have no version and no name
 * - deprecates subgraph version
 */
export function handleSubgraphDeprecated(event: SubgraphDeprecated): void {
  let graphAccount = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = graphAccount.concat('-').concat(subgraphNumber)
  let subgraph = Subgraph.load(subgraphID)

  // updates subgraph
  let subgraphVersionID = subgraph.currentVersion
  subgraph.currentVersion = null
  let name = subgraph.name
  if (name != null) {
    let pastNames = subgraph.pastVersionNames
    pastNames.push(name)
    subgraph.pastVersionNames = pastNames
  }
  subgraph.name = null
  subgraph.save()

  // update subgraph version
  let subgraphVersion = SubgraphVersion.load(subgraphVersionID)
  subgraphVersion.unpublished = true
  subgraphVersion.save()
}
