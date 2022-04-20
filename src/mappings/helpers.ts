import { BigInt, ByteArray, Address, Bytes, crypto, log, BigDecimal } from '@graphprotocol/graph-ts'
import {
  SubgraphDeployment,
  GraphNetwork,
  Indexer,
  Pool,
  Curator,
  Epoch,
  Signal,
  SubgraphVersion,
  Subgraph,
  GraphAccount,
  GraphAccountName,
  NameSignal,
  Delegator,
  DelegatedStake,
  Network,
  SubgraphCategory,
  SubgraphCategoryRelation,
  NameSignalSubgraphRelation,
  CurrentSubgraphDeploymentRelation,
  Contract,
  ContractEvent
} from '../types/schema'
import { ENS } from '../types/GNS/ENS'
import { Controller } from '../types/Controller/Controller'
import { fetchSubgraphDeploymentManifest } from './metadataHelpers'
import { addresses } from '../../config/addresses'

export function createOrLoadSubgraph(
  bigIntID: BigInt,
  owner: Address,
  timestamp: BigInt,
): Subgraph {
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let subgraph = Subgraph.load(subgraphID)
  if (subgraph == null) {
    subgraph = new Subgraph(subgraphID)
    subgraph.owner = owner.toHexString()
    subgraph.versionCount = BigInt.fromI32(0)
    subgraph.createdAt = timestamp.toI32()
    subgraph.updatedAt = timestamp.toI32()
    subgraph.active = true
    subgraph.migrated = false
    subgraph.entityVersion = 2
    subgraph.nftID = bigIntID.toString()
    subgraph.initializing = false

    subgraph.signalledTokens = BigInt.fromI32(0)
    subgraph.unsignalledTokens = BigInt.fromI32(0)
    subgraph.currentSignalledTokens = BigInt.fromI32(0)
    subgraph.nameSignalAmount = BigInt.fromI32(0)
    subgraph.signalAmount = BigInt.fromI32(0)
    subgraph.reserveRatio = 0
    subgraph.withdrawableTokens = BigInt.fromI32(0)
    subgraph.withdrawnTokens = BigInt.fromI32(0)
    subgraph.nameSignalCount = 0

    subgraph.metadataHash = changetype<Bytes>(Bytes.fromI32(0))

    subgraph.save()

    let graphNetwork = GraphNetwork.load('1')!
    graphNetwork.subgraphCount = graphNetwork.subgraphCount + 1
    graphNetwork.activeSubgraphCount = graphNetwork.activeSubgraphCount + 1
    graphNetwork.save()
  }
  return subgraph as Subgraph
}

export function createOrLoadSubgraphDeployment(
  subgraphID: string,
  timestamp: BigInt,
): SubgraphDeployment {
  let deployment = SubgraphDeployment.load(subgraphID)
  if (deployment == null) {
    let graphNetwork = GraphNetwork.load('1')!
    let prefix = '1220'
    deployment = new SubgraphDeployment(subgraphID)
    deployment.ipfsHash = Bytes.fromHexString(prefix.concat(subgraphID.slice(2))).toBase58()
    deployment = fetchSubgraphDeploymentManifest(
      deployment as SubgraphDeployment,
      deployment.ipfsHash,
    )
    deployment.createdAt = timestamp.toI32()
    deployment.stakedTokens = BigInt.fromI32(0)
    deployment.indexingRewardAmount = BigInt.fromI32(0)
    deployment.indexingIndexerRewardAmount = BigInt.fromI32(0)
    deployment.indexingDelegatorRewardAmount = BigInt.fromI32(0)
    deployment.queryFeesAmount = BigInt.fromI32(0)
    deployment.queryFeeRebates = BigInt.fromI32(0)
    deployment.curatorFeeRewards = BigInt.fromI32(0)

    deployment.signalledTokens = BigInt.fromI32(0)
    deployment.unsignalledTokens = BigInt.fromI32(0)
    deployment.signalAmount = BigInt.fromI32(0)
    deployment.pricePerShare = BigDecimal.fromString('0')
    deployment.reserveRatio = graphNetwork.defaultReserveRatio
    deployment.deniedAt = 0

    deployment.subgraphCount = 0
    deployment.activeSubgraphCount = 0
    deployment.deprecatedSubgraphCount = 0
    deployment.save()

    graphNetwork.subgraphDeploymentCount = graphNetwork.subgraphDeploymentCount + 1
    graphNetwork.save()
  }
  return deployment as SubgraphDeployment
}

