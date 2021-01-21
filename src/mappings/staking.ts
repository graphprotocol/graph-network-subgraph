import { BigInt, Address, BigDecimal, Bytes, ipfs, log } from '@graphprotocol/graph-ts'
import {
  StakeDeposited,
  StakeWithdrawn,
  StakeLocked,
  StakeSlashed,
  AllocationCreated,
  AllocationClosed,
  RebateClaimed,
  ParameterUpdated,
  Staking,
  SetOperator,
  StakeDelegated,
  StakeDelegatedLocked,
  StakeDelegatedWithdrawn,
  AllocationCollected,
  DelegationParametersUpdated,
  SlasherUpdate,
  AssetHolderUpdate,
} from '../types/Staking/Staking'
import {
  Indexer,
  Allocation,
  GraphNetwork,
  Pool,
  SubgraphDeployment,
  GraphAccount,
  Delegator,
  DelegatedStake,
} from '../types/schema'

import {
  createOrLoadSubgraphDeployment,
  createOrLoadIndexer,
  createOrLoadPool,
  createOrLoadEpoch,
  joinID,
  createOrLoadDelegator,
  createOrLoadDelegatedStake,
  createOrLoadGraphAccount,
  updateAdvancedIndexerMetrics,
} from './helpers'

export function handleDelegationParametersUpdated(event: DelegationParametersUpdated): void {
  let id = event.params.indexer.toHexString()
  // Quick fix to avoid creating new Indexer entities if they don't exist yet.
  let account = GraphAccount.load(id)
  if (account != null) {
    let indexer = createOrLoadIndexer(id, event.block.timestamp)
    indexer.indexingRewardCut = event.params.indexingRewardCut.toI32()
    indexer.queryFeeCut = event.params.queryFeeCut.toI32()
    indexer.delegatorParameterCooldown = event.params.cooldownBlocks.toI32()
    indexer.lastDelegationParameterUpdate = event.block.number.toI32()
    indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
    indexer.save()
  }
}

/**
 * @dev handleStakeDeposited
 * - creates an Indexer if it is the first time they have staked
 * - updated the Indexers stake
 * - updates the GraphNetwork total stake
 */
export function handleStakeDeposited(event: StakeDeposited): void {
  // update indexer
  let id = event.params.indexer.toHexString()
  let indexer = createOrLoadIndexer(id, event.block.timestamp)
  let previousStake = indexer.stakedTokens
  indexer.stakedTokens = indexer.stakedTokens.plus(event.params.tokens)
  indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
  indexer = calculateCapacities(indexer as Indexer)
  indexer.save()

  // Update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalTokensStaked = graphNetwork.totalTokensStaked.plus(event.params.tokens)
  if (previousStake == BigInt.fromI32(0)) {
    graphNetwork.stakedIndexersCount = graphNetwork.stakedIndexersCount + 1
  }
  graphNetwork.save()

  // Update epoch
  let epoch = createOrLoadEpoch(event.block.number)
  epoch.stakeDeposited = epoch.stakeDeposited.plus(event.params.tokens)
  epoch.save()
}

/**
 * @dev handleStakeLocked
 * - updated the Indexers stake
 * - note - the contracts work by not changing the tokensStaked amount, so here, capacity does not
 *          get changed
 */
export function handleStakeLocked(event: StakeLocked): void {
  // update indexer
  let id = event.params.indexer.toHexString()
  let indexer = Indexer.load(id)
  indexer.lockedTokens = event.params.tokens
  indexer.tokensLockedUntil = event.params.until.toI32()
  indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
  indexer = calculateCapacities(indexer as Indexer)
  indexer.save()

  // update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalUnstakedTokensLocked = graphNetwork.totalUnstakedTokensLocked.plus(
    event.params.tokens,
  )
  graphNetwork.save()
}

/**
 * @dev handleStakeWithdrawn
 * - updated the Indexers stake
 * - updates the GraphNetwork total stake
 */
export function handleStakeWithdrawn(event: StakeWithdrawn): void {
  // update indexer
  let id = event.params.indexer.toHexString()
  let indexer = Indexer.load(id)
  indexer.stakedTokens = indexer.stakedTokens.minus(event.params.tokens)
  indexer.lockedTokens = indexer.lockedTokens.minus(event.params.tokens)
  indexer.tokensLockedUntil = 0 // always set to 0 when withdrawn
  indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
  indexer = calculateCapacities(indexer as Indexer)
  indexer.save()

  // Update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalTokensStaked = graphNetwork.totalTokensStaked.minus(event.params.tokens)
  graphNetwork.totalUnstakedTokensLocked = graphNetwork.totalUnstakedTokensLocked.minus(
    event.params.tokens,
  )
  if (indexer.stakedTokens == BigInt.fromI32(0)) {
    graphNetwork.stakedIndexersCount = graphNetwork.stakedIndexersCount - 1
  }
  graphNetwork.save()
}

