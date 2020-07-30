import { Bytes, ipfs, json } from '@graphprotocol/graph-ts'
import {
  SubgraphPublished,
  SubgraphDeprecated,
  NameSignalEnabled,
  NSignalMinted,
  NSignalBurned,
  NameSignalUpgrade,
  NameSignalDisabled,
  GRTWithdrawn,
  SubgraphMetadataUpdated,
  SetDefaultName,
} from '../types/GNS/GNS'

import { Subgraph, SubgraphVersion, GraphAccount } from '../types/schema'

import { jsonToString } from './utils'
import {
  createOrLoadSubgraphDeployment,
  createOrLoadGraphAccount,
  addQm,
  resolveName,
  createOrLoadSubgraph,
  joinID,
  createOrLoadNameSignal,
} from './helpers'

export function handleSetDefaultName(event: SetDefaultName): void {
  let graphAccount = GraphAccount.load(event.params.graphAccount.toString())
  graphAccount.defaultName = resolveName(
    event.params.graphAccount,
    event.params.name,
    event.params.nameIdentifier,
  )
  graphAccount.save()
}

export function handleSubgraphMetadataUpdated(event: SubgraphMetadataUpdated): void {
  let graphAccountID = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = joinID([graphAccountID, subgraphNumber])
  let subgraph = createOrLoadSubgraph(subgraphID, event.params.graphAccount, event.block.timestamp)

  let hexHash = addQm(event.params.subgraphMetadata) as Bytes
  let base58Hash = hexHash.toBase58()
  let getVersionDataFromIPFS = ipfs.cat(base58Hash)
  subgraph.metadataHash = event.params.subgraphMetadata
  if (getVersionDataFromIPFS !== null) {
    let tryData = json.try_fromBytes(getVersionDataFromIPFS as Bytes)
    if (tryData.isOk) {
      let data = tryData.value.toObject()
      subgraph.description = jsonToString(data.get('subgraphDescription'))
      subgraph.image = jsonToString(data.get('subgraphImage'))
      subgraph.displayName = jsonToString(data.get('subgraphDisplayName'))
      subgraph.codeRepository = jsonToString(data.get('subgraphCodeRepository'))
      subgraph.website = jsonToString(data.get('subgraphWebsite'))
    }
  }
  subgraph.save()
}

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
  let subgraphID = joinID([graphAccountID, subgraphNumber])
  let versionID: string
  let versionNumber: number

  // Update subgraph
  let subgraph = createOrLoadSubgraph(subgraphID, event.params.graphAccount, event.block.timestamp)

  // If null, it is deprecated, and there is no need to push into past version,
  // or else it was just created and there were no previous versions
  if (subgraph.currentVersion != null) {
    let pastVersions = subgraph.pastVersions
    pastVersions.push(subgraph.currentVersion)
    subgraph.pastVersions = pastVersions
  }
  versionNumber = subgraph.pastVersions.length
  versionID = joinID([subgraphID, versionNumber.toString()])
  subgraph.currentVersion = versionID

  // Creates Graph Account, if needed
  createOrLoadGraphAccount(graphAccountID, event.params.graphAccount, event.block.timestamp)

  subgraph.save()

  // Create subgraph version
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  let subgraphVersion = new SubgraphVersion(versionID)
  subgraphVersion.subgraph = subgraphID
  subgraphVersion.subgraphDeployment = subgraphDeploymentID
  subgraphVersion.version = versionNumber as i32
  subgraphVersion.createdAt = event.block.timestamp.toI32()
  let hexHash = addQm(event.params.versionMetadata) as Bytes
  let base58Hash = hexHash.toBase58()
  let getVersionDataFromIPFS = ipfs.cat(base58Hash)
  subgraphVersion.metadataHash = event.params.versionMetadata
  if (getVersionDataFromIPFS !== null) {
    let tryData = json.try_fromBytes(getVersionDataFromIPFS as Bytes)
    if (tryData.isOk) {
      let data = tryData.value.toObject()
      subgraphVersion.description = jsonToString(data.get('description'))
      subgraphVersion.label = jsonToString(data.get('label'))
    }
  }
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
  let subgraphID = joinID([graphAccount, subgraphNumber])
  let subgraph = Subgraph.load(subgraphID)

  // updates subgraph
  let pastVersions = subgraph.pastVersions
  pastVersions.push(subgraph.currentVersion)
  subgraph.pastVersions = pastVersions
  subgraph.currentVersion = null
  subgraph.save()
}

