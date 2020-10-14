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
} from '../types/schema'
import { ENS } from '../types/GNS/ENS'
import { Controller } from '../types/Controller/Controller'

import { addresses } from '../../config/addresses'

export function createOrLoadSubgraph(
  subgraphID: string,
  owner: Address,
  timestamp: BigInt,
): Subgraph {
  let subgraph = Subgraph.load(subgraphID)
  if (subgraph == null) {
    subgraph = new Subgraph(subgraphID)
    subgraph.owner = owner.toHexString()
    subgraph.pastVersions = []
    subgraph.createdAt = timestamp.toI32()
    subgraph.updatedAt = timestamp.toI32()

    subgraph.signalledTokens = BigInt.fromI32(0)
    subgraph.unsignalledTokens = BigInt.fromI32(0)
    subgraph.nameSignalAmount = BigInt.fromI32(0)
    subgraph.reserveRatio = 0
    subgraph.withdrawableTokens = BigInt.fromI32(0)
    subgraph.withdrawnTokens = BigInt.fromI32(0)

    subgraph.metadataHash = Bytes.fromI32(0) as Bytes
    subgraph.description = ''
    subgraph.image = ''
    subgraph.codeRepository = ''
    subgraph.website = ''
    subgraph.displayName = ''

    subgraph.totalIndexingRewards = BigInt.fromI32(0)
    subgraph.totalQueryFeesCollected = BigInt.fromI32(0)

    subgraph.save()

    let graphNetwork = GraphNetwork.load('1')
    graphNetwork.subgraphCount = graphNetwork.subgraphCount + 1
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
    deployment = new SubgraphDeployment(subgraphID)
    deployment.createdAt = timestamp.toI32()
    deployment.stakedTokens = BigInt.fromI32(0)
    deployment.indexingRewardAmount = BigInt.fromI32(0)
    deployment.queryFeesAmount = BigInt.fromI32(0)
    deployment.queryFeeRebates = BigInt.fromI32(0)
    deployment.curatorFeeRewards = BigInt.fromI32(0)

    deployment.signalledTokens = BigInt.fromI32(0)
    deployment.unsignalledTokens = BigInt.fromI32(0)
    deployment.signalAmount = BigInt.fromI32(0)
    deployment.reserveRatio = 0
    deployment.deniedAt = 0
    deployment.save()

    let graphNetwork = GraphNetwork.load('1')
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

    indexer.delegatedCapacity = BigInt.fromI32(0)
    indexer.tokenCapacity = BigInt.fromI32(0)
    indexer.availableStake = BigInt.fromI32(0)

    indexer.delegatedTokens = BigInt.fromI32(0)
    indexer.delegatorShares = BigInt.fromI32(0)
    indexer.delegationExchangeRate = BigDecimal.fromString('0')
    indexer.tokenCapacity = BigInt.fromI32(0)
    indexer.indexingRewardCut = 0
    indexer.delegatorIndexingRewards = BigInt.fromI32(0)
    indexer.delegatorQueryFees = BigInt.fromI32(0)
    indexer.queryFeeCut = 0
    indexer.delegatorParameterCooldown = 0
    indexer.lastDelegationParameterUpdate = 0
    indexer.forcedClosures = 0

    indexer.totalReturn = BigDecimal.fromString('0')
    indexer.annualizedReturn = BigDecimal.fromString('0')
    indexer.stakingEfficiency = BigDecimal.fromString('0')
    indexer.save()

    let graphAccount = GraphAccount.load(id)
    graphAccount.indexer = id
    graphAccount.save()

    let graphNetwork = GraphNetwork.load('1')
    graphNetwork.indexerCount = graphNetwork.indexerCount + 1
    graphNetwork.save()
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
    delegator.save()

    let graphAccount = GraphAccount.load(id)
    graphAccount.delegator = id
    graphAccount.save()

    let graphNetwork = GraphNetwork.load('1')
    graphNetwork.delegatorCount = graphNetwork.delegatorCount + 1
    graphNetwork.save()
  }
  return delegator as Delegator
}

export function createOrLoadDelegatedStake(delegator: string, indexer: string): DelegatedStake {
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
    delegatedStake.personalExchangeRate = BigDecimal.fromString('0')
    delegatedStake.realizedRewards = BigDecimal.fromString('0')
    delegatedStake.save()
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
    curator.save()

    let graphAccount = GraphAccount.load(id)
    graphAccount.curator = id
    graphAccount.save()

    let graphNetwork = GraphNetwork.load('1')
    graphNetwork.curatorCount = graphNetwork.curatorCount + 1
    graphNetwork.save()
  }
  return curator as Curator
}

export function createOrLoadSignal(curator: string, subgraphDeploymentID: string): Signal {
  let signalID = joinID([curator, subgraphDeploymentID])
  let signal = Signal.load(signalID)
  if (signal == null) {
    signal = new Signal(signalID)
    signal.curator = curator
    signal.subgraphDeployment = subgraphDeploymentID
    signal.signalledTokens = BigInt.fromI32(0)
    signal.unsignalledTokens = BigInt.fromI32(0)
    signal.signal = BigInt.fromI32(0)
    signal.lastSignalChange = 0
    signal.realizedRewards = BigInt.fromI32(0)
    signal.save()
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
    nameSignal.curator = underlyingCurator.id
    nameSignal.subgraph = subgraphID
    nameSignal.signalledTokens = BigInt.fromI32(0)
    nameSignal.unsignalledTokens = BigInt.fromI32(0)
    nameSignal.withdrawnTokens = BigInt.fromI32(0)
    nameSignal.nameSignal = BigInt.fromI32(0)
    nameSignal.lastNameSignalChange = 0
    nameSignal.realizedRewards = BigInt.fromI32(0)
    nameSignal.save()
  }
  return nameSignal as NameSignal
}

