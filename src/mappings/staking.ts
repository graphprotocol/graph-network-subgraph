import {
  StakeDeposited,
  StakeWithdrawn,
  StakeLocked,
  StakeSlashed,
  AllocationCreated,
  AllocationSettled,
  RebateClaimed,
  SlasherUpdate,
  Staking
} from '../../generated/Staking/Staking'

import {GraphToken} from '../../generated/Staking/GraphToken'
import {
  Channel,
  Indexer,
  Allocation,
  Subgraph,
  NamedSubgraph,
  Account,
  GraphNetwork
} from '../../generated/schema'
import {BigInt, store, Bytes} from '@graphprotocol/graph-ts'

/**
 * handleStakeDeposited
 * - creates an Indexer if it is the first time they have staked
 * - updated the Indexers stake
 * - updates the GraphNetwork total stake
 * - no need to create an Account. To stake, it would have obtained GRT, and
 *   the account would have been created in graphToken.ts
 */
export function handleStakeDeposited(event: StakeDeposited): void {
  // update indexer
  let id = event.params.indexer.toHexString()
  let indexer = Indexer.load(id)
  if (indexer == null){
    indexer = new Indexer(id)
    indexer.stakedTokens = BigInt.fromI32(0)
    indexer.tokensAllocated = BigInt.fromI32(0)
    indexer.tokensLocked = BigInt.fromI32(0)
    indexer.tokensLockedUntil  = BigInt.fromI32(0)
    indexer.tokensDelegated = BigInt.fromI32(0)
    indexer.tokenCapacity = BigInt.fromI32(0)
    indexer.indexingRewardCut = 0
    indexer.queryFeeCut = 0
    indexer.delegatorParameterCooldown = 0
    indexer.forcedSettlements = 0
  }
  indexer.stakedTokens = indexer.stakedTokens.plus(event.params.tokens)
  indexer.save()

  // Update graph network
  let graphNetwork = GraphNetwork.load("1")
  let graphToken = GraphToken.bind(graphNetwork.graphToken)
  graphNetwork.totalGRTStaked = graphToken.balanceOf(graphNetwork.staking)
  graphNetwork.save()
}
/**
 * handleStakeDeposited
 * - updated the Indexers stake
 * - updates the GraphNetwork total stake
 * - no need to create an Account or an Indexer, they would have been created
 *   already
 */
export function handleStakeWithdrawn(event: StakeWithdrawn): void {
    // update indexer
    let id = event.params.indexer.toHexString()
    let indexer = Indexer.load(id)
    if (indexer == null){
      indexer = new Indexer(id)
      indexer.stakedTokens = BigInt.fromI32(0)
      indexer.tokensAllocated = BigInt.fromI32(0)
      indexer.tokensLocked = BigInt.fromI32(0)
      indexer.tokensLockedUntil  = BigInt.fromI32(0)
      indexer.tokensDelegated = BigInt.fromI32(0)
      indexer.tokenCapacity = BigInt.fromI32(0)
      indexer.indexingRewardCut = 0
      indexer.queryFeeCut = 0
      indexer.delegatorParameterCooldown = 0
      indexer.forcedSettlements = 0
    }
    indexer.stakedTokens = indexer.stakedTokens.plus(event.params.tokens)
    indexer.save()
  
    // Update graph network
    let graphNetwork = GraphNetwork.load("1")
    let graphToken = GraphToken.bind(graphNetwork.graphToken)
    graphNetwork.totalGRTStaked = graphToken.balanceOf(graphNetwork.staking)
    graphNetwork.save()

}
export function handleStakeLocked(event: StakeLocked): void {

}
export function handleStakeSlashed(event: StakeSlashed): void {

}
export function handleAllocationUpdated(event: AllocationCreated): void {

}
export function handleAllocationSettled(event: AllocationSettled): void {

}
export function handleRebateClaimed(event: RebateClaimed): void {

}
export function handleSlasherUpdate(event: SlasherUpdate): void {

}

// export function handleCuratorStaked(event: CuratorStaked): void {
//   let curatorID = event.params.staker.toHexString()
//   let curator = new Curator(curatorID)
//   curator.save()

