import { Subgraph, GraphNetwork, Indexer, Account } from '../../generated/schema'
import { BigInt, Bytes } from '@graphprotocol/graph-ts'

export function createSubgraph(subgraphID: string, timestamp: BigInt): Subgraph {
  let subgraph = new Subgraph(subgraphID)
  subgraph.createdAt = timestamp.toI32()
  subgraph.totalStake = BigInt.fromI32(0)
  subgraph.totalSubraphIndexingRewards = BigInt.fromI32(0)
  subgraph.totalSignaledGRT = BigInt.fromI32(0)
  subgraph.totalSignalMinted = BigInt.fromI32(0)
  subgraph.totalQueryFeesCollected = BigInt.fromI32(0)

  let graphNetwork = GraphNetwork.load('1')
  subgraph.reserveRatio = graphNetwork.defaultReserveRatio

  return subgraph
}

export function createIndexer(id: string, timestamp: BigInt): Indexer {
  let indexer = new Indexer(id)
  indexer.stakedTokens = BigInt.fromI32(0)
  indexer.tokensAllocated = BigInt.fromI32(0)
  indexer.tokensLocked = BigInt.fromI32(0)
  indexer.tokensLockedUntil = BigInt.fromI32(0)
  indexer.tokensDelegated = BigInt.fromI32(0)
  indexer.tokenCapacity = BigInt.fromI32(0)
  indexer.indexingRewardCut = 0
  indexer.queryFeeCut = 0
  indexer.delegatorParameterCooldown = 0
  indexer.forcedSettlements = 0
  indexer.createdAt = timestamp.toI32()
  return indexer
}

export function createAccount(id: string): Account {
  let account = new Account(id)
  account.metadataHash = Bytes.fromHexString('0x')
  account.name = ''
  return account
}
