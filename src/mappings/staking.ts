import {
  CuratorStaked,
  CuratorLogout,
  IndexingNodeStaked,
  IndexingNodeBeginLogout,
  IndexingNodeFinalizeLogout,
  DisputeCreated,
  DisputeAccepted,
  DisputeRejected,
  Deposit,
  Withdraw,
  Staking
} from '../../generated/Staking/Staking'
import {
  CuratorInfo,
  Curator,
  IndexerInfo,
  Indexer,
  Subgraph,
  SubgraphVersion,
  Account
} from '../../generated/schema'
import {BigInt, store} from '@graphprotocol/graph-ts'

export function handleDeposit(event: Deposit): void {
  let id = event.params.user.toHexString()
  let account = Account.load(id)
  account.standbyPoolBalance = account.standbyPoolBalance.plus(event.params.amount)
  account.save()
}

export function handleWithdraw(event: Withdraw): void {
  let id = event.params.user.toHexString()
  let account = Account.load(id)
  account.standbyPoolBalance = account.standbyPoolBalance.minus(event.params.amount)
  account.save()
}


export function handleCuratorStaked(event: CuratorStaked): void {
  let curatorID = event.params.staker.toHexString()
  let curator = new Curator(curatorID)
  curator.save()

  let subgraphVersion = SubgraphVersion.load(event.params.subgraphID.toHexString())
  // This null check is possible since GNS is not linked to subgraph creation
  if (subgraphVersion == null) {
    subgraphVersion = new SubgraphVersion(event.params.subgraphID.toHexString())
    subgraphVersion.createdAt = event.block.timestamp.toI32()
    subgraphVersion.totalCurationShares = BigInt.fromI32(0)
    subgraphVersion.totalCurationStake = BigInt.fromI32(0)
    subgraphVersion.totalIndexingStake = BigInt.fromI32(0)
  }

  if (subgraphVersion.reserveRatio == null) {
    const staking = Staking.bind(event.address)
    const subgraph = staking.subgraphs(event.params.subgraphID)
    subgraphVersion.reserveRatio = subgraph.value0
  }

    // Note, this is emitted as the real values stored in the contract, so no addition
  // or subtraction needed

  let oldTotalStake = subgraphVersion.totalCurationStake
  let changeInStake = event.params.subgraphTotalCurationStake.minus(oldTotalStake)
  subgraphVersion.totalCurationStake = event.params.subgraphTotalCurationStake
  subgraphVersion.totalCurationShares = event.params.subgraphTotalCurationShares
  subgraphVersion.save()

  let infoID = event.params.staker.toHexString().concat("-").concat(event.params.subgraphID.toHexString())
  let curatorInfo = CuratorInfo.load(infoID)
  if (curatorInfo == null) {
    curatorInfo = new CuratorInfo(infoID)
    curatorInfo.tokensStaked = BigInt.fromI32(0)
    curatorInfo.tokensUnstaked = BigInt.fromI32(0)
    curatorInfo.shares = BigInt.fromI32(0)
    curatorInfo.user = event.params.staker.toHexString()
    curatorInfo.subgraphID = event.params.subgraphID.toHexString()
  }

  let account = Account.load(event.params.staker.toHexString())

  // Need to check if we staked more tokens, or unstaked without full logout (same event)
  if (changeInStake.gt(BigInt.fromI32(0))) {
    curatorInfo.tokensStaked = curatorInfo.tokensStaked.plus(changeInStake)
    account.standbyPoolBalance = account.standbyPoolBalance.minus(changeInStake)

  } else {
    // Here we minus both, because the number is negative, so it increased tokens
    // unstaked, and increases pool balance
    curatorInfo.tokensUnstaked = curatorInfo.tokensUnstaked.minus(changeInStake)
    account.standbyPoolBalance = account.standbyPoolBalance.minus(changeInStake)
  }
  curatorInfo.shares = event.params.curatorShares
  curatorInfo.save()
  account.save()


  // TODO - Bring this back in when we stake on names, probably in beta
  // let subgraph = Subgraph.load(subgraphVersion.subgraph)
  // // This null check is possible since GNS is not linked to subgraph creation
  // // So what happens - if this SubgraphVersion was registered to a Subgraph, both will end up updated.
  // // If it wasnt registed, the Subgraphversion exists on its own
  // if (subgraph != null) {
  //   // Shares only exist on the Subgraph, not within subgraph version.
  //   // So this value is straight from the contract
  //   subgraph.totalCurationShares = event.params.subgraphTotalCurationShares
  //
  //   // Must check if the CuratorStaked event increased or decreased the Curators stake
  //   let changeInStake: BigInt
  //   if (curatorInfo.tokensStaked.gt(previousStake)) {
  //     changeInStake = curatorInfo.tokensStaked.minus(previousStake)
  //     subgraph.totalCurationStake = subgraph.totalCurationStake.plus(changeInStake)
  //   } else {
  //     changeInStake = previousStake.minus(curatorInfo.tokensStaked)
  //     subgraph.totalCurationStake = subgraph.totalCurationStake.minus(changeInStake)
  //   }
  //   subgraph.save()
  // }

}

