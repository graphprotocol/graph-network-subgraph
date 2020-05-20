import {
  Subgraph,
  GraphNetwork,
  Indexer,
  Account,
  Pool,
  Curator,
  Signal,
} from '../../generated/schema'
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

export function createCurator(id: string, timestamp: BigInt): Curator {
  let curator = new Curator(id)
  curator.createdAt = timestamp.toI32()
  curator.account = id
  curator.totalSignal = BigInt.fromI32(0)
  curator.totalSignaledGRT = BigInt.fromI32(0)
  curator.totalRedeemedGRT = BigInt.fromI32(0)
  curator.feesEarned = BigInt.fromI32(0)
  return curator
}

export function createSignal(curator: string, subgraphID: string): Signal {
  let signalID = curator.concat('-').concat(subgraphID)
  let signal = new Signal(signalID)
  signal.curator = curator
  signal.subgraph = subgraphID
  signal.tokensSignaled = BigInt.fromI32(0)
  signal.tokensSignaled = BigInt.fromI32(0)
  signal.signal = BigInt.fromI32(0)
  return signal
}

export function createAccount(id: string): Account {
  let account = new Account(id)
  account.metadataHash = Bytes.fromHexString('0x')
  account.name = ''
  return account
}

export function createPool(id: BigInt): Pool {
  let pool = new Pool(id.toString())
  pool.fees = BigInt.fromI32(0)
  pool.allocation = BigInt.fromI32(0)
  pool.allocationClaimed = BigInt.fromI32(0)
  pool.curatorReward = BigInt.fromI32(0)
  return pool
}
