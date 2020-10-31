import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { Indexer, Allocation, GraphNetwork, Epoch, SubgraphDeployment } from '../types/schema'
import {
  RewardsAssigned,
  ParameterUpdated,
  RewardsManager,
  RewardsDenylistUpdated,
} from '../types/RewardsManager/RewardsManager'
import {createOrLoadSubgraphDeployment, createOrLoadEpoch, } from './helpers'

export function handleRewardsAssigned(event: RewardsAssigned): void {
  let indexerID = event.params.indexer.toHexString()
  let allocationID = event.params.allocationID.toHexString()

  // update indexer
  let indexer = Indexer.load(indexerID)
  indexer.rewardsEarned = indexer.rewardsEarned.plus(event.params.amount)
  let delegationRewards = event.params.amount
    .times(BigInt.fromI32(indexer.indexingRewardCut))
    .div(BigInt.fromI32(1000000))
  indexer.delegatorIndexingRewards = indexer.delegatorIndexingRewards.plus(delegationRewards)
  indexer.delegatedTokens = indexer.delegatedTokens.plus(delegationRewards)
  if (indexer.delegatorShares != BigInt.fromI32(0)) {
    indexer.delegationExchangeRate = indexer.delegatedTokens
      .toBigDecimal()
      .div(indexer.delegatorShares.toBigDecimal())
  }
  indexer.save()

  // update allocation
  // no status updated, Claimed happens when RebateClaimed, and it is done
  let allocation = Allocation.load(allocationID)
  allocation.indexingRewards = allocation.indexingRewards.plus(event.params.amount)
  allocation.save()

  // Update epoch
  let epoch = createOrLoadEpoch(event.block.number)
  epoch.totalRewards = epoch.totalRewards.plus(event.params.amount)
  epoch.save()

  // update subgraph deployment
  let subgraphDeploymentID = allocation.subgraphDeployment
  let subgraphDeployment = createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp)
  subgraphDeployment.indexingRewardAmount = subgraphDeployment.indexingRewardAmount.plus(
    event.params.amount,
  )
  subgraphDeployment.save()

  // update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalIndexingRewards = graphNetwork.totalIndexingRewards.plus(event.params.amount)
  graphNetwork.save()
}

/**
 * @dev handleParameterUpdated
 * - handlers updating all parameters
 */
export function handleParameterUpdated(event: ParameterUpdated): void {
  let parameter = event.params.param
  let graphNetwork = GraphNetwork.load('1')
  let rewardsManager = RewardsManager.bind(event.address as Address)

  if (parameter == 'issuanceRate') {
    graphNetwork.networkGRTIssuance = rewardsManager.issuanceRate()
  } else if (parameter == 'subgraphAvailabilityOracle') {
    graphNetwork.subgraphAvailabilityOracle = rewardsManager.subgraphAvailabilityOracle()
  }
  graphNetwork.save()
}

// export function handleImplementationUpdated(event: ImplementationUpdated): void {
//   let graphNetwork = GraphNetwork.load('1')
//   let implementations = graphNetwork.rewardsManagerImplementations
//   implementations.push(event.params.newImplementation)
//   graphNetwork.rewardsManagerImplementations = implementations
//   graphNetwork.save()
// }

export function handleRewardsDenyListUpdated(event: RewardsDenylistUpdated): void {
  let subgraphDeployment = SubgraphDeployment.load(event.params.subgraphDeploymentID.toHexString())
  if (event.params.sinceBlock.toI32() == 0) {
    subgraphDeployment.deniedAt = 0
  } else {
    subgraphDeployment.deniedAt = event.params.sinceBlock.toI32()
  }
  subgraphDeployment.save()
}