export function handleCuratorLogout(event: CuratorLogout): void {
  let id = event.params.staker
    .toHexString()
    .concat('-')
    .concat(event.params.subgraphID.toHexString())
  store.remove('CuratorInfo', id)

  let subgraphVersion = SubgraphVersion.load(event.params.subgraphID.toHexString())
  let changeInStake = subgraphVersion.totalCurationStake.minus(event.params.subgraphTotalCurationStake)
  subgraphVersion.totalCurationStake = event.params.subgraphTotalCurationStake
  subgraphVersion.totalCurationShares = event.params.subgraphTotalCurationShares
  subgraphVersion.save()

  let account = Account.load(event.params.staker.toHexString())
  account.standbyPoolBalance = account.standbyPoolBalance.plus(changeInStake)
  account.save()

  // TODO - Bring this back in when we stake on names, probably in beta
  // let subgraph = Subgraph.load(subgraphVersion.subgraph)
  // subgraph.totalCurationShares = event.params.subgraphTotalCurationShares
  // subgraph.totalCurationStake = event.params.subgraphTotalCurationStake.minus(removedStaked)
  // subgraph.save()


}

export function handleIndexerStaked(event: IndexingNodeStaked): void {
  let id = event.params.staker.toHexString()

  // Subgraph SHOULD already exist, the GNS must create it before anyone can stake on it
  let subgraphVersion = SubgraphVersion.load(event.params.subgraphID.toHexString())
  if (subgraphVersion == null) {
    subgraphVersion = new SubgraphVersion(event.params.subgraphID.toHexString())
    subgraphVersion.createdAt = event.block.timestamp.toI32()
    subgraphVersion.totalCurationShares = BigInt.fromI32(0)
    subgraphVersion.totalCurationStake = BigInt.fromI32(0)
    subgraphVersion.totalIndexingStake = BigInt.fromI32(0)
  }

  if (subgraphVersion.reserveRatio == null) {
    const staking = Staking.bind(event.address)
    const subgraph = staking.subgraphs(event.params.subgraphID)
    subgraphVersion.reserveRatio = subgraph.value0
  }

  subgraphVersion.totalIndexingStake = event.params.subgraphTotalIndexingStake
  subgraphVersion.save()

  // TODO - Bring this back in when we stake on names, probably in beta
  // let subgraph = Subgraph.load(subgraphVersion.subgraph)
  // // This null check is possible since GNS is not linked to subgraph creation
  // if (subgraph == null){
  //   subgraph = new Subgraph(event.params.subgraphID.toHexString())
  // }
  // subgraph.totalIndexingStake = event.params.subgraphTotalIndexingStake
  // subgraph.save()


  // Need to load to check if this is a new index node, so we can add 1 to total indexers
  let indexer = Indexer.load(id)
  if (indexer == null) {
    indexer = new Indexer(id)
    indexer.save()
  }
  let infoID = event.params.staker.toHexString().concat("-").concat(event.params.subgraphID.toHexString())
  let info = IndexerInfo.load(infoID)
  if (info == null) {
    info = new IndexerInfo(infoID)
    info.user = id
    info.subgraphID = event.params.subgraphID.toHexString()
    info.logoutStartTime = 0
  }
  info.tokensStaked = event.params.amountStaked
  info.save()

  let account = Account.load(event.params.staker.toHexString())
  account.standbyPoolBalance = account.standbyPoolBalance.minus(event.params.amountStaked)
  account.save()
}

// TODO - Might be an error in how we handle logging out, users can still earn rewards and I dont think it should be like that. For now though, handle normally
export function handleIndexerBeginLogout(event: IndexingNodeBeginLogout): void {
  let id = event.params.staker
    .toHexString()
    .concat('-')
    .concat(event.params.subgraphID.toHexString())
  let indexNode = new IndexerInfo(id)
  indexNode.logoutStartTime = event.block.timestamp.toI32()
  indexNode.tokensStaked = BigInt.fromI32(0)
  indexNode.save()

  let subgraphVersion = SubgraphVersion.load(event.params.subgraphID.toHexString())
  subgraphVersion.totalIndexingStake = subgraphVersion.totalIndexingStake.minus(event.params.unstakedAmount)
  subgraphVersion.save()

  let account = Account.load(event.params.staker.toHexString())
  account.thawingTokenBalance = account.thawingTokenBalance.plus(event.params.unstakedAmount).plus(event.params.fees)
  account.save()



  // TODO - Bring this back in when we stake on names, probably in beta
  // let subgraph = Subgraph.load(subgraphVersion.subgraph)
  // // It can be null if someone just staked, without registering a domain
  // // Then the subgraph exists only as a version, and does not have a Subgraph entity it can relate to
  // if (subgraph != null) {
  //   subgraph.totalIndexingStake = event.params.subgraphTotalIndexingStake
  //   subgraph.save()
  // }

}

export function handleIndexerFinalizeLogout(event: IndexingNodeFinalizeLogout): void {
  let id = event.params.staker
    .toHexString()
    .concat('-')
    .concat(event.params.subgraphID.toHexString())

  store.remove('IndexerInfo', id)

  let account = Account.load(event.params.staker.toHexString())
  account.standbyPoolBalance = account.standbyPoolBalance.plus(account.thawingTokenBalance)
  account.thawingTokenBalance = BigInt.fromI32(0)
  account.save()

}

export function handleDisputeCreated(event: DisputeCreated): void {
}

export function handleDisputeAccepted(event: DisputeAccepted): void {
}

export function handleDisputeRejected(event: DisputeRejected): void {
}