/**
 * @dev handleStakeSlashed
 * - update the Indexers stake
 */
export function handleStakeSlashed(event: StakeSlashed): void {
  let id = event.params.indexer.toHexString()
  let indexer = Indexer.load(id)

  indexer.stakedTokens = indexer.stakedTokens.minus(event.params.tokens)

  // We need to call into stakes mapping, because locked tokens might have been
  // decremented, and this is not released in the event
  // To fix this we would need to indicate in the event how many locked tokens were released
  let graphNetwork = GraphNetwork.load('1')
  let staking = Staking.bind(event.address)
  let indexerStored = staking.stakes(event.params.indexer)
  indexer.lockedTokens = indexerStored.value2
  indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
  indexer = calculateCapacities(indexer as Indexer)
  indexer.save()

  // Update graph network
  graphNetwork.totalTokensStaked = graphNetwork.totalTokensStaked.minus(event.params.tokens)
  graphNetwork.save()
}

export function handleStakeDelegated(event: StakeDelegated): void {
  let zeroShares = event.params.shares.equals(BigInt.fromI32(0))

  // update indexer
  let indexerID = event.params.indexer.toHexString()
  let indexer = createOrLoadIndexer(indexerID, event.block.timestamp)
  indexer.delegatedTokens = indexer.delegatedTokens.plus(event.params.tokens)
  indexer.delegatorShares = indexer.delegatorShares.plus(event.params.shares)
  if (indexer.delegatorShares.gt(BigInt.fromI32(0))) {
    indexer.delegationExchangeRate = indexer.delegatedTokens
      .toBigDecimal()
      .div(indexer.delegatorShares.toBigDecimal())
  }
  indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
  indexer = calculateCapacities(indexer as Indexer)
  indexer.save()

  // update delegator
  let delegatorID = event.params.delegator.toHexString()
  let delegator = createOrLoadDelegator(delegatorID, event.block.timestamp)
  delegator.totalStakedTokens = delegator.totalStakedTokens.plus(event.params.tokens)
  delegator.save()

  // update delegated stake
  let delegatedStake = createOrLoadDelegatedStake(
    delegatorID,
    indexerID,
    event.block.timestamp.toI32(),
  )
  if (!zeroShares) {
    let previousExchangeRate = delegatedStake.personalExchangeRate
    let previousShares = delegatedStake.shareAmount
    let averageCostBasisTokens = previousExchangeRate
      .times(previousShares.toBigDecimal())
      .plus(event.params.tokens.toBigDecimal())
    let averageCostBasisShares = previousShares.plus(event.params.shares)
    if (averageCostBasisShares.gt(BigInt.fromI32(0))) {
      delegatedStake.personalExchangeRate = averageCostBasisTokens.div(
        averageCostBasisShares.toBigDecimal(),
      )
    }
  }

  delegatedStake.stakedTokens = delegatedStake.stakedTokens.plus(event.params.tokens)
  delegatedStake.shareAmount = delegatedStake.shareAmount.plus(event.params.shares)
  delegatedStake.save()

  // upgrade graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalDelegatedTokens = graphNetwork.totalDelegatedTokens.plus(event.params.tokens)
  graphNetwork.save()
}

