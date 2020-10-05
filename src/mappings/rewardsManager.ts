import { Address } from '@graphprotocol/graph-ts'
import { Indexer, Allocation, GraphNetwork, Epoch, SubgraphDeployment } from '../types/schema'
import {
  RewardsAssigned,
  ParameterUpdated,
  RewardsManager,
  RewardsDenylistUpdated,
} from '../types/RewardsManager/RewardsManager'

export function handleRewardsAssigned(event: RewardsAssigned): void {
  let indexerID = event.params.indexer.toHexString()
  let allocationID = event.params.allocationID.toHexString()

  // update indexer
  let indexer = Indexer.load(indexerID)
  indexer.rewardsEarned = indexer.rewardsEarned.plus(event.params.amount)
  indexer.save()

  // update allocation
  // Hmm - TODO - should allocation have another status udpate here, for when this happens?
  let allocation = Allocation.load(allocationID)
  allocation.indexingRewards = allocation.indexingRewards.plus(event.params.amount)
  allocation.save()

  // Update epoch
  let epoch = Epoch.load(event.params.epoch.toString())
  epoch.totalRewards = epoch.totalRewards.plus(event.params.amount)
  epoch.save()

  // update subgraph deployment
  let subgraphDeploymentID = allocation.subgraphDeployment
  let subgraphDeployment = SubgraphDeployment.load(subgraphDeploymentID)
  subgraphDeployment.queryFeeRebates = subgraphDeployment.queryFeeRebates.plus(event.params.amount)
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
  let rewardsManager = RewardsManager.bind(graphNetwork.rewardsManager as Address)

  if (parameter == 'issuanceRate') {
    graphNetwork.networkGRTIssuance = rewardsManager.issuanceRate().toI32()
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