export function createOrLoadIndexer(id: string, timestamp: BigInt): Indexer {
  let indexer = Indexer.load(id)
  if (indexer == null) {
    indexer = new Indexer(id)
    indexer.createdAt = timestamp.toI32()
    indexer.account = id

    indexer.stakedTokens = BigInt.fromI32(0)
    indexer.allocatedTokens = BigInt.fromI32(0)
    indexer.lockedTokens = BigInt.fromI32(0)
    indexer.unstakedTokens = BigInt.fromI32(0)
    indexer.tokensLockedUntil = 0
    indexer.queryFeesCollected = BigInt.fromI32(0)
    indexer.queryFeeRebates = BigInt.fromI32(0)
    indexer.rewardsEarned = BigInt.fromI32(0)
    indexer.indexerRewardsOwnGenerationRatio = BigDecimal.fromString('0')

    indexer.delegatedCapacity = BigInt.fromI32(0)
    indexer.tokenCapacity = BigInt.fromI32(0)
    indexer.availableStake = BigInt.fromI32(0)

    indexer.delegatedTokens = BigInt.fromI32(0)
    indexer.ownStakeRatio = BigDecimal.fromString('0')
    indexer.delegatedStakeRatio = BigDecimal.fromString('0')
    indexer.delegatorShares = BigInt.fromI32(0)
    indexer.delegationExchangeRate = BigDecimal.fromString('1')
    indexer.indexingRewardCut = 0
    indexer.indexingRewardEffectiveCut = BigDecimal.fromString('0')
    indexer.overDelegationDilution = BigDecimal.fromString('0')
    indexer.delegatorIndexingRewards = BigInt.fromI32(0)
    indexer.indexerIndexingRewards = BigInt.fromI32(0)
    indexer.delegatorQueryFees = BigInt.fromI32(0)
    indexer.queryFeeCut = 0
    indexer.queryFeeEffectiveCut = BigDecimal.fromString('0')
    indexer.delegatorParameterCooldown = 0
    indexer.lastDelegationParameterUpdate = 0
    indexer.forcedClosures = 0
    indexer.allocationCount = 0
    indexer.totalAllocationCount = BigInt.fromI32(0)

    indexer.totalReturn = BigDecimal.fromString('0')
    indexer.annualizedReturn = BigDecimal.fromString('0')
    indexer.stakingEfficiency = BigDecimal.fromString('0')

    let graphAccount = GraphAccount.load(id)!
    graphAccount.indexer = id
    graphAccount.save()

    indexer.defaultDisplayName = graphAccount.defaultDisplayName

    let graphNetwork = GraphNetwork.load('1')!
    graphNetwork.indexerCount = graphNetwork.indexerCount + 1
    graphNetwork.save()

    indexer.save()
  }
  return indexer as Indexer
}

export function createOrLoadDelegator(id: string, timestamp: BigInt): Delegator {
  let delegator = Delegator.load(id)
  if (delegator == null) {
    delegator = new Delegator(id)
    delegator.account = id
    delegator.totalStakedTokens = BigInt.fromI32(0)
    delegator.totalUnstakedTokens = BigInt.fromI32(0)
    delegator.createdAt = timestamp.toI32()
    delegator.totalRealizedRewards = BigDecimal.fromString('0')
    delegator.stakesCount = 0
    delegator.activeStakesCount = 0
    delegator.save()

    let graphAccount = GraphAccount.load(id)!
    graphAccount.delegator = id
    graphAccount.save()

    let graphNetwork = GraphNetwork.load('1')!
    graphNetwork.delegatorCount = graphNetwork.delegatorCount + 1
    graphNetwork.save()
  }
  return delegator as Delegator
}

export function createOrLoadDelegatedStake(
  delegator: string,
  indexer: string,
  timestamp: i32,
): DelegatedStake {
  let id = joinID([delegator, indexer])
  let delegatedStake = DelegatedStake.load(id)
  if (delegatedStake == null) {
    delegatedStake = new DelegatedStake(id)
    delegatedStake.indexer = indexer
    delegatedStake.delegator = delegator
    delegatedStake.stakedTokens = BigInt.fromI32(0)
    delegatedStake.unstakedTokens = BigInt.fromI32(0)
    delegatedStake.lockedTokens = BigInt.fromI32(0)
    delegatedStake.lockedUntil = 0
    delegatedStake.shareAmount = BigInt.fromI32(0)
    delegatedStake.personalExchangeRate = BigDecimal.fromString('1')
    delegatedStake.realizedRewards = BigDecimal.fromString('0')
    delegatedStake.createdAt = timestamp

    delegatedStake.save()

    let delegatorEntity = Delegator.load(delegator)!
    delegatorEntity.stakesCount = delegatorEntity.stakesCount + 1
    delegatorEntity.save()

    let graphNetwork = GraphNetwork.load('1')!
    graphNetwork.delegationCount = graphNetwork.delegationCount + 1
    graphNetwork.save()
  }
  return delegatedStake as DelegatedStake
}
export function createOrLoadCurator(id: string, timestamp: BigInt): Curator {
  let curator = Curator.load(id)
  if (curator == null) {
    curator = new Curator(id)
    curator.createdAt = timestamp.toI32()
    curator.account = id
    curator.totalSignalledTokens = BigInt.fromI32(0)
    curator.totalUnsignalledTokens = BigInt.fromI32(0)

    curator.totalNameSignalledTokens = BigInt.fromI32(0)
    curator.totalNameUnsignalledTokens = BigInt.fromI32(0)
    curator.totalWithdrawnTokens = BigInt.fromI32(0)

    curator.realizedRewards = BigInt.fromI32(0)
    curator.annualizedReturn = BigDecimal.fromString('0')
    curator.totalReturn = BigDecimal.fromString('0')
    curator.signalingEfficiency = BigDecimal.fromString('0')
    curator.totalNameSignalAverageCostBasis = BigDecimal.fromString('0')
    curator.totalNameSignal = BigDecimal.fromString('0')
    curator.totalAverageCostBasisPerNameSignal = BigDecimal.fromString('0')
    curator.totalSignalAverageCostBasis = BigDecimal.fromString('0')
    curator.totalSignal = BigDecimal.fromString('0')
    curator.totalAverageCostBasisPerSignal = BigDecimal.fromString('0')

    curator.signalCount = 0
    curator.activeSignalCount = 0
    curator.nameSignalCount = 0
    curator.activeNameSignalCount = 0
    curator.combinedSignalCount = 0
    curator.activeCombinedSignalCount = 0
    curator.save()

    let graphAccount = GraphAccount.load(id)!
    graphAccount.curator = id
    graphAccount.save()

    let graphNetwork = GraphNetwork.load('1')!
    graphNetwork.curatorCount = graphNetwork.curatorCount + 1
    graphNetwork.save()
  }
  return curator as Curator
}

