import { BigInt, ByteArray, Address, Bytes, crypto, log } from '@graphprotocol/graph-ts'
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
  GraphAccountName,
} from '../types/schema'
import { ENS } from '../types/GNS/ENS'
import { ENSPublicResolver } from '../types/GNS/ENSPublicResolver'
import { addresses } from '../../config/addresses'

export function createOrLoadSubgraph(
  subgraphID: string,
  owner: Address,
  timestamp: BigInt,
): Subgraph {
  let subgraph = Subgraph.load(subgraphID)
  if (subgraph == null) {
    subgraph = new Subgraph(subgraphID)
    subgraph.createdAt = timestamp.toI32()
    subgraph.owner = owner.toHexString()
    subgraph.pastVersions = []
    subgraph.totalNameSignaledGRT = BigInt.fromI32(0)
    subgraph.totalNameSignalMinted = BigInt.fromI32(0)
    subgraph.metadataHash = Bytes.fromI32(0) as Bytes
    subgraph.description = ''
    subgraph.image = ''
    subgraph.name = null
    subgraph.pastNames = []
    subgraph.codeRepository = ''
    subgraph.website = ''
    subgraph.save()
  }
  return subgraph as Subgraph
}

export function createOrLoadSubgraphDeployment(
  subgraphID: string,
  timestamp: BigInt,
): SubgraphDeployment {
  let deployment = SubgraphDeployment.load(subgraphID)
  if (deployment == null) {
    deployment = new SubgraphDeployment(subgraphID)
    deployment.createdAt = timestamp.toI32()
    deployment.totalStake = BigInt.fromI32(0)
    deployment.totalSubgraphIndexingRewards = BigInt.fromI32(0)
    deployment.totalSignaledGRT = BigInt.fromI32(0)
    deployment.totalSignalMinted = BigInt.fromI32(0)
    deployment.totalQueryFeesCollected = BigInt.fromI32(0)
    deployment.totalCuratorFeeReward = BigInt.fromI32(0)
    deployment.save()
  }
  return deployment as SubgraphDeployment
}

export function createOrLoadIndexer(id: string, timestamp: BigInt): Indexer {
  let indexer = Indexer.load(id)
  if (indexer == null) {
    indexer = new Indexer(id)
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
  }
  return indexer as Indexer
}

export function createOrLoadCurator(id: string, timestamp: BigInt): Curator {
  let curator = Curator.load(id)
  if (curator == null) {
    curator = new Curator(id)
    curator.createdAt = timestamp.toI32()
    curator.account = id
    curator.totalSignal = BigInt.fromI32(0)
    curator.totalSignaledGRT = BigInt.fromI32(0)
    curator.totalRedeemedGRT = BigInt.fromI32(0)
    curator.save()
  }
  return curator as Curator
}

export function createOrLoadSignal(curator: string, subgraphID: string): Signal {
  let signalID = curator.concat('-').concat(subgraphID)
  let signal = Signal.load(signalID)
  if (signal == null) {
    signal = new Signal(signalID)
    signal.curator = curator
    signal.subgraphDeployment = subgraphID
    signal.tokensSignaled = BigInt.fromI32(0)
    signal.tokensRedeemed = BigInt.fromI32(0)
    signal.signal = BigInt.fromI32(0)
    signal.save()
  }
  return signal as Signal
}

export function createOrLoadGraphAccount(
  id: string,
  owner: Bytes,
  timeStamp: BigInt,
): GraphAccount {
  let graphAccount = GraphAccount.load(id)
  if (graphAccount == null) {
    graphAccount = new GraphAccount(id)
    graphAccount.createdAt = timeStamp.toI32()
    graphAccount.balance = BigInt.fromI32(0)
    // graphAccount.owner = owner.toHexString()
    graphAccount.save()
  }
  return graphAccount as GraphAccount
}

export function createOrLoadPool(id: BigInt): Pool {
  let pool = Pool.load(id.toString())
  if (pool == null) {
    pool = new Pool(id.toString())
    pool.fees = BigInt.fromI32(0)
    pool.allocation = BigInt.fromI32(0)
    pool.feesClaimed = BigInt.fromI32(0)
    pool.curatorReward = BigInt.fromI32(0)
    pool.save()
  }
  return pool as Pool
}

