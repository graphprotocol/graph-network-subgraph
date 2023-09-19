import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'

import {
  assert,
  clearStore,
  test,
  beforeAll,
  describe,
  afterAll,
  createMockedFunction,
} from 'matchstick-as/assembly/index'

import {
  handleDelegationParametersUpdated,
  handleStakeDeposited,
  handleStakeLocked,
  handleStakeWithdrawn,
  handleSetOperator,
  handleStakeDelegated,
  handleStakeDelegatedLocked,
  handleStakeDelegatedWithdrawn,
  handleAllocationCreated,
  handleAllocationCollected,
  handleParameterUpdated,
  handleAssetHolderUpdate,
  handleSlasherUpdate,
} from '../src/mappings/staking'
import { handleTransfer } from '../src/mappings/graphToken'
import {
  mockDelegationParametersUpdated,
  mockStakeDeposited,
  mockStakeLocked,
  mockStakeWithdrawn,
  mockSetOperator,
  mockStakeDelegated,
  mockStakeDelegatedLocked,
  mockStakeDelegatedWithdrawn,
  mockAllocationCreated,
  mockAllocationCollected,
  mockParameterUpdated,
  mockSlasherUpdate,
  mockAssetHolderUpdate,
} from './factories/staking'
import { createOrLoadGraphNetwork } from '../src/mappings/helpers/helpers'
import { mockTransfer } from './factories/graphToken'
import { GraphNetwork, GraphAccount } from '../src/types/schema'

// CONSTANT ADDRESS OR IDS
const graphID = '0x0000000000000000000000000000000000000000'
const graphAddress = Address.fromString(graphID)
const controllerID = '0x0000000000000000000000000000000000000001'
const controllerAddress = Address.fromString(controllerID)
const indexerID = '0x0000000000000000000000000000000000000003'
const indexerAddress = Address.fromString(indexerID)
const operatorID = '0x0000000000000000000000000000000000000004'
const operatorAddress = Address.fromString(operatorID)
const slahserID = '0x0000000000000000000000000000000000000005'
const slasherAddress = Address.fromString(slahserID)
const delegatorID = '0x0000000000000000000000000000000000000006'
const delegatorAddress = Address.fromString(delegatorID)
const delegatedStakeID = delegatorID.concat('-').concat(indexerID)
const subgraphDeploymentID = '0x0000000000000000000000000000000000000007'
const subgraphDeploymentAddress = Address.fromString(subgraphDeploymentID)
const allocationID = '0x0000000000000000000000000000000000000008'
const allocationAddress = Address.fromString(allocationID)
const metadata = Address.fromString('0x0000000000000000000000000000000000000009')
const assetHolderAddress = Address.fromString('0x0000000000000000000000000000000000000011')

// CONSTANT NUMBERS OR BIGINTS
// blockNumber and epochLength are picked in a way to let createOrLoadEpoch create new epoch
// when first called. Note that to the same end mockStakeDeposited sets block.number of the event as 5 in factories/statking.ts
// The other values are rather random.

const blockNumber = BigInt.fromI32(1)
const indexingRewardCut = BigInt.fromI32(3)
const queryFeeCut = BigInt.fromI32(4)
const cooldownBlocks = BigInt.fromI32(5)
const indexingRewardCut2 = BigInt.fromI32(33)
const queryFeeCut2 = BigInt.fromI32(44)
const cooldownBlocks2 = BigInt.fromI32(55)
const delegationRatio = 10
const epochLength = 2
const value = BigInt.fromI32(66)
const value2 = BigInt.fromI32(55)
const lockedUntil = BigInt.fromI32(10)
const slasherReward = BigInt.fromI32(10)
const shares = BigInt.fromI32(10)
const shares2 = BigInt.fromI32(20)
const epoch = BigInt.fromI32(1)
const curationFees = BigInt.fromI32(1)
const rebateFees = BigInt.fromI32(2)
const minimumIndexerStake = BigInt.fromI32(11)
const thawingPeriod = BigInt.fromI32(12)
const curationPercentage = BigInt.fromI32(13)
const protocolPercentage = BigInt.fromI32(14)
const channelDisputeEpochs = BigInt.fromI32(15)
const maxAllocationEpochs = BigInt.fromI32(16)
const rebateRatio = BigInt.fromI32(17)
const delegationRatio1 = BigInt.fromI32(18)
const delegationParametersCooldown = BigInt.fromI32(19)
const delegationUnbondingPeriod = BigInt.fromI32(20)
const delegationTaxPercentage = BigInt.fromI32(21)

// MOCKS
// createOrLoadGraphNetwork calls the getGovernor function of controllerAddress so we mock it here
createMockedFunction(controllerAddress, 'getGovernor', 'getGovernor():(address)')
  .withArgs([])
  .returns([ethereum.Value.fromAddress(controllerAddress)])

