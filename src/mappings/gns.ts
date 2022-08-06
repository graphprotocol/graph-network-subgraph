import { BigInt, BigDecimal, Bytes } from '@graphprotocol/graph-ts'
import {
  SubgraphPublished,
  SubgraphPublished1,
  SubgraphDeprecated,
  SubgraphDeprecated1,
  NameSignalEnabled,
  NSignalMinted,
  SignalMinted,
  NSignalBurned,
  SignalBurned,
  NameSignalUpgrade,
  NameSignalDisabled,
  GRTWithdrawn,
  GRTWithdrawn1,
  SubgraphMetadataUpdated,
  SubgraphMetadataUpdated1,
  SetDefaultName,
  ParameterUpdated,
  SubgraphUpgraded,
  SubgraphVersionUpdated,
  LegacySubgraphClaimed,
  Transfer,
  GNSStitched as GNS,
} from '../types/GNS/GNSStitched'

import {
  Subgraph,
  SubgraphVersion,
  NameSignalTransaction,
  Curator,
  Delegator,
  Indexer,
  GraphAccountName,
  SubgraphDeployment,
  GraphNetwork,
  GraphAccount,
  NameSignalSubgraphRelation,
  NameSignal,
} from '../types/schema'

import { zeroBD } from './utils'
import {
  createOrLoadSubgraphDeployment,
  createOrLoadGraphAccount,
  createOrLoadCurator,
  addQm,
  resolveName,
  createOrLoadSubgraph,
  joinID,
  createOrLoadNameSignal,
  updateCurrentDeploymentLinks,
  getSubgraphID,
  convertBigIntSubgraphIDToBase58,
  duplicateOrUpdateSubgraphWithNewID,
  duplicateOrUpdateSubgraphVersionWithNewID,
  duplicateOrUpdateNameSignalWithNewID,
} from './helpers'
import { fetchSubgraphMetadata, fetchSubgraphVersionMetadata } from './metadataHelpers'

export function handleSetDefaultName(event: SetDefaultName): void {
  let graphAccount = createOrLoadGraphAccount(event.params.graphAccount, event.block.timestamp)

  if (graphAccount.defaultName != null) {
    let graphAccountName = GraphAccountName.load(graphAccount.defaultName!)!
    // If trying to set the same name, do nothing
    if (graphAccountName.name == event.params.name) {
      return
    }

    // A user is resetting their name. This is done by passing nameIdentifier = bytes32(0)
    // String can be anything, but in front end we should just do a blank string
    if (
      event.params.nameIdentifier.toHex() ==
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      graphAccountName.graphAccount = null
      graphAccountName.save()

      graphAccount.defaultName = null
      graphAccount.defaultDisplayName = null
      graphAccount.save()

      let indexer = Indexer.load(event.params.graphAccount.toHexString())
      if (indexer != null) {
        indexer.defaultDisplayName = graphAccount.defaultDisplayName
        indexer.save()
      }

      let curator = Curator.load(event.params.graphAccount.toHexString())
      if (curator != null) {
        curator.defaultDisplayName = graphAccount.defaultDisplayName
        curator.save()
      }

      let delegator = Delegator.load(event.params.graphAccount.toHexString())
      if (delegator != null) {
        delegator.defaultDisplayName = graphAccount.defaultDisplayName
        delegator.save()
      }
      addDefaultNameTokenLockWallets(graphAccount)
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
    let userAddress = event.params.graphAccount.toHexString()

    let indexer = Indexer.load(userAddress)
    if (indexer != null) {
      indexer.defaultDisplayName = graphAccount.defaultDisplayName
      indexer.save()
    }

    let curator = Curator.load(userAddress)
    if (curator != null) {
      curator.defaultDisplayName = graphAccount.defaultDisplayName
      curator.save()
    }

    let delegator = Delegator.load(userAddress)
    if (delegator != null) {
      delegator.defaultDisplayName = graphAccount.defaultDisplayName
      delegator.save()
    }
    addDefaultNameTokenLockWallets(graphAccount)
  }
  graphAccount.save()
}

// Add in default names to a graph accounts token lock wallets
function addDefaultNameTokenLockWallets(graphAccount: GraphAccount): void {
  let tlws = graphAccount.tokenLockWallets
  for (let i = 0; i < tlws.length; i++) {
    let tlw = GraphAccount.load(tlws[i])!
    tlw.defaultName = graphAccount.defaultName
    tlw.defaultDisplayName = graphAccount.defaultDisplayName
    tlw.save()

    let indexer = Indexer.load(tlw.id)
    if (indexer != null) {
      indexer.defaultDisplayName = tlw.defaultDisplayName
      indexer.save()
    }

    let curator = Curator.load(tlw.id)
    if (curator != null) {
      curator.defaultDisplayName = tlw.defaultDisplayName
      curator.save()
    }

    let delegator = Delegator.load(tlw.id)
    if (delegator != null) {
      delegator.defaultDisplayName = tlw.defaultDisplayName
      delegator.save()
    }
  }
}

export function handleSubgraphMetadataUpdated(event: SubgraphMetadataUpdated): void {
  let oldID = joinID([
    event.params.graphAccount.toHexString(),
    event.params.subgraphNumber.toString(),
  ])
  let subgraphID = getSubgraphID(event.params.graphAccount, event.params.subgraphNumber)

  // Create subgraph
  let subgraph = createOrLoadSubgraph(subgraphID, event.params.graphAccount, event.block.timestamp)

  let hexHash = changetype<Bytes>(addQm(event.params.subgraphMetadata))
  let base58Hash = hexHash.toBase58()

  subgraph.metadataHash = event.params.subgraphMetadata
  subgraph.ipfsMetadataHash = addQm(subgraph.metadataHash).toBase58()
  subgraph = fetchSubgraphMetadata(subgraph, base58Hash)
  subgraph.updatedAt = event.block.timestamp.toI32()
  subgraph.save()

  let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, oldID, 1)
  subgraphDuplicate.save()

  // Add the original subgraph name to the subgraph deployment
  // This is a temporary solution until we can filter on nested queries
  let subgraphVersion = SubgraphVersion.load(subgraph.currentVersion!)!
  let subgraphDeployment = SubgraphDeployment.load(subgraphVersion.subgraphDeployment)!
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
  let oldID = joinID([
    event.params.graphAccount.toHexString(),
    event.params.subgraphNumber.toString(),
  ])
  let subgraphID = getSubgraphID(event.params.graphAccount, event.params.subgraphNumber)
  let versionNumber: BigInt

  // Update subgraph
  // Create subgraph
  let subgraph = createOrLoadSubgraph(subgraphID, event.params.graphAccount, event.block.timestamp)
  let oldVersionID = subgraph.currentVersion

  versionNumber = subgraph.versionCount
  let versionIDOld = joinID([oldID, subgraph.versionCount.toString()])
  let versionIDNew = joinID([subgraph.id, subgraph.versionCount.toString()])
  subgraph.creatorAddress = changetype<Bytes>(event.params.graphAccount)
  subgraph.subgraphNumber = event.params.subgraphNumber
  subgraph.oldID = joinID([
    event.params.graphAccount.toHexString(),
    event.params.subgraphNumber.toString(),
  ])
  subgraph.versionCount = versionNumber.plus(BigInt.fromI32(1))
  subgraph.updatedAt = event.block.timestamp.toI32()

  let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, oldID, 1)

  subgraph.currentVersion = versionIDNew
  subgraphDuplicate.currentVersion = versionIDOld
  subgraph.linkedEntity = subgraphDuplicate.id
  subgraph.save()
  subgraphDuplicate.save()

  // Creates Graph Account, if needed
  createOrLoadGraphAccount(event.params.graphAccount, event.block.timestamp)

  // Create subgraph deployment, if needed. Can happen if the deployment has never been staked on
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  let deployment = createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp)

  // Create subgraph version
  let subgraphVersion = new SubgraphVersion(versionIDNew)
  subgraphVersion.entityVersion = 2
  subgraphVersion.subgraph = subgraph.id
  subgraphVersion.subgraphDeployment = subgraphDeploymentID
  subgraphVersion.version = versionNumber.toI32()
  subgraphVersion.createdAt = event.block.timestamp.toI32()
  let hexHash = changetype<Bytes>(addQm(event.params.versionMetadata))
  let base58Hash = hexHash.toBase58()
  subgraphVersion.metadataHash = event.params.versionMetadata
  subgraphVersion = fetchSubgraphVersionMetadata(subgraphVersion, base58Hash)

  let subgraphVersionDuplicate = duplicateOrUpdateSubgraphVersionWithNewID(
    subgraphVersion,
    versionIDOld,
    1,
  )
  subgraphVersionDuplicate.subgraph = subgraphDuplicate.id
  subgraphVersion.linkedEntity = subgraphVersionDuplicate.id
  subgraphVersionDuplicate.save()
  subgraphVersion.save()

  let oldDeployment: SubgraphDeployment | null = null
  if (oldVersionID != null) {
    let oldVersion = SubgraphVersion.load(oldVersionID!)!
    oldDeployment = SubgraphDeployment.load(oldVersion.subgraphDeployment)!
  }
  // create deployment - named subgraph relationship, and update the old one
  updateCurrentDeploymentLinks(oldDeployment, deployment, subgraphDuplicate as Subgraph)
  updateCurrentDeploymentLinks(oldDeployment, deployment, subgraph as Subgraph)
}
/**
 * @dev handleSubgraphDeprecated
 * - updates subgraph to have no version and no name
 * - deprecates subgraph version
 */
