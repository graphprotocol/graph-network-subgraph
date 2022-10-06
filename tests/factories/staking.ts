import { newMockEvent, createMockedFunction } from 'matchstick-as/assembly/index'
import {
  DelegationParametersUpdated,
  StakeDeposited,
  StakeLocked,
  StakeWithdrawn,
  StakeSlashed,
  StakeDelegated,
  StakeDelegatedLocked,
  StakeDelegatedWithdrawn,
  AllocationCreated,
  AllocationCollected,
  AllocationClosed,
  RebateClaimed,
  ParameterUpdated,
  SetOperator,
  SlasherUpdate,
  AssetHolderUpdate,
} from '../../src/types/Staking/Staking'
import { Address, BigInt, ethereum, Bytes } from '@graphprotocol/graph-ts'

export function mockDelegationParametersUpdated(
  indexer: Address,
  indexingRewardCut: BigInt,
  queryFeeCut: BigInt,
  cooldownBlocks: BigInt,
): DelegationParametersUpdated {
  let mockEvent = newMockEvent()
  let event = new DelegationParametersUpdated(
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
  event.parameters.push(new ethereum.EventParam('indexer', ethereum.Value.fromAddress(indexer)))
  event.parameters.push(
    new ethereum.EventParam(
      'indexingRewardCut',
      ethereum.Value.fromUnsignedBigInt(indexingRewardCut),
    ),
  )
  event.parameters.push(
    new ethereum.EventParam('queryFeeCut', ethereum.Value.fromUnsignedBigInt(queryFeeCut)),
  )
  event.parameters.push(
    new ethereum.EventParam('cooldownBlocks', ethereum.Value.fromUnsignedBigInt(cooldownBlocks)),
  )

  return event
}

export function mockStakeDeposited(
  indexer: Address,
  tokens: BigInt, //this is supposed to be uint256
): StakeDeposited {
  let mockEvent = newMockEvent()
  mockEvent.block.number = BigInt.fromI32(5)

  let event = new StakeDeposited(
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
  event.parameters.push(new ethereum.EventParam('indexer', ethereum.Value.fromAddress(indexer)))
  event.parameters.push(new ethereum.EventParam('tokens', ethereum.Value.fromSignedBigInt(tokens)))

  return event
}

export function mockStakeLocked(indexer: Address, tokens: BigInt, until: BigInt): StakeLocked {
  let mockEvent = newMockEvent()
  let event = new StakeLocked(
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
  event.parameters.push(new ethereum.EventParam('indexer', ethereum.Value.fromAddress(indexer)))
  event.parameters.push(new ethereum.EventParam('tokens', ethereum.Value.fromSignedBigInt(tokens)))
  event.parameters.push(new ethereum.EventParam('until', ethereum.Value.fromSignedBigInt(until)))

  return event
}

export function mockStakeWithdrawn(indexer: Address, tokens: BigInt): StakeWithdrawn {
  let mockEvent = newMockEvent()
  let event = new StakeWithdrawn(
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
  event.parameters.push(new ethereum.EventParam('indexer', ethereum.Value.fromAddress(indexer)))
  event.parameters.push(new ethereum.EventParam('tokens', ethereum.Value.fromSignedBigInt(tokens)))

  return event
}

export function mockStakeSlashed(
  indexer: Address,
  tokens: BigInt,
  reward: BigInt, //this is supposed to be uint256
  beneficiary: Address,
): StakeSlashed {
  let mockEvent = newMockEvent()
  let event = new StakeSlashed(
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
  event.parameters.push(new ethereum.EventParam('indexer', ethereum.Value.fromAddress(indexer)))
  event.parameters.push(new ethereum.EventParam('tokens', ethereum.Value.fromSignedBigInt(tokens)))
  event.parameters.push(new ethereum.EventParam('reward', ethereum.Value.fromSignedBigInt(reward)))
  event.parameters.push(
    new ethereum.EventParam('beneficiary', ethereum.Value.fromAddress(beneficiary)),
  )

  let staking = mockEvent.address
  createMockedFunction(staking, 'stakes', 'stakes(address):(uint256,uint256,uint256,uint256)')
    .withArgs([ethereum.Value.fromAddress(indexer)])
    .returns([
      ethereum.Value.fromI32(11),
      ethereum.Value.fromI32(77),
      ethereum.Value.fromI32(77),
      ethereum.Value.fromI32(11),
    ])

  return event
}

export function mockStakeDelegated(
  indexer: Address,
  delegator: Address,
  tokens: BigInt,
  shares: BigInt,
): StakeDelegated {
  let mockEvent = newMockEvent()
  let event = new StakeDelegated(
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
  event.parameters.push(new ethereum.EventParam('indexer', ethereum.Value.fromAddress(indexer)))
  event.parameters.push(new ethereum.EventParam('delegator', ethereum.Value.fromAddress(delegator)))
  event.parameters.push(new ethereum.EventParam('tokens', ethereum.Value.fromSignedBigInt(tokens)))
  event.parameters.push(new ethereum.EventParam('shares', ethereum.Value.fromSignedBigInt(shares)))

  return event
}

export function mockStakeDelegatedLocked(
  indexer: Address,
  delegator: Address,
  tokens: BigInt,
  shares: BigInt,
  until: BigInt,
): StakeDelegatedLocked {
  let mockEvent = newMockEvent()
  let event = new StakeDelegatedLocked(
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
  event.parameters.push(new ethereum.EventParam('indexer', ethereum.Value.fromAddress(indexer)))
  event.parameters.push(new ethereum.EventParam('delegator', ethereum.Value.fromAddress(delegator)))
  event.parameters.push(new ethereum.EventParam('tokens', ethereum.Value.fromSignedBigInt(tokens)))
  event.parameters.push(new ethereum.EventParam('shares', ethereum.Value.fromSignedBigInt(shares)))
  event.parameters.push(new ethereum.EventParam('until', ethereum.Value.fromSignedBigInt(until)))

  return event
}

export function mockStakeDelegatedWithdrawn(
  indexer: Address,
  delegator: Address,
  tokens: BigInt,
): StakeDelegatedWithdrawn {
  let mockEvent = newMockEvent()
  let event = new StakeDelegatedWithdrawn(
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
  event.parameters.push(new ethereum.EventParam('indexer', ethereum.Value.fromAddress(indexer)))
  event.parameters.push(new ethereum.EventParam('delegator', ethereum.Value.fromAddress(delegator)))
  event.parameters.push(new ethereum.EventParam('tokens', ethereum.Value.fromSignedBigInt(tokens)))

  return event
}

export function mockAllocationCreated(
  indexer: Address,
  subgraphDeploymentID: Bytes,
  epoch: BigInt,
  tokens: BigInt,
  allocationID: Address,
  metadata: Bytes,
): AllocationCreated {
  let mockEvent = newMockEvent()
  let event = new AllocationCreated(
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
  event.parameters.push(new ethereum.EventParam('indexer', ethereum.Value.fromAddress(indexer)))
  event.parameters.push(
    new ethereum.EventParam('subgraphDeploymentID', ethereum.Value.fromBytes(subgraphDeploymentID)),
  )
  event.parameters.push(new ethereum.EventParam('epoch', ethereum.Value.fromSignedBigInt(epoch)))
  event.parameters.push(new ethereum.EventParam('tokens', ethereum.Value.fromSignedBigInt(tokens)))
  event.parameters.push(
    new ethereum.EventParam('allocationID', ethereum.Value.fromAddress(allocationID)),
  )
  event.parameters.push(new ethereum.EventParam('metadata', ethereum.Value.fromBytes(metadata)))

  return event
}

export function mockAllocationCollected(
  indexer: Address,
  subgraphDeploymentID: Bytes,
  epoch: BigInt,
  tokens: BigInt, //this is supposed to be uint256
  allocationID: Address,
  from: Address,
  curationFees: BigInt,
  rebateFees: BigInt,
): AllocationCollected {
  let mockEvent = newMockEvent()
  let event = new AllocationCollected(
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
  event.parameters.push(new ethereum.EventParam('indexer', ethereum.Value.fromAddress(indexer)))
  event.parameters.push(
    new ethereum.EventParam('subgraphDeploymentID', ethereum.Value.fromBytes(subgraphDeploymentID)),
  )
  event.parameters.push(new ethereum.EventParam('epoch', ethereum.Value.fromSignedBigInt(epoch)))
  event.parameters.push(new ethereum.EventParam('tokens', ethereum.Value.fromSignedBigInt(tokens)))
  event.parameters.push(
    new ethereum.EventParam('allocationID', ethereum.Value.fromAddress(allocationID)),
  )
  event.parameters.push(new ethereum.EventParam('from', ethereum.Value.fromAddress(from)))
  event.parameters.push(
    new ethereum.EventParam('curationFees', ethereum.Value.fromSignedBigInt(curationFees)),
  )
  event.parameters.push(
    new ethereum.EventParam('rebateFees', ethereum.Value.fromSignedBigInt(rebateFees)),
  )

  return event
}

export function mockAllocationClosed(
  indexer: Address,
  subgraphDeploymentID: Bytes,
  epoch: BigInt,
  tokens: BigInt, //this is supposed to be uint256
  allocationID: Address,
  effectiveAllocation: BigInt,
  sender: Address,
  poi: Bytes,
  isPublic: boolean,
): AllocationClosed {
  let mockEvent = newMockEvent()
  let event = new AllocationClosed(
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
  event.parameters.push(new ethereum.EventParam('indexer', ethereum.Value.fromAddress(indexer)))
  event.parameters.push(
    new ethereum.EventParam('subgraphDeploymentID', ethereum.Value.fromBytes(subgraphDeploymentID)),
  )
  event.parameters.push(new ethereum.EventParam('epoch', ethereum.Value.fromSignedBigInt(epoch)))
  event.parameters.push(new ethereum.EventParam('tokens', ethereum.Value.fromSignedBigInt(tokens)))
  event.parameters.push(
    new ethereum.EventParam('allocationID', ethereum.Value.fromAddress(allocationID)),
  )
  event.parameters.push(
    new ethereum.EventParam(
      'effectiveAllocation',
      ethereum.Value.fromSignedBigInt(effectiveAllocation),
    ),
  )
  event.parameters.push(new ethereum.EventParam('sender', ethereum.Value.fromAddress(sender)))
  event.parameters.push(new ethereum.EventParam('poi', ethereum.Value.fromBytes(poi)))
  event.parameters.push(new ethereum.EventParam('isPublic', ethereum.Value.fromBoolean(isPublic)))

  let staking = mockEvent.address

  let tupleArray = [
    ethereum.Value.fromString("0x111111"),
    ethereum.Value.fromBytes(Bytes.fromI32(1)),
    ethereum.Value.fromI32(11),
    ethereum.Value.fromI32(11),
    ethereum.Value.fromI32(11),
    ethereum.Value.fromI32(11),
    ethereum.Value.fromI32(11),
    ethereum.Value.fromI32(11),
  ]
  let tuple = changetype<ethereum.Tuple>(tupleArray)
  let tupleValue = ethereum.Value.fromTuple(tuple)


  createMockedFunction(
    staking,
    'getAllocation',
    'getAllocation(address):((address,bytes32,uint256,uint256,uint256,uint256,uint256,uint256))',
  )
    .withArgs([ethereum.Value.fromAddress(allocationID)])
    .returns(tupleValue)

  return event
}

export function mockRebateClaimed(
  indexer: Address,
  subgraphDeploymentID: Bytes,
  allocationID: Address,
  epoch: BigInt,
  forEpoch: BigInt,
  tokens: BigInt, //this is supposed to be uint256
  unclaimedAllocationsCount: BigInt,
  delegationFees: BigInt,
): RebateClaimed {
  let mockEvent = newMockEvent()
  let event = new RebateClaimed(
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
  event.parameters.push(new ethereum.EventParam('indexer', ethereum.Value.fromAddress(indexer)))
  event.parameters.push(
    new ethereum.EventParam('subgraphDeploymentID', ethereum.Value.fromBytes(subgraphDeploymentID)),
  )
  event.parameters.push(
    new ethereum.EventParam('allocationID', ethereum.Value.fromAddress(allocationID)),
  )
  event.parameters.push(new ethereum.EventParam('epoch', ethereum.Value.fromSignedBigInt(epoch)))
  event.parameters.push(
    new ethereum.EventParam('forEpoch', ethereum.Value.fromSignedBigInt(forEpoch)),
  )
  event.parameters.push(new ethereum.EventParam('tokens', ethereum.Value.fromSignedBigInt(tokens)))
  event.parameters.push(
    new ethereum.EventParam(
      'unclaimedAllocationsCount',
      ethereum.Value.fromSignedBigInt(unclaimedAllocationsCount),
    ),
  )
  event.parameters.push(
    new ethereum.EventParam('delegationFees', ethereum.Value.fromSignedBigInt(delegationFees)),
  )

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

  let staking = mockEvent.address
  createMockedFunction(staking, 'minimumIndexerStake', 'minimumIndexerStake():(uint256)')
    .withArgs([])
    .returns([ethereum.Value.fromI32(11)])
  createMockedFunction(staking, 'thawingPeriod', 'thawingPeriod():(uint32)')
    .withArgs([])
    .returns([ethereum.Value.fromI32(12)])
  createMockedFunction(staking, 'curationPercentage', 'curationPercentage():(uint32)')
    .withArgs([])
    .returns([ethereum.Value.fromI32(13)])
  createMockedFunction(staking, 'protocolPercentage', 'protocolPercentage():(uint32)')
    .withArgs([])
    .returns([ethereum.Value.fromI32(14)])
  createMockedFunction(staking, 'channelDisputeEpochs', 'channelDisputeEpochs():(uint32)')
    .withArgs([])
    .returns([ethereum.Value.fromI32(15)])
  createMockedFunction(staking, 'maxAllocationEpochs', 'maxAllocationEpochs():(uint32)')
    .withArgs([])
    .returns([ethereum.Value.fromI32(16)])
  createMockedFunction(staking, 'alphaNumerator', 'alphaNumerator():(uint32)')
    .withArgs([])
    .returns([ethereum.Value.fromI32(171)])
  createMockedFunction(staking, 'alphaDenominator', 'alphaDenominator():(uint32)')
    .withArgs([])
    .returns([ethereum.Value.fromI32(171)])
  createMockedFunction(staking, 'delegationRatio', 'delegationRatio():(uint32)')
    .withArgs([])
    .returns([ethereum.Value.fromI32(18)])
  createMockedFunction(
    staking,
    'delegationParametersCooldown',
    'delegationParametersCooldown():(uint32)',
  )
    .withArgs([])
    .returns([ethereum.Value.fromI32(19)])
  createMockedFunction(staking, 'delegationUnbondingPeriod', 'delegationUnbondingPeriod():(uint32)')
    .withArgs([])
    .returns([ethereum.Value.fromI32(20)])
  createMockedFunction(staking, 'delegationTaxPercentage', 'delegationTaxPercentage():(uint32)')
    .withArgs([])
    .returns([ethereum.Value.fromI32(21)])

  return event
}

export function mockSetOperator(
  indexer: Address,
  operator: Address,
  allowed: boolean,
): SetOperator {
  let mockEvent = newMockEvent()
  let event = new SetOperator(
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
  event.parameters.push(new ethereum.EventParam('indexer', ethereum.Value.fromAddress(indexer)))
  event.parameters.push(new ethereum.EventParam('operator', ethereum.Value.fromAddress(operator)))
  event.parameters.push(new ethereum.EventParam('allowed', ethereum.Value.fromBoolean(allowed)))

  return event
}

export function mockSlasherUpdate(
  caller: Address,
  slasher: Address,
  allowed: boolean,
): SlasherUpdate {
  let mockEvent = newMockEvent()
  let event = new SlasherUpdate(
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
  event.parameters.push(new ethereum.EventParam('caller', ethereum.Value.fromAddress(caller)))
  event.parameters.push(new ethereum.EventParam('slasher', ethereum.Value.fromAddress(slasher)))
  event.parameters.push(new ethereum.EventParam('allowed', ethereum.Value.fromBoolean(allowed)))

  return event
}

export function mockAssetHolderUpdate(
  caller: Address,
  assetHolder: Address,
  allowed: boolean,
): AssetHolderUpdate {
  let mockEvent = newMockEvent()
  let event = new AssetHolderUpdate(
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
  event.parameters.push(new ethereum.EventParam('caller', ethereum.Value.fromAddress(caller)))
  event.parameters.push(
    new ethereum.EventParam('assetHolder', ethereum.Value.fromAddress(assetHolder)),
  )
  event.parameters.push(new ethereum.EventParam('allowed', ethereum.Value.fromBoolean(allowed)))

  return event
}