// INDEXER STAKE RELATED TESTS
describe('INDEXER STAKE', () => {
  describe('DelegationParametersUpdated', () => {
    beforeAll(() => {
      createOrLoadGraphNetwork(blockNumber, controllerAddress)
    })

    afterAll(() => {
      // Clear the store in order to start the next test off on a clean state
      clearStore()
    })

    // A non-network participant can call stake at Staking.sol
    // which might cause delegationParametersUpdated event to be emitted
    // inside _stake function, a transfer event is emitted, thus a graph account is created
    // Thus the case is the same for a non-indexer network participant
    test('works when a non-indexer stakes', () => {
      // When _stake is successfully run, before any event we are considering here can be emitted
      // a transaction occurs for staking. Therefore we moch this transaction.
      // This leads to a graph account creation as well as initialization of some values needed.
      let transfer = mockTransfer(graphAddress, indexerAddress, value)
      handleTransfer(transfer)

      let event = mockDelegationParametersUpdated(
        indexerAddress,
        indexingRewardCut,
        queryFeeCut,
        cooldownBlocks,
      )
      handleDelegationParametersUpdated(event)
      assert.fieldEquals('Indexer', indexerID, 'queryFeeCut', queryFeeCut.toString())
    })

    test('assigns the right values to params', () => {
      assert.fieldEquals('Indexer', indexerID, 'indexingRewardCut', indexingRewardCut.toString())
      assert.fieldEquals('Indexer', indexerID, 'queryFeeCut', queryFeeCut.toString())
      assert.fieldEquals(
        'Indexer',
        indexerID,
        'delegatorParameterCooldown',
        cooldownBlocks.toString(),
      )
    })

    test('works when an indexer changes delegation parameters', () => {
      let event = mockDelegationParametersUpdated(
        indexerAddress,
        indexingRewardCut2,
        queryFeeCut2,
        cooldownBlocks2,
      )
      handleDelegationParametersUpdated(event)
      assert.fieldEquals('Indexer', indexerID, 'indexingRewardCut', indexingRewardCut2.toString())
      assert.fieldEquals('Indexer', indexerID, 'queryFeeCut', queryFeeCut2.toString())
      assert.fieldEquals(
        'Indexer',
        indexerID,
        'delegatorParameterCooldown',
        cooldownBlocks2.toString(),
      )
    })
  })

  describe('StakeDeposited', () => {
    beforeAll(() => {
      // We need epoch length and delegation ratio to be nonzero for these tests
      let graphNetwork = createOrLoadGraphNetwork(blockNumber, controllerAddress)
      graphNetwork.delegationRatio = delegationRatio
      graphNetwork.epochLength = epochLength
      graphNetwork.save()

      // When _stake is successfully run, before any event we are considering here can be emitted
      // a transaction occurs for staking. Therefore we moch this transaction.
      // This leads to a graph account creation as well as initialization of some values needed.
      let transfer = mockTransfer(graphAddress, indexerAddress, value)
      handleTransfer(transfer)
    })

    afterAll(() => {
      // Clear the store in order to start the next test off on a clean state
      clearStore()
    })

    test("creates an indexer and correctly updates if it's the first time they have staked", () => {
      let stakeDeposited = mockStakeDeposited(indexerAddress, value)
      handleStakeDeposited(stakeDeposited)
      assert.fieldEquals('Indexer', indexerID, 'stakedTokens', value.toString())
    })

    test('increases graphNetwork.stakedIndexersCount when an indexer stakes the first time', () => {
      assert.fieldEquals('GraphNetwork', '1', 'stakedIndexersCount', '1')
    })

    test('correctly updates graphNetwork.totalTokensStaked', () => {
      assert.fieldEquals('GraphNetwork', '1', 'totalTokensStaked', value.toString())
    })

    test('correctly updates epoch.stakeDeposited', () => {
      // Epoch id turns out as 2 when we set graphNetwork.blockNumber = 1, epochLength = 2, event.block.number = 5
      // see createOrLoadEpoch in handleStakeDeposited for calculations
      assert.fieldEquals('Epoch', '2', 'stakeDeposited', value.toString())
    })

    test('correctly updates indexer.stakedToken when an already existing indexer stakes', () => {
      assert.fieldEquals('Indexer', indexerID, 'stakedTokens', value.toString())
      let stakeDeposited = mockStakeDeposited(indexerAddress, value2)
      handleStakeDeposited(stakeDeposited)

      // Since we have staked 2 times, the indexers stakedTokens will be the total of the values
      let totalValue = value.plus(value2)
      assert.fieldEquals('Indexer', indexerID, 'stakedTokens', totalValue.toString())
    })
  })

  describe('StakeLocked', () => {
    // Note that indexer.stakedTokens are not decremented when _unstake is called but when _withdraw is called
    // Note StakeLocked event is emitted when _unstake is called
    beforeAll(() => {
      // We need epoch length and delegation ratio to be nonzero for these tests
      let graphNetwork = createOrLoadGraphNetwork(blockNumber, controllerAddress)
      graphNetwork.delegationRatio = delegationRatio
      graphNetwork.epochLength = epochLength
      graphNetwork.save()

      // When _stake is successfully run, before any event we are considering here can be emitted
      // a transaction occurs for staking. Therefore we moch this transaction.
      // This leads to a graph account creation as well as initialization of some values needed.
      let transfer = mockTransfer(graphAddress, indexerAddress, value)
      handleTransfer(transfer)

      // StakeLocked event can only be emitted if _stake is called and indexer.stakedTokens are nonzero
      // before unstake is called since it is a requirement in unstake
      // thus we stake first
      let stakeDeposited = mockStakeDeposited(indexerAddress, value)
      handleStakeDeposited(stakeDeposited)
    })

    afterAll(() => {
      // Clear the store in order to start the next test off on a clean state
      clearStore()
    })

    test('correctly updates indexer.lockedTokens and indexer.tokensLockedUntil', () => {
      let stakeLocked = mockStakeLocked(indexerAddress, value2, lockedUntil)
      handleStakeLocked(stakeLocked)
      assert.fieldEquals('Indexer', indexerID, 'lockedTokens', value2.toString())
      assert.fieldEquals('Indexer', indexerID, 'tokensLockedUntil', lockedUntil.toString())
    })

    test('correctly updates graphNetwork.totalUnstakedTokensLocked', () => {
      assert.fieldEquals('GraphNetwork', '1', 'totalUnstakedTokensLocked', value2.toString())
    })

    test('does not descrease graphNetwork.stakedIndexersCount if indexer did not lock all its stake', () => {
      assert.fieldEquals('GraphNetwork', '1', 'stakedIndexersCount', '1')
    })

    test('descreases graphNetwork.stakedIndexersCount if indexer locked all its stake', () => {
      let stakeLocked = mockStakeLocked(indexerAddress, value, lockedUntil)
      handleStakeLocked(stakeLocked)
      assert.fieldEquals('GraphNetwork', '1', 'stakedIndexersCount', '0')
    })
  })

  describe('StakeWithdrawn', () => {
    // Note indexer.stakedTokens are decremented in _withdraw but not in _unstake
    beforeAll(() => {
      // We need epoch length and delegation ratio to be nonzero for these tests
      let graphNetwork = createOrLoadGraphNetwork(blockNumber, controllerAddress)
      graphNetwork.delegationRatio = delegationRatio
      graphNetwork.epochLength = epochLength
      graphNetwork.save()

      // When _stake is successfully run, before any event we are considering here can be emitted
      // a transaction occurs for staking. Therefore we moch this transaction.
      // This leads to a graph account creation as well as initialization of some values needed.
      let transfer = mockTransfer(graphAddress, indexerAddress, value)
      handleTransfer(transfer)

      // StakeWithdrawn event can only be emitted if _stake and _unstake are called before
      // thus we first emit the corresponding events
      let stakeDeposited = mockStakeDeposited(indexerAddress, value)
      handleStakeDeposited(stakeDeposited)
      let stakeDeposited2 = mockStakeDeposited(indexerAddress, value2)
      handleStakeDeposited(stakeDeposited2)

      let stakeLocked = mockStakeLocked(indexerAddress, value, lockedUntil)
      handleStakeLocked(stakeLocked)
    })

    afterAll(() => {
      // Clear the store in order to start the next test off on a clean state
      clearStore()
    })

    test('correctly updates indexer.stakedTokens', () => {
      // Total staked tokens are value + value2
      let StakeWithdrawn = mockStakeWithdrawn(indexerAddress, value2)
      handleStakeWithdrawn(StakeWithdrawn)
      assert.fieldEquals('Indexer', indexerID, 'stakedTokens', value.toString())
    })

    test('correctly updates indexer.lockedTokens', () => {
      // 'value2' amount of tokens are withdrawn from the  'value' amount of lockedTokens
      // hence the "final lockedTokens = value - value2"
      let diff = value.minus(value2)
      assert.fieldEquals('Indexer', indexerID, 'lockedTokens', diff.toString())
    })

    test('sets indexer.tokensLockedUntil to zero', () => {
      assert.fieldEquals('Indexer', indexerID, 'tokensLockedUntil', '0')
    })

    test('correctly updates graphNetwork.totalTokensStaked', () => {
      assert.fieldEquals('GraphNetwork', '1', 'totalTokensStaked', value.toString())
    })

    // 'value2' amount of tokens are withdrawn from the  'value' amount of lockedTokens
    // hence the "final lockedTokens = value - value2"
    test('correctly updates graphNetwork.totalUnstakedTokensLocked', () => {
      let diff = value.minus(value2)
      assert.fieldEquals('GraphNetwork', '1', 'totalUnstakedTokensLocked', diff.toString())
    })
  })

  describe('StakeSlashed', () => {
    beforeAll(() => {
      // We need epoch length and delegation ratio to be nonzero for these tests
      let graphNetwork = createOrLoadGraphNetwork(blockNumber, controllerAddress)
      graphNetwork.delegationRatio = delegationRatio
      graphNetwork.epochLength = epochLength
      graphNetwork.save()

      // When _stake is successfully run, before any event we are considering here can be emitted
      // a transaction occurs for staking. Therefore we moch this transaction.
      // This leads to a graph account creation as well as initialization of some values needed.
      let transfer = mockTransfer(graphAddress, indexerAddress, value)
      handleTransfer(transfer)

      // StakeSlashed event can only be emitted if _stake is called and indexer.stakedTokens are nonzero
      let stakeDeposited = mockStakeDeposited(indexerAddress, value)
      handleStakeDeposited(stakeDeposited)
      let stakeDeposited2 = mockStakeDeposited(indexerAddress, value2)
      handleStakeDeposited(stakeDeposited2)
    })

    afterAll(() => {
      // Clear the store in order to start the next test off on a clean state
      clearStore()
    })

    // test('correctly updates indexer.stakedTokens', () => {
    //   let stakeSlashed = mockStakeSlashed(indexerAddress, value, slasherReward, slasherAddress)
    //   handleStakeSlashed(stakeSlashed)
    //   assert.fieldEquals('Indexer', indexerID, 'stakedTokens', value2.toString())
    // })

    // test('correctly updates graphNetwork.totalTokensStaked', () => {
    //   assert.fieldEquals('GraphNetwork', '1', 'totalTokensStaked', value2.toString())
    // })
  })
})