export function handleSubgraphDeprecated(event: SubgraphDeprecated): void {
  let oldID = joinID([
    event.params.graphAccount.toHexString(),
    event.params.subgraphNumber.toString(),
  ])
  let bigIntID = getSubgraphID(event.params.graphAccount, event.params.subgraphNumber)
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let subgraph = Subgraph.load(subgraphID)!

  subgraph.active = false
  subgraph.updatedAt = event.block.timestamp.toI32()
  subgraph.save()

  let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, oldID, 1)
  subgraphDuplicate.save()

  let graphNetwork = GraphNetwork.load('1')!
  graphNetwork.activeSubgraphCount = graphNetwork.activeSubgraphCount - 1
  graphNetwork.save()

  let version = SubgraphVersion.load(subgraph.currentVersion!)
  if (version != null) {
    let deployment = SubgraphDeployment.load(version.subgraphDeployment)

    updateCurrentDeploymentLinks(deployment, null, subgraphDuplicate as Subgraph, true)
    updateCurrentDeploymentLinks(deployment, null, subgraph as Subgraph, true)
  }
}

export function handleNameSignalEnabled(event: NameSignalEnabled): void {
  let oldID = joinID([
    event.params.graphAccount.toHexString(),
    event.params.subgraphNumber.toString(),
  ])
  let bigIntID = getSubgraphID(event.params.graphAccount, event.params.subgraphNumber)
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let subgraph = Subgraph.load(subgraphID)!

  subgraph.reserveRatio = event.params.reserveRatio.toI32()
  subgraph.save()

  let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, oldID, 1)
  subgraphDuplicate.save()
}

