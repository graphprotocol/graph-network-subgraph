import { Bytes, ipfs, json } from '@graphprotocol/graph-ts'
import { SubgraphPublished, SubgraphDeprecated } from '../types/GNS/GNS'

import { Subgraph, SubgraphVersion } from '../types/schema'

import { jsonToString } from './utils'
import {
  createOrLoadSubgraphDeployment,
  createOrLoadGraphAccount,
  addQm,
  resolveName,
  createOrLoadSubgraph,
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
  let graphAccountID = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = graphAccountID.concat('-').concat(subgraphNumber)
  let versionID: string
  let versionNumber: number

  // Update subgraph
  let subgraph = createOrLoadSubgraph(subgraphID, event.params.graphAccount, event.block.timestamp)

  // If null, it is deprecated, and no need to push into past version, or it was just created
  if (subgraph.currentVersion != null) {
    let pastVersions = subgraph.pastVersions
    pastVersions.push(subgraph.currentVersion)
    subgraph.pastVersions = pastVersions
  }
  versionNumber = subgraph.pastVersions.length
  versionID = subgraphID.concat('-').concat(versionNumber.toString())
  subgraph.currentVersion = versionID

  // Creates Graph Account, if needed
  createOrLoadGraphAccount(
    graphAccountID,
    event.params.graphAccount,
    event.block.timestamp,
  )

  // Resolve name
  resolveName(
    event.params.graphAccount,
    event.params.name,
    event.params.nameIdentifier,
  )

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
      subgraph.displayName = jsonToString(data.get('subgraphDisplayName'))
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
  subgraphVersion.version = versionNumber as i32
  subgraphVersion.createdAt = event.block.timestamp.toI32()
  subgraphVersion.metadataHash = event.params.metadataHash
  subgraphVersion.description = versionDescription
  subgraphVersion.label = label
  subgraphVersion.save()

  // Create subgraph deployment, if needed. Can happen if the deployment has never been staked on
  createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp)
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
  let pastVersions = subgraph.pastVersions
  pastVersions.push(subgraph.currentVersion)
  subgraph.pastVersions = pastVersions
  subgraph.currentVersion = null
  subgraph.save()
}