// DELEGATOR STAKE RELATED TESTS
describe('DELEGATOR STAKE', () => {
  describe('StakeDelegated', () => {
    beforeAll(() => {
      // We need epoch length and delegation ratio to be nonzero for these tests
      let graphNetwork = createOrLoadGraphNetwork(blockNumber, controllerAddress)
      graphNetwork.delegationRatio = delegationRatio
      graphNetwork.epochLength = epochLength
      graphNetwork.save()

      // When _stake is successfully run, before any event we are considering here can be emitted
      // a transaction occurs for staking. Therefore we moch this transaction.
      // This leads to a graph account creation as well as initialization of some values needed.
      let transfer = mockTransfer(graphAddress, indexerAddress, value)
      handleTransfer(transfer)

      // Same for delegatorAddress
      let transfer2 = mockTransfer(graphAddress, delegatorAddress, value)
      handleTransfer(transfer2)

      // StakeDelegated event can only be emitted if _stake is called and indexer.stakedTokens are nonzero
      let stakeDeposited = mockStakeDeposited(indexerAddress, value)
      handleStakeDeposited(stakeDeposited)
    })

    afterAll(() => {
      // Clear the store in order to start the next test off on a clean state
      clearStore()
    })

    test('correctly updates indexer.delegatedTokens', () => {
      let stakeDelegated = mockStakeDelegated(indexerAddress, delegatorAddress, value, shares)
      handleStakeDelegated(stakeDelegated)
      assert.fieldEquals('Indexer', indexerID, 'delegatedTokens', value.toString())
    })

    test('correctly updates indexer.delegatorShares', () => {
      assert.fieldEquals('Indexer', indexerID, 'delegatorShares', shares.toString())
    })

    test('correctly updates delegator.totalStakedTokens', () => {
      assert.fieldEquals('Delegator', delegatorID, 'totalStakedTokens', value.toString())
    })

    test('increases delegator.activeStakesCount if delegators share increases from zero', () => {
      assert.fieldEquals('Delegator', delegatorID, 'activeStakesCount', '1')
    })

    test('correctly updates graphNetwork.totalDelegatedTokens', () => {
      assert.fieldEquals('GraphNetwork', '1', 'totalDelegatedTokens', value.toString())
    })

    test('increases graphNetwork.activeDelegatorCount if delegator.activeStakesCount was initially zero', () => {
      assert.fieldEquals('GraphNetwork', '1', 'activeDelegatorCount', '1')
    })

    test('creates and correctly updates delegatedStake', () => {
      assert.fieldEquals('DelegatedStake', delegatedStakeID, 'stakedTokens', value.toString())
      assert.fieldEquals('DelegatedStake', delegatedStakeID, 'shareAmount', shares.toString())
    })

    test('does not increase delegator.activeStakesCount if the delegator had previous shares ', () => {
      // We make delegator delegate again to test nonzero previous stake case
      let stakeDelegated2 = mockStakeDelegated(indexerAddress, delegatorAddress, value2, shares2)
      handleStakeDelegated(stakeDelegated2)
      assert.fieldEquals('Delegator', delegatorID, 'activeStakesCount', '1')
    })

    test('does not increase graphNetwork.activeDelegatorCount if the delegator had previous shares', () => {
      assert.fieldEquals('GraphNetwork', '1', 'activeDelegatorCount', '1')
    })
  })

  describe('StakeDelegatedLocked', () => {
    beforeAll(() => {
      // We need epoch length and delegation ratio to be nonzero for these tests
      let graphNetwork = createOrLoadGraphNetwork(blockNumber, controllerAddress)
      graphNetwork.delegationRatio = delegationRatio
      graphNetwork.epochLength = epochLength
      graphNetwork.save()

      // When _stake is successfully run, before any event we are considering here can be emitted
      // a transaction occurs for staking. Therefore we moch this transaction.
      // This leads to a graph account creation as well as initialization of some values needed.
      let transfer = mockTransfer(graphAddress, indexerAddress, value)
      handleTransfer(transfer)
      let transfer2 = mockTransfer(graphAddress, delegatorAddress, value)
      handleTransfer(transfer2)

      // StakeDelegatedLocked event can only be emitted if _stake is called and indexer.stakedTokens are nonzero
      let stakeDeposited = mockStakeDeposited(indexerAddress, value)
      handleStakeDeposited(stakeDeposited)

      let stakeDelegated = mockStakeDelegated(indexerAddress, delegatorAddress, value, shares)
      handleStakeDelegated(stakeDelegated)

      let stakeDelegated2 = mockStakeDelegated(indexerAddress, delegatorAddress, value2, shares2)
      handleStakeDelegated(stakeDelegated2)
    })

    afterAll(() => {
      // Clear the store in order to start the next test off on a clean state
      clearStore()
    })

    test('correctly updates indexer.delegatedTokens', () => {
      let stakeDelegatedLocked = mockStakeDelegatedLocked(
        indexerAddress,
        delegatorAddress,
        value,
        shares,
        lockedUntil,
      )
      handleStakeDelegatedLocked(stakeDelegatedLocked)
      assert.fieldEquals('Indexer', indexerID, 'delegatedTokens', value2.toString())
    })

    test('correctly updates indexer.delegatorShares', () => {
      assert.fieldEquals('Indexer', indexerID, 'delegatorShares', shares2.toString())
    })

    test('correctly updates delegator.totalUnstakedTokens', () => {
      assert.fieldEquals('Delegator', delegatorID, 'totalUnstakedTokens', value.toString())
    })

    test('correctly updates graphNetwork.totalDelegatedTokens ', () => {
      assert.fieldEquals('GraphNetwork', '1', 'totalDelegatedTokens', value2.toString())
    })

    test('does not decrease delegator.activeStakesCount if the shares does not become zero ', () => {
      assert.fieldEquals('Delegator', delegatorID, 'activeStakesCount', '1')
    })

    test('does not decrease graphNetwork.activeDelegatorCount if delegator.activeStakesCount does not become zero', () => {
      assert.fieldEquals('GraphNetwork', '1', 'activeDelegatorCount', '1')
    })

    //TODO totalRealizedRewards after helpers about exchange rate

    test('correctly updates delegatedStake', () => {
      assert.fieldEquals('DelegatedStake', delegatedStakeID, 'unstakedTokens', value.toString())
      assert.fieldEquals('DelegatedStake', delegatedStakeID, 'shareAmount', shares2.toString())
      assert.fieldEquals('DelegatedStake', delegatedStakeID, 'lockedTokens', value.toString())
      assert.fieldEquals('DelegatedStake', delegatedStakeID, 'lockedUntil', lockedUntil.toString())
    })

    test('decreases delegator.activeStakesCount if the shares becomes zero ', () => {
      let stakeDelegatedLocked2 = mockStakeDelegatedLocked(
        indexerAddress,
        delegatorAddress,
        value2,
        shares2,
        lockedUntil,
      )
      handleStakeDelegatedLocked(stakeDelegatedLocked2)
      assert.fieldEquals('Delegator', delegatorID, 'activeStakesCount', '0')
    })

    test('decreases graphNetwork.activeDelegatorCount if delegator.activeStakesCount becomes zero', () => {
      assert.fieldEquals('GraphNetwork', '1', 'activeDelegatorCount', '0')
    })
  })

  describe('StakeDelegatedWithdrawn', () => {
    beforeAll(() => {
      // We need epoch length and delegation ratio to be nonzero for these tests
      let graphNetwork = createOrLoadGraphNetwork(blockNumber, controllerAddress)
      graphNetwork.delegationRatio = delegationRatio
      graphNetwork.epochLength = epochLength
      graphNetwork.save()

      // When _stake is successfully run, before any event we are considering here can be emitted
      // a transaction occurs for staking. Therefore we moch this transaction.
      // This leads to a graph account creation as well as initialization of some values needed.
      let transfer = mockTransfer(graphAddress, indexerAddress, value)
      handleTransfer(transfer)
      let transfer2 = mockTransfer(graphAddress, delegatorAddress, value)
      handleTransfer(transfer2)

      // StakeDelegatedWithdrawn event can only be emitted if _stake is called before
      // Also, StakeDelegated and StakeDelegatedLocked events must be emitted before
      let stakeDeposited = mockStakeDeposited(indexerAddress, value)
      handleStakeDeposited(stakeDeposited)

      let stakeDelegated = mockStakeDelegated(indexerAddress, delegatorAddress, value, shares)
      handleStakeDelegated(stakeDelegated)

      let stakeDelegatedLocked = mockStakeDelegatedLocked(
        indexerAddress,
        delegatorAddress,
        value,
        shares,
        lockedUntil,
      )
      handleStakeDelegatedLocked(stakeDelegatedLocked)
    })

    afterAll(() => {
      // Clear the store in order to start the next test off on a clean state
      clearStore()
    })

    test('sets delegatedStake.lockedTokens to zero', () => {
      let stakeDelegatedWithdrawn = mockStakeDelegatedWithdrawn(
        indexerAddress,
        delegatorAddress,
        value,
      )
      handleStakeDelegatedWithdrawn(stakeDelegatedWithdrawn)
      assert.fieldEquals('DelegatedStake', delegatedStakeID, 'lockedTokens', '0')
    })

    test('sets delegatedStake.lockedUntil to zero', () => {
      assert.fieldEquals('DelegatedStake', delegatedStakeID, 'lockedUntil', '0')
    })
  })
})

