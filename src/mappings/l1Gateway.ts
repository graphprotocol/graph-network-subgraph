import {
  DepositInitiated,
  WithdrawalFinalized,
} from '../types/L1GraphTokenGateway/L1GraphTokenGateway'
import { BridgeWithdrawalTransaction } from '../types/schema'
import { getTransactionIndex } from './bridgeHelpers'
import { createOrLoadGraphNetwork } from './helpers'

export function handleDepositInitiated(event: DepositInitiated): void {
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.totalGRTDeposited = graphNetwork.totalGRTDeposited.plus(event.params.amount)
  graphNetwork.save()
}

export function handleWithdrawalFinalized(event: WithdrawalFinalized): void {
  // Update total GRT withdrawn confirmed
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.totalGRTWithdrawnConfirmed = graphNetwork.totalGRTWithdrawnConfirmed.plus(
    event.params.amount,
  )
  graphNetwork.save()

  // Save the withdrawal transaction
  let entity = new BridgeWithdrawalTransaction(
    event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString(),
  )

  entity.blockNumber = event.block.number.toI32()
  entity.timestamp = event.block.timestamp.toI32()
  entity.signer = event.params.from.toHexString()
  entity.type = 'BridgeWithdrawal'
  entity.txHash = event.transaction.hash
  entity.from = event.params.from
  entity.to = event.params.to

  entity.amount = event.params.amount
  entity.l1Token = event.params.l1Token

  entity.transactionIndex = getTransactionIndex(event)

  entity.save()
}
