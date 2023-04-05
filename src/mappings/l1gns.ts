import { BigInt, BigDecimal, Bytes } from '@graphprotocol/graph-ts'
import { SubgraphSentToL2 } from '../types/L1GNS/L1GNS'

import { Subgraph, SubgraphVersion } from '../types/schema'

import { zeroBD } from './utils'
import {
  createOrLoadSubgraph,
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
  subgraph.startedMigrationToL2 = true
  subgraph.startedMigrationToL2At = event.block.timestamp
  subgraph.startedMigrationToL2AtBlockNumber = event.block.number
  subgraph.startedMigrationToL2AtTx = event.transaction.hash.toHexString()
  subgraph.idOnL1 = subgraphID
  subgraph.idOnL2 = l2id
  subgraph.save()
}