export function handleStakeDelegatedLocked(event: StakeDelegatedLocked): void {
  // update indexer
  let indexerID = event.params.indexer.toHexString()
  let indexer = Indexer.load(indexerID)
  indexer.delegatedTokens = indexer.delegatedTokens.minus(event.params.tokens)
  indexer.delegatorShares = indexer.delegatorShares.minus(event.params.shares)

  if (indexer.delegatorShares != BigInt.fromI32(0)) {
    indexer.delegationExchangeRate = indexer.delegatedTokens
      .toBigDecimal()
      .div(indexer.delegatorShares.toBigDecimal())
  }
  indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
  indexer = calculateCapacities(indexer as Indexer)
  indexer.save()

  // update delegated stake
  let delegatorID = event.params.delegator.toHexString()
  let id = joinID([delegatorID, indexerID])
  let delegatedStake = DelegatedStake.load(id)
  delegatedStake.unstakedTokens = delegatedStake.unstakedTokens.plus(event.params.tokens)
  delegatedStake.shareAmount = delegatedStake.shareAmount.minus(event.params.shares)
  delegatedStake.lockedTokens = delegatedStake.lockedTokens.plus(event.params.tokens)
  delegatedStake.lockedUntil = event.params.until.toI32() // until always updates and overwrites the past lockedUntil time

  let realizedRewards = event.params.shares
    .toBigDecimal()
    .times(indexer.delegationExchangeRate.minus(delegatedStake.personalExchangeRate))
  delegatedStake.realizedRewards = delegatedStake.realizedRewards.plus(realizedRewards)
  delegatedStake.save()

  // update delegator
  let delegator = Delegator.load(delegatorID)
  delegator.totalUnstakedTokens = delegator.totalUnstakedTokens.plus(event.params.tokens)
  delegator.totalRealizedRewards = delegator.totalRealizedRewards.plus(realizedRewards)
  delegator.save()

  // upgrade graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalDelegatedTokens = graphNetwork.totalDelegatedTokens.minus(event.params.tokens)
  graphNetwork.save()
}

export function handleStakeDelegatedWithdrawn(event: StakeDelegatedWithdrawn): void {
  let indexerID = event.params.indexer.toHexString()
  let delegatorID = event.params.delegator.toHexString()
  let id = joinID([delegatorID, indexerID])
  let delegatedStake = DelegatedStake.load(id)
  delegatedStake.lockedTokens = BigInt.fromI32(0)
  delegatedStake.lockedUntil = 0
  delegatedStake.save()
}

/**
 * @dev handleAllocationUpdated
 * - update the indexers stake
 * - update the subgraph total stake
 * - update the named subgraph aggregate stake
 * - update the specific allocation
 * - create a new channel
 */
export function handleAllocationCreated(event: AllocationCreated): void {
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  let indexerID = event.params.indexer.toHexString()
  let channelID = event.params.allocationID.toHexString()
  let allocationID = channelID

  // update indexer
  let indexer = Indexer.load(indexerID)
  indexer.allocatedTokens = indexer.allocatedTokens.plus(event.params.tokens)
  indexer.totalAllocationCount = indexer.totalAllocationCount.plus(BigInt.fromI32(1))
  indexer.allocationCount = indexer.allocationCount + 1
  indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
  indexer = calculateCapacities(indexer as Indexer)
  indexer.save()

  // update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalTokensAllocated = graphNetwork.totalTokensAllocated.plus(event.params.tokens)
  graphNetwork.save()

  // update subgraph deployment
  let deployment = createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp)
  deployment.stakedTokens = deployment.stakedTokens.plus(event.params.tokens)
  deployment.save()

  // create allocation
  let allocation = new Allocation(allocationID)
  allocation.indexer = indexerID
  allocation.creator = event.transaction.from
  allocation.activeForIndexer = indexerID
  allocation.subgraphDeployment = subgraphDeploymentID
  allocation.allocatedTokens = event.params.tokens
  allocation.effectiveAllocation = BigInt.fromI32(0)
  allocation.createdAtEpoch = event.params.epoch.toI32()
  allocation.closedAtEpoch = 0
  allocation.createdAtBlockHash = event.block.hash
  allocation.queryFeesCollected = BigInt.fromI32(0)
  allocation.queryFeeRebates = BigInt.fromI32(0)
  allocation.curatorRewards = BigInt.fromI32(0)
  allocation.indexingRewards = BigInt.fromI32(0)
  allocation.indexingIndexerRewards = BigInt.fromI32(0)
  allocation.indexingDelegatorRewards = BigInt.fromI32(0)
  allocation.delegationFees = BigInt.fromI32(0)
  allocation.status = 'Active'
  allocation.totalReturn = BigDecimal.fromString('0')
  allocation.annualizedReturn = BigDecimal.fromString('0')
  allocation.createdAt = event.block.timestamp.toI32()
  allocation.save()
}