//   let subgraphVersion = SubgraphVersion.load(event.params.subgraphID.toHexString())
//   // This null check is possible since GNS is not linked to subgraph creation
//   if (subgraphVersion == null) {
//     subgraphVersion = new SubgraphVersion(event.params.subgraphID.toHexString())
//     subgraphVersion.createdAt = event.block.timestamp.toI32()
//     subgraphVersion.totalCurationShares = BigInt.fromI32(0)
//     subgraphVersion.totalCurationStake = BigInt.fromI32(0)
//     subgraphVersion.totalIndexingStake = BigInt.fromI32(0)
//   }

//   if (subgraphVersion.reserveRatio == null) {
//     let staking = Staking.bind(event.address)
//     let subgraph = staking.subgraphs(event.params.subgraphID)
//     subgraphVersion.reserveRatio = subgraph.value0
//   }

//     // Note, this is emitted as the real values stored in the contract, so no addition
//   // or subtraction needed

//   let oldTotalStake = subgraphVersion.totalCurationStake
//   let changeInStake = event.params.subgraphTotalCurationStake.minus(oldTotalStake)
//   subgraphVersion.totalCurationStake = event.params.subgraphTotalCurationStake
//   subgraphVersion.totalCurationShares = event.params.subgraphTotalCurationShares
//   subgraphVersion.save()

//   let infoID = event.params.staker.toHexString().concat("-").concat(event.params.subgraphID.toHexString())
//   let curatorInfo = CuratorInfo.load(infoID)
//   if (curatorInfo == null) {
//     curatorInfo = new CuratorInfo(infoID)
//     curatorInfo.tokensStaked = BigInt.fromI32(0)
//     curatorInfo.tokensUnstaked = BigInt.fromI32(0)
//     curatorInfo.shares = BigInt.fromI32(0)
//     curatorInfo.user = event.params.staker.toHexString()
//     curatorInfo.subgraphID = event.params.subgraphID.toHexString()
//   }

//   // Need to check if we staked more tokens, or unstaked without full logout (same event)
//   if (changeInStake.gt(BigInt.fromI32(0))) {
//     curatorInfo.tokensStaked = curatorInfo.tokensStaked.plus(changeInStake)
//   } else {
//     // Here we minus both, because the number is negative, so it increased tokens
//     // unstaked, and increases pool balance
//     curatorInfo.tokensUnstaked = curatorInfo.tokensUnstaked.minus(changeInStake)
//   }
//   curatorInfo.shares = event.params.curatorShares
//   curatorInfo.save()

//   // TODO - Bring this back in when we stake on names, probably in beta
//   // let subgraph = Subgraph.load(subgraphVersion.subgraph)
//   // // This null check is possible since GNS is not linked to subgraph creation
//   // // So what happens - if this SubgraphVersion was registered to a Subgraph, both will end up updated.
//   // // If it wasnt registed, the Subgraphversion exists on its own
//   // if (subgraph != null) {
//   //   // Shares only exist on the Subgraph, not within subgraph version.
//   //   // So this value is straight from the contract
//   //   subgraph.totalCurationShares = event.params.subgraphTotalCurationShares
//   //
//   //   // Must check if the CuratorStaked event increased or decreased the Curators stake
//   //   let changeInStake: BigInt
//   //   if (curatorInfo.tokensStaked.gt(previousStake)) {
//   //     changeInStake = curatorInfo.tokensStaked.minus(previousStake)
//   //     subgraph.totalCurationStake = subgraph.totalCurationStake.plus(changeInStake)
//   //   } else {
//   //     changeInStake = previousStake.minus(curatorInfo.tokensStaked)
//   //     subgraph.totalCurationStake = subgraph.totalCurationStake.minus(changeInStake)
//   //   }
//   //   subgraph.save()
//   // }

// }

// export function handleCuratorLogout(event: CuratorLogout): void {
//   let id = event.params.staker
//     .toHexString()
//     .concat('-')
//     .concat(event.params.subgraphID.toHexString())
//   store.remove('CuratorInfo', id)

