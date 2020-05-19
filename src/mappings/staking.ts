import { BigInt, store, Bytes } from "@graphprotocol/graph-ts";
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
} from "../../generated/Staking/Staking";
import { GraphToken } from "../../generated/Staking/GraphToken";
import { EpochManager } from "../../generated/Staking/EpochManager";
import {
  Channel,
  Indexer,
  Allocation,
  Subgraph,
  NamedSubgraph,
  Account,
  GraphNetwork
} from "../../generated/schema";

import { createSubgraph } from "./helpers";

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
  let id = event.params.indexer.toHexString();
  let indexer = Indexer.load(id);
  if (indexer == null) {
    indexer = new Indexer(id);
    indexer.stakedTokens = BigInt.fromI32(0);
    indexer.tokensAllocated = BigInt.fromI32(0);
    indexer.tokensLocked = BigInt.fromI32(0);
    indexer.tokensLockedUntil = BigInt.fromI32(0);
    indexer.tokensDelegated = BigInt.fromI32(0);
    indexer.tokenCapacity = BigInt.fromI32(0);
    indexer.indexingRewardCut = 0;
    indexer.queryFeeCut = 0;
    indexer.delegatorParameterCooldown = 0;
    indexer.forcedSettlements = 0;
  }
  indexer.stakedTokens = indexer.stakedTokens.plus(event.params.tokens);
  indexer.save();

  // Update graph network
  let graphNetwork = GraphNetwork.load("1");
  let graphToken = GraphToken.bind(graphNetwork.graphToken);
  graphNetwork.totalGRTStaked = graphToken.balanceOf(graphNetwork.staking);
  graphNetwork.save();
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
  let id = event.params.indexer.toHexString();
  let indexer = Indexer.load(id);
  if (indexer == null) {
    indexer = new Indexer(id);
    indexer.stakedTokens = BigInt.fromI32(0);
    indexer.tokensAllocated = BigInt.fromI32(0);
    indexer.tokensLocked = BigInt.fromI32(0);
    indexer.tokensLockedUntil = BigInt.fromI32(0);
    indexer.tokensDelegated = BigInt.fromI32(0);
    indexer.tokenCapacity = BigInt.fromI32(0);
    indexer.indexingRewardCut = 0;
    indexer.queryFeeCut = 0;
    indexer.delegatorParameterCooldown = 0;
    indexer.forcedSettlements = 0;
  }
  indexer.stakedTokens = indexer.stakedTokens.plus(event.params.tokens);
  indexer.save();

  // Update graph network
  let graphNetwork = GraphNetwork.load("1");
  let graphToken = GraphToken.bind(graphNetwork.graphToken);
  graphNetwork.totalGRTStaked = graphToken.balanceOf(graphNetwork.staking);
  graphNetwork.save();
}
export function handleStakeLocked(event: StakeLocked): void {}
export function handleStakeSlashed(event: StakeSlashed): void {}
export function handleAllocationUpdated(event: AllocationCreated): void {
  let subgraphID = event.params.subgraphID.toString();
  let indexerID = event.params.indexer.toString();
  let challengeID = event.params.channelID.toString();
  let allocationID = indexerID.concat("-").concat(subgraphID);

  // update indexer
  let indexer = Indexer.load(indexerID);
  indexer.tokensAllocated = indexer.tokensAllocated.plus(event.params.tokens);
  indexer.save();

  // update subgraph
  let subgraph = Subgraph.load(subgraphID);
  if (subgraph == null) {
    subgraph = createSubgraph(subgraphID, event.block.timestamp);
  }
  subgraph.totalStake = subgraph.totalStake.plus(event.params.tokens)
  subgraph.save()

  // update allocation
  let allocation = Allocation.load(allocationID);
  if (allocation == null) {
    allocation = new Allocation(allocationID);
  }
  allocation.subgraph = subgraphID;
  allocation.activeChannel = challengeID;
  allocation.save();

  // create channel
  let channel = new Channel(challengeID);
  channel.indexer = indexerID;
  channel.subgraph = subgraphID;
  channel.allocation = allocationID;
  channel.tokensAllocated = event.params.tokens;
  channel.createdAtEpoch = event.params.epoch
  channel.feesCollected = BigInt.fromI32(0);
  channel.curatorReward = BigInt.fromI32(0);
  channel.save();
}

export function handleAllocationSettled(event: AllocationSettled): void {
  let subgraphID = event.params.subgraphID.toString();
  let indexerID = event.params.indexer.toString();
  let challengeID = event.params.channelID.toString();

  // update indexer
  let indexer = Indexer.load(indexerID);
  indexer.tokensAllocated = indexer.tokensAllocated.minus(event.params.tokens);
  indexer.save();

  // update subgraph
  let subgraph = Subgraph.load(subgraphID);
  subgraph.totalStake = subgraph.totalStake.minus(event.params.tokens)
  // TODO - looks like we need query fees exposed 
  // asked for this here https://github.com/graphprotocol/contracts/issues/197
  subgraph.totalQueryFeesCollected
  subgraph.save()

  // update allocation
  let allocation = new Allocation(indexerID.concat("-").concat(subgraphID));
  allocation.subgraph = subgraphID;
  let closedChannels = allocation.closedChannels;
  closedChannels.push(allocation.activeChannel);
  allocation.closedChannels = closedChannels;
  allocation.activeChannel = null;
  allocation.save();

  // update channel
}
export function handleRebateClaimed(event: RebateClaimed): void {}
export function handleSlasherUpdate(event: SlasherUpdate): void {}
