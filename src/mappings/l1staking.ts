import { BigInt } from '@graphprotocol/graph-ts'
import {
  IndexerStakeTransferredToL2,
  DelegationTransferredToL2,
  StakeDelegatedUnlockedDueToL2Transfer,
} from '../types/L1Staking/L1Staking'

import { Indexer, DelegatedStake, GraphNetwork } from '../types/schema'
import { calculateCapacities, joinID, updateAdvancedIndexerMetrics, updateDelegationExchangeRate } from './helpers/helpers'

/*
    /// @dev Emitted when an indexer transfers their stake to L2.
    /// This can happen several times as indexers can transfer partial stake.
    event IndexerStakeTransferredToL2(
        address indexed indexer,
        address indexed l2Indexer,
        uint256 transferredStakeTokens
    );
*/
export function handleIndexerStakeTransferredToL2(event: IndexerStakeTransferredToL2): void {
  let indexer = Indexer.load(event.params.indexer.toHexString())!
  indexer.stakedTokensTransferredToL2 = indexer.stakedTokensTransferredToL2.plus(
    event.params.transferredStakeTokens,
  )
  if (!indexer.transferredToL2) {
    indexer.transferredToL2 = true
    indexer.firstTransferredToL2At = event.block.timestamp
    indexer.firstTransferredToL2AtBlockNumber = event.block.number
    indexer.firstTransferredToL2AtTx = event.transaction.hash.toHexString()
    indexer.idOnL2 = event.params.l2Indexer.toHexString()
    indexer.idOnL1 = event.params.indexer.toHexString()
  }
  indexer.stakedTokens = indexer.stakedTokens.minus(event.params.transferredStakeTokens)
  indexer.lastTransferredToL2At = event.block.timestamp
  indexer.lastTransferredToL2AtBlockNumber = event.block.number
  indexer.lastTransferredToL2AtTx = event.transaction.hash.toHexString()
  indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
  indexer = calculateCapacities(indexer as Indexer)
  indexer.save()
}
/*
    /// @dev Emitted when a delegator transfers their delegation to L2
    event DelegationTransferredToL2(
        address indexed delegator,
        address indexed l2Delegator,
        address indexed indexer,
        address l2Indexer,
        uint256 transferredDelegationTokens
    );
*/
export function handleDelegationTransferredToL2(event: DelegationTransferredToL2): void {
  let delegationID = joinID([
    event.params.delegator.toHexString(),
    event.params.indexer.toHexString(),
  ])
  let delegationIDL2 = joinID([
    event.params.l2Delegator.toHexString(),
    event.params.l2Indexer.toHexString(),
  ])
  let delegation = DelegatedStake.load(delegationID)!
  let delegatorSharesBefore = delegation.shareAmount;
  delegation.stakedTokensTransferredToL2 = delegation.stakedTokensTransferredToL2.plus(
    event.params.transferredDelegationTokens,
  )
  delegation.shareAmount = BigInt.fromI32(0);
  delegation.unstakedTokens = delegation.unstakedTokens.plus(event.params.transferredDelegationTokens);
  delegation.transferredToL2 = true
  delegation.transferredToL2At = event.block.timestamp
  delegation.transferredToL2AtBlockNumber = event.block.number
  delegation.transferredToL2AtTx = event.transaction.hash.toHexString()
  delegation.idOnL1 = delegationID
  delegation.idOnL2 = delegationIDL2
  delegation.save()

  let indexer = Indexer.load(event.params.indexer.toHexString())!
  indexer.delegatedTokens = indexer.delegatedTokens.minus(event.params.transferredDelegationTokens)
  indexer.delegatorShares = indexer.delegatorShares.minus(delegatorSharesBefore)
  if (indexer.delegatorShares != BigInt.fromI32(0)) {
    indexer = updateDelegationExchangeRate(indexer as Indexer)
  }
  indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
  indexer = calculateCapacities(indexer as Indexer)
  indexer.save()
}

/*
    /// @dev Emitted when a delegator unlocks their tokens ahead of time because the indexer has transferred to L2
    event StakeDelegatedUnlockedDueToL2Transfer(address indexed indexer, address indexed delegator);
*/

export function handleStakeDelegatedUnlockedDueToL2Transfer(
  event: StakeDelegatedUnlockedDueToL2Transfer,
): void {
  let graphNetwork = GraphNetwork.load('1')!
  let delegationID = joinID([
    event.params.delegator.toHexString(),
    event.params.indexer.toHexString(),
  ])
  let delegation = DelegatedStake.load(delegationID)!
  delegation.lockedUntil = graphNetwork.currentEpoch
  delegation.save()
}
