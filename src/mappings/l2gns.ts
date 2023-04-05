import { BigInt, BigDecimal, Bytes } from '@graphprotocol/graph-ts'
import { SubgraphReceivedFromL1, SubgraphMigrationFinalized } from '../types/L2GNS/L2GNS'

import { Subgraph, SubgraphVersion } from '../types/schema'

import { zeroBD } from './utils'
import { createOrLoadSubgraph, joinID, convertBigIntSubgraphIDToBase58 } from './helpers/helpers'

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
  subgraph.startedMigrationToL2 = true
  subgraph.startedMigrationToL2At = event.block.timestamp
  subgraph.startedMigrationToL2AtBlockNumber = event.block.number
  subgraph.startedMigrationToL2AtTx = event.transaction.hash.toHexString()
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
  subgraph.migratedToL2 = true
  subgraph.migratedToL2At = event.block.timestamp
  subgraph.migratedToL2AtBlockNumber = event.block.number
  subgraph.migratedToL2AtTx = event.transaction.hash.toHexString()
  subgraph.save()
}