export function handleNSignalMinted(event: NSignalMinted): void {
  let curatorID = event.params.nameCurator.toHexString()
  let oldID = joinID([
    event.params.graphAccount.toHexString(),
    event.params.subgraphNumber.toString(),
  ])
  let bigIntID = getSubgraphID(event.params.graphAccount, event.params.subgraphNumber)
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let subgraph = Subgraph.load(subgraphID)!

  subgraph.nameSignalAmount = subgraph.nameSignalAmount.plus(event.params.nSignalCreated)
  subgraph.signalAmount = subgraph.signalAmount.plus(event.params.vSignalCreated)
  subgraph.signalledTokens = subgraph.signalledTokens.plus(event.params.tokensDeposited)
  subgraph.save()

  let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, oldID, 1)
  subgraphDuplicate.save()

  // Update the curator
  let curator = createOrLoadCurator(event.params.nameCurator.toHexString(), event.block.timestamp)
  // nSignal
  curator.totalNameSignalledTokens = curator.totalNameSignalledTokens.plus(
    event.params.tokensDeposited,
  )
  curator.totalNameSignalAverageCostBasis = curator.totalNameSignalAverageCostBasis.plus(
    event.params.tokensDeposited.toBigDecimal(),
  )
  curator.totalNameSignal = curator.totalNameSignal.plus(event.params.nSignalCreated.toBigDecimal())

  // zero division protection
  if (curator.totalNameSignal != zeroBD) {
    curator.totalAverageCostBasisPerNameSignal = curator.totalNameSignalAverageCostBasis
      .div(curator.totalNameSignal)
      .truncate(18)
  }

  // vSignal
  // Might need to add the curation tax to this specific case
  curator.totalSignalledTokens = curator.totalSignalledTokens.plus(event.params.tokensDeposited)
  curator.totalSignalAverageCostBasis = curator.totalSignalAverageCostBasis.plus(
    event.params.tokensDeposited.toBigDecimal(),
  )
  curator.totalSignal = curator.totalSignal.plus(event.params.vSignalCreated.toBigDecimal())

  // zero division protection
  if (curator.totalSignal != zeroBD) {
    curator.totalAverageCostBasisPerSignal = curator.totalSignalAverageCostBasis
      .div(curator.totalSignal)
      .truncate(18)
  }
  curator.save()

  let nameSignal = createOrLoadNameSignal(curatorID, subgraphID, event.block.timestamp)

  let isNameSignalBecomingActive =
    nameSignal.nameSignal.isZero() && !event.params.nSignalCreated.isZero()

  nameSignal.nameSignal = nameSignal.nameSignal.plus(event.params.nSignalCreated)
  nameSignal.signal = nameSignal.signal.plus(event.params.vSignalCreated.toBigDecimal())
  nameSignal.signalledTokens = nameSignal.signalledTokens.plus(event.params.tokensDeposited)
  nameSignal.lastNameSignalChange = event.block.timestamp.toI32()
  // nSignal
  nameSignal.nameSignalAverageCostBasis = nameSignal.nameSignalAverageCostBasis.plus(
    event.params.tokensDeposited.toBigDecimal(),
  )
  nameSignal.averageCostBasis = nameSignal.nameSignalAverageCostBasis

  // zero division protection
  if (nameSignal.nameSignal.toBigDecimal() != zeroBD) {
    nameSignal.nameSignalAverageCostBasisPerSignal = nameSignal.nameSignalAverageCostBasis
      .div(nameSignal.nameSignal.toBigDecimal())
      .truncate(18)
    nameSignal.averageCostBasisPerSignal = nameSignal.nameSignalAverageCostBasisPerSignal
  }

  // vSignal
  nameSignal.signalAverageCostBasis = nameSignal.signalAverageCostBasis.plus(
    event.params.tokensDeposited.toBigDecimal(),
  )

  // zero division protection
  if (nameSignal.signal != zeroBD) {
    nameSignal.signalAverageCostBasisPerSignal = nameSignal.signalAverageCostBasis
      .div(nameSignal.signal)
      .truncate(18)
  }
  let nsDuplicateID = joinID([curatorID, oldID])
  nameSignal.linkedEntity = nsDuplicateID
  nameSignal.save()

  let nameSignalDuplicate = duplicateOrUpdateNameSignalWithNewID(nameSignal, nsDuplicateID, 1)
  nameSignalDuplicate.subgraph = oldID
  nameSignalDuplicate.save()

  // reload curator, since it might update counters in another context and we don't want to overwrite it
  curator = Curator.load(curatorID) as Curator
  if (isNameSignalBecomingActive) {
    curator.activeNameSignalCount = curator.activeNameSignalCount + 1
    curator.activeCombinedSignalCount = curator.activeCombinedSignalCount + 1

    if (curator.activeCombinedSignalCount == 1) {
      let graphNetwork = GraphNetwork.load('1')!
      graphNetwork.activeCuratorCount = graphNetwork.activeCuratorCount + 1
      graphNetwork.save()
    }
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
  let curatorID = event.params.nameCurator.toHexString()
  let oldID = joinID([
    event.params.graphAccount.toHexString(),
    event.params.subgraphNumber.toString(),
  ])
  let bigIntID = getSubgraphID(event.params.graphAccount, event.params.subgraphNumber)
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let subgraph = Subgraph.load(subgraphID)!

  subgraph.nameSignalAmount = subgraph.nameSignalAmount.minus(event.params.nSignalBurnt)
  subgraph.signalAmount = subgraph.signalAmount.minus(event.params.vSignalBurnt)
  subgraph.unsignalledTokens = subgraph.unsignalledTokens.plus(event.params.tokensReceived)
  subgraph.save()

  let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, oldID, 1)
  subgraphDuplicate.save()

  // update name signal
  let nameSignal = createOrLoadNameSignal(
    event.params.nameCurator.toHexString(),
    subgraphID,
    event.block.timestamp,
  )

  let isNameSignalBecomingInactive =
    !nameSignal.nameSignal.isZero() && event.params.nSignalBurnt == nameSignal.nameSignal

  nameSignal.nameSignal = nameSignal.nameSignal.minus(event.params.nSignalBurnt)
  nameSignal.signal = nameSignal.signal.minus(event.params.vSignalBurnt.toBigDecimal())
  nameSignal.unsignalledTokens = nameSignal.unsignalledTokens.plus(event.params.tokensReceived)
  nameSignal.lastNameSignalChange = event.block.timestamp.toI32()

  // nSignal ACB
  // update acb to reflect new name signal balance
  let previousACBNameSignal = nameSignal.nameSignalAverageCostBasis
  nameSignal.nameSignalAverageCostBasis = nameSignal.nameSignal
    .toBigDecimal()
    .times(nameSignal.nameSignalAverageCostBasisPerSignal)
    .truncate(18)
  nameSignal.averageCostBasis = nameSignal.nameSignalAverageCostBasis
  let diffACBNameSignal = previousACBNameSignal.minus(nameSignal.nameSignalAverageCostBasis)
  if (nameSignal.nameSignalAverageCostBasis == BigDecimal.fromString('0')) {
    nameSignal.nameSignalAverageCostBasisPerSignal = BigDecimal.fromString('0')
    nameSignal.averageCostBasisPerSignal = BigDecimal.fromString('0')
  }

  // update curator
  let curator = createOrLoadCurator(event.params.nameCurator.toHexString(), event.block.timestamp)
  curator.totalNameUnsignalledTokens = curator.totalNameUnsignalledTokens.plus(
    event.params.tokensReceived,
  )
  curator.totalNameSignal = curator.totalNameSignal.minus(event.params.nSignalBurnt.toBigDecimal())
  curator.totalNameSignalAverageCostBasis = curator.totalNameSignalAverageCostBasis.minus(
    diffACBNameSignal,
  )
  if (curator.totalNameSignal == BigDecimal.fromString('0')) {
    curator.totalAverageCostBasisPerNameSignal = BigDecimal.fromString('0')
  } else {
    curator.totalAverageCostBasisPerNameSignal = curator.totalNameSignalAverageCostBasis
      .div(curator.totalNameSignal)
      .truncate(18)
  }

  // vSignal ACB
  // update acb to reflect new name signal balance
  let previousACBSignal = nameSignal.signalAverageCostBasis
  nameSignal.signalAverageCostBasis = nameSignal.signal
    .times(nameSignal.signalAverageCostBasisPerSignal)
    .truncate(18)
  let diffACBSignal = previousACBSignal.minus(nameSignal.signalAverageCostBasis)
  if (nameSignal.signalAverageCostBasis == zeroBD) {
    nameSignal.signalAverageCostBasisPerSignal = zeroBD
  }
  let nsDuplicateID = joinID([curatorID, oldID])
  nameSignal.linkedEntity = nsDuplicateID
  nameSignal.save()

  let nameSignalDuplicate = duplicateOrUpdateNameSignalWithNewID(nameSignal, nsDuplicateID, 1)
  nameSignalDuplicate.subgraph = oldID
  nameSignalDuplicate.save()

  // Update curator
  curator.totalUnsignalledTokens = curator.totalUnsignalledTokens.plus(event.params.tokensReceived)
  curator.totalSignal = curator.totalSignal.minus(event.params.vSignalBurnt.toBigDecimal())
  curator.totalSignalAverageCostBasis = curator.totalSignalAverageCostBasis.minus(diffACBSignal)
  if (curator.totalSignal == zeroBD) {
    curator.totalAverageCostBasisPerSignal = zeroBD
  } else {
    curator.totalAverageCostBasisPerSignal = curator.totalSignalAverageCostBasis
      .div(curator.totalSignal)
      .truncate(18)
  }

  if (isNameSignalBecomingInactive) {
    curator.activeNameSignalCount = curator.activeNameSignalCount - 1
    curator.activeCombinedSignalCount = curator.activeCombinedSignalCount - 1

    if (curator.activeCombinedSignalCount == 0) {
      let graphNetwork = GraphNetwork.load('1')!
      graphNetwork.activeCuratorCount = graphNetwork.activeCuratorCount - 1
      graphNetwork.save()
    }
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
  let oldID = joinID([
    event.params.graphAccount.toHexString(),
    event.params.subgraphNumber.toString(),
  ])
  let bigIntID = getSubgraphID(event.params.graphAccount, event.params.subgraphNumber)
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let subgraph = Subgraph.load(subgraphID)!

  // Weirdly here, we add the token amount to both, but also the name curator owner must
  // stake the withdrawal fees, so both balance fairly
  // TODO - will have to come back here and make sure my thinking is correct
  // event.params.newVSignalCreated -> will be used to calculate new nSignal/vSignal ratio
  subgraph.signalAmount = event.params.newVSignalCreated
  subgraph.unsignalledTokens = subgraph.unsignalledTokens.plus(event.params.tokensSignalled)
  subgraph.signalledTokens = subgraph.signalledTokens.plus(event.params.tokensSignalled)
  subgraph.save()

  let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, oldID, 1)
  subgraphDuplicate.save()

  let signalRatio = subgraph.signalAmount.toBigDecimal() / subgraph.nameSignalAmount.toBigDecimal()

  for (let i = 0; i < subgraph.nameSignalCount; i++) {
    let relation = NameSignalSubgraphRelation.load(
      joinID([subgraphID, BigInt.fromI32(i).toString()]),
    )!
    let nameSignal = NameSignal.load(relation.nameSignal)!
    if (!nameSignal.nameSignal.isZero()) {
      let curator = Curator.load(nameSignal.curator)!

      let oldSignal = nameSignal.signal
      nameSignal.signal = nameSignal.nameSignal.toBigDecimal() * signalRatio
      nameSignal.signal = nameSignal.signal.truncate(18)

      // zero division protection
      if (nameSignal.signal != zeroBD) {
        nameSignal.signalAverageCostBasisPerSignal = nameSignal.signalAverageCostBasis
          .div(nameSignal.signal)
          .truncate(18)
      }

      let previousACBSignal = nameSignal.signalAverageCostBasis
      nameSignal.signalAverageCostBasis = nameSignal.signal
        .times(nameSignal.signalAverageCostBasisPerSignal)
        .truncate(18)

      let diffACBSignal = previousACBSignal.minus(nameSignal.signalAverageCostBasis)
      if (nameSignal.signalAverageCostBasis == zeroBD) {
        nameSignal.signalAverageCostBasisPerSignal = zeroBD
      }

      curator.totalSignal = curator.totalSignal.minus(oldSignal).plus(nameSignal.signal)
      curator.totalSignalAverageCostBasis = curator.totalSignalAverageCostBasis.minus(diffACBSignal)
      if (curator.totalSignal == zeroBD) {
        curator.totalAverageCostBasisPerSignal = zeroBD
      } else {
        curator.totalAverageCostBasisPerSignal = curator.totalSignalAverageCostBasis
          .div(curator.totalSignal)
          .truncate(18)
      }
      nameSignal.save()
      curator.save()

      if (subgraph.linkedEntity != null && nameSignal.linkedEntity) {
        let nameSignalDuplicate = duplicateOrUpdateNameSignalWithNewID(
          nameSignal,
          nameSignal.linkedEntity!,
          1,
        )
        nameSignalDuplicate.save()
      }
    }
  }
}