// ALLOCATION LIFE CYCLE RELATED TESTS
describe('ALLOCATION LIFE CYCLE', () => {
  describe('AllocationCreated', () => {
    beforeAll(() => {
      // We need epoch length and delegation ratio to be nonzero for these tests
      let graphNetwork = createOrLoadGraphNetwork(blockNumber, controllerAddress)
      graphNetwork.delegationRatio = delegationRatio
      graphNetwork.epochLength = epochLength
      graphNetwork.save()

      // When _stake is successfully run, before any event we are considering here can be emitted
      // a transaction occurs for staking. Therefore we moch this transaction.
      // This leads to a graph account creation as well as initialization of some values needed.
      let transfer = mockTransfer(graphAddress, indexerAddress, value)
      handleTransfer(transfer)
      let transfer2 = mockTransfer(graphAddress, delegatorAddress, value)
      handleTransfer(transfer2)

      // AllocationCreated event can only be emitted if _stake is called before
      let stakeDeposited = mockStakeDeposited(indexerAddress, value)
      handleStakeDeposited(stakeDeposited)

      let stakeDelegated = mockStakeDelegated(indexerAddress, delegatorAddress, value, shares)
      handleStakeDelegated(stakeDelegated)
    })

    afterAll(() => {
      // Clear the store in order to start the next test off on a clean state
      clearStore()
    })

    test('correctly increases indexer.allocatedTokens', () => {
      let allocationCreated = mockAllocationCreated(
        indexerAddress,
        subgraphDeploymentAddress,
        epoch,
        value,
        allocationAddress,
        metadata,
      )
      handleAllocationCreated(allocationCreated)
      assert.fieldEquals('Indexer', indexerID, 'allocatedTokens', value.toString())
    })

    test('correctly increases indexer.totalAllocationCount', () => {
      assert.fieldEquals('Indexer', indexerID, 'totalAllocationCount', '1')
    })

    test('correctly increases indexer.allocationCount', () => {
      assert.fieldEquals('Indexer', indexerID, 'allocationCount', '1')
    })

    test('correctly increases graphNetwork.totalTokensAllocated', () => {
      assert.fieldEquals('GraphNetwork', '1', 'totalTokensAllocated', value.toString())
    })

    test('creates and correctly updates deployment', () => {
      assert.fieldEquals(
        'SubgraphDeployment',
        subgraphDeploymentID,
        'stakedTokens',
        value.toString(),
      )
    })

    test('creates and correctly updates allocation', () => {
      assert.fieldEquals('Allocation', allocationID, 'allocatedTokens', value.toString())
      assert.fieldEquals('Allocation', allocationID, 'subgraphDeployment', subgraphDeploymentID)
      assert.fieldEquals('Allocation', allocationID, 'status', 'Active')
    })
  })

  describe('AllocationCollected', () => {
    beforeAll(() => {
      // We need epoch length and delegation ratio to be nonzero for these tests
      let graphNetwork = createOrLoadGraphNetwork(blockNumber, controllerAddress)
      graphNetwork.delegationRatio = delegationRatio
      graphNetwork.epochLength = epochLength
      graphNetwork.save()

      // When _stake is successfully run, before any event we are considering here can be emitted
      // a transaction occurs for staking. Therefore we moch this transaction.
      // This leads to a graph account creation as well as initialization of some values needed.
      let transfer = mockTransfer(graphAddress, indexerAddress, value)
      handleTransfer(transfer)
      let transfer2 = mockTransfer(graphAddress, delegatorAddress, value)
      handleTransfer(transfer2)

      // AllocationCollected event can only be emitted if _stake is called before
      let stakeDeposited = mockStakeDeposited(indexerAddress, value)
      handleStakeDeposited(stakeDeposited)

      let stakeDelegated = mockStakeDelegated(indexerAddress, delegatorAddress, value, shares)
      handleStakeDelegated(stakeDelegated)

      let allocationCreated = mockAllocationCreated(
        indexerAddress,
        subgraphDeploymentAddress,
        epoch,
        value,
        allocationAddress,
        metadata,
      )
      handleAllocationCreated(allocationCreated)
    })

    afterAll(() => {
      // Clear the store in order to start the next test off on a clean state
      clearStore()
    })

    test('correctly updates indexer.queryFeesCollected', () => {
      let allocationCollected = mockAllocationCollected(
        indexerAddress,
        subgraphDeploymentAddress,
        epoch,
        value,
        allocationAddress,
        indexerAddress,
        curationFees,
        rebateFees,
      )
      handleAllocationCollected(allocationCollected)
      assert.fieldEquals('Indexer', indexerID, 'queryFeesCollected', rebateFees.toString())
    })

    test('correctly updates allocation.queryFeesCollected', () => {
      assert.fieldEquals('Allocation', allocationID, 'queryFeesCollected', rebateFees.toString())
    })

    test('correctly updates allocation.curatorRewards', () => {
      assert.fieldEquals('Allocation', allocationID, 'curatorRewards', curationFees.toString())
    })

    test('creates and correctly updates epoch', () => {
      assert.fieldEquals('Epoch', '2', 'totalQueryFees', value.toString())
      assert.fieldEquals('Epoch', '2', 'queryFeesCollected', rebateFees.toString())
      assert.fieldEquals('Epoch', '2', 'curatorQueryFees', curationFees.toString())
    })

    test('creates and correctly updates pool', () => {
      assert.fieldEquals('Pool', '1', 'curatorRewards', curationFees.toString())
    })

    test('creates and correctly updates deployment', () => {
      assert.fieldEquals(
        'SubgraphDeployment',
        subgraphDeploymentID,
        'queryFeesAmount',
        rebateFees.toString(),
      )
      assert.fieldEquals(
        'SubgraphDeployment',
        subgraphDeploymentID,
        'signalledTokens',
        curationFees.toString(),
      )
      assert.fieldEquals(
        'SubgraphDeployment',
        subgraphDeploymentID,
        'curatorFeeRewards',
        curationFees.toString(),
      )
    })

    test('correctly updates graphNetwork', () => {
      assert.fieldEquals('GraphNetwork', '1', 'totalQueryFees', value.toString())
      assert.fieldEquals(
        'GraphNetwork',
        '1',
        'totalIndexerQueryFeesCollected',
        rebateFees.toString(),
      )
      assert.fieldEquals('GraphNetwork', '1', 'totalCuratorQueryFees', curationFees.toString())
      assert.fieldEquals(
        'GraphNetwork',
        '1',
        'totalUnclaimedQueryFeeRebates',
        rebateFees.toString(),
      )
    })
  })
})