// Transfers tokens from a state channel to the staking contract
// Burns fees if protocolPercentage > 0
// Collects curationFees to go to curator rewards
// calls collect() on curation, which is handled in curation.ts
// adds to the allocations collected fees
// if closed, it will add fees to the rebate pool
// Note - the name event.param.rebateFees is confusing. Rebate fees are better described
// as query Fees. rebate is from cobbs douglas, which we get from claim()
export function handleAllocationCollected(event: AllocationCollected): void {
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  let indexerID = event.params.indexer.toHexString()
  let allocationID = event.params.allocationID.toHexString()

  // update indexer
  let indexer = Indexer.load(indexerID)
  indexer.queryFeesCollected = indexer.queryFeesCollected.plus(event.params.rebateFees)
  indexer.save()

  // update allocation
  // rebateFees is the total token value minus the curation and protocol fees, as can be seen in the contracts
  let allocation = Allocation.load(allocationID)
  allocation.queryFeesCollected = allocation.queryFeesCollected.plus(event.params.rebateFees)
  allocation.curatorRewards = allocation.curatorRewards.plus(event.params.curationFees)
  allocation.save()

  // Update epoch - none

  // update pool
  let pool = createOrLoadPool(event.params.epoch)
  // ONLY if allocation is closed. Otherwise it gets collected into an allocation, and it will
  // get added to the pool where the allocation gets closed
  if (allocation.status == 'Closed') {
    pool.totalQueryFees = pool.totalQueryFees.plus(event.params.rebateFees)
  }
  // Curator rewards in pool is not stored in the contract, so we take the actual value of it
  // happening. Every time an allocation is collected, curator rewards get transferred into
  // bonding curves. Hence why it is not dependant on status being closed
  pool.curatorRewards = pool.curatorRewards.plus(event.params.curationFees)
  pool.save()

  // update subgraph deployment
  let deployment = SubgraphDeployment.load(subgraphDeploymentID)
  deployment.queryFeesAmount = deployment.queryFeesAmount.plus(event.params.rebateFees)
  deployment.signalledTokens = deployment.signalledTokens.plus(event.params.curationFees)
  deployment.curatorFeeRewards = deployment.curatorFeeRewards.plus(event.params.curationFees)
  deployment.save()

  // since we don't get the protocol tax explicitly, we will use tokens - (curation + rebate) to calculate it
  // This could also be calculated by doing: protocolPercentage * event.params.tokens
  let taxedFees = event.params.tokens.minus(event.params.rebateFees.plus(event.params.curationFees))

  // update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalQueryFees = graphNetwork.totalQueryFees.plus(event.params.tokens)
  graphNetwork.totalIndexerQueryFeesCollected = graphNetwork.totalIndexerQueryFeesCollected.plus(
    event.params.rebateFees,
  )
  graphNetwork.totalCuratorQueryFees = graphNetwork.totalCuratorQueryFees.plus(
    event.params.curationFees,
  )
  graphNetwork.totalTaxedQueryFees = graphNetwork.totalTaxedQueryFees.plus(taxedFees)
  graphNetwork.totalUnclaimedQueryFeeRebates = graphNetwork.totalUnclaimedQueryFeeRebates.plus(
    event.params.rebateFees,
  )
  graphNetwork.save()
}

/**
 * @dev handleAllocationClosed
 * - update the indexers stake
 * - update the subgraph total stake
 * - update the named subgraph aggregate stake
 * - update the specific allocation
 * - update and close the channel
 */
export function handleAllocationClosed(event: AllocationClosed): void {
  let indexerID = event.params.indexer.toHexString()
  let allocationID = event.params.allocationID.toHexString()

  // update indexer
  let indexer = Indexer.load(indexerID)
  if (event.params.sender != event.params.indexer) {
    indexer.forcedClosures = indexer.forcedClosures + 1
  }
  indexer.allocatedTokens = indexer.allocatedTokens.minus(event.params.tokens)
  indexer.allocationCount = indexer.allocationCount - 1
  indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
  indexer = calculateCapacities(indexer as Indexer)
  indexer.save()

  // update allocation
  let allocation = Allocation.load(allocationID)
  allocation.poolClosedIn = event.params.epoch.toString()
  allocation.activeForIndexer = null
  allocation.closedAtEpoch = event.params.epoch.toI32()
  allocation.closedAtBlockHash = event.block.hash
  allocation.closedAtBlockNumber = event.block.number.toI32()
  allocation.effectiveAllocation = event.params.effectiveAllocation
  allocation.status = 'Closed'
  allocation.poi = event.params.poi
  allocation.save()

  // update epoch - We do it here to have more epochs created, instead of seeing none created
  // Likely this problem would go away with a live network with long epochs
  // But we keep it here anyway. We might think of adding data in the future, like epoch.tokensClosed
  let epoch = createOrLoadEpoch(event.block.number)
  epoch.save()
  // update pool
  let pool = createOrLoadPool(event.params.epoch)
  // effective allocation is the value stored in contracts, so we use it here
  pool.allocation = pool.allocation.plus(event.params.effectiveAllocation)

  // We must call the contract directly to see how many fees are getting closed in this
  // allocation. The event does not emit this information
  let staking = Staking.bind(event.address)
  let contractAlloc = staking.getAllocation(event.params.allocationID)
  pool.totalQueryFees = pool.totalQueryFees.plus(contractAlloc.collectedFees)
  pool.save()

  // update subgraph deployment. Pretty sure this should be done here, if not
  // it would be done in handleRebateClaimed
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  let deployment = createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp)
  deployment.stakedTokens = deployment.stakedTokens.minus(event.params.tokens)
  deployment.save()

  // update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalTokensAllocated = graphNetwork.totalTokensAllocated.minus(event.params.tokens)
  graphNetwork.save()
}