export function createOrLoadSignal(
  curator: string,
  subgraphDeploymentID: string,
  blockNumber: i32,
  timestamp: i32,
): Signal {
  let signalID = joinID([curator, subgraphDeploymentID])
  let signal = Signal.load(signalID)
  if (signal == null) {
    signal = new Signal(signalID)
    signal.curator = curator
    signal.subgraphDeployment = subgraphDeploymentID
    signal.signalledTokens = BigInt.fromI32(0)
    signal.unsignalledTokens = BigInt.fromI32(0)
    signal.signal = BigInt.fromI32(0)
    signal.averageCostBasis = BigDecimal.fromString('0')
    signal.averageCostBasisPerSignal = BigDecimal.fromString('0')
    signal.lastSignalChange = 0
    signal.realizedRewards = BigInt.fromI32(0)
    signal.createdAt = timestamp
    signal.createdAtBlock = blockNumber
    signal.lastUpdatedAt = timestamp
    signal.lastUpdatedAtBlock = blockNumber
    signal.save()

    let curatorEntity = Curator.load(curator)!
    curatorEntity.signalCount = curatorEntity.signalCount + 1
    curatorEntity.combinedSignalCount = curatorEntity.combinedSignalCount + 1
    curatorEntity.save()
  }
  return signal as Signal
}

export function createOrLoadNameSignal(
  curator: string,
  subgraphID: string,
  timestamp: BigInt,
): NameSignal {
  let nameSignalID = joinID([curator, subgraphID])
  let nameSignal = NameSignal.load(nameSignalID)
  if (nameSignal == null) {
    nameSignal = new NameSignal(nameSignalID)
    let underlyingCurator = createOrLoadCurator(curator, timestamp)
    nameSignal.entityVersion = 2
    nameSignal.curator = underlyingCurator.id
    nameSignal.subgraph = subgraphID
    nameSignal.signalledTokens = BigInt.fromI32(0)
    nameSignal.unsignalledTokens = BigInt.fromI32(0)
    nameSignal.withdrawnTokens = BigInt.fromI32(0)
    nameSignal.nameSignal = BigInt.fromI32(0)
    nameSignal.signal = BigDecimal.fromString('0')
    nameSignal.lastNameSignalChange = 0
    nameSignal.realizedRewards = BigInt.fromI32(0)
    nameSignal.averageCostBasis = BigDecimal.fromString('0')
    nameSignal.averageCostBasisPerSignal = BigDecimal.fromString('0')
    nameSignal.nameSignalAverageCostBasis = BigDecimal.fromString('0')
    nameSignal.nameSignalAverageCostBasisPerSignal = BigDecimal.fromString('0')
    nameSignal.signalAverageCostBasis = BigDecimal.fromString('0')
    nameSignal.signalAverageCostBasisPerSignal = BigDecimal.fromString('0')
    nameSignal.save()

    let curatorEntity = Curator.load(curator)!
    curatorEntity.nameSignalCount = curatorEntity.nameSignalCount + 1
    curatorEntity.combinedSignalCount = curatorEntity.combinedSignalCount + 1
    curatorEntity.save()

    let subgraphEntity = Subgraph.load(subgraphID)!
    let relation = new NameSignalSubgraphRelation(
      joinID([subgraphID, BigInt.fromI32(subgraphEntity.nameSignalCount).toString()]),
    )
    subgraphEntity.nameSignalCount = subgraphEntity.nameSignalCount + 1
    subgraphEntity.save()

    relation.subgraph = subgraphEntity.id
    relation.nameSignal = nameSignal.id
    relation.save()
  }
  return nameSignal as NameSignal
}

export function createOrLoadGraphAccount(owner: Bytes, timeStamp: BigInt): GraphAccount {
  let id = owner.toHexString()
  let graphAccount = GraphAccount.load(id)
  if (graphAccount == null) {
    graphAccount = new GraphAccount(id)
    graphAccount.createdAt = timeStamp.toI32()
    graphAccount.operators = []
    graphAccount.balance = BigInt.fromI32(0)
    graphAccount.curationApproval = BigInt.fromI32(0)
    graphAccount.stakingApproval = BigInt.fromI32(0)
    graphAccount.gnsApproval = BigInt.fromI32(0)
    graphAccount.subgraphQueryFees = BigInt.fromI32(0)
    graphAccount.tokenLockWallets = []
    graphAccount.save()
  }
  return graphAccount as GraphAccount
}

export function createOrLoadPool(id: BigInt): Pool {
  let pool = Pool.load(id.toString())
  if (pool == null) {
    pool = new Pool(id.toString())
    pool.allocation = BigInt.fromI32(0)
    pool.totalQueryFees = BigInt.fromI32(0)
    pool.claimedFees = BigInt.fromI32(0)
    pool.curatorRewards = BigInt.fromI32(0)
    pool.save()
  }
  return pool as Pool
}

