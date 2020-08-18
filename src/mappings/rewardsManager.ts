import { GraphNetwork } from '../types/schema'
import { RewardsAssigned, RewardsClaimed } from '../types/RewardsManager/RewardsManager'
import { createOrLoadGraphNetwork, createOrLoadEpoch } from './helpers'

/**
 * @dev handleEpochRun
 * - updates the last run epoch
 */
export function handleRewardsAssigned(event: RewardsAssigned): void {
  // let graphNetwork = GraphNetwork.load('1')
  // graphNetwork.lastRunEpoch = event.params.epoch.toI32()
  // graphNetwork.save()
}

/**
 * @dev handleEpochLengthUpdate
 * - updates the length and the last block and epoch it happened
 */
export function handleRewardsClaimed(event: RewardsClaimed): void {
  // let graphNetwork = createOrLoadGraphNetwork()
  // graphNetwork.epochLength = event.params.epochLength.toI32()
  // graphNetwork.lastLengthUpdateEpoch = graphNetwork.currentEpoch
  // graphNetwork.lastLengthUpdateBlock = event.block.number.toI32()
  // graphNetwork.save()

  // let epoch = createOrLoadEpoch(event.block.number)
  // epoch.endBlock = epoch.startBlock + graphNetwork.epochLength
  // epoch.save()
}

// TODO - do we need to do the deny list?



/*
subgraph.totalIndexingRewards - which is upwards so dont do it

subgraphDeployment.indexingRewardAmount
subgraphDeployment.rebateAmount ??????????
subgraphDeployment.curateFeeREwards??????? xxxxx - this is from AllocationCollected.event.params.curationFees
subgraphDeployment.queryFeeAmount i DOUBT it xxxx same as above

indexer.queryFeesCollected - i doubt it
indexer.queryFeeRebates - ?
indexer.rewardsEarned

allocation.queryFeesCollected - i doubt
allocation.queryFeeRebates - ?
allocatio.CuratorRewards ??xxxxxxxx
TODO - no indexingReward amount here, why not?

pool.claimedFees - ? xxxxxxx -allocation collected gets it
pool.totalFees -  ? xxxx-allocation collected gets it
pool.curatorRewards - ?xxxxxxxxxxxx-allocation collected gets it

epoch.totalREwards
epoch.queryFeeRebates - ? 


*/