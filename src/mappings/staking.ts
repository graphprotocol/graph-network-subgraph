import {
  CurationNodeStaked,
  CurationNodeLogout,
  IndexingNodeStaked,
  IndexingNodeBeginLogout,
  IndexingNodeFinalizeLogout,
  DisputeCreated,
  DisputeAccepted,
  DisputeRejected
} from '../../generated/Staking/Staking'
import {Curator, IndexNode, Subgraph, Transactions} from '../../generated/schema'
import {BigInt} from '@graphprotocol/graph-ts'


export function handleCurationNodeStaked(event: CurationNodeStaked): void {
  let id = event.params.staker.toHexString().concat("-").concat(event.params.subgraphID.toHexString())
  let curationNode = new Curator(id)
  curationNode.subgraphID = event.params.subgraphID
  curationNode.tokensStaked = event.params.amountStaked
  curationNode.user = event.params.staker
  curationNode.shares = event.params.curatorShares
  curationNode.save()

  let subgraph = new Subgraph(event.params.subgraphID.toHexString())
  subgraph.totalCurationShares = event.params.subgraphShares
  subgraph.totalIndexingStake = event.params.subgraphStake
  subgraph.save()
}

export function handleCurationNodeLogout(event: CurationNodeLogout): void {
  let id = event.params.staker.toHexString().concat("-").concat(event.params.subgraphID.toHexString())
  let curationNode = new Curator(id)
  curationNode.subgraphID = event.params.subgraphID
  curationNode.tokensStaked = BigInt.fromI32(0)
  curationNode.shares = BigInt.fromI32(0)
  curationNode.save()

  let subgraph = new Subgraph(event.params.subgraphID.toHexString())
  subgraph.totalCurationShares = event.params.subgraphShares
  subgraph.totalIndexingStake = event.params.subgraphStake
  subgraph.save()
}

export function handleIndexingNodeStaked(event: IndexingNodeStaked): void {
  let id = event.params.staker.toHexString().concat("-").concat(event.params.subgraphID.toHexString())

  // Subgraph SHOULD already exist, the GNS must create it before anyone can stake on it
  let subgraph = Subgraph.load(event.params.subgraphID.toHexString())

  let indexNode = IndexNode.load(id)
  if (indexNode == null) {
    indexNode.user = event.params.staker
    indexNode.subgraphID = event.params.subgraphID
    indexNode.logoutStartTime = 0
    subgraph.totalIndexers = subgraph.totalIndexers + 1
  }
  indexNode.tokensStaked = event.params.amountStaked
  indexNode.save()

  subgraph.totalIndexingStake = event.params.totalSubgraphStake
  subgraph.save()

}

export function handleIndexingBeginNodeLogout(event: IndexingNodeBeginLogout): void {
  let id = event.params.staker.toHexString().concat("-").concat(event.params.subgraphID.toHexString())
  let indexNode = new IndexNode(id)
  indexNode.logoutStartTime = event.block.timestamp
  indexNode.save()
}

export function handleIndexingFinalizeNodeLogout(event: IndexingNodeFinalizeLogout): void {
  let id = event.params.staker.toHexString().concat("-").concat(event.params.subgraphID.toHexString())

  let indexNode = new IndexNode(id)
  indexNode.logoutStartTime = 0
  indexNode.tokensStaked = BigInt.fromI32(0)
  indexNode.save()

  let subgraph = Subgraph.load(event.params.subgraphID.toHexString())
  subgraph.totalIndexers = subgraph.totalIndexers - 1
  subgraph.totalIndexingStake = event.params.totalSubgraphStake
  subgraph.save()
}


export function handleDisputeCreated(event: DisputeCreated): void {
// not in MVP
}

export function handleDisputeAccepted(event: DisputeAccepted): void {
// not in MVP
}

export function handleDisputeRejected(event: DisputeRejected): void {
// not in MVP
}