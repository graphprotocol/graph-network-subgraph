import { newMockEvent } from 'matchstick-as/assembly/index'
import { AllocationClosed } from '../../src/types/Staking/Staking'
import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'

export function mockAllocationClosed(
  indexer: Address,
  subgraphDeploymentID: Bytes,
  epoch: BigInt,
  tokens: BigInt,
  allocationID: Address,
  effectiveAllocation: BigInt,
  sender: Address,
  poi: Bytes,
  isDelegator: boolean,
): AllocationClosed {
  const event = changetype<AllocationClosed>(newMockEvent())

  event.parameters = []
  event.parameters.push(new ethereum.EventParam('indexer', ethereum.Value.fromAddress(indexer)))
  event.parameters.push(
    new ethereum.EventParam('subgraphDeploymentID', ethereum.Value.fromBytes(subgraphDeploymentID)),
  )
  event.parameters.push(new ethereum.EventParam('epoch', ethereum.Value.fromUnsignedBigInt(epoch)))
  event.parameters.push(
    new ethereum.EventParam('tokens', ethereum.Value.fromUnsignedBigInt(tokens)),
  )
  event.parameters.push(
    new ethereum.EventParam('allocationID', ethereum.Value.fromAddress(allocationID)),
  )
  event.parameters.push(
    new ethereum.EventParam(
      'effectiveAllocation',
      ethereum.Value.fromUnsignedBigInt(effectiveAllocation),
    ),
  )
  event.parameters.push(new ethereum.EventParam('sender', ethereum.Value.fromAddress(sender)))
  event.parameters.push(new ethereum.EventParam('poi', ethereum.Value.fromBytes(poi)))
  event.parameters.push(
    new ethereum.EventParam('isDelegator', ethereum.Value.fromBoolean(isDelegator)),
  )

  return event
}
