import { Indexer, Allocation, GraphNetwork, Epoch, SubgraphDeployment } from '../types/schema'
import { RewardsAssigned } from '../types/RewardsManager/RewardsManager'

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

// export function handleRewardsClaimed(event: RewardsClaimed): void {
//   // Only indexer has a "claimed" amount - since in the UI we would want to show
//   // an indexer can claim. The the other 4 entities in RewardsAssigned, there
//   // is no need to add a difference for claimed vs assigned. (...yet)
//   let indexerID = event.params.indexer.toHexString()
//   let indexer = Indexer.load(indexerID)
//   indexer.rewardsClaimed = indexer.rewardsClaimed.plus(event.params.amount)
//   indexer.save()
// }