// NETWORK CONSTANTS OR SETTING RELATED TESTS
describe('NETWORK SETS AND UPDATES', () => {
  describe('ParameterUpdated', () => {
    beforeAll(() => {
      createOrLoadGraphNetwork(blockNumber, controllerAddress)
    })

    afterAll(() => {
      // Clear the store in order to start the next test off on a clean state
      clearStore()
    })

    test('minimumIndexerStake correctly updated', () => {
      let parameterUpdated = mockParameterUpdated('minimumIndexerStake')
      handleParameterUpdated(parameterUpdated)
      assert.fieldEquals('GraphNetwork', '1', 'minimumIndexerStake', minimumIndexerStake.toString())
    })
    test('thawingPeriod correctly updated', () => {
      let parameterUpdated = mockParameterUpdated('thawingPeriod')
      handleParameterUpdated(parameterUpdated)
      assert.fieldEquals('GraphNetwork', '1', 'thawingPeriod', thawingPeriod.toString())
    })
    test('curationPercentage correctly updated', () => {
      let parameterUpdated = mockParameterUpdated('curationPercentage')
      handleParameterUpdated(parameterUpdated)
      assert.fieldEquals('GraphNetwork', '1', 'curationPercentage', curationPercentage.toString())
    })
    test('protocolPercentage correctly updated', () => {
      let parameterUpdated = mockParameterUpdated('protocolPercentage')
      handleParameterUpdated(parameterUpdated)
      assert.fieldEquals(
        'GraphNetwork',
        '1',
        'protocolFeePercentage',
        protocolPercentage.toString(),
      )
    })
    test('channelDisputeEpochs correctly updated', () => {
      let parameterUpdated = mockParameterUpdated('channelDisputeEpochs')
      handleParameterUpdated(parameterUpdated)
      assert.fieldEquals(
        'GraphNetwork',
        '1',
        'channelDisputeEpochs',
        channelDisputeEpochs.toString(),
      )
    })
    test('maxAllocationEpochs correctly updated', () => {
      let parameterUpdated = mockParameterUpdated('maxAllocationEpochs')
      handleParameterUpdated(parameterUpdated)
      assert.fieldEquals('GraphNetwork', '1', 'maxAllocationEpochs', maxAllocationEpochs.toString())
    })
    test('rebateRatio correctly updated', () => {
      let parameterUpdated = mockParameterUpdated('rebateRatio')
      handleParameterUpdated(parameterUpdated)
      assert.fieldEquals('GraphNetwork', '1', 'rebateRatio', rebateRatio.toString())
    })
    test('delegationRatio correctly updated', () => {
      let parameterUpdated = mockParameterUpdated('delegationRatio')
      handleParameterUpdated(parameterUpdated)
      assert.fieldEquals('GraphNetwork', '1', 'delegationRatio', delegationRatio1.toString())
    })
    test('delegationParametersCooldown correctly updated', () => {
      let parameterUpdated = mockParameterUpdated('delegationParametersCooldown')
      handleParameterUpdated(parameterUpdated)
      assert.fieldEquals(
        'GraphNetwork',
        '1',
        'delegationParametersCooldown',
        delegationParametersCooldown.toString(),
      )
    })
    test('delegationUnbondingPeriod correctly updated', () => {
      let parameterUpdated = mockParameterUpdated('delegationUnbondingPeriod')
      handleParameterUpdated(parameterUpdated)
      assert.fieldEquals(
        'GraphNetwork',
        '1',
        'delegationUnbondingPeriod',
        delegationUnbondingPeriod.toString(),
      )
    })
    test('delegationTaxPercentage correctly updated', () => {
      let parameterUpdated = mockParameterUpdated('delegationTaxPercentage')
      handleParameterUpdated(parameterUpdated)
      assert.fieldEquals(
        'GraphNetwork',
        '1',
        'delegationTaxPercentage',
        delegationTaxPercentage.toString(),
      )
    })
  })

  describe('SetOperator', () => {
    beforeAll(() => {
      createOrLoadGraphNetwork(blockNumber, controllerAddress)

      let transfer = mockTransfer(graphAddress, indexerAddress, value)
      handleTransfer(transfer)
    })

    afterAll(() => {
      // Clear the store in order to start the next test off on a clean state
      clearStore()
    })

    test('correctly updates operator', () => {
      let operator = mockSetOperator(indexerAddress, operatorAddress, true)
      handleSetOperator(operator)
      let graphAccount = GraphAccount.load(indexerID)!
      let operators = graphAccount.operators

      if (operators !== null) {
        let first = operators[0]
        assert.addressEquals(Address.fromString(first), operatorAddress)
      }
    })
  })

  describe('SlasherUpdate', () => {
    beforeAll(() => {
      createOrLoadGraphNetwork(blockNumber, controllerAddress)
    })

    afterAll(() => {
      // Clear the store in order to start the next test off on a clean state
      clearStore()
    })

    test('correctly updates slasher', () => {
      let slasher = mockSlasherUpdate(indexerAddress, slasherAddress, true)
      handleSlasherUpdate(slasher)

      let graphNetwork = GraphNetwork.load('1')!
      let slashers = graphNetwork.slashers

      if (slashers !== null) {
        let first = slashers[0]
        assert.addressEquals(Address.fromBytes(first), slasherAddress)
      }
    })
  })

  describe('AssetHolderUpdate', () => {
    beforeAll(() => {
      createOrLoadGraphNetwork(blockNumber, controllerAddress)
    })

    afterAll(() => {
      // Clear the store in order to start the next test off on a clean state
      clearStore()
    })

    test('correctly updates asset holder', () => {
      let assetHolder = mockAssetHolderUpdate(indexerAddress, assetHolderAddress, true)
      handleAssetHolderUpdate(assetHolder)

      let graphNetwork = GraphNetwork.load('1')!
      let assetHolders = graphNetwork.assetHolders

      if (assetHolders !== null) {
        let first = assetHolders[0]
        assert.addressEquals(Address.fromBytes(first), assetHolderAddress)
      }
    })
  })
})
