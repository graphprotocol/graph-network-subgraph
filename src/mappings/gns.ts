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
  resolveName,
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

  // Update subgraph
  let subgraph = Subgraph.load(subgraphID)
  if (subgraph == null) {
    subgraph = createSubgraph(
      subgraphID,
      event.params.graphAccount,
      versionID,
      event.block.timestamp,
    )
  } else {
    // If null, it is deprecated, and no need to push into past version
    if (subgraph.currentVersion != null) {
      let pastVersions = subgraph.pastVersions
      pastVersions.push(subgraph.currentVersion)
      subgraph.pastVersions = pastVersions
    }
    subgraph.currentVersion = versionID
  }

  // Resolve name
  let graphAccountNameID = resolveName(
    event.params.graphAccount,
    event.params.name,
    event.params.nameIdentifier,
  )
  // let name = checkTLD(event.params.name, event.params.nameIdentifier.toHexString())

  // // Verify name
  // let graphAccountNameID: string
  // if (name != null) {
  //   graphAccountNameID = verifyNameOwnership(graphAccount, name, event.params.nameIdentifier)
  // }
  // // When name is not null, it is proven it is owned
  // // Next, we must make sure that the name is not already in use
  // // We can't check the ID, we need to check the actually STRING, to prevent the same
  // // string being used for one account, but from two different name systems
  // // If it is, name is set to null
  // if (graphAccountNameID != null) {
  //   const words = graphAccountNameID.split('-')
  //   name = words[1]
  //   let gns = GNS.bind(event.address)
  //   let subgraphCount = gns.graphAccountSubgraphNumbers(event.params.graphAccount).toI32()
  //   for (let i = 0; i < subgraphCount; i++) {
  //     let counter = BigInt.fromI32(i).toString()
  //     let checkSubgraph = Subgraph.load(graphAccount.concat('-').concat(counter))
  //     if (checkSubgraph.name == name) {
  //       name = null
  //       break
  //     }
  //   }
  // }

  // Set name
  subgraph.name = graphAccountNameID

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
  subgraphVersion.metadataHash = event.params.metadataHash
  subgraphVersion.description = versionDescription
  subgraphVersion.label = label
  subgraphVersion.save()

  // Create subgraph deployment, if needed
  // This can happen if the deployment has never been staked on
  let deployment = SubgraphDeployment.load(subgraphDeploymentID)
  if (deployment == null) {
    createSubgraphDeployment(subgraphDeploymentID, event.block.timestamp)
  }

  // Creates Graph Account, if needed
  let account = GraphAccount.load(graphAccount)
  if (account == null) {
    account = createGraphAccount(graphAccount, event.params.graphAccount, event.block.timestamp)
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
  subgraph.currentVersion = null
  let name = subgraph.name
  if (name != null) {
    let pastNames = subgraph.pastNames
    pastNames.push(name)
    subgraph.pastNames = pastNames
  }
  subgraph.name = null
  subgraph.save()
}
