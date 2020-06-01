import { BigInt, ByteArray, Address, Bytes } from '@graphprotocol/graph-ts'
import {
  SubgraphDeployment,
  GraphNetwork,
  Indexer,
  EthereumAccount,
  Pool,
  Curator,
  Signal,
  SubgraphVersion,
  Subgraph,
  GraphAccount
} from '../types/schema'
import { GraphToken } from '../types/GraphToken/GraphToken'
import { addresses } from '../../config/addresses'

export function createSubgraph(
  nameHash: ByteArray,
  name: string,
  owner: Address,
  versionID: string,
): Subgraph {
  let subgraph = new Subgraph(nameHash.toHexString())
  subgraph.createdAt = timestamp.toI32()
  subgraph.owner = owner.toHexString()
  subgraph.currentVersion = versionID
  subgraph.pastVersions = []
  subgraph.totalNameSignaledGRT = BigInt.fromI32(0)
  subgraph.totalNameSignalMinted = BigInt.fromI32(0)
  subgraph.metadataHash = Bytes.fromI32(0) as Bytes
  subgraph.description = ''
  subgraph.image = ''
  subgraph.name = ''
  subgraph.codeRepository = ''
  subgraph.website = ''
  subgraph.save()
  return subgraph
}

export function createSubgraphDeployment(
  subgraphID: string,
  timestamp: BigInt,
): SubgraphDeployment {
  let deployment = new SubgraphDeployment(subgraphID)
  deployment.createdAt = timestamp.toI32()
  deployment.totalStake = BigInt.fromI32(0)
  deployment.totalSubraphIndexingRewards = BigInt.fromI32(0)
  deployment.totalSignaledGRT = BigInt.fromI32(0)
  deployment.totalSignalMinted = BigInt.fromI32(0)
  deployment.totalQueryFeesCollected = BigInt.fromI32(0)
  deployment.totalCuratorFeeReward = BigInt.fromI32(0)
  deployment.save()
  return deployment
}

export function createIndexer(id: string, timestamp: BigInt): Indexer {
  let indexer = new Indexer(id)
  indexer.createdAt = timestamp.toI32()
  indexer.account = id
  indexer.stakedTokens = BigInt.fromI32(0)
  indexer.tokensAllocated = BigInt.fromI32(0)
  indexer.tokensLocked = BigInt.fromI32(0)
  indexer.tokensClaimable = BigInt.fromI32(0)
  indexer.tokensLockedUntil = 0
  indexer.tokensDelegated = BigInt.fromI32(0)
  indexer.tokenCapacity = BigInt.fromI32(0)
  indexer.indexingRewardCut = 0
  indexer.queryFeeCut = 0
  indexer.delegatorParameterCooldown = 0
  indexer.forcedSettlements = 0
  indexer.save()
  return indexer
}

export function createCurator(id: string, timestamp: BigInt): Curator {
  let curator = new Curator(id)
  curator.createdAt = timestamp.toI32()
  curator.account = id
  curator.totalSignal = BigInt.fromI32(0)
  curator.totalSignaledGRT = BigInt.fromI32(0)
  curator.totalRedeemedGRT = BigInt.fromI32(0)
  curator.save()
  return curator
}

export function createSignal(curator: string, subgraphID: string): Signal {
  let signalID = curator.concat('-').concat(subgraphID)
  let signal = new Signal(signalID)
  signal.curator = curator
  signal.subgraphDeployment = subgraphID
  signal.tokensSignaled = BigInt.fromI32(0)
  signal.tokensRedeemed = BigInt.fromI32(0)
  signal.signal = BigInt.fromI32(0)
  signal.save()
  return signal
}

export function createEthereumAccount(id: string): EthereumAccount {
  let account = new EthereumAccount(id)
  account.balance = BigInt.fromI32(0) // gets set by transfers
  account.save()
  return account
}

export function createGraphAccount(id: string, owner: Bytes): GraphAccount {
  let graphAccount = new GraphAccount(id)
  graphAccount.names = []
  graphAccount.owner = owner.toHexString()
  graphAccount.isOrganization = false // TODO - how is this passed from front end?
  graphAccount.subgraphs = []
  graphAccount.metadataHash = Bytes.fromI32(0) as Bytes
  graphAccount.description = ''
  graphAccount.website = ''
  graphAccount.image = ''
  graphAccount.save()
  return graphAccount
}

export function createPool(id: BigInt): Pool {
  let pool = new Pool(id.toString())
  pool.fees = BigInt.fromI32(0)
  pool.allocation = BigInt.fromI32(0)
  pool.feesClaimed = BigInt.fromI32(0)
  pool.curatorReward = BigInt.fromI32(0)
  pool.save()
  return pool
}

export function createGraphNetwork(): GraphNetwork {
  let graphNetwork = new GraphNetwork('1')
  graphNetwork.graphToken = Address.fromString(addresses.graphToken)
  graphNetwork.epochManager = Address.fromString(addresses.epochManager)
  graphNetwork.curation = Address.fromString(addresses.curation)
  graphNetwork.staking = Address.fromString(addresses.staking)
  graphNetwork.disputeManager = Address.fromString(addresses.disputeManager)
  graphNetwork.gns = Address.fromString(addresses.gns)
  graphNetwork.serviceRegistry = Address.fromString(addresses.serviceRegistry)

  let graphTokenAddress = Address.fromString(addresses.graphToken)
  let graphToken = GraphToken.bind(graphTokenAddress)
  graphNetwork.totalSupply = BigInt.fromI32(0) // gets set by mint

  // most of the parameters below are updated in the constructor, or else
  // right after deployement
  graphNetwork.curationPercentage = BigInt.fromI32(0)
  graphNetwork.channelDisputeEpochs = BigInt.fromI32(0)
  graphNetwork.maxAllocationEpochs = BigInt.fromI32(0)
  graphNetwork.thawingPeriod = BigInt.fromI32(0)
  graphNetwork.totalGRTStaked = BigInt.fromI32(0)
  graphNetwork.totalGRTAllocated = BigInt.fromI32(0)
  graphNetwork.totalGRTClaimable = BigInt.fromI32(0)
  graphNetwork.totalGRTLocked = BigInt.fromI32(0)
  graphNetwork.defaultReserveRatio = BigInt.fromI32(0)
  graphNetwork.minimumCurationSignal = BigInt.fromI32(0)
  graphNetwork.totalGRTSignaled = BigInt.fromI32(0)
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
