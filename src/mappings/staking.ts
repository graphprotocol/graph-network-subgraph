import { BigInt, Address } from '@graphprotocol/graph-ts'
import {
  StakeDeposited,
  StakeWithdrawn,
  StakeLocked,
  StakeSlashed,
  AllocationCreated,
  AllocationSettled,
  RebateClaimed,
  ParameterUpdated,
  Staking,
} from '../types/Staking/Staking'
import {
  Channel,
  Indexer,
  Allocation,
  GraphNetwork,
  Pool,
  SubgraphDeployment,
} from '../types/schema'

import { createOrLoadSubgraphDeployment, createOrLoadIndexer, createOrLoadPool } from './helpers'

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
  indexer.stakedTokens = indexer.stakedTokens.plus(event.params.tokens)
  indexer.save()

  // Update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalGRTStaked = graphNetwork.totalGRTStaked.plus(event.params.tokens)
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
  indexer.tokensLocked = BigInt.fromI32(0) // always set to 0 when withdrawn
  indexer.tokensLockedUntil = 0 // always set to 0 when withdrawn
  indexer.save()

  // Update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalGRTStaked = graphNetwork.totalGRTStaked.minus(event.params.tokens)
  graphNetwork.totalGRTLocked = graphNetwork.totalGRTLocked.minus(event.params.tokens)
  graphNetwork.save()
}

/**
 * @dev handleStakeLocked
 * - updated the Indexers stake
 */
export function handleStakeLocked(event: StakeLocked): void {
  // update indexer
  let id = event.params.indexer.toHexString()
  let indexer = Indexer.load(id)
  indexer.tokensLocked = event.params.tokens
  indexer.tokensLockedUntil = event.params.until.toI32()
  indexer.save()

  // update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalGRTLocked = graphNetwork.totalGRTLocked.plus(event.params.tokens)
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
  let graphNetwork = GraphNetwork.load('1')
  let staking = Staking.bind(graphNetwork.staking as Address)
  let indexerStored = staking.stakes(event.params.indexer)
  indexer.tokensLocked = indexerStored.value2
  indexer.save()

  // Update graph network
  graphNetwork.totalGRTStaked = graphNetwork.totalGRTStaked.minus(event.params.tokens)
  graphNetwork.save()
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
  let channelID = event.params.channelID.toHexString()
  let allocationID = indexerID.concat('-').concat(subgraphDeploymentID)

  // update indexer
  let indexer = Indexer.load(indexerID)
  indexer.tokensAllocated = indexer.tokensAllocated.plus(event.params.tokens)
  indexer.save()

  // update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalGRTAllocated = graphNetwork.totalGRTAllocated.plus(event.params.tokens)
  graphNetwork.save()

  // update subgraph
  let deployment = createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp)
  deployment.totalStake = deployment.totalStake.plus(event.params.tokens)
  deployment.save()

  // update allocation
  let allocation = Allocation.load(allocationID)
  if (allocation == null) {
    allocation = new Allocation(allocationID)
    allocation.subgraphDeployment = subgraphDeploymentID
    allocation.indexer = indexerID
  }
  allocation.activeChannel = channelID
  allocation.save()

  // create channel
  let channel = new Channel(channelID)
  channel.indexer = indexerID
  channel.publicKey = event.params.channelPubKey
  channel.subgraphDeployment = subgraphDeploymentID
  channel.allocation = allocationID
  channel.tokensAllocated = event.params.tokens
  channel.createdAtEpoch = event.params.epoch.toI32()
  channel.feesCollected = BigInt.fromI32(0)
  channel.curatorReward = BigInt.fromI32(0)
  channel.claimed = false
  channel.save()
}

/**
 * @dev handleAllocationSettled
 * - update the indexers stake
 * - update the subgraph total stake
 * - update the named subgraph aggregate stake
 * - update the specific allocation
 * - update and close the channel
 */
