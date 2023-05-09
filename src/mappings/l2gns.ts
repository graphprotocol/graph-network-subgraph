import {
  SubgraphReceivedFromL1,
  SubgraphMigrationFinalized,
  CuratorBalanceReturnedToBeneficiary,
  CuratorBalanceReceived,
} from '../types/L2GNS/L2GNS'

import { Subgraph, NameSignal } from '../types/schema'

import {
  createOrLoadSubgraph,
  createOrLoadNameSignal,
  createOrLoadGraphAccount,
  joinID,
  convertBigIntSubgraphIDToBase58,
} from './helpers/helpers'

/*
    event SubgraphReceivedFromL1(
        uint256 indexed _l1SubgraphID,
        uint256 indexed _l2SubgraphID,
        address indexed _owner,
        uint256 _tokens
    );
*/
export function handleSubgraphReceivedFromL1(event: SubgraphReceivedFromL1): void {
  let bigIntID = event.params._l2SubgraphID
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)

  // Create subgraph if needed
  let subgraph = createOrLoadSubgraph(
    event.params._l2SubgraphID,
    event.params._owner,
    event.block.timestamp,
  )
  subgraph.startedTransferToL2 = true
  subgraph.startedTransferToL2At = event.block.timestamp
  subgraph.startedTransferToL2AtBlockNumber = event.block.number
  subgraph.startedTransferToL2AtTx = event.transaction.hash.toHexString()
  subgraph.idOnL1 = convertBigIntSubgraphIDToBase58(event.params._l1SubgraphID)
  subgraph.idOnL2 = convertBigIntSubgraphIDToBase58(event.params._l2SubgraphID)
  subgraph.save()
}

// event SubgraphMigrationFinalized(uint256 indexed _l2SubgraphID);
export function handleSubgraphMigrationFinalized(event: SubgraphMigrationFinalized): void {
  let bigIntID = event.params._l2SubgraphID
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  // Can't use createOrLoadSubgraph, loading it directly, as it's also assumed already created
  let subgraph = Subgraph.load(subgraphID)!
  subgraph.transferredToL2 = true
  subgraph.transferredToL2At = event.block.timestamp
  subgraph.transferredToL2AtBlockNumber = event.block.number
  subgraph.transferredToL2AtTx = event.transaction.hash.toHexString()
  subgraph.save()
}

/// @dev Emitted when the L1 balance for a curator has been claimed
// event CuratorBalanceReceived(uint256 _l2SubgraphID, address _l2Curator, uint256 _tokens);

export function handleCuratorBalanceReceived(event: CuratorBalanceReceived): void {
  let bigIntID = event.params._l2SubgraphID
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)

  let nameSignal = createOrLoadNameSignal(
    event.params._l2Curator.toHexString(),
    subgraphID,
    event.block.timestamp,
  )
  nameSignal.idOnL2 = nameSignal.id
  nameSignal.signalledTokensReceivedOnL2 = nameSignal.signalledTokensReceivedOnL2.plus(
    event.params._tokens,
  )
  nameSignal.save()

  let subgraph = Subgraph.load(subgraphID)!
  subgraph.signalledTokensReceivedOnL2 = subgraph.signalledTokensReceivedOnL2.plus(
    event.params._tokens,
  )
  subgraph.save()
}

/// @dev Emitted when the L1 balance for a curator has been returned to the beneficiary.
/// This can happen if the subgraph migration was not finished when the curator's tokens arrived.
// event CuratorBalanceReturnedToBeneficiary(
//     uint256 _subgraphID,
//     address _l2Curator,
//     uint256 _tokens
// );

export function handleCuratorBalanceReturnedToBeneficiary(
  event: CuratorBalanceReturnedToBeneficiary,
): void {
  let graphAccount = createOrLoadGraphAccount(event.params._l2Curator, event.block.timestamp)
  graphAccount.balanceReceivedFromL1 = graphAccount.balanceReceivedFromL1.plus(event.params._tokens)
  graphAccount.save()
}
