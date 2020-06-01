import { Approval, Transfer } from '../types/GraphToken/GraphToken'
import { EthereumAccount, GraphNetwork } from '../types/schema'
import { BigInt } from '@graphprotocol/graph-ts'
import { createGraphNetwork, createEthereumAccount } from './helpers'

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
  let graphNetwork = GraphNetwork.load("1")
  if (graphNetwork == null){
    graphNetwork = createGraphNetwork()
  }


  let userTo = EthereumAccount.load(to.toHexString())
  if (userTo == null) {
    userTo = createEthereumAccount(to.toHexString())
  }
  let userFrom = EthereumAccount.load(from.toHexString())
  if (userFrom == null) {
    userFrom = createEthereumAccount(from.toHexString())
  }

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
