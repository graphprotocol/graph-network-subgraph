import { BigDecimal, BigInt, Bytes, ipfs, json } from '@graphprotocol/graph-ts'
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

import {
  Subgraph,
  SubgraphVersion,
  NameSignalTransaction,
  Curator,
  Indexer,
  GraphAccountName,
  SubgraphDeployment,
} from '../types/schema'

import { jsonToString, zeroBD } from './utils'
import {
  createOrLoadSubgraphDeployment,
  createOrLoadGraphAccount,
  createOrLoadCurator,
  addQm,
  resolveName,
  createOrLoadSubgraph,
  joinID,
  createOrLoadNameSignal,
} from './helpers'

export function handleSetDefaultName(event: SetDefaultName): void {
  let graphAccount = createOrLoadGraphAccount(
    event.params.graphAccount.toHexString(),
    event.params.graphAccount,
    event.block.timestamp,
  )

  // A name has already been registered
  if (graphAccount.defaultName != null) {
    let graphAccountName = GraphAccountName.load(graphAccount.defaultName)
    // If trying to set the same name, do nothing
    if (graphAccountName.name == event.params.name) {
      return
    }
  }
  let newDefaultName = resolveName(
    event.params.graphAccount,
    event.params.name,
    event.params.nameIdentifier,
  )

  // Edge case - a user sets a correct ID, and then sets an incorrect ID. It should not overwrite
  // the good name with null
  if (newDefaultName != null) {
    graphAccount.defaultName = newDefaultName
    graphAccount.defaultDisplayName = event.params.name

    // And if the GraphAccount changes default name, we should change it on the indexer too.
    // Indexer also has a defaultDisplayName because it helps with filtering.
    let indexer = Indexer.load(event.params.graphAccount.toHexString())
    if (indexer != null) {
      indexer.defaultDisplayName = graphAccount.defaultDisplayName
      indexer.save()
    }
  }
  graphAccount.save()
}

export function handleSubgraphMetadataUpdated(event: SubgraphMetadataUpdated): void {
  let graphAccountID = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = joinID([graphAccountID, subgraphNumber])
  let subgraph = createOrLoadSubgraph(subgraphID, event.params.graphAccount, event.block.timestamp)

  let hexHash = addQm(event.params.subgraphMetadata) as Bytes
  let base58Hash = hexHash.toBase58()
  let metadata = ipfs.cat(base58Hash)
  subgraph.metadataHash = event.params.subgraphMetadata
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
  subgraph.updatedAt = event.block.timestamp.toI32()
  subgraph.save()

  // Add the original subgraph name to the subgraph deployment
  // This is a temporary solution until we can filter on nested queries
  let subgraphVersion = SubgraphVersion.load(subgraph.currentVersion)
  let subgraphDeployment = SubgraphDeployment.load(subgraphVersion.subgraphDeployment)
  // Not super robust, someone could deploy blank, then point a subgraph to here
  // It is more appropriate to say this is the first name 'claimed' for the deployment
  if (subgraphDeployment.originalName == null) {
    subgraphDeployment.originalName = subgraph.displayName
    subgraphDeployment.save()
  }
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
  subgraph.updatedAt = event.block.timestamp.toI32()
  subgraph.save()

  // Create subgraph deployment, if needed. Can happen if the deployment has never been staked on
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp)

  // Create subgraph version
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
    } else {
      subgraphVersion.description = ''
      subgraphVersion.label = ''
    }
  }
  subgraphVersion.save()
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
  subgraph.updatedAt = event.block.timestamp.toI32()
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
  subgraph.signalledTokens = subgraph.signalledTokens.plus(event.params.tokensDeposited)
  subgraph.save()

  let nameSignal = createOrLoadNameSignal(
    event.params.nameCurator.toHexString(),
    subgraphID,
    event.block.timestamp,
  )
  nameSignal.nameSignal = nameSignal.nameSignal.plus(event.params.nSignalCreated)
  nameSignal.signalledTokens = nameSignal.signalledTokens.plus(event.params.tokensDeposited)
  nameSignal.lastNameSignalChange = event.block.timestamp.toI32()
  nameSignal.averageCostBasis = nameSignal.averageCostBasis.plus(
    event.params.tokensDeposited.toBigDecimal(),
  )

  // zero division protection
  if (nameSignal.nameSignal.toBigDecimal() != zeroBD) {
    nameSignal.averageCostBasisPerSignal = nameSignal.averageCostBasis.div(
      nameSignal.nameSignal.toBigDecimal(),
    )
  }
  nameSignal.save()

  // Update the curator
  let curator = createOrLoadCurator(event.params.nameCurator.toHexString(), event.block.timestamp)
  curator.totalNameSignalledTokens = curator.totalNameSignalledTokens.plus(
    event.params.tokensDeposited,
  )
  curator.totalNameSignalAverageCostBasis = curator.totalNameSignalAverageCostBasis.plus(
    event.params.tokensDeposited.toBigDecimal(),
  )
  curator.totalNameSignal = curator.totalNameSignal.plus(event.params.nSignalCreated.toBigDecimal())

  // zero division protection
  if (curator.totalNameSignal != zeroBD) {
    curator.totalAverageCostBasisPerNameSignal = curator.totalNameSignalAverageCostBasis.div(
      curator.totalNameSignal,
    )
  }
  curator.save()

  // Create n signal tx
  let nSignalTransaction = new NameSignalTransaction(
    event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString()),
  )
  nSignalTransaction.blockNumber = event.block.number.toI32()
  nSignalTransaction.timestamp = event.block.timestamp.toI32()
  nSignalTransaction.signer = event.params.nameCurator.toHexString()
  nSignalTransaction.type = 'MintNSignal'
  nSignalTransaction.nameSignal = event.params.nSignalCreated
  nSignalTransaction.versionSignal = event.params.vSignalCreated
  nSignalTransaction.tokens = event.params.tokensDeposited
  nSignalTransaction.subgraph = subgraphID
  nSignalTransaction.save()
}

