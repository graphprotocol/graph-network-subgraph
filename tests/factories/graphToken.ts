import { newMockEvent } from 'matchstick-as/assembly/index'
import { Transfer } from '../../src/types/GraphToken/GraphToken'
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'

export function mockTransfer(to: Address, from: Address, value: BigInt): Transfer {
  let mockEvent = newMockEvent()
  let event = new Transfer(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(new ethereum.EventParam('to', ethereum.Value.fromAddress(to)))
  event.parameters.push(new ethereum.EventParam('from', ethereum.Value.fromAddress(from)))
  event.parameters.push(new ethereum.EventParam('value', ethereum.Value.fromSignedBigInt(value)))

  return event
}