//   let subgraphVersion = SubgraphVersion.load(event.params.subgraphID.toHexString())
//   subgraphVersion.totalCurationStake = event.params.subgraphTotalCurationStake
//   subgraphVersion.totalCurationShares = event.params.subgraphTotalCurationShares
//   subgraphVersion.save()

//   // TODO - Bring this back in when we stake on names, probably in beta
//   // let subgraph = Subgraph.load(subgraphVersion.subgraph)
//   // subgraph.totalCurationShares = event.params.subgraphTotalCurationShares
//   // subgraph.totalCurationStake = event.params.subgraphTotalCurationStake.minus(removedStaked)
//   // subgraph.save()


// }

// export function handleIndexerStaked(event: IndexingNodeStaked): void {
//   let id = event.params.staker.toHexString()

//   // Subgraph SHOULD already exist, the GNS must create it before anyone can stake on it
//   let subgraphVersion = SubgraphVersion.load(event.params.subgraphID.toHexString())
//   if (subgraphVersion == null) {
//     subgraphVersion = new SubgraphVersion(event.params.subgraphID.toHexString())
//     subgraphVersion.createdAt = event.block.timestamp.toI32()
//     subgraphVersion.totalCurationShares = BigInt.fromI32(0)
//     subgraphVersion.totalCurationStake = BigInt.fromI32(0)
//     subgraphVersion.totalIndexingStake = BigInt.fromI32(0)
//   }

//   if (subgraphVersion.reserveRatio == null) {
//     let staking = Staking.bind(event.address)
//     let subgraph = staking.subgraphs(event.params.subgraphID)
//     subgraphVersion.reserveRatio = subgraph.value0
//   }

//   subgraphVersion.totalIndexingStake = event.params.subgraphTotalIndexingStake
//   subgraphVersion.save()

//   // TODO - Bring this back in when we stake on names, probably in beta
//   // let subgraph = Subgraph.load(subgraphVersion.subgraph)
//   // // This null check is possible since GNS is not linked to subgraph creation
//   // if (subgraph == null){
//   //   subgraph = new Subgraph(event.params.subgraphID.toHexString())
//   // }
//   // subgraph.totalIndexingStake = event.params.subgraphTotalIndexingStake
//   // subgraph.save()


//   // Need to load to check if this is a new index node, so we can add 1 to total indexers
//   let indexer = Indexer.load(id)
//   if (indexer == null) {
//     indexer = new Indexer(id)
//     indexer.save()
//   }
//   let infoID = event.params.staker.toHexString().concat("-").concat(event.params.subgraphID.toHexString())
//   let info = IndexerInfo.load(infoID)
//   if (info == null) {
//     info = new IndexerInfo(infoID)
//     info.user = id
//     info.subgraphID = event.params.subgraphID.toHexString()
//     info.logoutStartTime = 0
//   }
//   info.tokensStaked = event.params.amountStaked
//   info.save()
// }

// // TODO - Might be an error in how we handle logging out, users can still earn rewards and I dont think it should be like that. For now though, handle normally
// export function handleIndexerBeginLogout(event: IndexingNodeBeginLogout): void {
//   let id = event.params.staker
//     .toHexString()
//     .concat('-')
//     .concat(event.params.subgraphID.toHexString())
//   let indexNode = new IndexerInfo(id)
//   indexNode.logoutStartTime = event.block.timestamp.toI32()
//   indexNode.lockedTokens = event.params.unstakedAmount
//   indexNode.tokensStaked = BigInt.fromI32(0)
//   indexNode.save()

//   let subgraphVersion = SubgraphVersion.load(event.params.subgraphID.toHexString())
//   subgraphVersion.totalIndexingStake = subgraphVersion.totalIndexingStake.minus(event.params.unstakedAmount)
//   subgraphVersion.save()

//   // TODO - Bring this back in when we stake on names, probably in beta
//   // let subgraph = Subgraph.load(subgraphVersion.subgraph)
//   // // It can be null if someone just staked, without registering a domain
//   // // Then the subgraph exists only as a version, and does not have a Subgraph entity it can relate to
//   // if (subgraph != null) {
//   //   subgraph.totalIndexingStake = event.params.subgraphTotalIndexingStake
//   //   subgraph.save()
//   // }

// }