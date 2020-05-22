import { BigInt, Bytes, ByteArray, Address } from '@graphprotocol/graph-ts'
import {
  Subgraph,
  GraphNetwork,
  Indexer,
  Account,
  Pool,
  Curator,
  Signal,
  SubgraphVersion,
  NamedSubgraph,
} from '../../generated/schema'
import { GraphToken } from '../../generated/GraphToken/GraphToken'
import { addresses } from '../../config/addresses'

export function createNamedSubgraph(
  nameHash: ByteArray,
  name: string,
  owner: Address,
  versionID: string,
): NamedSubgraph {
  let namedSubgraph = new NamedSubgraph(nameHash.toHexString())
  namedSubgraph.nameSystem = 'GNS'
  namedSubgraph.name = name
  namedSubgraph.owner = owner.toHexString()
  namedSubgraph.currentVersion = versionID
  namedSubgraph.pastVersions = []

  return namedSubgraph
}

export function createSubgraph(subgraphID: string, timestamp: BigInt): Subgraph {
  let subgraph = new Subgraph(subgraphID)
  subgraph.createdAt = timestamp.toI32()
  subgraph.totalStake = BigInt.fromI32(0)
  subgraph.totalSubraphIndexingRewards = BigInt.fromI32(0)
  subgraph.totalSignaledGRT = BigInt.fromI32(0)
  subgraph.totalSignalMinted = BigInt.fromI32(0)
  subgraph.totalQueryFeesCollected = BigInt.fromI32(0)
  subgraph.totalCuratorFeeReward = BigInt.fromI32(0)

  let graphNetwork = GraphNetwork.load('1')
  subgraph.reserveRatio = graphNetwork.defaultReserveRatio

  return subgraph
}

export function createIndexer(id: string, timestamp: BigInt): Indexer {
  let indexer = new Indexer(id)
  indexer.stakedTokens = BigInt.fromI32(0)
  indexer.tokensAllocated = BigInt.fromI32(0)
  indexer.tokensLocked = BigInt.fromI32(0)
  indexer.tokensLockedUntil = 0
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
  account.metadataHash = null
  account.name = ''
  account.namedSubgraphs = []
  account.balance = BigInt.fromI32(0) // gets set by transfers
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

export function createGraphNetwork(): GraphNetwork {
  let graphNetwork = new GraphNetwork('1')
  graphNetwork.graphToken = addresses.graphToken
  graphNetwork.epochManager = addresses.epochManager
  graphNetwork.curation = addresses.curation
  graphNetwork.staking = addresses.staking
  graphNetwork.disputeManager = addresses.disputeManager
  graphNetwork.gns = addresses.gns
  graphNetwork.serviceRegistry = addresses.serviceRegistry

  let graphTokenAddress = Address.fromString(addresses.graphToken)
  let graphToken = GraphToken.bind(graphTokenAddress)
  graphNetwork.totalSupply = BigInt.fromI32(0) // gets set by mint

  // most of the parameters below are updated in the constructor, or else
  // right after deployement
  let stakingAddress = Address.fromString(addresses.staking)
  graphNetwork.curationPercentage = BigInt.fromI32(0)
  graphNetwork.channelDisputeEpochs = BigInt.fromI32(0)
  graphNetwork.maxAllocationEpochs = BigInt.fromI32(0)
  graphNetwork.thawingPeriod = BigInt.fromI32(0)
  graphNetwork.totalGRTStaked = graphToken.balanceOf(stakingAddress)
  let curationAddress = Address.fromString(addresses.curation)
  graphNetwork.defaultReserveRatio = BigInt.fromI32(0)
  graphNetwork.minimumCurationSignal = BigInt.fromI32(0)
  graphNetwork.totalGRTSignaled = graphToken.balanceOf(curationAddress)
  graphNetwork.save()
  
  return graphNetwork
}

export function addQm(a: ByteArray): ByteArray {
  let out = new Uint8Array(34)
  out[0] = 0x12
  out[1] = 0x20
  for (let i = 0; i < 32; i++) {
    out[i + 2] = a[i]
  }
  return out as ByteArray
}

export function getVersionNumber(name: string, subgraphID: string, versionNumber: BigInt): BigInt {
  // create versionID. start at version 1
  let versionID = name
    .concat('-')
    .concat(subgraphID)
    .concat('-')
    .concat(versionNumber.toString())
  let version = SubgraphVersion.load(versionID)
  // recursion until you get the right verison
  if (version != null) {
    versionNumber = versionNumber.plus(BigInt.fromI32(1))
    getVersionNumber(name, subgraphID, versionNumber)
  }
  return versionNumber
}
