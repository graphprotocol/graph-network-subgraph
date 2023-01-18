import { Bytes, BigInt, log } from '@graphprotocol/graph-ts'
import {
  DepositInitiated,
  WithdrawalFinalized,
} from '../types/L1GraphTokenGateway/L1GraphTokenGateway'
import { BridgeWithdrawalTransaction } from '../types/schema'
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

  entity.exitNum = event.params.exitNum.toI32()
  entity.amount = event.params.amount
  entity.l1Token = event.params.l1Token

  // Loop through the receipt logs to find the OutBoxTransactionExecuted event on the same tx
  // This event is emited by Arbitrum's Outbox contract and contains the withdrawal transactionIndex
  let receipt = event.receipt
  let eventFound = false
  if (receipt && receipt.logs.length > 0) {
    let logs = receipt.logs

    for (let i = 0; i < logs.length; i++) {
      let topics = logs[i].topics

      // OutBoxTransactionExecuted event
      if (isOutBoxTransactionExecutedEvent(topics[0])) {
        eventFound = true

        // Parse event data to get the transactionIndex
        let data = logs[i].data
        if (data.length === 32) {
          let hexStringData = strip0xPrefix(data.toHexString())

          let amountBytes = Bytes.fromHexString(hexStringData)
          entity.transactionIndex = BigInt.fromUnsignedBytes(amountBytes.reverse() as Bytes)
        } else {
          log.error('Invalid data length', [data.length.toString(), data.toHexString()])
        }
      }
    }
  } else {
    log.error('Could not find transaction receipt!', [])
  }

  if (!eventFound) {
    log.error('Could not find WithdrawalFinalized event!', [])
  }

  entity.save()
}

function strip0xPrefix(input: string): string {
  return input.startsWith('0x') ? input.slice(2) : input
}

function isOutBoxTransactionExecutedEvent(topic: Bytes): boolean {
  return topic.toHexString() == '0x20af7f3bbfe38132b8900ae295cd9c8d1914be7052d061a511f3f728dab18964'
}
