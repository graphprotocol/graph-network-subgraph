import { newMockEvent, createMockedFunction } from 'matchstick-as/assembly/index'
import { Signalled, Burned, ParameterUpdated } from '../../src/types/Curation/Curation'
import { Address, BigInt, ethereum, Bytes } from '@graphprotocol/graph-ts'

export function mockSignalled(
  curator: Address,
  subgraphDeploymentID: Bytes,
  tokens: BigInt,
  signal: BigInt,
  curationTax: BigInt,
): Signalled {
  let mockEvent = newMockEvent()
  let event = new Signalled(
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
  event.parameters.push(new ethereum.EventParam('curator', ethereum.Value.fromAddress(curator)))
  event.parameters.push(
    new ethereum.EventParam('subgraphDeploymentID', ethereum.Value.fromBytes(subgraphDeploymentID)),
  )
  event.parameters.push(new ethereum.EventParam('tokens', ethereum.Value.fromSignedBigInt(tokens)))
  event.parameters.push(new ethereum.EventParam('signal', ethereum.Value.fromSignedBigInt(signal)))
  event.parameters.push(
    new ethereum.EventParam('curationTax', ethereum.Value.fromSignedBigInt(curationTax)),
  )

  return event
}

export function mockBurned(
  curator: Address,
  subgraphDeploymentID: Bytes,
  tokens: BigInt,
  signal: BigInt,
): Burned {
  let mockEvent = newMockEvent()
  let event = new Burned(
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
  event.parameters.push(new ethereum.EventParam('curator', ethereum.Value.fromAddress(curator)))
  event.parameters.push(
    new ethereum.EventParam('subgraphDeploymentID', ethereum.Value.fromBytes(subgraphDeploymentID)),
  )
  event.parameters.push(new ethereum.EventParam('tokens', ethereum.Value.fromSignedBigInt(tokens)))
  event.parameters.push(new ethereum.EventParam('signal', ethereum.Value.fromSignedBigInt(signal)))

  return event
}

export function mockParameterUpdated(param: string): ParameterUpdated {
  let mockEvent = newMockEvent()
  let event = new ParameterUpdated(
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
  event.parameters.push(new ethereum.EventParam('param', ethereum.Value.fromString(param)))

  let curation = mockEvent.address
  createMockedFunction(curation, 'defaultReserveRatio', 'defaultReserveRatio():(uint32)')
    .withArgs([])
    .returns([ethereum.Value.fromI32(11)])
  createMockedFunction(curation, 'curationTaxPercentage', 'curationTaxPercentage():(uint32)')
    .withArgs([])
    .returns([ethereum.Value.fromI32(11)])
  createMockedFunction(curation, 'minimumCurationDeposit', 'minimumCurationDeposit():(uint256)')
    .withArgs([])
    .returns([ethereum.Value.fromI32(11)])
  return event
}