// Only need to upgrade withdrawable tokens. Everything else handled from
// curation events, or handleGRTWithdrawn
export function handleNameSignalDisabled(event: NameSignalDisabled): void {
  let oldID = joinID([
    event.params.graphAccount.toHexString(),
    event.params.subgraphNumber.toString(),
  ])
  let bigIntID = getSubgraphID(event.params.graphAccount, event.params.subgraphNumber)
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let subgraph = Subgraph.load(subgraphID)!
  subgraph.withdrawableTokens = event.params.withdrawableGRT
  subgraph.signalAmount = BigInt.fromI32(0)
  subgraph.save()

  let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, oldID, 1)
  subgraphDuplicate.save()
}

export function handleGRTWithdrawn(event: GRTWithdrawn): void {
  let oldID = joinID([
    event.params.graphAccount.toHexString(),
    event.params.subgraphNumber.toString(),
  ])
  let bigIntID = getSubgraphID(event.params.graphAccount, event.params.subgraphNumber)
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let subgraph = Subgraph.load(subgraphID)!
  subgraph.withdrawableTokens = subgraph.withdrawableTokens.minus(event.params.withdrawnGRT)
  subgraph.withdrawnTokens = subgraph.withdrawnTokens.plus(event.params.withdrawnGRT)
  subgraph.nameSignalAmount = subgraph.nameSignalAmount.minus(event.params.nSignalBurnt)
  subgraph.save()

  let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, oldID, 1)
  subgraphDuplicate.save()

  let nameSignal = createOrLoadNameSignal(
    event.params.nameCurator.toHexString(),
    subgraphID,
    event.block.timestamp,
  )
  nameSignal.withdrawnTokens = event.params.withdrawnGRT
  nameSignal.nameSignal = nameSignal.nameSignal.minus(event.params.nSignalBurnt)
  // Resetting this one since we don't have the value to subtract, but it should be 0 anyways.
  nameSignal.signal = BigDecimal.fromString('0')
  nameSignal.lastNameSignalChange = event.block.timestamp.toI32()

  // Reset everything to 0 since this empties the signal
  nameSignal.averageCostBasis = BigDecimal.fromString('0')
  nameSignal.averageCostBasisPerSignal = BigDecimal.fromString('0')
  nameSignal.nameSignalAverageCostBasis = BigDecimal.fromString('0')
  nameSignal.nameSignalAverageCostBasisPerSignal = BigDecimal.fromString('0')
  nameSignal.signalAverageCostBasis = BigDecimal.fromString('0')
  nameSignal.signalAverageCostBasisPerSignal = BigDecimal.fromString('0')

  let nsDuplicateID = joinID([event.params.nameCurator.toHexString(), oldID])
  nameSignal.linkedEntity = nsDuplicateID
  nameSignal.save()

  let nameSignalDuplicate = duplicateOrUpdateNameSignalWithNewID(nameSignal, nsDuplicateID, 1)
  nameSignalDuplicate.subgraph = oldID
  nameSignalDuplicate.save()

  let curator = Curator.load(event.params.nameCurator.toHexString())!
  curator.totalWithdrawnTokens = curator.totalWithdrawnTokens.plus(event.params.withdrawnGRT)
  curator.save()
}

/**
 * @dev handleParameterUpdated
 * - updates all parameters of GNS, depending on string passed. We then can
 *   call the contract directly to get the updated value
 */