export function createOrLoadEpoch(blockNumber: BigInt): Epoch {
  let graphNetwork = GraphNetwork.load('1')!
  let epochsSinceLastUpdate = blockNumber
    .minus(BigInt.fromI32(graphNetwork.lastLengthUpdateBlock))
    .div(BigInt.fromI32(graphNetwork.epochLength))
  let epoch: Epoch

  // true if we need to create
  // it is checking if at least 1 epoch has passed since the last creation
  let needsCreating =
    epochsSinceLastUpdate.toI32() > graphNetwork.currentEpoch - graphNetwork.lastLengthUpdateEpoch

  if (needsCreating) {
    let newEpoch = graphNetwork.lastLengthUpdateEpoch + epochsSinceLastUpdate.toI32()

    // Need to get the start block according to the contracts, not just the start block this
    // entity was created in the subgraph
    let startBlock =
      graphNetwork.lastLengthUpdateBlock + epochsSinceLastUpdate.toI32() * graphNetwork.epochLength
    epoch = createEpoch(startBlock, graphNetwork.epochLength, newEpoch)
    graphNetwork.epochCount = graphNetwork.epochCount + 1
    graphNetwork.currentEpoch = newEpoch
    graphNetwork.save()

    // If there is no need to create a new epoch, just return the current one
  } else {
    epoch = Epoch.load(BigInt.fromI32(graphNetwork.currentEpoch).toString()) as Epoch
  }
  return epoch
}

export function createEpoch(startBlock: i32, epochLength: i32, epochNumber: i32): Epoch {
  let epoch = new Epoch(BigInt.fromI32(epochNumber).toString())
  epoch.startBlock = startBlock
  epoch.endBlock = startBlock + epochLength
  epoch.signalledTokens = BigInt.fromI32(0)
  epoch.stakeDeposited = BigInt.fromI32(0)
  epoch.queryFeeRebates = BigInt.fromI32(0)
  epoch.queryFeesCollected = BigInt.fromI32(0)
  epoch.curatorQueryFees = BigInt.fromI32(0)
  epoch.totalRewards = BigInt.fromI32(0)
  epoch.totalIndexerRewards = BigInt.fromI32(0)
  epoch.totalDelegatorRewards = BigInt.fromI32(0)
  epoch.save()
  return epoch
}

export function createOrLoadGraphNetwork(
  blockNumber: BigInt,
  controllerAddress: Bytes,
): GraphNetwork {
  let graphNetwork = GraphNetwork.load('1')
  if (graphNetwork == null) {
    graphNetwork = new GraphNetwork('1')

    let contract = Controller.bind(changetype<Address>(controllerAddress))
    let governor = contract.getGovernor()

    // All of the 0x0000 addresses will be replaced in controller deployment calls
    // Service registry is not stored in the Controller so we get it manually
    graphNetwork.controller = controllerAddress
    graphNetwork.graphToken = Address.fromString(addresses.graphToken)
    graphNetwork.epochManager = Address.fromString(addresses.epochManager)
    graphNetwork.epochManagerImplementations = []
    graphNetwork.curation = Address.fromString(addresses.curation)
    graphNetwork.curationImplementations = []
    graphNetwork.staking = Address.fromString(addresses.staking)
    graphNetwork.stakingImplementations = []
    graphNetwork.disputeManager = Address.fromString(addresses.disputeManager)
    graphNetwork.gns = Address.fromString(addresses.gns)
    graphNetwork.serviceRegistry = Address.fromString(addresses.serviceRegistry)
    graphNetwork.rewardsManager = Address.fromString(addresses.rewardsManager)
    graphNetwork.rewardsManagerImplementations = []
    graphNetwork.isPaused = false
    graphNetwork.isPartialPaused = false
    graphNetwork.governor = governor
    graphNetwork.pauseGuardian = Address.fromString('0x0000000000000000000000000000000000000000')

    // let contract = GraphNetwork.bind(event.params.a)
    // most of the parameters below are updated in the constructor, or else
    // right after deployment
    graphNetwork.curationPercentage = 0
    graphNetwork.protocolFeePercentage = 0
    graphNetwork.delegationRatio = 0
    graphNetwork.channelDisputeEpochs = 0
    graphNetwork.maxAllocationEpochs = 0
    graphNetwork.thawingPeriod = 0
    graphNetwork.delegationParametersCooldown = 0
    graphNetwork.minimumIndexerStake = BigInt.fromI32(0)
    graphNetwork.delegationUnbondingPeriod = 0
    graphNetwork.delegationTaxPercentage = 0
    graphNetwork.rebateRatio = BigDecimal.fromString('0')

    graphNetwork.totalTokensStaked = BigInt.fromI32(0)
    graphNetwork.totalTokensClaimable = BigInt.fromI32(0)
    graphNetwork.totalUnstakedTokensLocked = BigInt.fromI32(0)
    graphNetwork.totalTokensAllocated = BigInt.fromI32(0)
    graphNetwork.totalDelegatedTokens = BigInt.fromI32(0)
    graphNetwork.totalTokensSignalled = BigInt.fromI32(0)
    graphNetwork.totalTokensSignalledAutoMigrate = BigDecimal.fromString('0')
    graphNetwork.totalTokensSignalledDirectly = BigDecimal.fromString('0')

    graphNetwork.totalQueryFees = BigInt.fromI32(0)
    graphNetwork.totalIndexerQueryFeesCollected = BigInt.fromI32(0)
    graphNetwork.totalIndexerQueryFeeRebates = BigInt.fromI32(0)
    graphNetwork.totalDelegatorQueryFeeRebates = BigInt.fromI32(0)
    graphNetwork.totalCuratorQueryFees = BigInt.fromI32(0)
    graphNetwork.totalTaxedQueryFees = BigInt.fromI32(0)
    graphNetwork.totalUnclaimedQueryFeeRebates = BigInt.fromI32(0)

    graphNetwork.totalIndexingRewards = BigInt.fromI32(0)
    graphNetwork.totalIndexingIndexerRewards = BigInt.fromI32(0)
    graphNetwork.totalIndexingDelegatorRewards = BigInt.fromI32(0)

    graphNetwork.networkGRTIssuance = BigInt.fromI32(0)
    graphNetwork.subgraphAvailabilityOracle = Address.fromString(
      '0x0000000000000000000000000000000000000000',
    )

    graphNetwork.totalGRTMinted = BigInt.fromI32(0)
    graphNetwork.totalGRTBurned = BigInt.fromI32(0)

    graphNetwork.defaultReserveRatio = 0
    graphNetwork.minimumCurationDeposit = BigInt.fromI32(0)
    graphNetwork.curationTaxPercentage = 0
    graphNetwork.ownerTaxPercentage = 0

    graphNetwork.totalSupply = BigInt.fromI32(0) // gets set by mint
    graphNetwork.GRTinUSD = BigDecimal.fromString('0')
    graphNetwork.GRTinETH = BigDecimal.fromString('0')

    graphNetwork.epochLength = 0
    graphNetwork.lastRunEpoch = 0
    graphNetwork.lastLengthUpdateEpoch = 0
    graphNetwork.lastLengthUpdateBlock = blockNumber.toI32() // start it first block it was created
    graphNetwork.currentEpoch = 0
    graphNetwork.epochCount = 0

    graphNetwork.indexerCount = 0
    graphNetwork.stakedIndexersCount = 0
    graphNetwork.delegatorCount = 0
    graphNetwork.activeDelegatorCount = 0
    graphNetwork.delegationCount = 0
    graphNetwork.activeDelegationCount = 0
    graphNetwork.curatorCount = 0
    graphNetwork.activeCuratorCount = 0
    graphNetwork.subgraphCount = 0
    graphNetwork.subgraphDeploymentCount = 0
    graphNetwork.activeSubgraphCount = 0

    graphNetwork.arbitrator = Address.fromString('0x0000000000000000000000000000000000000000')
    graphNetwork.querySlashingPercentage = 0
    graphNetwork.indexingSlashingPercentage = 0
    graphNetwork.slashingPercentage = 0 // keeping it for backwards compatibility for now
    graphNetwork.minimumDisputeDeposit = BigInt.fromI32(0)
    graphNetwork.fishermanRewardPercentage = 0

    graphNetwork.save()
  }
  return graphNetwork as GraphNetwork
}

