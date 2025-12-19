import { Address, BigInt } from '@graphprotocol/graph-ts'
import { Indexer, Allocation, SubgraphDeployment } from '../types/schema'
import {
  RewardsAssigned,
  HorizonRewardsAssigned,
  ParameterUpdated,
  RewardsManagerStitched as RewardsManager,
  RewardsDenylistUpdated,
} from '../types/RewardsManager/RewardsManagerStitched'
import {
  createOrLoadSubgraphDeployment,
  createOrLoadEpoch,
  updateLegacyAdvancedIndexerMetrics,
  updateDelegationExchangeRate,
  createOrLoadGraphNetwork
} from './helpers/helpers'
import { addresses } from '../../config/addresses'

export function handleRewardsAssigned(event: RewardsAssigned): void {
  processRewardsAssigned(
    event.params.indexer,
    event.params.allocationID.toHexString(),
    event.params.amount,
    event.block.number,
    event.block.timestamp,
    event.address,
  )
}

/**
 * @dev handleHorizonRewardsAssigned
 * - Handles the HorizonRewardsAssigned event emitted after Horizon upgrade
 * - Only processes rewards for legacy allocations (created via old Staking contract)
 * - New allocations (via SubgraphService) are handled by IndexingRewardsCollected instead
 */
export function handleHorizonRewardsAssigned(event: HorizonRewardsAssigned): void {
  let allocationID = event.params.allocationID.toHexString()
  let allocation = Allocation.load(allocationID)

  // Skip if allocation doesn't exist or is not a legacy allocation
  // New allocations have their rewards tracked via IndexingRewardsCollected from SubgraphService
  if (allocation == null || !allocation.isLegacy) {
    return
  }

  processRewardsAssigned(
    event.params.indexer,
    allocationID,
    event.params.amount,
    event.block.number,
    event.block.timestamp,
    event.address,
  )
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

/**
 * @dev processRewardsAssigned
 * - Common logic for processing rewards assigned events (both legacy RewardsAssigned and HorizonRewardsAssigned)
 */
function processRewardsAssigned(
  indexerAddress: Address,
  allocationID: string,
  amount: BigInt,
  blockNumber: BigInt,
  blockTimestamp: BigInt,
  eventAddress: Address,
): void {
  let graphNetwork = createOrLoadGraphNetwork(blockNumber, eventAddress)
  let indexerID = indexerAddress.toHexString()

  // update indexer
  let indexer = Indexer.load(indexerID)!
  indexer.rewardsEarned = indexer.rewardsEarned.plus(amount)
  // If the delegation pool has zero tokens, the contracts don't give away any rewards
  let indexerIndexingRewards =
    indexer.delegatedTokens == BigInt.fromI32(0)
      ? amount
      : amount
          .times(BigInt.fromI32(indexer.legacyIndexingRewardCut))
          .div(BigInt.fromI32(1000000))

  let delegatorIndexingRewards = amount.minus(indexerIndexingRewards)

  indexer.delegatorIndexingRewards = indexer.delegatorIndexingRewards.plus(delegatorIndexingRewards)
  indexer.indexerIndexingRewards = indexer.indexerIndexingRewards.plus(indexerIndexingRewards)
  indexer.delegatedTokens = indexer.delegatedTokens.plus(delegatorIndexingRewards)

  if (indexer.delegatorShares != BigInt.fromI32(0)) {
    indexer = updateDelegationExchangeRate(indexer as Indexer)
  }
  indexer = updateLegacyAdvancedIndexerMetrics(indexer as Indexer)
  indexer.save()

  // update allocation
  // no status updated, Claimed happens when RebateClaimed, and it is done
  let allocation = Allocation.load(allocationID)!
  allocation.indexingRewards = allocation.indexingRewards.plus(amount)
  allocation.indexingIndexerRewards = allocation.indexingIndexerRewards.plus(indexerIndexingRewards)
  allocation.indexingDelegatorRewards = allocation.indexingDelegatorRewards.plus(
    delegatorIndexingRewards,
  )
  allocation.save()

  // Update epoch
  let epoch = createOrLoadEpoch(addresses.isL1 ? blockNumber : graphNetwork.currentL1BlockNumber!, graphNetwork)
  epoch.totalRewards = epoch.totalRewards.plus(amount)
  epoch.totalIndexerRewards = epoch.totalIndexerRewards.plus(indexerIndexingRewards)
  epoch.totalDelegatorRewards = epoch.totalDelegatorRewards.plus(delegatorIndexingRewards)
  epoch.save()

  // update subgraph deployment
  let subgraphDeploymentID = allocation.subgraphDeployment
  let subgraphDeployment = createOrLoadSubgraphDeployment(
    subgraphDeploymentID,
    blockTimestamp,
    graphNetwork,
  )
  subgraphDeployment.indexingRewardAmount = subgraphDeployment.indexingRewardAmount.plus(amount)
  subgraphDeployment.indexingIndexerRewardAmount = subgraphDeployment.indexingIndexerRewardAmount.plus(
    indexerIndexingRewards,
  )
  subgraphDeployment.indexingDelegatorRewardAmount = subgraphDeployment.indexingDelegatorRewardAmount.plus(
    delegatorIndexingRewards,
  )
  subgraphDeployment.save()

  // update graph network
  graphNetwork.totalIndexingRewards = graphNetwork.totalIndexingRewards.plus(amount)
  graphNetwork.totalIndexingIndexerRewards = graphNetwork.totalIndexingIndexerRewards.plus(
    indexerIndexingRewards,
  )
  graphNetwork.totalIndexingDelegatorRewards = graphNetwork.totalIndexingDelegatorRewards.plus(
    delegatorIndexingRewards,
  )
  graphNetwork.totalDelegatedTokens = graphNetwork.totalDelegatedTokens.plus(delegatorIndexingRewards)
  graphNetwork.save()
}
