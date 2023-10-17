import { Address, BigInt } from '@graphprotocol/graph-ts'
import { Indexer, Allocation, SubgraphDeployment } from '../types/schema'
import {
  RewardsAssigned,
  ParameterUpdated,
  RewardsManagerStitched as RewardsManager,
  RewardsDenylistUpdated,
} from '../types/RewardsManager/RewardsManagerStitched'
import {
  createOrLoadSubgraphDeployment,
  createOrLoadEpoch,
  updateAdvancedIndexerMetrics,
  updateDelegationExchangeRate,
  updateDelegatorsRewardsFields,
  createOrLoadGraphNetwork
} from './helpers/helpers'
import { addresses } from '../../config/addresses'

export function handleRewardsAssigned(event: RewardsAssigned): void {
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  let indexerID = event.params.indexer.toHexString()
  let allocationID = event.params.allocationID.toHexString()

  // update indexer
  let indexer = Indexer.load(indexerID)!
  indexer.rewardsEarned = indexer.rewardsEarned.plus(event.params.amount)
  // If the delegation pool has zero tokens, the contracts don't give away any rewards
  let indexerIndexingRewards =
    indexer.delegatedTokens == BigInt.fromI32(0)
      ? event.params.amount
      : event.params.amount
          .times(BigInt.fromI32(indexer.indexingRewardCut))
          .div(BigInt.fromI32(1000000))

  let delegatorIndexingRewards = event.params.amount.minus(indexerIndexingRewards)

  indexer.delegatorIndexingRewards = indexer.delegatorIndexingRewards.plus(delegatorIndexingRewards)
  indexer.indexerIndexingRewards = indexer.indexerIndexingRewards.plus(indexerIndexingRewards)
  indexer.delegatedTokens = indexer.delegatedTokens.plus(delegatorIndexingRewards)

  if (indexer.delegatorShares != BigInt.fromI32(0)) {
    indexer = updateDelegationExchangeRate(indexer as Indexer)
  }
  indexer = updateAdvancedIndexerMetrics(indexer as Indexer, event)
  indexer.save()

  // update allocation
  // no status updated, Claimed happens when RebateClaimed, and it is done
  let allocation = Allocation.load(allocationID)!
  allocation.indexingRewards = allocation.indexingRewards.plus(event.params.amount)
  allocation.indexingIndexerRewards = allocation.indexingIndexerRewards.plus(indexerIndexingRewards)
  allocation.indexingDelegatorRewards = allocation.indexingDelegatorRewards.plus(
    delegatorIndexingRewards,
  )
  allocation.save()

  // Update epoch
  let epoch = createOrLoadEpoch((addresses.isL1 ? event.block.number : graphNetwork.currentL1BlockNumber!))
  epoch.totalRewards = epoch.totalRewards.plus(event.params.amount)
  epoch.totalIndexerRewards = epoch.totalIndexerRewards.plus(indexerIndexingRewards)
  epoch.totalDelegatorRewards = epoch.totalDelegatorRewards.plus(delegatorIndexingRewards)
  epoch.save()

  // update subgraph deployment
  let subgraphDeploymentID = allocation.subgraphDeployment
  let subgraphDeployment = createOrLoadSubgraphDeployment(
    subgraphDeploymentID,
    event.block.timestamp,
  )
  subgraphDeployment.indexingRewardAmount = subgraphDeployment.indexingRewardAmount.plus(
    event.params.amount,
  )
  subgraphDeployment.indexingIndexerRewardAmount = subgraphDeployment.indexingIndexerRewardAmount.plus(
    indexerIndexingRewards,
  )
  subgraphDeployment.indexingDelegatorRewardAmount = subgraphDeployment.indexingDelegatorRewardAmount.plus(
    delegatorIndexingRewards,
  )
  subgraphDeployment.save()

  // update graph network
  graphNetwork.totalIndexingRewards = graphNetwork.totalIndexingRewards.plus(event.params.amount)
  graphNetwork.totalIndexingIndexerRewards = graphNetwork.totalIndexingIndexerRewards.plus(
    indexerIndexingRewards,
  )
  graphNetwork.totalIndexingDelegatorRewards = graphNetwork.totalIndexingDelegatorRewards.plus(
    delegatorIndexingRewards,
  )
  graphNetwork.save()
  updateDelegatorsRewardsFields(indexerID, event)
}

/**
 * @dev handleParameterUpdated
 * - handlers updating all parameters
 */
export function handleParameterUpdated(event: ParameterUpdated): void {
  let parameter = event.params.param
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  let rewardsManager = RewardsManager.bind(event.address as Address)

  if (parameter == 'issuanceRate') {
    graphNetwork.networkGRTIssuance = rewardsManager.issuanceRate()
  } else if (parameter == 'issuancePerBlock') {
    graphNetwork.networkGRTIssuancePerBlock = rewardsManager.issuancePerBlock()
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
  if (subgraphDeployment != null) {
    if (event.params.sinceBlock.toI32() == 0) {
      subgraphDeployment.deniedAt = 0
    } else {
      subgraphDeployment.deniedAt = event.params.sinceBlock.toI32()
    }
    subgraphDeployment.save()
  }
  // We might need to handle the case where the subgraph deployment doesn't exists later
}