export function createOrLoadContract(contractID: String): Contract {
  let contract = Contract.load(contractID)
  if(contract == null) {
    contract = new Contract(contractID)
    contract.save()
  }
  return contract as Contract
}

export function createOrLoadContractEvent(contractID: String,event: String): ContractEvent {
// TODO This could really benefit from the use of name mangling, if possible.  There might be contract event redundancies without it.
  let contractEvent = ContractEvent.load(joinID([contractID,event]))
  if(contractEvent == null) {
    contractEvent = new ContractEvent(joinID([contractID,event]))
  }
  contractEvent.contract = contractID
  contractEvent.event = event
  contractEvent.save()
  return contractEvent as ContractEvent
}


export function addQm(a: ByteArray): ByteArray {
  let out = new Uint8Array(34)
  out[0] = 0x12
  out[1] = 0x20
  for (let i = 0; i < 32; i++) {
    out[i + 2] = a[i]
  }
  return changetype<ByteArray>(out)
}

// Helper for concatenating two byte arrays
export function concatByteArrays(a: ByteArray, b: ByteArray): ByteArray {
  let out = new Uint8Array(a.length + b.length)
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i]
  }
  for (let j = 0; j < b.length; j++) {
    out[a.length + j] = b[j]
  }
  return changetype<ByteArray>(out)
}

export function getVersionNumber(
  graphAccount: string,
  subgraphNumber: string,
  versionNumber: BigInt,
): BigInt {
  // create versionID. start at version 1
  // TODO - should I start it at 0?
  let versionID = joinID([graphAccount, subgraphNumber, versionNumber.toString()])
  let version = SubgraphVersion.load(versionID)
  // recursion until you get the right version
  if (version != null) {
    versionNumber = versionNumber.plus(BigInt.fromI32(1))
    getVersionNumber(graphAccount, subgraphNumber, versionNumber)
  }
  return versionNumber
}

/**
 * @dev Checks 3 different requirements to resolve a name for a subgraph. Only works with ENS
 * @returns GraphNameAccount ID or null
 */
export function resolveName(graphAccount: Address, name: string, node: Bytes): string | null {
  let graphAccountString = graphAccount.toHexString()
  if (checkTLD(name, node.toHexString())) {
    if (verifyNameOwnership(graphAccountString, node)) {
      let nameSystem = 'ENS'
      let id = joinID([nameSystem, node.toHexString()])
      createGraphAccountName(id, nameSystem, name, graphAccountString)
      // All checks have passed: save the new name and return the ID to be stored on the subgraph
      return id
    }
  }
  // one requirement failed, return null
  return null
}

/**
 * @dev Checks if it is a valid top level .eth domain and that the name matches the name hash.
 * Sub domains automatically return null
 * Non matching names return null
 */
function checkTLD(name: string, node: string): boolean {
  if (name.includes('.') || name == '') return false
  let labelHash = crypto.keccak256(ByteArray.fromUTF8(name))

  // namehash('eth') = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae
  let nameNode = ByteArray.fromHexString(
    '0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae',
  )

  let nameHash = crypto.keccak256(concatByteArrays(nameNode, labelHash)).toHexString()
  return nameHash == node ? true : false
}

