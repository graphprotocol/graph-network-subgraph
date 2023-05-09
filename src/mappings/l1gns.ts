import { SubgraphSentToL2, CuratorBalanceSentToL2 } from '../types/L1GNS/L1GNS'

import { Subgraph, NameSignal } from '../types/schema'

import {
  joinID,
  convertBigIntSubgraphIDToBase58,
  getAliasedL2SubgraphID,
} from './helpers/helpers'

/*
    event SubgraphSentToL2(
        uint256 indexed _subgraphID,
        address indexed _l1Owner,
        address indexed _l2Owner,
        uint256 _tokens
    );
*/
export function handleSubgraphSentToL2(event: SubgraphSentToL2): void {
  let bigIntID = event.params._subgraphID
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let l2id = convertBigIntSubgraphIDToBase58(getAliasedL2SubgraphID(bigIntID))

  let subgraph = Subgraph.load(subgraphID)!
  subgraph.startedTransferToL2 = true
  subgraph.startedTransferToL2At = event.block.timestamp
  subgraph.startedTransferToL2AtBlockNumber = event.block.number
  subgraph.startedTransferToL2AtTx = event.transaction.hash.toHexString()
  subgraph.signalledTokensSentToL2 = subgraph.signalledTokensSentToL2.plus(event.params._tokens)
  subgraph.idOnL1 = subgraphID
  subgraph.idOnL2 = l2id
  subgraph.save()
}

/*
    event CuratorBalanceSentToL2(
        uint256 indexed _subgraphID,
        address indexed _l1Curator,
        address indexed _l2Beneficiary,
        uint256 _tokens
    );
*/
export function handleCuratorBalanceSentToL2(event: CuratorBalanceSentToL2): void {
  let bigIntID = event.params._subgraphID
  let subgraphID = convertBigIntSubgraphIDToBase58(bigIntID)
  let subgraphL2id = convertBigIntSubgraphIDToBase58(getAliasedL2SubgraphID(bigIntID))
  let nameSignalID = joinID([event.params._l1Curator.toHexString(), subgraphID])
  let nameSignalL2id = joinID([event.params._l2Beneficiary.toHexString(), subgraphL2id])

  let nameSignal = NameSignal.load(nameSignalID)!
  nameSignal.idOnL1 = nameSignalID
  nameSignal.idOnL2 = nameSignalL2id
  nameSignal.signalledTokensSentToL2 = nameSignal.signalledTokensSentToL2.plus(event.params._tokens)
  nameSignal.save()

  let subgraph = Subgraph.load(subgraphID)!
  subgraph.signalledTokensSentToL2 = subgraph.signalledTokensSentToL2.plus(event.params._tokens)
  subgraph.save()
}