export function handleParameterUpdated(event: ParameterUpdated): void {
  let parameter = event.params.param
  let graphNetwork = GraphNetwork.load('1')!
  let gns = GNS.bind(event.address)

  if (parameter == 'ownerTaxPercentage') {
    graphNetwork.ownerTaxPercentage = gns.ownerTaxPercentage().toI32()
  }
  graphNetwork.save()
}

// - event: SubgraphPublished(indexed uint256,indexed bytes32,uint32)
//   handler: handleSubgraphPublishedV2

export function handleSubgraphPublishedV2(event: SubgraphPublished1): void {
  let bigIntID = event.params.subgraphID
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let versionID: string
  let versionNumber: BigInt

  // Update subgraph
  let subgraph = createOrLoadSubgraph(
    event.params.subgraphID,
    event.transaction.from,
    event.block.timestamp,
  )
  let oldVersionID = subgraph.currentVersion

  versionNumber = subgraph.versionCount
  versionID = joinID([subgraph.id, subgraph.versionCount.toString()])
  subgraph.currentVersion = versionID
  subgraph.versionCount = subgraph.versionCount.plus(BigInt.fromI32(1))
  subgraph.updatedAt = event.block.timestamp.toI32()
  subgraph.reserveRatio = event.params.reserveRatio.toI32()
  subgraph.migrated = true
  subgraph.initializing = true
  subgraph.creatorAddress = changetype<Bytes>(event.transaction.from)
  subgraph.save()

  // Create subgraph deployment, if needed. Can happen if the deployment has never been staked on
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  let deployment = createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp)

  // Create subgraph version
  let subgraphVersion = new SubgraphVersion(versionID)
  subgraphVersion.entityVersion = 2
  subgraphVersion.subgraph = subgraph.id
  subgraphVersion.subgraphDeployment = subgraphDeploymentID
  subgraphVersion.version = versionNumber.toI32()
  subgraphVersion.createdAt = event.block.timestamp.toI32()
  subgraphVersion.save()

  let oldDeployment: SubgraphDeployment | null = null
  if (oldVersionID != null) {
    let oldVersion = SubgraphVersion.load(oldVersionID!)!
    oldDeployment = SubgraphDeployment.load(oldVersion.subgraphDeployment)!
  }
  // create deployment - named subgraph relationship, and update the old one
  updateCurrentDeploymentLinks(oldDeployment, deployment, subgraph as Subgraph)
}

// - event: SubgraphDeprecated(indexed uint256,uint256)
//   handler: handleSubgraphDeprecatedV2

export function handleSubgraphDeprecatedV2(event: SubgraphDeprecated1): void {
  let bigIntID = event.params.subgraphID
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let subgraph = Subgraph.load(subgraphID)!

  subgraph.active = false
  subgraph.updatedAt = event.block.timestamp.toI32()
  subgraph.withdrawableTokens = event.params.withdrawableGRT
  subgraph.signalAmount = BigInt.fromI32(0)
  subgraph.save()
  let subgraphDuplicate: Subgraph | null = null
  if (subgraph.linkedEntity != null) {
    subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, subgraph.linkedEntity!, 1)
    subgraphDuplicate.save()
  }

  let graphNetwork = GraphNetwork.load('1')!
  graphNetwork.activeSubgraphCount = graphNetwork.activeSubgraphCount - 1
  graphNetwork.save()

  let version = SubgraphVersion.load(subgraph.currentVersion!)
  if (version != null) {
    let deployment = SubgraphDeployment.load(version.subgraphDeployment)

    updateCurrentDeploymentLinks(deployment, null, subgraph as Subgraph, true)
    if (subgraphDuplicate != null) {
      updateCurrentDeploymentLinks(deployment, null, subgraphDuplicate as Subgraph, true)
    }
  }
}

// - event: SubgraphMetadataUpdated(indexed uint256,bytes32)
//   handler: handleSubgraphMetadataUpdatedV2

export function handleSubgraphMetadataUpdatedV2(event: SubgraphMetadataUpdated1): void {
  let bigIntID = event.params.subgraphID
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let subgraph = Subgraph.load(subgraphID)!

  let hexHash = changetype<Bytes>(addQm(event.params.subgraphMetadata))
  let base58Hash = hexHash.toBase58()

  subgraph.metadataHash = event.params.subgraphMetadata
  subgraph.ipfsMetadataHash = addQm(subgraph.metadataHash).toBase58()
  subgraph = fetchSubgraphMetadata(subgraph, base58Hash)
  subgraph.updatedAt = event.block.timestamp.toI32()
  subgraph.save()

  if (subgraph.linkedEntity != null) {
    let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, subgraph.linkedEntity!, 1)
    subgraphDuplicate.save()
  }

  // Add the original subgraph name to the subgraph deployment
  // This is a temporary solution until we can filter on nested queries
  let subgraphVersion = SubgraphVersion.load(subgraph.currentVersion!)!
  let subgraphDeployment = SubgraphDeployment.load(subgraphVersion.subgraphDeployment)!
  // Not super robust, someone could deploy blank, then point a subgraph to here
  // It is more appropriate to say this is the first name 'claimed' for the deployment
  if (subgraphDeployment.originalName == null) {
    subgraphDeployment.originalName = subgraph.displayName
    subgraphDeployment.save()
  }
}

// - event: SignalMinted(indexed uint256,indexed address,uint256,uint256,uint256)
//   handler: handleNSignalMintedV2

