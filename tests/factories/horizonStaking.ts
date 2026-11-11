import { newMockEvent } from 'matchstick-as/assembly/index'
import {
  DelegatedTokensWithdrawn,
  DelegationFeeCutSet,
  DelegationSlashed,
  HorizonStakeDeposited,
  HorizonStakeWithdrawn,
  ProvisionCreated,
  ProvisionIncreased,
  ProvisionSlashed,
  ProvisionThawed,
  TokensDelegated,
  TokensDeprovisioned,
  TokensUndelegated,
} from '../../src/types/HorizonStaking/HorizonStaking'
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'

function addressParam(name: string, value: Address): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromAddress(value))
}

function uintParam(name: string, value: BigInt): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromUnsignedBigInt(value))
}

export function mockProvisionSlashed(
  serviceProvider: Address,
  verifier: Address,
  tokens: BigInt,
): ProvisionSlashed {
  let event = changetype<ProvisionSlashed>(newMockEvent())
  event.parameters = [
    addressParam('serviceProvider', serviceProvider),
    addressParam('verifier', verifier),
    uintParam('tokens', tokens),
  ]
  return event
}

export function mockDelegationSlashed(
  serviceProvider: Address,
  verifier: Address,
  tokens: BigInt,
): DelegationSlashed {
  let event = changetype<DelegationSlashed>(newMockEvent())
  event.parameters = [
    addressParam('serviceProvider', serviceProvider),
    addressParam('verifier', verifier),
    uintParam('tokens', tokens),
  ]
  return event
}

export function mockProvisionIncreased(
  serviceProvider: Address,
  verifier: Address,
  tokens: BigInt,
): ProvisionIncreased {
  let event = changetype<ProvisionIncreased>(newMockEvent())
  event.parameters = [
    addressParam('serviceProvider', serviceProvider),
    addressParam('verifier', verifier),
    uintParam('tokens', tokens),
  ]
  return event
}

export function mockHorizonStakeDeposited(
  serviceProvider: Address,
  tokens: BigInt,
): HorizonStakeDeposited {
  let event = changetype<HorizonStakeDeposited>(newMockEvent())
  event.block.number = BigInt.fromI32(5)
  event.parameters = [addressParam('serviceProvider', serviceProvider), uintParam('tokens', tokens)]
  return event
}

export function mockHorizonStakeWithdrawn(
  serviceProvider: Address,
  tokens: BigInt,
): HorizonStakeWithdrawn {
  let event = changetype<HorizonStakeWithdrawn>(newMockEvent())
  event.parameters = [addressParam('serviceProvider', serviceProvider), uintParam('tokens', tokens)]
  return event
}

export function mockProvisionCreated(
  serviceProvider: Address,
  verifier: Address,
  tokens: BigInt,
): ProvisionCreated {
  let mockEvent = newMockEvent()
  let event = new ProvisionCreated(
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
  event.parameters.push(addressParam('serviceProvider', serviceProvider))
  event.parameters.push(addressParam('verifier', verifier))
  event.parameters.push(uintParam('tokens', tokens))
  event.parameters.push(uintParam('maxVerifierCut', BigInt.fromI32(0)))
  event.parameters.push(uintParam('thawingPeriod', BigInt.fromI32(0)))
  return event
}

export function mockProvisionThawed(
  serviceProvider: Address,
  verifier: Address,
  tokens: BigInt,
): ProvisionThawed {
  let mockEvent = newMockEvent()
  let event = new ProvisionThawed(
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
  event.parameters.push(addressParam('serviceProvider', serviceProvider))
  event.parameters.push(addressParam('verifier', verifier))
  event.parameters.push(uintParam('tokens', tokens))
  return event
}

export function mockTokensDeprovisioned(
  serviceProvider: Address,
  verifier: Address,
  tokens: BigInt,
): TokensDeprovisioned {
  let mockEvent = newMockEvent()
  let event = new TokensDeprovisioned(
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
  event.parameters.push(addressParam('serviceProvider', serviceProvider))
  event.parameters.push(addressParam('verifier', verifier))
  event.parameters.push(uintParam('tokens', tokens))
  return event
}

export function mockDelegationFeeCutSet(
  serviceProvider: Address,
  verifier: Address,
  paymentType: i32,
  feeCut: BigInt,
): DelegationFeeCutSet {
  let mockEvent = newMockEvent()
  let event = new DelegationFeeCutSet(
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
  event.parameters.push(addressParam('serviceProvider', serviceProvider))
  event.parameters.push(addressParam('verifier', verifier))
  event.parameters.push(new ethereum.EventParam('paymentType', ethereum.Value.fromI32(paymentType)))
  event.parameters.push(uintParam('feeCut', feeCut))
  return event
}

export function mockTokensDelegated(
  serviceProvider: Address,
  verifier: Address,
  delegator: Address,
  tokens: BigInt,
  shares: BigInt,
): TokensDelegated {
  let mockEvent = newMockEvent()
  let event = new TokensDelegated(
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
  event.parameters.push(addressParam('serviceProvider', serviceProvider))
  event.parameters.push(addressParam('verifier', verifier))
  event.parameters.push(addressParam('delegator', delegator))
  event.parameters.push(uintParam('tokens', tokens))
  event.parameters.push(uintParam('shares', shares))
  return event
}

export function mockTokensUndelegated(
  serviceProvider: Address,
  verifier: Address,
  delegator: Address,
  tokens: BigInt,
  shares: BigInt,
): TokensUndelegated {
  let mockEvent = newMockEvent()
  let event = new TokensUndelegated(
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
  event.parameters.push(addressParam('serviceProvider', serviceProvider))
  event.parameters.push(addressParam('verifier', verifier))
  event.parameters.push(addressParam('delegator', delegator))
  event.parameters.push(uintParam('tokens', tokens))
  event.parameters.push(uintParam('shares', shares))
  return event
}

export function mockDelegatedTokensWithdrawn(
  serviceProvider: Address,
  verifier: Address,
  delegator: Address,
  tokens: BigInt,
): DelegatedTokensWithdrawn {
  let mockEvent = newMockEvent()
  let event = new DelegatedTokensWithdrawn(
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
  event.parameters.push(addressParam('serviceProvider', serviceProvider))
  event.parameters.push(addressParam('verifier', verifier))
  event.parameters.push(addressParam('delegator', delegator))
  event.parameters.push(uintParam('tokens', tokens))
  return event
}