export function handleAllocationSettled(event: AllocationSettled): void {
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  let indexerID = event.params.indexer.toHexString()
  let channelID = event.params.channelID.toHexString()

  // update indexer
  let indexer = Indexer.load(indexerID)
  indexer.tokensAllocated = indexer.tokensAllocated.minus(event.params.tokens)
  indexer.tokensClaimable = indexer.tokensAllocated.plus(event.params.tokens)
  indexer.save()

  // update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalGRTClaimable = graphNetwork.totalGRTClaimable.plus(event.params.tokens)
  graphNetwork.totalGRTAllocated = graphNetwork.totalGRTAllocated.minus(event.params.tokens)
  graphNetwork.save()

  // update subgraph
  let deployment = SubgraphDeployment.load(subgraphDeploymentID)
  deployment.totalStake = deployment.totalStake.minus(event.params.tokens)
  deployment.totalQueryFeesCollected = deployment.totalQueryFeesCollected.plus(
    event.params.rebateFees,
  )
  deployment.save()

  // update pool
  let pool = createOrLoadPool(event.params.epoch)
  pool.fees = pool.fees.plus(event.params.rebateFees)
  pool.allocation = pool.allocation.plus(event.params.effectiveAllocation)
  pool.curatorReward = pool.curatorReward.plus(event.params.curationFees)
  pool.save()

  // update allocation
  let allocation = Allocation.load(indexerID.concat('-').concat(subgraphDeploymentID))
  let closedChannels = allocation.channels
  closedChannels.push(allocation.activeChannel)
  allocation.channels = closedChannels
  allocation.activeChannel = null
  allocation.save()

  // update channel
  let channel = Channel.load(channelID)
  channel.feesCollected = event.params.rebateFees
  channel.curatorReward = event.params.curationFees
  channel.settled = event.params.epoch.toString()
  channel.save()
}

/**
 * @dev handleRebateClaimed
 * - update pool
 * - update settlement of channel in pool
 * - update pool
 * - note - if rebate is transferred to indexer, that will be handled in graphToken.ts
 */
export function handleRebateClaimed(event: RebateClaimed): void {
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  let indexerID = event.params.indexer.toHexString()
  let allocationID = indexerID.concat('-').concat(subgraphDeploymentID)

  // update indexer
  let indexer = Indexer.load(indexerID)
  indexer.tokensClaimable = indexer.tokensAllocated.minus(event.params.tokens)
  indexer.save()

  // update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalGRTClaimable = graphNetwork.totalGRTClaimable.minus(event.params.tokens)
  graphNetwork.save()

  // update allocation
  let allocation = Allocation.load(allocationID)
  let channelID = allocation.activeChannel
  allocation.activeChannel = null
  allocation.save()

  // update channel
  let channel = Channel.load(channelID)
  channel.claimed = true
  channel.save()

  // update pool
  let pool = Pool.load(event.params.forEpoch.toString())
  pool.feesClaimed = pool.feesClaimed.plus(event.params.tokens)
  pool.save()
}

/**
 * @dev handleParameterUpdated
 * - updates all parameters of staking, depending on string passed. We then can
 *   call the contract directly to get the updated value
 */
export function handleParameterUpdated(event: ParameterUpdated): void {
  let parameter = event.params.param
  let graphNetwork = GraphNetwork.load('1')
  let staking = Staking.bind(graphNetwork.staking as Address)

  if (parameter == 'curation') {
    // Not in use now, we are waiting till we have a controller contract that
    // houses all the addresses of all contracts. So that there aren't a bunch
    // of different instances of the contract addresses across all contracts
    // graphNetwork.curation = staking.curation()
  } else if (parameter == 'curationPercentage') {
    graphNetwork.curationPercentage = staking.curationPercentage()
  } else if (parameter == 'channelDisputeEpochs') {
    graphNetwork.channelDisputeEpochs = staking.channelDisputeEpochs()
  } else if (parameter == 'maxAllocationEpochs') {
    graphNetwork.maxAllocationEpochs = staking.maxAllocationEpochs()
  } else if (parameter == 'thawingPeriod') {
    graphNetwork.thawingPeriod = staking.thawingPeriod()
  }

  graphNetwork.save()
}
