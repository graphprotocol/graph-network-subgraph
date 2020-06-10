import { BigInt, ByteArray, Address, Bytes, crypto } from '@graphprotocol/graph-ts'
import {
  SubgraphDeployment,
  GraphNetwork,
  Indexer,
  Pool,
  Curator,
  Signal,
  SubgraphVersion,
  Subgraph,
  GraphAccount,
} from '../types/schema'
import { GraphToken } from '../types/GraphToken/GraphToken'
import { ENS } from '../types/GNS/ENS'
import { ENSPublicResolver } from '../types/GNS/ENSPublicResolver'
import { addresses } from '../../config/addresses'

export function createSubgraph(
  subgraphID: string,
  owner: Address,
  versionID: string,
  timestamp: BigInt,
): Subgraph {
  let subgraph = new Subgraph(subgraphID)
  subgraph.createdAt = timestamp.toI32()
  subgraph.owner = owner.toHexString()
  subgraph.currentVersion = versionID
  subgraph.pastVersions = []
  // subgraph.totalNameSignaledGRT = BigInt.fromI32(0)
  // subgraph.totalNameSignalMinted = BigInt.fromI32(0)
  subgraph.metadataHash = Bytes.fromI32(0) as Bytes
  subgraph.description = ''
  subgraph.displayName = ''
  subgraph.image = ''
  subgraph.name = null
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

// TODO - fix this whole thing when GNS is fixed
export function createGraphAccount(id: string, owner: Bytes): GraphAccount {
  let graphAccount = new GraphAccount(id)
  graphAccount.names = []
  graphAccount.name = ''
  // graphAccount.owner = owner.toHexString()
  // graphAccount.isOrganization = false
  graphAccount.metadataHash = Bytes.fromI32(0) as Bytes
  // graphAccount.description = ''
  // graphAccount.website = ''
  // graphAccount.image = ''
  graphAccount.balance = BigInt.fromI32(0)
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

export function getVersionNumber(
  graphAccount: string,
  subgraphNumber: string,
  versionNumber: BigInt,
): BigInt {
  // create versionID. start at version 1
  // TODO - should I start it at 0?
  let versionID = graphAccount
    .concat('-')
    .concat(subgraphNumber)
    .concat('-')
    .concat(versionNumber.toString())
  let version = SubgraphVersion.load(versionID)
  // recursion until you get the right verison
  if (version != null) {
    versionNumber = versionNumber.plus(BigInt.fromI32(1))
    getVersionNumber(graphAccount, subgraphNumber, versionNumber)
  }
  return versionNumber
}

/*
 * @dev Checks if it is a valid top level domains and that the name matches the name hash.
 * Sub domains automatically return null
 * Non matching names return null
 */
export function simpleNamehash(name: string, node: string): string | null {
  if (name.includes('.') || name == '') return null

  let firstHash = crypto.keccak256(ByteArray.fromUTF8(name)).toHexString()

  // namehash('eth') = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae
  let ethNode = '0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae'
  let nameHash = crypto.keccak256(ByteArray.fromUTF8(ethNode + firstHash)).toHexString()

  if (nameHash == node) {
    return name
  } else {
    return node
  }
}

/*
 * @dev Checks if the name provided is actually owned by the graph account. Checks if the graph
 * account has registered their account in the text record on the public resolver. If both are
 * true, returns the name as valid. Otherwise returns null
 */
export function verifyName(graphAccount: string, name: string, node: Bytes): string | null {
  let ens = ENS.bind(Address.fromHexString(addresses.ens) as Address)
  let publicResolver = ENSPublicResolver.bind(
    Address.fromHexString(addresses.ensPublicResolver) as Address,
  )

  let ownerOnENS = ens.owner(node)
  if (ownerOnENS.toHexString() == graphAccount) {
    let textRecord = publicResolver.text(node, 'GRAPH NAME SERVICE')
    if (textRecord == graphAccount) {
      return name
    } else {
      // They have not set the text record for graph account, return null
      return null
    }
  } else {
    // They aren't the real owner, return null
    return null
  }
}
