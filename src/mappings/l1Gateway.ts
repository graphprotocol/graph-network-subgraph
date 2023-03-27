import {
  WithdrawalFinalized,
  DepositInitiated,
  TokensMintedFromL2,
} from '../types/L1GraphTokenGateway/L1GraphTokenGateway'
import { BridgeWithdrawalTransaction, BridgeDepositTransaction } from '../types/schema'
import { getRetryableTicketId, getTransactionIndex } from './helpers/bridge'
import { getDataFromEventLog } from './helpers/event-log'
import { createOrLoadGraphNetwork } from './helpers/helpers'

export function handleWithdrawalFinalized(event: WithdrawalFinalized): void {
  // Update total GRT withdrawn confirmed
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.totalGRTWithdrawnConfirmed = graphNetwork.totalGRTWithdrawnConfirmed.plus(
    event.params.amount,
  )
  graphNetwork.save()

  // Save withdrawal data
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

export function handleDepositInitiated(event: DepositInitiated): void {
  // Update total GRT deposited
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.totalGRTDeposited = graphNetwork.totalGRTDeposited.plus(event.params.amount)
  graphNetwork.save()

  // Save deposit data
  let entity = new BridgeDepositTransaction(
    event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString(),
  )

  entity.blockNumber = event.block.number.toI32()
  entity.timestamp = event.block.timestamp.toI32()
  entity.signer = event.params.from.toHexString()
  entity.type = 'BridgeDeposit'
  entity.txHash = event.transaction.hash
  entity.from = event.params.from
  entity.to = event.params.to
  entity.amount = event.params.amount
  entity.l1Token = event.params.l1Token
  entity.retryableTicketId = getRetryableTicketId(event)

  // Deposits initiated through Arbitrum's gateway router will emit a TransferRouted event
  let EVENT_SIGNATURE = 'TransferRouted(address,address,address,address)'
  let data = getDataFromEventLog(event, EVENT_SIGNATURE)
  entity.routed = data !== null

  entity.save()
}

export function handleTokensMintedFromL2 (event: TokensMintedFromL2): void {
  // Update total GRT minted by bridge
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.totalGRTMintedFromL2 = graphNetwork.totalGRTMintedFromL2.plus(event.params.amount)
  graphNetwork.save()
}