/**
 * @dev Checks if the name provided is actually owned by the graph account.
 * @param graphAccount - Graph Account ID
 * @param node - ENS node (i.e. this function only works for ens right now)
 * @returns - true if name is verified
 */
function verifyNameOwnership(graphAccount: string, node: Bytes): boolean {
  let ens = ENS.bind(changetype<Address>(Address.fromHexString(addresses.ens)))
  let ownerOnENS = ens.try_owner(node)
  if (ownerOnENS.reverted == true) {
    log.warning('Try owner reverted for node: {}', [node.toHexString()])
    return false
  } else {
    return ownerOnENS.value.toHexString() == graphAccount ? true : false
  }
}

/**
 * @dev Create the graph account name if it has not been created.
 * In the future when there are multiple name systems, de-duplication will have
 * to be added to the resolver
 */
function createGraphAccountName(
  id: string,
  nameSystem: string,
  name: string,
  graphAccount: string,
): void {
  let graphAccountName = GraphAccountName.load(id)
  // This name is new, so lets register it
  if (graphAccountName == null) {
    graphAccountName = new GraphAccountName(id)
    graphAccountName.nameSystem = nameSystem
    graphAccountName.name = name
    graphAccountName.graphAccount = graphAccount
    graphAccountName.save()
    // check that this name is not already used by another graph account (changing ownership)
    // If so, remove the old owner, and set the new one
  } else if (graphAccountName.graphAccount != graphAccount) {
    // Only update the old graph account if it exists
    if (graphAccountName.graphAccount != null) {
      // Set defaultDisplayName to null if they lost ownership of this name
      let oldGraphAccount = GraphAccount.load(graphAccountName.graphAccount!)!
      oldGraphAccount.defaultDisplayName = null
      oldGraphAccount.save()
    }

    graphAccountName.graphAccount = graphAccount
    graphAccountName.save()
  }
}

export function joinID(pieces: Array<string>): string {
  return pieces.join('-')
}

function min(a: BigDecimal, b: BigDecimal): BigDecimal {
  return a < b ? a : b
}

function max(a: BigDecimal, b: BigDecimal): BigDecimal {
  return a > b ? a : b
}

export function calculateOwnStakeRatio(indexer: Indexer): BigDecimal {
  let stakedTokensBD = indexer.stakedTokens.toBigDecimal()
  let delegatedTokensBD = indexer.delegatedTokens.toBigDecimal()
  let graphNetwork = GraphNetwork.load('1')!
  let delegationRatioBD = BigInt.fromI32(graphNetwork.delegationRatio).toBigDecimal()
  let maxPossibleTotalUsable = stakedTokensBD + stakedTokensBD * delegationRatioBD
  let currentTotalStake = stakedTokensBD + delegatedTokensBD
  let totalUsable = min(maxPossibleTotalUsable, currentTotalStake)
  return totalUsable == BigDecimal.fromString('0')
    ? BigDecimal.fromString('0')
    : stakedTokensBD / totalUsable
}

export function calculateDelegatedStakeRatio(indexer: Indexer): BigDecimal {
  // If own stake ratio is 0 it's because there's no usable stake, so we can't say that delegStakeRatio is 100%.
  // Also, own stake ratio can't be less than 0.0588 with the current delegationRatio, and even if it changes
  // it can never be 0 and have delegations.
  return indexer.ownStakeRatio == BigDecimal.fromString('0')
    ? BigDecimal.fromString('0')
    : BigDecimal.fromString('1') - indexer.ownStakeRatio
}

export function calculateIndexingRewardEffectiveCut(indexer: Indexer): BigDecimal {
  let delegatorCut =
    BigInt.fromI32(1000000 - indexer.indexingRewardCut).toBigDecimal() /
    BigDecimal.fromString('1000000')
  return indexer.delegatedStakeRatio == BigDecimal.fromString('0')
    ? BigDecimal.fromString('0')
    : BigDecimal.fromString('1') - delegatorCut / indexer.delegatedStakeRatio
}

export function calculateQueryFeeEffectiveCut(indexer: Indexer): BigDecimal {
  let delegatorCut =
    BigInt.fromI32(1000000 - indexer.queryFeeCut).toBigDecimal() / BigDecimal.fromString('1000000')
  return indexer.delegatedStakeRatio == BigDecimal.fromString('0')
    ? BigDecimal.fromString('0')
    : BigDecimal.fromString('1') - delegatorCut / indexer.delegatedStakeRatio
}

export function calculateIndexerRewardOwnGenerationRatio(indexer: Indexer): BigDecimal {
  let rewardCut =
    BigInt.fromI32(indexer.indexingRewardCut).toBigDecimal() / BigDecimal.fromString('1000000')
  return indexer.ownStakeRatio == BigDecimal.fromString('0')
    ? BigDecimal.fromString('0')
    : rewardCut / indexer.ownStakeRatio
}

export function calculateOverdelegationDilution(indexer: Indexer): BigDecimal {
  let stakedTokensBD = indexer.stakedTokens.toBigDecimal()
  let delegatedTokensBD = indexer.delegatedTokens.toBigDecimal()
  let graphNetwork = GraphNetwork.load('1')!
  let delegationRatioBD = BigInt.fromI32(graphNetwork.delegationRatio).toBigDecimal()
  let maxDelegatedStake = stakedTokensBD * delegationRatioBD
  return stakedTokensBD == BigDecimal.fromString('0')
    ? BigDecimal.fromString('0')
    : BigDecimal.fromString('1') - maxDelegatedStake / max(maxDelegatedStake, delegatedTokensBD)
}

