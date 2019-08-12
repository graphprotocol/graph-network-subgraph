import {
  CuratorStaked,
  CuratorLogout,
  IndexingNodeStaked,
  IndexingNodeBeginLogout,
  IndexingNodeFinalizeLogout,
  DisputeCreated,
  DisputeAccepted,
  DisputeRejected,
} from '../../generated/Staking/Staking'
import { CuratorInfo, IndexerInfo, Indexer, Subgraph, SubgraphVersion } from '../../generated/schema'
import { BigInt, store } from '@graphprotocol/graph-ts'

export function handleCuratorStaked(event: CuratorStaked): void {
  let id = event.params.staker
    .toHexString()
    .concat('-')
    .concat(event.params.subgraphID.toHexString())
  let curator = new CuratorInfo(id)
  curator.subgraphID = event.params.subgraphID
  curator.tokensStaked = event.params.amountStaked
  curator.user = event.params.staker.toHexString()
  curator.shares = event.params.curatorShares
  curator.save()

  let subgraph = new Subgraph(event.params.subgraphID.toHexString())
  subgraph.totalCurationShares = event.params.subgraphTotalCurationShares
  subgraph.totalCurationStake = event.params.subgraphTotalCurationStake
  subgraph.save()
}

export function handleCuratorLogout(event: CuratorLogout): void {
  let id = event.params.staker
    .toHexString()
    .concat('-')
    .concat(event.params.subgraphID.toHexString())
  store.remove('Curator', id)

  let subgraph = new Subgraph(event.params.subgraphID.toHexString())
  subgraph.totalCurationShares = event.params.subgraphTotalCurationShares
  subgraph.totalCurationStake = event.params.subgraphTotalCurationStake
  subgraph.save()
}

export function handleIndexingNodeStaked(event: IndexingNodeStaked): void {
  let id = event.params.staker
    .toHexString()
    .concat('-')
    .concat(event.params.subgraphID.toHexString())

  // Subgraph SHOULD already exist, the GNS must create it before anyone can stake on it
  let subgraphVersion = SubgraphVersion.load(event.params.subgraphID.toHexString())
  let subgraph = Subgraph.load(subgraphVersion.subgraph)

  subgraphVersion.totalIndexingStake = event.params.subgraphTotalIndexingStake
  subgraph.totalIndexingStake = event.params.subgraphTotalIndexingStake
  subgraph.save()
  subgraphVersion.save()

  // Need to load to check if this is a new index node, so we can add 1 to total indexers
  let indexer = Indexer.load(id)
  if (indexer == null){
    indexer = new Indexer(id)
    indexer.save()
  }
  let infoID = event.params.staker.toHexString().concat("-").concat(event.params.subgraphID.toHexString())
  let info = IndexerInfo.load(infoID)
  if (info == null) {
    info.user = event.params.staker.toHexString()
    info.subgraphID = event.params.subgraphID
    info.logoutStartTime = 0
  }
  info.tokensStaked = info.tokensStaked.plus(event.params.amountStaked)
  info.save()
}

// TODO - Might be an error in how we handle logging out, users can still earn rewards and I dont think it should be like that. For now though, handle normally
export function handleIndexingNodeBeginLogout(event: IndexingNodeBeginLogout): void {
  let id = event.params.staker
    .toHexString()
    .concat('-')
    .concat(event.params.subgraphID.toHexString())
  let indexNode = new IndexerInfo(id)
  indexNode.logoutStartTime = event.block.timestamp
  indexNode.save()
}

export function handleIndexingNodeFinalizeLogout(event: IndexingNodeFinalizeLogout): void {
  let id = event.params.staker
    .toHexString()
    .concat('-')
    .concat(event.params.subgraphID.toHexString())

  let indexNode = new IndexerInfo(id)
  indexNode.logoutStartTime = 0
  indexNode.tokensStaked = BigInt.fromI32(0)
  indexNode.save()

  let subgraphVersion = SubgraphVersion.load(event.params.subgraphID.toHexString())
  subgraphVersion.totalIndexingStake = event.params.subgraphTotalIndexingStake
  subgraphVersion.save()

  let subgraph = Subgraph.load(subgraphVersion.subgraph)
  subgraph.totalIndexingStake = event.params.subgraphTotalIndexingStake
  subgraph.save()
}

export function handleDisputeCreated(event: DisputeCreated): void {}

export function handleDisputeAccepted(event: DisputeAccepted): void {}

export function handleDisputeRejected(event: DisputeRejected): void {}