/**
 * @dev handleRebateClaimed
 * - update pool
 * - update closure of channel in pool
 * - update pool
 * - note - if rebate is transferred to indexer, that will be handled in graphToken.ts, and in
 *          the other case, if it is restaked, it will be handled by handleStakeDeposited
 */
export function handleRebateClaimed(event: RebateClaimed): void {
  let indexerID = event.params.indexer.toHexString()
  let allocationID = event.params.allocationID.toHexString()
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()

  // update indexer
  let indexer = Indexer.load(indexerID)
  indexer.queryFeeRebates = indexer.queryFeeRebates.plus(event.params.tokens)
  indexer.delegatorQueryFees = indexer.delegatorQueryFees.plus(event.params.delegationFees)
  indexer.delegatedTokens = indexer.delegatedTokens.plus(event.params.delegationFees)

  if (indexer.delegatorShares != BigInt.fromI32(0)) {
    indexer.delegationExchangeRate = indexer.delegatedTokens
      .toBigDecimal()
      .div(indexer.delegatorShares.toBigDecimal())
  }
  indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
  indexer.save()
  // update allocation
  let allocation = Allocation.load(allocationID)
  allocation.queryFeeRebates = event.params.tokens
  allocation.delegationFees = event.params.delegationFees
  allocation.status = 'Claimed'
  allocation.save()

  // Update epoch
  let epoch = createOrLoadEpoch(event.block.number)
  epoch.queryFeeRebates = epoch.queryFeeRebates.plus(event.params.tokens)
  epoch.save()

  // update pool
  let pool = Pool.load(event.params.forEpoch.toString())
  pool.claimedFees = pool.claimedFees.plus(event.params.tokens)
  pool.save()

  // update subgraph deployment
  let subgraphDeployment = SubgraphDeployment.load(subgraphDeploymentID)
  subgraphDeployment.queryFeeRebates = subgraphDeployment.queryFeeRebates.plus(event.params.tokens)
  subgraphDeployment.save()

  // update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalIndexerQueryFeeRebates = graphNetwork.totalIndexerQueryFeeRebates.plus(
    event.params.tokens,
  )
  graphNetwork.totalDelegatorQueryFeeRebates = graphNetwork.totalDelegatorQueryFeeRebates.plus(
    event.params.delegationFees,
  )
  graphNetwork.totalUnclaimedQueryFeeRebates = graphNetwork.totalUnclaimedQueryFeeRebates.minus(
    event.params.delegationFees.plus(event.params.tokens),
  )
  graphNetwork.save()
}

/**
 * @dev handleParameterUpdated
 * - updates all parameters of staking, depending on string passed. We then can
 *   call the contract directly to get the updated value
 */