export function updateAdvancedIndexerMetrics(indexer: Indexer): Indexer {
  indexer.ownStakeRatio = calculateOwnStakeRatio(indexer as Indexer)
  indexer.delegatedStakeRatio = calculateDelegatedStakeRatio(indexer as Indexer)
  indexer.indexingRewardEffectiveCut = calculateIndexingRewardEffectiveCut(indexer as Indexer)
  indexer.queryFeeEffectiveCut = calculateQueryFeeEffectiveCut(indexer as Indexer)
  indexer.indexerRewardsOwnGenerationRatio = calculateIndexerRewardOwnGenerationRatio(
    indexer as Indexer,
  )
  indexer.overDelegationDilution = calculateOverdelegationDilution(indexer as Indexer)
  return indexer as Indexer
}

export function updateDelegationExchangeRate(indexer: Indexer): Indexer {
  indexer.delegationExchangeRate = indexer.delegatedTokens
    .toBigDecimal()
    .div(indexer.delegatorShares.toBigDecimal())
    .truncate(18)
  return indexer as Indexer
}

export function calculatePricePerShare(deployment: SubgraphDeployment): BigDecimal {
  // TODO check why there's a deviation from the values of the bancor formula
  // Ideally this would be a 1 to 1 recreation of the share sell formula, but due to
  // implementation issues for that formula on AssemblyScript (mainly BigDecimal missing pow implementation)
  // I decided to use an approximation derived from testing.

  // This value could be wrong unfortunately, so we should ideally find a workaround later
  // to implement the actual sell share formula for 1 share.

  // reserve ratio multiplier = MAX_WEIGHT / reserveRatio = 1M (ppm) / reserveRatio
  // HOTFIX for now, if deployment.reserveRatio -> 0, use a known previous default
  let reserveRatioMultiplier = deployment.reserveRatio == 0 ? 2 : 1000000 / deployment.reserveRatio
  let pricePerShare =
    deployment.signalAmount == BigInt.fromI32(0)
      ? BigDecimal.fromString('0')
      : deployment.signalledTokens
          .toBigDecimal()
          .div(deployment.signalAmount.toBigDecimal())
          .times(BigInt.fromI32(reserveRatioMultiplier).toBigDecimal())
          .truncate(18)
  return pricePerShare
}

export function createOrLoadNetwork(id: string): Network {
  let network = Network.load(id)
  if (network == null) {
    network = new Network(id)

    network.save()
  }
  return network as Network
}

export function createOrLoadSubgraphCategory(id: string): SubgraphCategory {
  let category = SubgraphCategory.load(id)
  if (category == null) {
    category = new SubgraphCategory(id)

    category.save()
  }
  return category as SubgraphCategory
}

export function createOrLoadSubgraphCategoryRelation(
  categoryId: string,
  subgraphId: string,
): SubgraphCategoryRelation {
  let id = joinID([categoryId, subgraphId])
  let relation = SubgraphCategoryRelation.load(id)
  if (relation == null) {
    relation = new SubgraphCategoryRelation(id)
    relation.subgraph = subgraphId
    relation.category = categoryId

    relation.save()
  }
  return relation as SubgraphCategoryRelation
}

export function updateCurrentDeploymentLinks(
  oldDeployment: SubgraphDeployment | null,
  newDeployment: SubgraphDeployment | null,
  subgraph: Subgraph,
  deprecated: boolean = false,
): void {
  if (oldDeployment != null) {
    if (!deprecated) {
      let oldRelationEntity = CurrentSubgraphDeploymentRelation.load(
        subgraph.currentVersionRelationEntity!,
      )!
      oldRelationEntity.active = false
      oldRelationEntity.save()
    }

    oldDeployment.activeSubgraphCount = oldDeployment.activeSubgraphCount - 1
    if (deprecated) {
      oldDeployment.deprecatedSubgraphCount = oldDeployment.deprecatedSubgraphCount + 1
    }
    oldDeployment.save()
  }

  if (newDeployment != null) {
    let newRelationID = newDeployment.id
      .concat('-')
      .concat(BigInt.fromI32(newDeployment.subgraphCount).toString())
    let newRelationEntity = new CurrentSubgraphDeploymentRelation(newRelationID)
    newRelationEntity.deployment = newDeployment.id
    newRelationEntity.subgraph = subgraph.id
    newRelationEntity.active = true
    newRelationEntity.save()

    newDeployment.subgraphCount = newDeployment.subgraphCount + 1
    newDeployment.activeSubgraphCount = newDeployment.activeSubgraphCount + 1
    newDeployment.save()

    subgraph.currentVersionRelationEntity = newRelationEntity.id
    subgraph.currentSignalledTokens = newDeployment.signalledTokens
    subgraph.save()
  }
}

export function batchUpdateSubgraphSignalledTokens(deployment: SubgraphDeployment): void {
  for (let i = 0; i < deployment.subgraphCount; i++) {
    let id = deployment.id.concat('-').concat(BigInt.fromI32(i).toString())
    let relationEntity = CurrentSubgraphDeploymentRelation.load(id)!
    if (relationEntity.active) {
      let subgraphEntity = Subgraph.load(relationEntity.subgraph)!
      subgraphEntity.currentSignalledTokens = deployment.signalledTokens
      subgraphEntity.save()
    }
  }
}

