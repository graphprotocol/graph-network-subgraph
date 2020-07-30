import { Approval, Transfer } from '../types/GraphToken/GraphToken'
import { createOrLoadGraphNetwork, createOrLoadGraphAccount } from './helpers'
import { GraphNetwork, GraphAccount } from '../types/schema'

/**
 * @dev handleTransfer
 * - updates graphNetwork, creates if needed
 * - updates accounts, creates if needed
 */
export function handleTransfer(event: Transfer): void {
  // The first transaction ever emitted in the network is the minting of GRT
  // And with this, we instantiate GraphNetwork
  let graphNetwork = createOrLoadGraphNetwork()
  let staking = graphNetwork.staking
  let curation = graphNetwork.curation
  let gns = graphNetwork.gns

  let to = event.params.to
  let from = event.params.from
  let value = event.params.value
  let userTo = createOrLoadGraphAccount(to.toHexString(), to, event.block.timestamp)
  let userFrom = createOrLoadGraphAccount(from.toHexString(), to, event.block.timestamp)

  // Mint Transfer
  if (from.toHexString() == '0x0000000000000000000000000000000000000000') {
    graphNetwork.totalSupply = graphNetwork.totalSupply.plus(value)
    graphNetwork.save()
    userTo.balance = userTo.balance.plus(value)

    // Burn Transfer
  } else if (to.toHexString() == '0x0000000000000000000000000000000000000000') {
    graphNetwork.totalSupply = graphNetwork.totalSupply.minus(value)
    graphNetwork.save()

    userFrom.balance = userFrom.balance.minus(value)

    // Normal Transfer
  } else {
    userTo.balance = userTo.balance.plus(value)
    userFrom.balance = userFrom.balance.minus(value)
  }

  // decrease approval , if it was a transferFrom from one of the core contracts
  if (to == staking) {
    userFrom.stakingApproval = userFrom.stakingApproval.minus(value)
  } else if (to == curation) {
    userFrom.curationApproval = userFrom.curationApproval.minus(value)
  } else if (to == gns) {
    userFrom.gnsApproval = userFrom.gnsApproval.minus(value)
  }

  userTo.save()
  userFrom.save()
}

export function handleApproval(event: Approval): void {
  let graphNetwork = GraphNetwork.load('1')
  let staking = graphNetwork.staking
  let curation = graphNetwork.curation
  let gns = graphNetwork.gns
  let spender = event.params.spender
  let graphAccount = createOrLoadGraphAccount(
    event.params.owner.toHexString(),
    event.params.owner,
    event.block.timestamp,
  )

  if (spender == staking) {
    graphAccount.stakingApproval = event.params.value
  } else if (spender == curation) {
    graphAccount.curationApproval = event.params.value
  } else if (spender == gns) {
    graphAccount.gnsApproval = event.params.value
  }
  graphAccount.save()
}