export function createOrLoadGraphAccount(
  id: string,
  owner: Bytes,
  timeStamp: BigInt,
): GraphAccount {
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
  let graphNetwork = GraphNetwork.load('1')
  let epochsSinceLastUpdate = blockNumber
    .minus(BigInt.fromI32(graphNetwork.lastLengthUpdateBlock))
    .div(BigInt.fromI32(graphNetwork.epochLength))
  let epoch: Epoch

  // true if we need to create
  let needsCreating =
    epochsSinceLastUpdate.toI32() > graphNetwork.currentEpoch - graphNetwork.lastLengthUpdateEpoch
  // true if its first epoch
  let isFirstEpoch = graphNetwork.currentEpoch == 0 && epochsSinceLastUpdate.toI32() == 0

  if (needsCreating || isFirstEpoch) {
    let newEpoch = graphNetwork.lastLengthUpdateEpoch + epochsSinceLastUpdate.toI32()
    if (newEpoch == 0) {
      // there is no 0 epoch. we start at 1
      newEpoch = 1
    }

    let startBlock =
      graphNetwork.lastLengthUpdateBlock + epochsSinceLastUpdate.toI32() * graphNetwork.epochLength
    epoch = createEpoch(startBlock, graphNetwork.epochLength, newEpoch)

    graphNetwork.epochCount = graphNetwork.epochCount + 1
    graphNetwork.currentEpoch = newEpoch
    graphNetwork.save()

    // Just load and return
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
  epoch.totalRewards = BigInt.fromI32(0)
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

    let contract = Controller.bind(controllerAddress as Address)
    let governor = contract.getGovernor()

    // All of the 0x0000 addresses will be replaced in controller deployment calls
    // Service registry is not stored in the Controller so we get it manually
    graphNetwork.controller = controllerAddress
    graphNetwork.graphToken = Address.fromString('0x0000000000000000000000000000000000000000')
    graphNetwork.epochManager = Address.fromString('0x0000000000000000000000000000000000000000')
    graphNetwork.epochManagerImplementations = []
    graphNetwork.curation = Address.fromString('0x0000000000000000000000000000000000000000')
    graphNetwork.curationImplementations = []
    graphNetwork.staking = Address.fromString('0x0000000000000000000000000000000000000000')
    graphNetwork.stakingImplementations = []
    graphNetwork.disputeManager = Address.fromString('0x0000000000000000000000000000000000000000')
    graphNetwork.gns = Address.fromString('0x0000000000000000000000000000000000000000')
    graphNetwork.serviceRegistry = Address.fromString(addresses.serviceRegistry)
    graphNetwork.rewardsManager = Address.fromString('0x0000000000000000000000000000000000000000')
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
    graphNetwork.indexingRewardsPerEpoch = 0
    graphNetwork.delegationUnbondingPeriod = 0

    graphNetwork.totalTokensStaked = BigInt.fromI32(0)
    graphNetwork.totalTokensClaimable = BigInt.fromI32(0)
    graphNetwork.totalUnstakedTokensLocked = BigInt.fromI32(0)
    graphNetwork.totalTokensAllocated = BigInt.fromI32(0)
    graphNetwork.totalQueryFees = BigInt.fromI32(0)
    graphNetwork.totalDelegatedTokens = BigInt.fromI32(0)
    graphNetwork.totalIndexingRewards = BigInt.fromI32(0)

    graphNetwork.networkGRTIssuance = 0
    graphNetwork.subgraphAvailabilityOracle = Address.fromString(
      '0x0000000000000000000000000000000000000000',
    )

    graphNetwork.defaultReserveRatio = 0
    graphNetwork.minimumCurationDeposit = BigInt.fromI32(0)
    graphNetwork.withdrawalFeePercentage = 0

    graphNetwork.totalTokensSignalled = BigInt.fromI32(0)

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
    graphNetwork.delegatorCount = 0
    graphNetwork.curatorCount = 0
    graphNetwork.subgraphCount = 0
    graphNetwork.subgraphDeploymentCount = 0

    graphNetwork.slashingPercentage = 0

    graphNetwork.save()
  }
  return graphNetwork as GraphNetwork
}

export function addQm(a: ByteArray): ByteArray {
  let out = new Uint8Array(34)
  out[0] = 0x12
  out[1] = 0x20
  for (let i = 0; i < 32; i++) {
    out[i + 2] = a[i]
  }
  return out as ByteArray
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
  return out as ByteArray
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
      if (createGraphAccountName(id, nameSystem, name, graphAccountString)) {
        // all checks passed. save the new name, return the ID to be stored on the subgraph
        return id
      }
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
  let ens = ENS.bind(Address.fromHexString(addresses.ens) as Address)
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
): boolean {
  let graphAccountName = GraphAccountName.load(id)
  // This name is new, so lets register it
  if (graphAccountName == null) {
    graphAccountName = new GraphAccountName(id)
    graphAccountName.nameSystem = nameSystem
    graphAccountName.name = name
    graphAccountName.graphAccount = graphAccount
    graphAccountName.save()
    return true
    // check that this name is not already used by another graph account (changing ownership)
    // If so, remove the old owner, and set the new one
  } else if (graphAccountName.graphAccount != graphAccount) {
    graphAccountName.graphAccount = graphAccount
    graphAccountName.save()
    return true
  }
  return true
}

export function joinID(pieces: Array<string>): string {
  return pieces.join('-')
}