export function handleNSignalBurned(event: NSignalBurned): void {
  let graphAccount = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = joinID([graphAccount, subgraphNumber])
  let subgraph = Subgraph.load(subgraphID)

  subgraph.nameSignalAmount = subgraph.nameSignalAmount.minus(event.params.nSignalBurnt)
  subgraph.unsignalledTokens = subgraph.unsignalledTokens.plus(event.params.tokensReceived)
  subgraph.save()

  // update name signal
  let nameSignal = createOrLoadNameSignal(
    event.params.nameCurator.toHexString(),
    subgraphID,
    event.block.timestamp,
  )

  nameSignal.nameSignal = nameSignal.nameSignal.minus(event.params.nSignalBurnt)
  nameSignal.unsignalledTokens = nameSignal.unsignalledTokens.plus(event.params.tokensReceived)
  nameSignal.lastNameSignalChange = event.block.timestamp.toI32()

  // update acb to reflect new name signal balance
  let previousACB = nameSignal.averageCostBasis
  nameSignal.averageCostBasis = nameSignal.nameSignal
    .toBigDecimal()
    .times(nameSignal.averageCostBasisPerSignal)
  let diffACB = previousACB.minus(nameSignal.averageCostBasis)
  if (nameSignal.averageCostBasis == BigDecimal.fromString('0')) {
    nameSignal.averageCostBasisPerSignal = BigDecimal.fromString('0')
  }
  nameSignal.save()

  // update curator
  let curator = createOrLoadCurator(event.params.nameCurator.toHexString(), event.block.timestamp)
  curator.totalNameUnsignalledTokens = curator.totalNameUnsignalledTokens.plus(
    event.params.tokensReceived,
  )
  curator.totalNameSignal = curator.totalNameSignal.minus(event.params.nSignalBurnt.toBigDecimal())
  curator.totalNameSignalAverageCostBasis = curator.totalNameSignalAverageCostBasis.minus(diffACB)
  if (curator.totalNameSignal == BigDecimal.fromString('0')) {
    curator.totalAverageCostBasisPerNameSignal = BigDecimal.fromString('0')
  } else {
    curator.totalAverageCostBasisPerNameSignal = curator.totalNameSignalAverageCostBasis.div(
      curator.totalNameSignal,
    )
  }
  curator.save()

  // Create n signal tx
  let nSignalTransaction = new NameSignalTransaction(
    event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString()),
  )
  nSignalTransaction.blockNumber = event.block.number.toI32()
  nSignalTransaction.timestamp = event.block.timestamp.toI32()
  nSignalTransaction.signer = event.params.nameCurator.toHexString()
  nSignalTransaction.type = 'BurnNSignal'
  nSignalTransaction.nameSignal = event.params.nSignalBurnt
  nSignalTransaction.versionSignal = event.params.vSignalBurnt
  nSignalTransaction.tokens = event.params.tokensReceived
  nSignalTransaction.subgraph = subgraphID
  nSignalTransaction.save()
}

export function handleNameSignalUpgrade(event: NameSignalUpgrade): void {
  let graphAccount = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = joinID([graphAccount, subgraphNumber])
  let subgraph = Subgraph.load(subgraphID)

  // Weirdly here, we add the token amount to both, but also the name curator owner must
  // stake the withdrawal fees, so both balance fairly
  // TODO - will have to come back here and make sure my thinking is correct
  subgraph.unsignalledTokens = subgraph.unsignalledTokens.plus(event.params.tokensSignalled)
  subgraph.signalledTokens = subgraph.signalledTokens.plus(event.params.tokensSignalled)
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
  subgraph.withdrawableTokens = subgraph.withdrawableTokens.minus(event.params.withdrawnGRT)
  subgraph.withdrawnTokens = subgraph.withdrawnTokens.plus(event.params.withdrawnGRT)
  subgraph.nameSignalAmount = subgraph.nameSignalAmount.minus(event.params.nSignalBurnt)
  subgraph.save()

  let nameSignal = createOrLoadNameSignal(
    event.params.nameCurator.toHexString(),
    subgraphID,
    event.block.timestamp,
  )
  nameSignal.withdrawnTokens = event.params.withdrawnGRT
  nameSignal.nameSignal = nameSignal.nameSignal.minus(event.params.nSignalBurnt)
  nameSignal.lastNameSignalChange = event.block.timestamp.toI32()
  nameSignal.save()

  let curator = Curator.load(event.params.nameCurator.toHexString())
  curator.totalWithdrawnTokens = curator.totalWithdrawnTokens.plus(event.params.withdrawnGRT)
  curator.save()
}