export function handleNameSignalEnabled(event: NameSignalEnabled): void {
  let graphAccount = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = joinID([graphAccount, subgraphNumber])
  let subgraph = Subgraph.load(subgraphID)

  // Right now we set deploymentID in SubgraphPublished, so only this is needed
  subgraph.reserveRatio = event.params.reserveRatio.toI32()
  subgraph.save()
}

export function handleNSignalMinted(event: NSignalMinted): void {
  let graphAccount = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = joinID([graphAccount, subgraphNumber])
  let subgraph = Subgraph.load(subgraphID)

  subgraph.nameSignalAmount = subgraph.nameSignalAmount.plus(event.params.nSignalCreated)
  // TODO - add tokensDeposited here, when I re-deploy the contracts
  // subgraph.signalledTokens = subgraph.signalledTokens.plus(event.params.tokensDeposited)
  subgraph.save()

  let nameSignal = createOrLoadNameSignal(event.params.nameCurator.toHexString(), subgraphID)
  nameSignal.nameSignal = nameSignal.nameSignal.plus(event.params.nSignalCreated)
  // TODO - add tokensDeposited here, when I re-deploy the contracts
  // nameSignal.signalledTokens = nameSignal.signalledTokens.plus(event.params.tokensDeposited)
  nameSignal.lastNameSignalChange = event.block.timestamp.toI32()
  nameSignal.save()
}

export function handleNSignalBurned(event: NSignalBurned): void {
  let graphAccount = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = joinID([graphAccount, subgraphNumber])
  let subgraph = Subgraph.load(subgraphID)

  subgraph.nameSignalAmount = subgraph.nameSignalAmount.minus(event.params.nSignalBurnt)
  subgraph.unsignalledTokens = subgraph.unsignalledTokens.plus(event.params.tokensReceived)
  subgraph.save()

  let nameSignal = createOrLoadNameSignal(event.params.nameCurator.toHexString(), subgraphID)
  nameSignal.nameSignal = nameSignal.nameSignal.plus(event.params.nSignalBurnt)
  nameSignal.unsignalledTokens = nameSignal.unsignalledTokens.plus(event.params.tokensReceived)
  nameSignal.lastNameSignalChange = event.block.timestamp.toI32()
  nameSignal.save()
}

export function handleNameSignalUpgrade(event: NameSignalUpgrade): void {
  let graphAccount = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = joinID([graphAccount, subgraphNumber])
  let subgraph = Subgraph.load(subgraphID)

  // Weirdly here, we add the token amount to both, but also the name curator owner must
  // stake the withdrawal fees, so both balance fairly
  // TODO - will have to come back here and make sure my thinking is correct
  subgraph.unsignalledTokens = subgraph.unsignalledTokens.plus(event.params.tokensExchanged)
  subgraph.signalledTokens = subgraph.signalledTokens.plus(event.params.tokensExchanged)
  subgraph.save()
}

// Only need to upgrade withdrawable tokens. Everything else handled from
// curation events, or handleGRTWithdrawn
export function handleNameSignalDisabled(event: NameSignalDisabled): void {
  let graphAccount = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = joinID([graphAccount, subgraphNumber])
  let subgraph = Subgraph.load(subgraphID)
  subgraph.withdrawableTokens = event.params.withdrawableGRT
  subgraph.save()
}

export function handleGRTWithdrawn(event: GRTWithdrawn): void {
  let graphAccount = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = joinID([graphAccount, subgraphNumber])
  let subgraph = Subgraph.load(subgraphID)
  subgraph.withdrawnTokens = subgraph.withdrawnTokens.plus(event.params.withdrawnGRT)
  subgraph.nameSignalAmount = subgraph.nameSignalAmount.minus(event.params.nSignalBurnt)
  subgraph.save()

  let nameSignal = createOrLoadNameSignal(event.params.nameCurator.toHexString(), subgraphID)
  nameSignal.withdrawnTokens = event.params.withdrawnGRT
  nameSignal.nameSignal = nameSignal.nameSignal.minus(event.params.nSignalBurnt)
  nameSignal.lastNameSignalChange = event.block.timestamp.toI32()
  nameSignal.save()
}
