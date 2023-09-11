import { BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { SubgraphSentToL2, CuratorBalanceSentToL2 } from '../types/L1GNS/L1GNS'

import { Subgraph, NameSignal, SubgraphVersion, SubgraphDeployment } from '../types/schema'

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
  let nameSignalID = joinID([event.params._l1Owner.toHexString(), subgraphID])
  let nameSignalL2id = joinID([event.params._l2Owner.toHexString(), l2id])

  let nameSignal = NameSignal.load(nameSignalID)!
  nameSignal.transferredToL2 = true
  nameSignal.transferredToL2At = event.block.timestamp
  nameSignal.transferredToL2AtBlockNumber = event.block.number
  nameSignal.transferredToL2AtTx = event.transaction.hash.toHexString()
  nameSignal.idOnL1 = nameSignalID
  nameSignal.idOnL2 = nameSignalL2id
  nameSignal.signalledTokensSentToL2 = nameSignal.signalledTokensSentToL2.plus(event.params._tokens)

  // uint256 tokensForL2 = ownerNSignal.mul(curationTokens).div(totalSignal);
  // tokensForL2.mul(totalSignal) = ownerNSignal.mul(curationTokens)
  // tokensForL2.mul(totalSignal).div(ownerNSignal) = curationTokens

  let subgraph = Subgraph.load(subgraphID)!
  subgraph.active = false;
  subgraph.startedTransferToL2 = true
  subgraph.startedTransferToL2At = event.block.timestamp
  subgraph.startedTransferToL2AtBlockNumber = event.block.number
  subgraph.startedTransferToL2AtTx = event.transaction.hash.toHexString()
  subgraph.signalledTokensSentToL2 = subgraph.signalledTokensSentToL2.plus(event.params._tokens)
  subgraph.idOnL1 = subgraphID
  subgraph.idOnL2 = l2id
  
  let curationTokens = event.params._tokens.times(subgraph.nameSignalAmount).div(nameSignal.nameSignal)

  subgraph.nameSignalAmount = subgraph.nameSignalAmount.minus(nameSignal.nameSignal)
  let withdrawable = curationTokens.minus(event.params._tokens)
  subgraph.withdrawableTokens = withdrawable == BigInt.fromI32(-1) ? BigInt.fromI32(0) : withdrawable; // to fix rounding error in AS

  nameSignal.nameSignal = BigInt.fromI32(0);
  nameSignal.signal = BigDecimal.fromString('0');
  nameSignal.lastNameSignalChange = event.block.number.toI32()

  nameSignal.save()
  subgraph.save()

  let version = SubgraphVersion.load(subgraph.currentVersion!)!
  let deployment = SubgraphDeployment.load(version.subgraphDeployment)!
  deployment.transferredToL2 = true
  deployment.transferredToL2At = event.block.timestamp
  deployment.transferredToL2AtBlockNumber = event.block.number
  deployment.transferredToL2AtTx = event.transaction.hash.toHexString()
  deployment.signalledTokensSentToL2 = deployment.signalledTokensSentToL2.plus(event.params._tokens)
  deployment.save()
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
  nameSignal.transferredToL2 = true
  nameSignal.transferredToL2At = event.block.timestamp
  nameSignal.transferredToL2AtBlockNumber = event.block.number
  nameSignal.transferredToL2AtTx = event.transaction.hash.toHexString()
  nameSignal.idOnL1 = nameSignalID
  nameSignal.idOnL2 = nameSignalL2id
  nameSignal.signalledTokensSentToL2 = nameSignal.signalledTokensSentToL2.plus(event.params._tokens)
  
  let subgraph = Subgraph.load(subgraphID)!
  subgraph.signalledTokensSentToL2 = subgraph.signalledTokensSentToL2.plus(event.params._tokens)

  subgraph.nameSignalAmount = subgraph.nameSignalAmount.minus(nameSignal.nameSignal)
  let withdrawable = subgraph.withdrawableTokens.minus(event.params._tokens)
  subgraph.withdrawableTokens = withdrawable == BigInt.fromI32(-1) ? BigInt.fromI32(0) : withdrawable; // to fix rounding error in AS

  nameSignal.nameSignal = BigInt.fromI32(0);
  nameSignal.signal = BigDecimal.fromString('0');
  nameSignal.lastNameSignalChange = event.block.number.toI32()

  nameSignal.save()
  subgraph.save()

  let version = SubgraphVersion.load(subgraph.currentVersion!)!
  let deployment = SubgraphDeployment.load(version.subgraphDeployment)!
  deployment.signalledTokensSentToL2 = deployment.signalledTokensSentToL2.plus(event.params._tokens)
  deployment.save()
}
