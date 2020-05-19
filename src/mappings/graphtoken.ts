import { Approval, Transfer } from '../../generated/GraphToken/GraphToken'
import { Account, GraphNetwork } from '../../generated/schema'
import { BigInt } from '@graphprotocol/graph-ts'
import { createAccount } from './helpers'

export function handleTransfer(event: Transfer): void {
  let to = event.params.to
  let from = event.params.from
  let value = event.params.value
  let graphNetwork: GraphNetwork | null

  let userTo = Account.load(to.toHexString())
  if (userTo == null) {
    userTo = createAccount(to.toHexString())
  }
  let userFrom = Account.load(from.toHexString())
  if (userFrom == null) {
    userFrom = createAccount(from.toHexString())
  }

  // Mint Transfer
  if (from.toHexString() == '0x0000000000000000000000000000000000000000') {
    graphNetwork = GraphNetwork.load('1')
    if (graphNetwork == null) {
      graphNetwork = new GraphNetwork('1')
      graphNetwork.totalSupply = BigInt.fromI32(0)
    }
    graphNetwork.totalSupply = graphNetwork.totalSupply.plus(value)
    graphNetwork.save()
    userTo.balance = userTo.balance.plus(value)

    // Burn Transfer
  } else if (to.toHexString() == '0x0000000000000000000000000000000000000000') {
    graphNetwork = GraphNetwork.load('1')
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