export function handleParameterUpdated(event: ParameterUpdated): void {
  let parameter = event.params.param
  let graphNetwork = GraphNetwork.load('1')
  let staking = Staking.bind(event.address)

  if (parameter == 'minimumIndexerStake') {
    graphNetwork.minimumIndexerStake = staking.minimumIndexerStake()
  } else if (parameter == 'thawingPeriod') {
    graphNetwork.thawingPeriod = staking.thawingPeriod().toI32()
  } else if (parameter == 'curationPercentage') {
    graphNetwork.curationPercentage = staking.curationPercentage().toI32()
  } else if (parameter == 'protocolPercentage') {
    graphNetwork.protocolFeePercentage = staking.protocolPercentage().toI32()
  } else if (parameter == 'channelDisputeEpochs') {
    graphNetwork.channelDisputeEpochs = staking.channelDisputeEpochs().toI32()
  } else if (parameter == 'maxAllocationEpochs') {
    graphNetwork.maxAllocationEpochs = staking.maxAllocationEpochs().toI32()
  } else if (parameter == 'rebateRatio') {
    graphNetwork.rebateRatio = staking
      .alphaNumerator()
      .toBigDecimal()
      .div(staking.alphaDenominator().toBigDecimal()) // alphaDemoninator != 0, no div() protection needed
  } else if (parameter == 'delegationRatio') {
    graphNetwork.delegationRatio = staking.delegationRatio().toI32()
  } else if (parameter == 'delegationParametersCooldown') {
    graphNetwork.delegationParametersCooldown = staking.delegationParametersCooldown().toI32()
  } else if (parameter == 'delegationUnbondingPeriod') {
    graphNetwork.delegationUnbondingPeriod = staking.delegationUnbondingPeriod().toI32()
  } else if (parameter == 'delegationTaxPercentage') {
    graphNetwork.delegationTaxPercentage = staking.delegationTaxPercentage().toI32()
  }
  graphNetwork.save()
}

export function handleSetOperator(event: SetOperator): void {
  let graphAccount = createOrLoadGraphAccount(
    event.params.indexer.toHexString(),
    event.params.indexer,
    event.block.timestamp,
  )
  let operators = graphAccount.operators
  let index = operators.indexOf(event.params.operator.toHexString())
  if (index != -1) {
    // false - it existed, and we set it to false, so remove from operators
    if (!event.params.allowed) {
      operators.splice(index, 1)
    }
  } else {
    // true - it did not exist before, and we say add, so add
    if (event.params.allowed) {
      operators.push(event.params.operator.toHexString())
      // Create the operator as a graph account
      createOrLoadGraphAccount(
        event.params.operator.toHexString(),
        event.params.operator,
        event.block.timestamp,
      )
    }
  }
  graphAccount.operators = operators
  graphAccount.save()
}

export function handleSlasherUpdate(event: SlasherUpdate): void {
  let graphNetwork = GraphNetwork.load('1')
  let slashers = graphNetwork.slashers
  if (slashers == null) {
    slashers = []
  }
  let index = slashers.indexOf(event.params.slasher)

  // It was not there before
  if (index == -1) {
    // Lets add it in
    if (event.params.allowed) {
      slashers.push(event.params.slasher)
    }
    // If false was passed, we do nothing
    // It was there before
  } else {
    // We are revoking access
    if (!event.params.allowed) {
      slashers.splice(index, 1)
    }
    // Otherwise do nothing
  }
  graphNetwork.slashers = slashers
  graphNetwork.save()
}

export function handleAssetHolderUpdate(event: AssetHolderUpdate): void {
  let graphNetwork = GraphNetwork.load('1')
  let assetHolders = graphNetwork.assetHolders
  if (assetHolders == null) {
    assetHolders = []
  }
  let index = assetHolders.indexOf(event.params.assetHolder)

  // It was not there before
  if (index == -1) {
    // Lets add it in
    if (event.params.allowed) {
      assetHolders.push(event.params.assetHolder)
    }
    // If false was passed, we do nothing
    // It was there before
  } else {
    // We are revoking access
    if (!event.params.allowed) {
      assetHolders.splice(index, 1)
    }
    // Otherwise do nothing
  }
  graphNetwork.assetHolders = assetHolders
  graphNetwork.save()
}

// export function handleImplementationUpdated(event: ImplementationUpdated): void {
//   let graphNetwork = GraphNetwork.load('1')
//   let implementations = graphNetwork.stakingImplementations
//   implementations.push(event.params.newImplementation)
//   graphNetwork.stakingImplementations = implementations
//   graphNetwork.save()
// }

// TODO - this is broken if we change the delegatio ratio
// Need to remove, or find a fix
function calculateCapacities(indexer: Indexer): Indexer {
  let graphNetwork = GraphNetwork.load('1')
  let tokensDelegatedMax = indexer.stakedTokens.times(BigInt.fromI32(graphNetwork.delegationRatio))

  // Eligible to add to the capacity
  indexer.delegatedCapacity =
    indexer.delegatedTokens < tokensDelegatedMax ? indexer.delegatedTokens : tokensDelegatedMax

  indexer.tokenCapacity = indexer.stakedTokens.plus(indexer.delegatedCapacity)
  indexer.availableStake = indexer.tokenCapacity
    .minus(indexer.allocatedTokens)
    .minus(indexer.lockedTokens)
  return indexer
}