export function createOrLoadGraphNetwork(): GraphNetwork {
  let graphNetwork = GraphNetwork.load('1')
  if (graphNetwork == null) {
    graphNetwork = new GraphNetwork('1')
    graphNetwork.graphToken = Address.fromString(addresses.graphToken)
    graphNetwork.epochManager = Address.fromString(addresses.epochManager)
    graphNetwork.curation = Address.fromString(addresses.curation)
    graphNetwork.staking = Address.fromString(addresses.staking)
    graphNetwork.disputeManager = Address.fromString(addresses.disputeManager)
    graphNetwork.gns = Address.fromString(addresses.gns)
    graphNetwork.serviceRegistry = Address.fromString(addresses.serviceRegistry)
    graphNetwork.totalSupply = BigInt.fromI32(0) // gets set by mint

    // most of the parameters below are updated in the constructor, or else
    // right after deployment
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
  }
  return graphNetwork as GraphNetwork
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

// Helper for concatenating two byte arrays
export function concatByteArrays(a: ByteArray, b: ByteArray): ByteArray {
  let out = new Uint8Array(a.length + b.length)
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i]
  }
  for (let j = 0; j < b.length; j++) {
    out[a.length + j] = b[j]
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
  // recursion until you get the right version
  if (version != null) {
    versionNumber = versionNumber.plus(BigInt.fromI32(1))
    getVersionNumber(graphAccount, subgraphNumber, versionNumber)
  }
  return versionNumber
}

/**
 * @dev Checks 4 different requirements to resolve a name for a subgraph. Only works with ENS
 * @returns GraphNameAccount ID or null
 */
export function resolveName(graphAccount: Address, name: string, node: Bytes): string | null {
  let graphAccountString = graphAccount.toHexString()
  if (checkTLD(name, node.toHexString())) {
    if (verifyNameOwnership(graphAccountString, node)) {
      if (checkTextRecord(graphAccountString, node)) {
        let nameSystem = 'ENS'
        let id = nameSystem.concat('-').concat(node.toHexString())
        if (checkNoNameDuplicate(id, nameSystem, name, graphAccountString)) {
          // all checks passed. save the new name, return the ID to be stored on the subgraph
          return id
        }
      }
    }
  }
  // one requirement failed, return null
  return null
}

/**
 * @dev Checks if it is a valid top level .eth domain and that the name matches the name hash.
 * Sub domains automatically return null
 * Non matching names return null
 */
function checkTLD(name: string, node: string): boolean {
  if (name.includes('.') || name == '') return false
  let labelHash = crypto.keccak256(ByteArray.fromUTF8(name))

  // namehash('eth') = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae
  // namehash('test') = 0x04f740db81dc36c853ab4205bddd785f46e79ccedca351fc6dfcbd8cc9a33dd6
  // NOTE - test registrar is in use for now for quick testing. TODO - switch when we are ready
  let testNode = ByteArray.fromHexString(
    '0x04f740db81dc36c853ab4205bddd785f46e79ccedca351fc6dfcbd8cc9a33dd6',
  )

  let nameHash = crypto.keccak256(concatByteArrays(testNode, labelHash)).toHexString()
  return nameHash == node ? true : false
}

/**
 * @dev Checks if the name provided is actually owned by the graph account.
 * @param graphAccount - Graph Account ID
 * @param node - ENS node (i.e. this function only works for ens right now)
 * @returns - true if name is verified
 */
function verifyNameOwnership(graphAccount: string, node: Bytes): boolean {
  let ens = ENS.bind(Address.fromHexString(addresses.ens) as Address)
  let ownerOnENS = ens.try_owner(node)
  if (ownerOnENS.reverted == true) {
    log.warning('Try owner reverted for node: {}', [node.toHexString()])
    return false
  } else {
    return ownerOnENS.value.toHexString() == graphAccount ? true : false
  }
}

/**
 * @dev Checks if the graph account has registered their account in the text record on the public
 * resolver
 * @param graphAccount - Graph Account ID
 * @param node - ENS node (i.e. this function only works for ens right now)
 * @returns true is text record is set
 */
function checkTextRecord(graphAccount: string, node: Bytes): boolean {
  let publicResolver = ENSPublicResolver.bind(
    Address.fromHexString(addresses.ensPublicResolver) as Address,
  )
  let textRecord = publicResolver.try_text(node, 'GRAPH NAME SERVICE')
  if (textRecord.reverted) {
    log.warning('Try_text reverted for node: {}', [node.toHexString()])
    return false
  } else {
    let record = ByteArray.fromHexString(textRecord.value).toHexString()
    return record == graphAccount ? true : false
  }
}

/**
 * @dev Check this name isn't already being used by this account. Note, because there is only one
 * system, we just check for the GraphAccountNameEntity. TODO - when multiple systems exist, we
 * will need to iterate over the graph accounts subgraphs, or check all possible names by building
 * each name system + name ID
 */
function checkNoNameDuplicate(
  id: string,
  nameSystem: string,
  name: string,
  graphAccount: string,
): boolean {
  let graphAccountName = GraphAccountName.load(id)
  if (graphAccountName == null) {
    graphAccountName = new GraphAccountName(id)
    graphAccountName.nameSystem = nameSystem
    graphAccountName.name = name
    graphAccountName.graphAccount = graphAccount
    graphAccountName.save()
    return true
  }
  return false
}