export function handleNSignalMintedV2(event: SignalMinted): void {
  let curatorID = event.params.curator.toHexString()
  let bigIntID = event.params.subgraphID
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let subgraph = Subgraph.load(subgraphID)!

  subgraph.nameSignalAmount = subgraph.nameSignalAmount.plus(event.params.nSignalCreated)
  subgraph.signalAmount = subgraph.signalAmount.plus(event.params.vSignalCreated)
  subgraph.signalledTokens = subgraph.signalledTokens.plus(event.params.tokensDeposited)
  subgraph.save()

  if (subgraph.linkedEntity != null) {
    let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, subgraph.linkedEntity!, 1)
    subgraphDuplicate.save()
  }

  // Update the curator
  let curator = createOrLoadCurator(event.params.curator.toHexString(), event.block.timestamp)
  // nSignal
  curator.totalNameSignalledTokens = curator.totalNameSignalledTokens.plus(
    event.params.tokensDeposited,
  )
  curator.totalNameSignalAverageCostBasis = curator.totalNameSignalAverageCostBasis.plus(
    event.params.tokensDeposited.toBigDecimal(),
  )
  curator.totalNameSignal = curator.totalNameSignal.plus(event.params.nSignalCreated.toBigDecimal())

  // zero division protection
  if (curator.totalNameSignal != zeroBD) {
    curator.totalAverageCostBasisPerNameSignal = curator.totalNameSignalAverageCostBasis
      .div(curator.totalNameSignal)
      .truncate(18)
  }

  // vSignal
  // Might need to add the curation tax to this specific case
  curator.totalSignalledTokens = curator.totalSignalledTokens.plus(event.params.tokensDeposited)
  curator.totalSignalAverageCostBasis = curator.totalSignalAverageCostBasis.plus(
    event.params.tokensDeposited.toBigDecimal(),
  )
  curator.totalSignal = curator.totalSignal.plus(event.params.vSignalCreated.toBigDecimal())

  // zero division protection
  if (curator.totalSignal != zeroBD) {
    curator.totalAverageCostBasisPerSignal = curator.totalSignalAverageCostBasis
      .div(curator.totalSignal)
      .truncate(18)
  }
  curator.save()

  let nameSignal = createOrLoadNameSignal(curatorID, subgraphID, event.block.timestamp)

  let isNameSignalBecomingActive =
    nameSignal.nameSignal.isZero() && !event.params.nSignalCreated.isZero()

  nameSignal.nameSignal = nameSignal.nameSignal.plus(event.params.nSignalCreated)
  nameSignal.signal = nameSignal.signal.plus(event.params.vSignalCreated.toBigDecimal())
  nameSignal.signalledTokens = nameSignal.signalledTokens.plus(event.params.tokensDeposited)
  nameSignal.lastNameSignalChange = event.block.timestamp.toI32()
  // nSignal
  nameSignal.nameSignalAverageCostBasis = nameSignal.nameSignalAverageCostBasis.plus(
    event.params.tokensDeposited.toBigDecimal(),
  )
  nameSignal.averageCostBasis = nameSignal.nameSignalAverageCostBasis

  // zero division protection
  if (nameSignal.nameSignal.toBigDecimal() != zeroBD) {
    nameSignal.nameSignalAverageCostBasisPerSignal = nameSignal.nameSignalAverageCostBasis
      .div(nameSignal.nameSignal.toBigDecimal())
      .truncate(18)
    nameSignal.averageCostBasisPerSignal = nameSignal.nameSignalAverageCostBasisPerSignal
  }

  // vSignal
  nameSignal.signalAverageCostBasis = nameSignal.signalAverageCostBasis.plus(
    event.params.tokensDeposited.toBigDecimal(),
  )

  // zero division protection
  if (nameSignal.signal != zeroBD) {
    nameSignal.signalAverageCostBasisPerSignal = nameSignal.signalAverageCostBasis
      .div(nameSignal.signal)
      .truncate(18)
  }
  nameSignal.save()

  if (subgraph.linkedEntity != null && nameSignal.linkedEntity != null) {
    let nameSignalDuplicate = duplicateOrUpdateNameSignalWithNewID(
      nameSignal,
      nameSignal.linkedEntity!,
      1,
    )
    nameSignalDuplicate.subgraph = subgraph.linkedEntity!
    nameSignalDuplicate.save()
  }

  // reload curator, since it might update counters in another context and we don't want to overwrite it
  curator = Curator.load(curatorID) as Curator
  if (isNameSignalBecomingActive) {
    curator.activeNameSignalCount = curator.activeNameSignalCount + 1
    curator.activeCombinedSignalCount = curator.activeCombinedSignalCount + 1

    if (curator.activeCombinedSignalCount == 1) {
      let graphNetwork = GraphNetwork.load('1')!
      graphNetwork.activeCuratorCount = graphNetwork.activeCuratorCount + 1
      graphNetwork.save()
    }
  }
  curator.save()

  // Create n signal tx
  let nSignalTransaction = new NameSignalTransaction(
    event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString()),
  )
  nSignalTransaction.blockNumber = event.block.number.toI32()
  nSignalTransaction.timestamp = event.block.timestamp.toI32()
  nSignalTransaction.signer = event.params.curator.toHexString()
  nSignalTransaction.type = 'MintNSignal'
  nSignalTransaction.nameSignal = event.params.nSignalCreated
  nSignalTransaction.versionSignal = event.params.vSignalCreated
  nSignalTransaction.tokens = event.params.tokensDeposited
  nSignalTransaction.subgraph = subgraphID
  nSignalTransaction.save()
}

// - event: SignalBurned(indexed uint256,indexed address,uint256,uint256,uint256)
//   handler: handleNSignalBurnedV2