export function convertBigIntSubgraphIDToBase58(bigIntRepresentation: BigInt): String {
  // Might need to unpad the BigInt since `fromUnsignedBytes` pads one byte with a zero.
  // Although for the events where the uint256 is provided, we probably don't need to unpad.
  let hexString = bigIntRepresentation.toHexString()
  if (hexString.length % 2 != 0) {
    log.error('Hex string not even, hex: {}, original: {}. Padding it to even length', [
      hexString,
      bigIntRepresentation.toString(),
    ])
    hexString = '0x0' + hexString.slice(2)
  }
  let bytes = ByteArray.fromHexString(hexString)
  return bytes.toBase58()
}

export function getSubgraphID(graphAccount: Address, subgraphNumber: BigInt): BigInt {
  let graphAccountStr = graphAccount.toHexString()
  let subgraphNumberStr = subgraphNumber.toHexString().slice(2)
  let number = subgraphNumberStr.padStart(64, '0')
  let unhashedSubgraphID = graphAccountStr.concat(number)
  let hashedId = Bytes.fromByteArray(crypto.keccak256(ByteArray.fromHexString(unhashedSubgraphID)))
  let bigIntRepresentation = BigInt.fromUnsignedBytes(changetype<Bytes>(hashedId.reverse()))
  return bigIntRepresentation
}

export function duplicateOrUpdateSubgraphWithNewID(entity: Subgraph, newID: String, newEntityVersion: i32): Subgraph {
  let subgraph = Subgraph.load(newID)
  if (subgraph == null) {
    subgraph = new Subgraph(newID)
  }

  subgraph.owner = entity.owner
  //subgraph.currentVersion = entity.currentVersion // currentVersion will have to be updated to be the duplicated SubgraphVersion entity afterwards
  subgraph.versionCount = entity.versionCount
  subgraph.createdAt = entity.createdAt
  subgraph.updatedAt = entity.updatedAt
  subgraph.active = entity.active
  subgraph.migrated = entity.migrated
  subgraph.nftID = entity.nftID
  subgraph.oldID = entity.oldID
  subgraph.creatorAddress = entity.creatorAddress
  subgraph.subgraphNumber = entity.subgraphNumber
  subgraph.initializing = entity.initializing
  subgraph.signalledTokens = entity.signalledTokens
  subgraph.unsignalledTokens = entity.unsignalledTokens
  subgraph.currentSignalledTokens = entity.currentSignalledTokens
  subgraph.nameSignalAmount = entity.nameSignalAmount
  subgraph.signalAmount = entity.signalAmount
  subgraph.reserveRatio = entity.reserveRatio
  subgraph.withdrawableTokens = entity.withdrawableTokens
  subgraph.withdrawnTokens = entity.withdrawnTokens
  subgraph.nameSignalCount = entity.nameSignalCount
  subgraph.metadataHash = entity.metadataHash
  subgraph.ipfsMetadataHash = entity.ipfsMetadataHash
  subgraph.description = entity.description
  subgraph.image = entity.image
  subgraph.codeRepository = entity.codeRepository
  subgraph.website = entity.website
  subgraph.displayName = entity.displayName
  // subgraph.pastVersions = entity.pastVersions This is a derived field, we won't copy, but need to make sure NameSignals are duplicated too.
  // subgraph.versions = entity.versions This is a derived field, we won't copy, but need to make sure NameSignals are duplicated too.
  // subgraph.nameSignals = entity.nameSignals This is a derived field, we won't copy, but need to make sure NameSignals are duplicated too.
  // subgraph.categories = entity.categories This is a derived field, we wont' copy, but need to make sure Categories auxiliary entities are properly duplicated too.

  subgraph.entityVersion = newEntityVersion
  subgraph.linkedEntity = entity.id // this is the entity id, since for the entity, this value will be this particular entity.

  return subgraph as Subgraph
}

export function duplicateOrUpdateSubgraphVersionWithNewID(entity: SubgraphVersion, newID: String, newEntityVersion: i32): SubgraphVersion {
  let version = SubgraphVersion.load(newID)
  if (version == null) {
    version = new SubgraphVersion(newID)
  }

  version.subgraphDeployment = entity.subgraphDeployment
  version.version = entity.version
  version.createdAt = entity.createdAt
  version.metadataHash = entity.metadataHash
  version.description = entity.description
  version.label = entity.label
  //version.subgraph = entity.subgraph

  version.entityVersion = newEntityVersion
  version.linkedEntity = entity.id

  return version as SubgraphVersion
}

export function duplicateOrUpdateNameSignalWithNewID(entity: NameSignal, newID: String, newEntityVersion: i32): NameSignal {
  let signal = NameSignal.load(newID)
  if (signal == null) {
    signal = new NameSignal(newID)
  }

  signal.curator = entity.curator
  //signal.subgraph = entity.subgraph
  signal.signalledTokens = entity.signalledTokens
  signal.unsignalledTokens = entity.unsignalledTokens
  signal.withdrawnTokens = entity.withdrawnTokens
  signal.nameSignal = entity.nameSignal
  signal.signal = entity.signal
  signal.lastNameSignalChange = entity.lastNameSignalChange
  signal.realizedRewards = entity.realizedRewards
  signal.averageCostBasis = entity.averageCostBasis
  signal.averageCostBasisPerSignal = entity.averageCostBasisPerSignal
  signal.nameSignalAverageCostBasis = entity.nameSignalAverageCostBasis
  signal.nameSignalAverageCostBasisPerSignal = entity.nameSignalAverageCostBasisPerSignal
  signal.signalAverageCostBasis = entity.signalAverageCostBasis
  signal.signalAverageCostBasisPerSignal = entity.signalAverageCostBasisPerSignal

  signal.entityVersion = newEntityVersion
  signal.linkedEntity = entity.id

  return signal as NameSignal
}
