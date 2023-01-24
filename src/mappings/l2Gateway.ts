import { WithdrawalInitiated } from '../types/L2GraphTokenGateway/L2GraphTokenGateway'
import { createOrLoadGraphNetwork } from './helpers/helpers'
import { BridgeWithdrawalTransaction } from '../types/schema'

export function handleWithdrawalInitiated(event: WithdrawalInitiated): void {
  // Update total GRT withdrawn
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.totalGRTWithdrawn = graphNetwork.totalGRTWithdrawn.plus(event.params.amount)
  graphNetwork.save()

  // Save withdrawal data
  let withdrawalTransaction = new BridgeWithdrawalTransaction(
    event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString()),
  )

  // Note that this only runs on L2, so we can take the block number directly from the L1 estimate
  withdrawalTransaction.blockNumber = graphNetwork.currentL1BlockNumber!.toI32()
  withdrawalTransaction.timestamp = event.block.timestamp.toI32()
  withdrawalTransaction.signer = event.params.from.toHexString()
  withdrawalTransaction.type = 'BridgeWithdrawal'
  withdrawalTransaction.txHash = event.transaction.hash
  withdrawalTransaction.from = event.params.from
  withdrawalTransaction.to = event.params.to
  withdrawalTransaction.transactionIndex = event.params.l2ToL1Id
  withdrawalTransaction.amount = event.params.amount
  withdrawalTransaction.l1Token = event.params.l1Token

  withdrawalTransaction.save()
}

export function handleDepositFinalized(event: DepositFinalized): void {
  
}