export function handleNSignalBurnedV2(event: SignalBurned): void {
  let bigIntID = event.params.subgraphID
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let subgraph = Subgraph.load(subgraphID)!

  subgraph.nameSignalAmount = subgraph.nameSignalAmount.minus(event.params.nSignalBurnt)
  subgraph.signalAmount = subgraph.signalAmount.minus(event.params.vSignalBurnt)
  subgraph.unsignalledTokens = subgraph.unsignalledTokens.plus(event.params.tokensReceived)
  subgraph.save()

  if (subgraph.linkedEntity != null) {
    let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, subgraph.linkedEntity!, 1)
    subgraphDuplicate.save()
  }

  // update name signal
  let nameSignal = createOrLoadNameSignal(
    event.params.curator.toHexString(),
    subgraphID,
    event.block.timestamp,
  )

  let isNameSignalBecomingInactive =
    !nameSignal.nameSignal.isZero() && event.params.nSignalBurnt == nameSignal.nameSignal

  nameSignal.nameSignal = nameSignal.nameSignal.minus(event.params.nSignalBurnt)
  nameSignal.signal = nameSignal.signal.minus(event.params.vSignalBurnt.toBigDecimal())
  nameSignal.unsignalledTokens = nameSignal.unsignalledTokens.plus(event.params.tokensReceived)
  nameSignal.lastNameSignalChange = event.block.timestamp.toI32()

  // nSignal ACB
  // update acb to reflect new name signal balance
  let previousACBNameSignal = nameSignal.nameSignalAverageCostBasis
  nameSignal.nameSignalAverageCostBasis = nameSignal.nameSignal
    .toBigDecimal()
    .times(nameSignal.nameSignalAverageCostBasisPerSignal)
    .truncate(18)
  nameSignal.averageCostBasis = nameSignal.nameSignalAverageCostBasis
  let diffACBNameSignal = previousACBNameSignal.minus(nameSignal.nameSignalAverageCostBasis)
  if (nameSignal.nameSignalAverageCostBasis == BigDecimal.fromString('0')) {
    nameSignal.nameSignalAverageCostBasisPerSignal = BigDecimal.fromString('0')
    nameSignal.averageCostBasisPerSignal = BigDecimal.fromString('0')
  }

  // update curator
  let curator = createOrLoadCurator(event.params.curator.toHexString(), event.block.timestamp)
  curator.totalNameUnsignalledTokens = curator.totalNameUnsignalledTokens.plus(
    event.params.tokensReceived,
  )
  curator.totalNameSignal = curator.totalNameSignal.minus(event.params.nSignalBurnt.toBigDecimal())
  curator.totalNameSignalAverageCostBasis = curator.totalNameSignalAverageCostBasis.minus(
    diffACBNameSignal,
  )
  if (curator.totalNameSignal == BigDecimal.fromString('0')) {
    curator.totalAverageCostBasisPerNameSignal = BigDecimal.fromString('0')
  } else {
    curator.totalAverageCostBasisPerNameSignal = curator.totalNameSignalAverageCostBasis
      .div(curator.totalNameSignal)
      .truncate(18)
  }

  // vSignal ACB
  // update acb to reflect new name signal balance
  let previousACBSignal = nameSignal.signalAverageCostBasis
  nameSignal.signalAverageCostBasis = nameSignal.signal
    .times(nameSignal.signalAverageCostBasisPerSignal)
    .truncate(18)
  let diffACBSignal = previousACBSignal.minus(nameSignal.signalAverageCostBasis)
  if (nameSignal.signalAverageCostBasis == zeroBD) {
    nameSignal.signalAverageCostBasisPerSignal = zeroBD
  }
  nameSignal.save()

  if (subgraph.linkedEntity != null && nameSignal.linkedEntity != null) {
    let nameSignalDuplicate = duplicateOrUpdateNameSignalWithNewID(
      nameSignal,
      nameSignal.linkedEntity!,
      1,
    )
    nameSignalDuplicate.subgraph = subgraph.linkedEntity!
    nameSignalDuplicate.save()
  }

  // Update curator
  curator.totalUnsignalledTokens = curator.totalUnsignalledTokens.plus(event.params.tokensReceived)
  curator.totalSignal = curator.totalSignal.minus(event.params.vSignalBurnt.toBigDecimal())
  curator.totalSignalAverageCostBasis = curator.totalSignalAverageCostBasis.minus(diffACBSignal)
  if (curator.totalSignal == zeroBD) {
    curator.totalAverageCostBasisPerSignal = zeroBD
  } else {
    curator.totalAverageCostBasisPerSignal = curator.totalSignalAverageCostBasis
      .div(curator.totalSignal)
      .truncate(18)
  }

  if (isNameSignalBecomingInactive) {
    curator.activeNameSignalCount = curator.activeNameSignalCount - 1
    curator.activeCombinedSignalCount = curator.activeCombinedSignalCount - 1

    if (curator.activeCombinedSignalCount == 0) {
      let graphNetwork = GraphNetwork.load('1')!
      graphNetwork.activeCuratorCount = graphNetwork.activeCuratorCount - 1
      graphNetwork.save()
    }
  }

  curator.save()

  // Create n signal tx
  let nSignalTransaction = new NameSignalTransaction(
    event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString()),
  )
  nSignalTransaction.blockNumber = event.block.number.toI32()
  nSignalTransaction.timestamp = event.block.timestamp.toI32()
  nSignalTransaction.signer = event.params.curator.toHexString()
  nSignalTransaction.type = 'BurnNSignal'
  nSignalTransaction.nameSignal = event.params.nSignalBurnt
  nSignalTransaction.versionSignal = event.params.vSignalBurnt
  nSignalTransaction.tokens = event.params.tokensReceived
  nSignalTransaction.subgraph = subgraphID
  nSignalTransaction.save()
}

// - event: GRTWithdrawn(indexed uint256,indexed address,uint256,uint256)
//   handler: handleGRTWithdrawnV2

export function handleGRTWithdrawnV2(event: GRTWithdrawn1): void {
  let bigIntID = event.params.subgraphID
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let subgraph = Subgraph.load(subgraphID)!
  subgraph.withdrawableTokens = subgraph.withdrawableTokens.minus(event.params.withdrawnGRT)
  subgraph.withdrawnTokens = subgraph.withdrawnTokens.plus(event.params.withdrawnGRT)
  subgraph.nameSignalAmount = subgraph.nameSignalAmount.minus(event.params.nSignalBurnt)
  subgraph.save()

  if (subgraph.linkedEntity != null) {
    let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, subgraph.linkedEntity!, 1)
    subgraphDuplicate.save()
  }

  let nameSignal = createOrLoadNameSignal(
    event.params.curator.toHexString(),
    subgraphID,
    event.block.timestamp,
  )
  nameSignal.withdrawnTokens = event.params.withdrawnGRT
  nameSignal.nameSignal = nameSignal.nameSignal.minus(event.params.nSignalBurnt)
  // Resetting this one since we don't have the value to subtract, but it should be 0 anyways.
  nameSignal.signal = BigDecimal.fromString('0')
  nameSignal.lastNameSignalChange = event.block.timestamp.toI32()

  // Reset everything to 0 since this empties the signal
  nameSignal.averageCostBasis = BigDecimal.fromString('0')
  nameSignal.averageCostBasisPerSignal = BigDecimal.fromString('0')
  nameSignal.nameSignalAverageCostBasis = BigDecimal.fromString('0')
  nameSignal.nameSignalAverageCostBasisPerSignal = BigDecimal.fromString('0')
  nameSignal.signalAverageCostBasis = BigDecimal.fromString('0')
  nameSignal.signalAverageCostBasisPerSignal = BigDecimal.fromString('0')

  nameSignal.save()

  if (subgraph.linkedEntity != null && nameSignal.linkedEntity) {
    let nameSignalDuplicate = duplicateOrUpdateNameSignalWithNewID(
      nameSignal,
      nameSignal.linkedEntity!,
      1,
    )
    nameSignalDuplicate.subgraph = subgraph.linkedEntity!
    nameSignalDuplicate.save()
  }

  let curator = Curator.load(event.params.curator.toHexString())!
  curator.totalWithdrawnTokens = curator.totalWithdrawnTokens.plus(event.params.withdrawnGRT)
  curator.save()
}

// - event: SubgraphUpgraded(indexed uint256,uint256,uint256,indexed bytes32)
//   handler: handleSubgraphUpgraded

