import { OutBoxTransactionExecuted } from '../types/Outbox/ArbitrumOutbox'
import { createOrLoadGraphNetwork } from './helpers'
import { BridgeWithdrawalTransaction } from '../types/schema'

export function handleOutBoxTransactionExecuted(event: OutBoxTransactionExecuted): void {
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)

  // Save the withdrawal transaction
  let withdrawalTransaction = new BridgeWithdrawalTransaction(
    event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString()),
  )

  const receipt = event.receipt
  const logs = receipt.logs
  logs[0].topics
  // Note that this only runs on L1, so we can take the block number directly
  withdrawalTransaction.blockNumber = event.block.number
  withdrawalTransaction.timestamp = event.block.timestamp.toI32()
  withdrawalTransaction.signer = event.params.l2Sender.toHexString()
  withdrawalTransaction.type = 'BridgeWithdrawal'
  withdrawalTransaction.txHash = event.transaction.hash
  withdrawalTransaction.from = event.params.l2Sender
  withdrawalTransaction.to = event.params.to
  withdrawalTransaction.transactionIndex = event.params.transactionIndex
  withdrawalTransaction.save()

  // Update total GRT withdrawn
  graphNetwork.totalGRTWithdrawnConfirmed = graphNetwork.totalGRTWithdrawnConfirmed.plus(event.params.amount)
  graphNetwork.save()
}
