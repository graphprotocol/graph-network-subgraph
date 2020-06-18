import { Approval, Transfer } from '../types/GraphToken/GraphToken'
import { createOrLoadGraphNetwork, createOrLoadGraphAccount } from './helpers'

/**
 * @dev handleTransfer
 * - updates graphNetwork, creates if needed
 * - updates accounts, creates if needed
 */
export function handleTransfer(event: Transfer): void {
  let to = event.params.to
  let from = event.params.from
  let value = event.params.value

  // The first transaction ever emitted in the network is the minting of GRT
  // And with this, we instantiate GraphNetwork
  let graphNetwork = createOrLoadGraphNetwork()

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

  userTo.save()
  userFrom.save()
}

export function handleApproval(event: Approval): void {
  // Currently not in use, we may need in the future
}