export function handleSubgraphUpgraded(event: SubgraphUpgraded): void {
  let bigIntID = event.params.subgraphID
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let subgraph = Subgraph.load(subgraphID)!

  // Weirdly here, we add the token amount to both, but also the name curator owner must
  // stake the withdrawal fees, so both balance fairly
  // TODO - will have to come back here and make sure my thinking is correct
  // event.params.newVSignalCreated -> will be used to calculate new nSignal/vSignal ratio
  subgraph.signalAmount = event.params.vSignalCreated
  subgraph.unsignalledTokens = subgraph.unsignalledTokens.plus(event.params.tokensSignalled)
  subgraph.signalledTokens = subgraph.signalledTokens.plus(event.params.tokensSignalled)
  subgraph.save()

  if (subgraph.linkedEntity != null) {
    let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, subgraph.linkedEntity!, 1)
    subgraphDuplicate.save()
  }

  let signalRatio = subgraph.signalAmount.toBigDecimal() / subgraph.nameSignalAmount.toBigDecimal()

  for (let i = 0; i < subgraph.nameSignalCount; i++) {
    let relation = NameSignalSubgraphRelation.load(
      joinID([subgraphID, BigInt.fromI32(i).toString()]),
    )!
    let nameSignal = NameSignal.load(relation.nameSignal)!
    if (!nameSignal.nameSignal.isZero()) {
      let curator = Curator.load(nameSignal.curator)!

      let oldSignal = nameSignal.signal
      nameSignal.signal = nameSignal.nameSignal.toBigDecimal() * signalRatio
      nameSignal.signal = nameSignal.signal.truncate(18)

      // zero division protection
      if (nameSignal.signal != zeroBD) {
        nameSignal.signalAverageCostBasisPerSignal = nameSignal.signalAverageCostBasis
          .div(nameSignal.signal)
          .truncate(18)
      }

      let previousACBSignal = nameSignal.signalAverageCostBasis
      nameSignal.signalAverageCostBasis = nameSignal.signal
        .times(nameSignal.signalAverageCostBasisPerSignal)
        .truncate(18)

      let diffACBSignal = previousACBSignal.minus(nameSignal.signalAverageCostBasis)
      if (nameSignal.signalAverageCostBasis == zeroBD) {
        nameSignal.signalAverageCostBasisPerSignal = zeroBD
      }

      curator.totalSignal = curator.totalSignal.minus(oldSignal).plus(nameSignal.signal)
      curator.totalSignalAverageCostBasis = curator.totalSignalAverageCostBasis.minus(diffACBSignal)
      if (curator.totalSignal == zeroBD) {
        curator.totalAverageCostBasisPerSignal = zeroBD
      } else {
        curator.totalAverageCostBasisPerSignal = curator.totalSignalAverageCostBasis
          .div(curator.totalSignal)
          .truncate(18)
      }
      nameSignal.save()
      curator.save()

      if (subgraph.linkedEntity != null && nameSignal.linkedEntity) {
        let nameSignalDuplicate = duplicateOrUpdateNameSignalWithNewID(
          nameSignal,
          nameSignal.linkedEntity!,
          1,
        )
        nameSignalDuplicate.save()
      }
    }
  }
}

// - event: SubgraphVersionUpdated(indexed uint256,indexed bytes32,bytes32)
//   handler: handleSubgraphVersionUpdated

// Might need to workaround this one, because of the ordering in subgraph creation scenario,
// we need to run this same code in SubgraphPublished (v2) too, and flag it so some of these executions
// don't create bugs (like double counting/creating versions)

export function handleSubgraphVersionUpdated(event: SubgraphVersionUpdated): void {
  let bigIntID = event.params.subgraphID
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let versionID: string
  let versionNumber: BigInt

  // Update subgraph
  let subgraph = Subgraph.load(subgraphID)!

  if (subgraph.initializing) {
    subgraph.initializing = false
    subgraph.save()

    // Update already initialized subgraph version
    versionID = joinID([subgraph.id, subgraph.versionCount.minus(BigInt.fromI32(1)).toString()])
    let subgraphVersion = SubgraphVersion.load(versionID)!
    let hexHash = changetype<Bytes>(addQm(event.params.versionMetadata))
    let base58Hash = hexHash.toBase58()
    subgraphVersion.metadataHash = event.params.versionMetadata
    subgraphVersion = fetchSubgraphVersionMetadata(subgraphVersion, base58Hash)
    subgraphVersion.save()
  } else {
    let oldVersionID = subgraph.currentVersion

    versionNumber = subgraph.versionCount
    versionID = joinID([subgraph.id, subgraph.versionCount.toString()])
    subgraph.currentVersion = versionID
    subgraph.versionCount = subgraph.versionCount.plus(BigInt.fromI32(1))
    subgraph.updatedAt = event.block.timestamp.toI32()
    subgraph.save()

    // Create subgraph deployment, if needed. Can happen if the deployment has never been staked on
    let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
    let deployment = createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp)

    // Create subgraph version
    let subgraphVersion = new SubgraphVersion(versionID)
    subgraphVersion.entityVersion = 2
    subgraphVersion.subgraph = subgraph.id
    subgraphVersion.subgraphDeployment = subgraphDeploymentID
    subgraphVersion.version = versionNumber.toI32()
    subgraphVersion.createdAt = event.block.timestamp.toI32()
    let hexHash = changetype<Bytes>(addQm(event.params.versionMetadata))
    let base58Hash = hexHash.toBase58()
    subgraphVersion.metadataHash = event.params.versionMetadata
    subgraphVersion = fetchSubgraphVersionMetadata(subgraphVersion, base58Hash)

    let oldDeployment: SubgraphDeployment | null = null
    if (oldVersionID != null) {
      let oldVersion = SubgraphVersion.load(oldVersionID!)!
      oldDeployment = SubgraphDeployment.load(oldVersion.subgraphDeployment)!
    }
    // create deployment - named subgraph relationship, and update the old one
    updateCurrentDeploymentLinks(oldDeployment, deployment, subgraph as Subgraph)

    if (subgraph.linkedEntity != null) {
      let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(
        subgraph,
        subgraph.linkedEntity!,
        1,
      )
      let duplicateVersionID = joinID([subgraphDuplicate.id, versionNumber.toString()])
      subgraphDuplicate.currentVersion = duplicateVersionID
      subgraphDuplicate.save()

      let subgraphVersionDuplicate = duplicateOrUpdateSubgraphVersionWithNewID(
        subgraphVersion,
        duplicateVersionID,
        1,
      )
      subgraphVersionDuplicate.subgraph = subgraphDuplicate.id
      subgraphVersion.linkedEntity = subgraphVersionDuplicate.id
      subgraphVersionDuplicate.save()

      updateCurrentDeploymentLinks(oldDeployment, deployment, subgraphDuplicate as Subgraph)
    }
    subgraphVersion.save()
  }
}

// - event: LegacySubgraphClaimed(indexed address,uint256)
//   handler: handleLegacySubgraphClaimed

export function handleLegacySubgraphClaimed(event: LegacySubgraphClaimed): void {
  let subgraphID = getSubgraphID(event.params.graphAccount, event.params.subgraphNumber)

  // Update subgraph v2
  let subgraph = createOrLoadSubgraph(subgraphID, event.params.graphAccount, event.block.timestamp)
  subgraph.migrated = true
  subgraph.save()

  let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, subgraph.linkedEntity!, 1)
  subgraphDuplicate.save()
}

// - event: Transfer(indexed address,indexed address,indexed uint256)
//   handler: handleTransfer

export function handleTransfer(event: Transfer): void {
  let newOwner = createOrLoadGraphAccount(event.params.to, event.block.timestamp)

  // Update subgraph v2
  let subgraph = createOrLoadSubgraph(
    event.params.tokenId,
    event.transaction.from,
    event.block.timestamp,
  )
  subgraph.updatedAt = event.block.timestamp.toI32()
  subgraph.owner = newOwner.id
  subgraph.save()

  if (subgraph.linkedEntity != null) {
    let subgraphDuplicate = duplicateOrUpdateSubgraphWithNewID(subgraph, subgraph.linkedEntity!, 1)
    subgraphDuplicate.save()
  }
}
