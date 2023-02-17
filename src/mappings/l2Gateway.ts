import { DepositFinalized, WithdrawalInitiated } from '../types/L2GraphTokenGateway/L2GraphTokenGateway'
import { createOrLoadGraphNetwork } from './helpers/helpers'
import { BridgeDepositTransaction, BridgeWithdrawalTransaction, RetryableTicketRedeemAttempt } from '../types/schema'
import { getDataFromEventLog } from './helpers/event-log'

export function handleWithdrawalInitiated(event: WithdrawalInitiated): void {
  // Update total GRT withdrawn
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.totalGRTWithdrawn = graphNetwork.totalGRTWithdrawn.plus(event.params.amount)
  graphNetwork.save()

  // Save withdrawal data
  let entity = new BridgeWithdrawalTransaction(
    event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString()),
  )

  // Note that this only runs on L2, so we can take the block number directly from the L1 estimate
  entity.blockNumber = graphNetwork.currentL1BlockNumber!.toI32()
  entity.timestamp = event.block.timestamp.toI32()
  entity.signer = event.params.from.toHexString()
  entity.type = 'BridgeWithdrawal'
  entity.txHash = event.transaction.hash
  entity.from = event.params.from
  entity.to = event.params.to
  entity.transactionIndex = event.params.l2ToL1Id
  entity.amount = event.params.amount
  entity.l1Token = event.params.l1Token

  entity.save()
}

export function handleDepositFinalized(event: DepositFinalized): void {
  // Update total GRT withdrawn confirmed
  let graphNetwork = createOrLoadGraphNetwork(
    event.block.number,
    event.address
  );
  graphNetwork.totalGRTDepositedConfirmed = graphNetwork.totalGRTDepositedConfirmed.plus(
    event.params.amount
  );
  graphNetwork.save();

  // Save bridge deposit data
  let entity = new BridgeDepositTransaction(
    event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString()
  );

  entity.blockNumber = graphNetwork.currentL1BlockNumber!.toI32();
  entity.timestamp = event.block.timestamp.toI32();
  entity.signer = event.params.from.toHexString();
  entity.type = 'BridgeDeposit'
  entity.txHash = event.transaction.hash;
  entity.from = event.params.from;
  entity.to = event.params.to;
  entity.amount = event.params.amount;
  entity.l1Token = event.params.l1Token;
  
  let attempt = RetryableTicketRedeemAttempt.load(event.transaction.hash.toHexString());
  if (attempt != null) {
    entity.retryableTicketId = attempt.ticketId;
  }

  // Deposits initiated through Arbitrum's gateway router will emit a TransferRouted event
  let EVENT_SIGNATURE = 'TransferRouted(address,address,address,address)'
  let data = getDataFromEventLog(event, EVENT_SIGNATURE)
  entity.routed = data !== null

  entity.save();
}