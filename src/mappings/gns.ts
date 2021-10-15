import { BigInt, BigDecimal, Bytes, json } from '@graphprotocol/graph-ts'
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
  ParameterUpdated,
  GNS,
} from '../types/GNS/GNS'

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
} from './helpers'
import { fetchSubgraphMetadata, fetchSubgraphVersionMetadata } from './metadataHelpers'

export function handleSetDefaultName(event: SetDefaultName): void {
  let graphAccount = createOrLoadGraphAccount(
    event.params.graphAccount.toHexString(),
    event.params.graphAccount,
    event.block.timestamp,
  )

  if (graphAccount.defaultName != null) {
    let graphAccountName = GraphAccountName.load(graphAccount.defaultName)
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
    let tlw = GraphAccount.load(tlws[i])
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
  let graphAccountID = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = joinID([graphAccountID, subgraphNumber])
  let subgraph = createOrLoadSubgraph(subgraphID, event.params.graphAccount, event.block.timestamp)

  let hexHash = addQm(event.params.subgraphMetadata) as Bytes
  let base58Hash = hexHash.toBase58()

  subgraph.metadataHash = event.params.subgraphMetadata
  subgraph = fetchSubgraphMetadata(subgraph, base58Hash)
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
  let oldVersionID = subgraph.currentVersion

  versionID = joinID([subgraphID, subgraph.versionCount.toString()])
  subgraph.currentVersion = versionID
  subgraph.versionCount = subgraph.versionCount.plus(BigInt.fromI32(1))

  // Creates Graph Account, if needed
  createOrLoadGraphAccount(graphAccountID, event.params.graphAccount, event.block.timestamp)
  subgraph.updatedAt = event.block.timestamp.toI32()
  subgraph.save()

  // Create subgraph deployment, if needed. Can happen if the deployment has never been staked on
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  let deployment = createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp)

  // Create subgraph version
  let subgraphVersion = new SubgraphVersion(versionID)
  subgraphVersion.subgraph = subgraphID
  subgraphVersion.subgraphDeployment = subgraphDeploymentID
  subgraphVersion.version = versionNumber as i32
  subgraphVersion.createdAt = event.block.timestamp.toI32()
  let hexHash = addQm(event.params.versionMetadata) as Bytes
  let base58Hash = hexHash.toBase58()
  subgraphVersion.metadataHash = event.params.versionMetadata
  subgraphVersion = fetchSubgraphVersionMetadata(subgraphVersion, base58Hash)
  subgraphVersion.save()

  let oldDeployment: SubgraphDeployment | null = null
  if (oldVersionID != null) {
    let oldVersion = SubgraphVersion.load(oldVersionID)
    oldDeployment = SubgraphDeployment.load(oldVersion.subgraphDeployment)
  }
  // create deployment - named subgraph relationship, and update the old one
  updateCurrentDeploymentLinks(
    oldDeployment,
    deployment,
    subgraph as Subgraph,
  )
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

  subgraph.active = false
  subgraph.updatedAt = event.block.timestamp.toI32()
  subgraph.save()

  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.activeSubgraphCount = graphNetwork.activeSubgraphCount - 1
  graphNetwork.save()


  let version = SubgraphVersion.load(subgraph.currentVersion)
  if (version != null) {
    let deployment = SubgraphDeployment.load(version.subgraphDeployment)

    updateCurrentDeploymentLinks(
      deployment,
      null,
      subgraph as Subgraph,
      true
    )
  }
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
  let curatorID = event.params.nameCurator.toHexString()
  let graphAccount = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = joinID([graphAccount, subgraphNumber])
  let subgraph = Subgraph.load(subgraphID)

  subgraph.nameSignalAmount = subgraph.nameSignalAmount.plus(event.params.nSignalCreated)
  subgraph.signalAmount = subgraph.signalAmount.plus(event.params.vSignalCreated)
  subgraph.signalledTokens = subgraph.signalledTokens.plus(event.params.tokensDeposited)
  subgraph.save()

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
  nameSignal.save()

  // reload curator, since it might update counters in another context and we don't want to overwrite it
  curator = Curator.load(curatorID) as Curator
  if (isNameSignalBecomingActive) {
    curator.activeNameSignalCount = curator.activeNameSignalCount + 1
    curator.activeCombinedSignalCount = curator.activeCombinedSignalCount + 1

    if (curator.activeCombinedSignalCount == 1) {
      let graphNetwork = GraphNetwork.load('1')
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
  let graphAccount = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = joinID([graphAccount, subgraphNumber])
  let subgraph = Subgraph.load(subgraphID)

  subgraph.nameSignalAmount = subgraph.nameSignalAmount.minus(event.params.nSignalBurnt)
  subgraph.signalAmount = subgraph.signalAmount.minus(event.params.vSignalBurnt)
  subgraph.unsignalledTokens = subgraph.unsignalledTokens.plus(event.params.tokensReceived)
  subgraph.save()

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
  nameSignal.save()

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
      let graphNetwork = GraphNetwork.load('1')
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
  let graphAccount = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = joinID([graphAccount, subgraphNumber])
  let subgraph = Subgraph.load(subgraphID)

  // Weirdly here, we add the token amount to both, but also the name curator owner must
  // stake the withdrawal fees, so both balance fairly
  // TODO - will have to come back here and make sure my thinking is correct
  // event.params.newVSignalCreated -> will be used to calculate new nSignal/vSignal ratio
  subgraph.signalAmount = event.params.newVSignalCreated
  subgraph.unsignalledTokens = subgraph.unsignalledTokens.plus(event.params.tokensSignalled)
  subgraph.signalledTokens = subgraph.signalledTokens.plus(event.params.tokensSignalled)
  subgraph.save()

  let signalRatio = subgraph.signalAmount.toBigDecimal() / subgraph.nameSignalAmount.toBigDecimal()

  for (let i = 0; i < subgraph.nameSignalCount; i++) {
    let relation = NameSignalSubgraphRelation.load(
      joinID([subgraphID, BigInt.fromI32(i).toString()]),
    )
    let nameSignal = NameSignal.load(relation.nameSignal)
    if (!nameSignal.nameSignal.isZero()) {
      let curator = Curator.load(nameSignal.curator)

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
    }
  }
}

// Only need to upgrade withdrawable tokens. Everything else handled from
// curation events, or handleGRTWithdrawn
export function handleNameSignalDisabled(event: NameSignalDisabled): void {
  let graphAccount = event.params.graphAccount.toHexString()
  let subgraphNumber = event.params.subgraphNumber.toString()
  let subgraphID = joinID([graphAccount, subgraphNumber])
  let subgraph = Subgraph.load(subgraphID)
  subgraph.withdrawableTokens = event.params.withdrawableGRT
  subgraph.signalAmount = BigInt.fromI32(0)
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

  let curator = Curator.load(event.params.nameCurator.toHexString())
  curator.totalWithdrawnTokens = curator.totalWithdrawnTokens.plus(event.params.withdrawnGRT)
  curator.save()
}

/**
 * @dev handleParamterUpdated
 * - updates all parameters of GNS, depending on string passed. We then can
 *   call the contract directly to get the updated value
 */
export function handleParameterUpdated(event: ParameterUpdated): void {
  let parameter = event.params.param
  let graphNetwork = GraphNetwork.load('1')
  let gns = GNS.bind(event.address)

  if (parameter == 'ownerTaxPercentage') {
    graphNetwork.ownerTaxPercentage = gns.ownerTaxPercentage().toI32()
  }
  graphNetwork.save()
}
