import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'

import {
  assert,
  clearStore,
  test,
  beforeAll,
  describe,
  afterAll,
  createMockedFunction,
} from 'matchstick-as/assembly/index'

import { handleSignalled, handleBurned, handleParameterUpdated } from '../src/mappings/curation'

import {
  handleStakeDeposited,
  handleStakeDelegated,
  handleAllocationCreated,
} from '../src/mappings/staking'

import { handleTransfer } from '../src/mappings/graphToken'
import { mockStakeDeposited, mockAllocationCreated, mockStakeDelegated } from './factories/staking'

import { mockSignalled, mockBurned, mockParameterUpdated } from './factories/curation'

import { createOrLoadGraphNetwork } from '../src/mappings/helpers/helpers'

import { mockTransfer } from './factories/graphToken'

// CONSTANT ADDRESS OR IDS
const graphID = '0x0000000000000000000000000000000000000000'
const graphAddress = Address.fromString(graphID)
const controllerID = '0x0000000000000000000000000000000000000001'
const controllerAddress = Address.fromString(controllerID)
const indexerID = '0x0000000000000000000000000000000000000003'
const indexerAddress = Address.fromString(indexerID)
const curatorID = '0x0000000000000000000000000000000000000011'
const curatorAddress = Address.fromString(curatorID)
const delegatorID = '0x0000000000000000000000000000000000000006'
const delegatorAddress = Address.fromString(delegatorID)
const subgraphDeploymentID = '0x0000000000000000000000000000000000000007'
const subgraphDeploymentAddress = Address.fromString(subgraphDeploymentID)
const allocationID = '0x0000000000000000000000000000000000000008'
const allocationAddress = Address.fromString(allocationID)
const metadata = Bytes.fromHexString('0x0000000000000000000000000000000000000009')
const signalID = curatorID.concat('-').concat(subgraphDeploymentID)

// CONSTANTS
// blockNumber and epochLength are picked in a way to let createOrLoadEpoch create new epoch
// when first called. The other values are rather random.
const blockNumber = BigInt.fromI32(1)
const delegationRatio = 10
const epochLength = 2
const value = BigInt.fromI32(66)
const shares = BigInt.fromI32(10)
const epoch = BigInt.fromI32(1)
const signal = BigInt.fromI32(6)
const curationTax = BigInt.fromI32(5)
const burnedValue = BigInt.fromI32(33)
const burnedSignal = BigInt.fromI32(3)
const defaultReserveRatio = BigInt.fromI32(11)
const curationTaxPercentage = BigInt.fromI32(12)
const minimumCurationDeposit = BigInt.fromI32(13)

// MOCKS
// createOrLoadGraphNetwork calls the getGovernor function of controllerAddress so we mock it here
createMockedFunction(controllerAddress, 'getGovernor', 'getGovernor():(address)')
  .withArgs([])
  .returns([ethereum.Value.fromAddress(controllerAddress)])

describe('Signalled', () => {
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
    let transfer3 = mockTransfer(graphAddress, curatorAddress, value)
    handleTransfer(transfer3)

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
    // Clear the store in order to start the next test off on a clean slate
    clearStore()
  })

  test('creates and correctly updates curator', () => {
    let signalled = mockSignalled(
      curatorAddress,
      subgraphDeploymentAddress,
      value,
      signal,
      curationTax,
    )
    handleSignalled(signalled)

    let totalSignalled = value.minus(curationTax)
    let perSignal = value.div(signal)

    assert.fieldEquals('Curator', curatorID, 'totalSignalledTokens', totalSignalled.toString())
    assert.fieldEquals('Curator', curatorID, 'totalSignalAverageCostBasis', value.toString())
    assert.fieldEquals('Curator', curatorID, 'totalSignal', signal.toString())
    assert.fieldEquals('Curator', curatorID, 'totalAverageCostBasisPerSignal', perSignal.toString())
  })

  test('creates and correctly updates signal', () => {
    let totalSignalled = value.minus(curationTax)
    let perSignal = value.div(signal)

    assert.fieldEquals('Signal', signalID, 'signalledTokens', totalSignalled.toString())
    assert.fieldEquals('Signal', signalID, 'signal', signal.toString())
    assert.fieldEquals('Signal', signalID, 'averageCostBasis', value.toString())
    assert.fieldEquals('Signal', signalID, 'averageCostBasisPerSignal', perSignal.toString())
  })

  test('increases curator.activeSignalCount and .activeCombinedSignalCount if new signal', () => {
    assert.fieldEquals('Curator', curatorID, 'activeSignalCount', '1')
    assert.fieldEquals('Curator', curatorID, 'activeCombinedSignalCount', '1')
  })

  test('increases graphNetwork.activeCuratorCount if new curator', () => {
    assert.fieldEquals('GraphNetwork', '1', 'activeCuratorCount', '1')
  })

  test('creates and correctly updates subgraph deployment', () => {
    let totalSignalled = value.minus(curationTax)

    assert.fieldEquals(
      'SubgraphDeployment',
      subgraphDeploymentID,
      'signalledTokens',
      totalSignalled.toString(),
    )
    assert.fieldEquals(
      'SubgraphDeployment',
      subgraphDeploymentID,
      'signalAmount',
      signal.toString(),
    )
  })

  test('correctly updates epoch', () => {
    let totalSignalled = value.minus(curationTax)
    assert.fieldEquals('Epoch', '2', 'signalledTokens', totalSignalled.toString())
  })

  test('correctly updates graphNetwork.totalTokensSignalled', () => {
    let totalSignalled = value.minus(curationTax)
    assert.fieldEquals('GraphNetwork', '1', 'totalTokensSignalled', totalSignalled.toString())
  })

  test('does not increase curator.activeSignalCount and .activeCombinedSignalCount if not new signal', () => {
    let signalled2 = mockSignalled(
      curatorAddress,
      subgraphDeploymentAddress,
      value,
      signal,
      curationTax,
    )
    handleSignalled(signalled2)

    assert.fieldEquals('Curator', curatorID, 'activeSignalCount', '1')
    assert.fieldEquals('Curator', curatorID, 'activeCombinedSignalCount', '1')
  })

  test('does not increase graphNetwork.activeCuratorCount if not new curator', () => {
    assert.fieldEquals('GraphNetwork', '1', 'activeCuratorCount', '1')
  })
})

describe('Burned', () => {
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
    let transfer3 = mockTransfer(graphAddress, curatorAddress, value)
    handleTransfer(transfer3)

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
    let signalled = mockSignalled(
      curatorAddress,
      subgraphDeploymentAddress,
      value,
      signal,
      curationTax,
    )
    handleSignalled(signalled)
  })

  afterAll(() => {
    // Clear the store in order to start the next test off on a clean slate
    clearStore()
  })

  test('correctly updates curator', () => {
    let burned = mockBurned(curatorAddress, subgraphDeploymentAddress, burnedValue, burnedSignal)
    handleBurned(burned)
    let totalSignal = signal.minus(burnedSignal)
    assert.fieldEquals('Curator', curatorID, 'totalUnsignalledTokens', burnedValue.toString())
    assert.fieldEquals('Curator', curatorID, 'totalSignal', totalSignal.toString())
  })

  test('correctly updates signal', () => {
    let totalSignal = signal.minus(burnedSignal)
    assert.fieldEquals('Signal', signalID, 'unsignalledTokens', burnedValue.toString())
    assert.fieldEquals('Signal', signalID, 'signal', totalSignal.toString())
  })

  test('does not decrease curator.activeSignalCount and .activeCombinedSignalCount if signal does not drop to zero', () => {
    assert.fieldEquals('Curator', curatorID, 'activeSignalCount', '1')
    assert.fieldEquals('Curator', curatorID, 'activeCombinedSignalCount', '1')
  })

  test('does not decrease graphNetwork.activeCuratorCount if signal does not drop to zero', () => {
    assert.fieldEquals('GraphNetwork', '1', 'activeCuratorCount', '1')
  })

  test('correctly updates subgraph deployment', () => {
    let totalTokens = value.minus(curationTax).minus(burnedValue)
    let totalSignal = signal.minus(burnedSignal)
    assert.fieldEquals(
      'SubgraphDeployment',
      subgraphDeploymentID,
      'signalledTokens',
      totalTokens.toString(),
    )
    assert.fieldEquals(
      'SubgraphDeployment',
      subgraphDeploymentID,
      'signalAmount',
      totalSignal.toString(),
    )
  })

  test('correctly updates graphNetwork.totalTokensSignalled', () => {
    let totalTokens = value.minus(curationTax).minus(burnedValue)
    assert.fieldEquals('GraphNetwork', '1', 'totalTokensSignalled', totalTokens.toString())
  })

  test('decreases curator.activeSignalCount and .activeCombinedSignalCount if signal drops to zero', () => {
    let totalTokens = value.minus(curationTax).minus(burnedValue)
    let totalSignal = signal.minus(burnedSignal)
    let leftTokens = value.minus(totalTokens)
    let leftSignal = signal.minus(totalSignal)

    let burned2 = mockBurned(curatorAddress, subgraphDeploymentAddress, leftTokens, leftSignal)
    handleBurned(burned2)

    assert.fieldEquals('Curator', curatorID, 'activeSignalCount', '0')
    assert.fieldEquals('Curator', curatorID, 'activeCombinedSignalCount', '0')
  })

  test('decreases graphNetwork.activeCuratorCount if signal drops to zero', () => {
    assert.fieldEquals('GraphNetwork', '1', 'activeCuratorCount', '0')
  })
})

describe('ParameterUpdated', () => {
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
    let transfer3 = mockTransfer(graphAddress, curatorAddress, value)
    handleTransfer(transfer3)

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
    // Clear the store in order to start the next test off on a clean slate
    clearStore()
  })

  test('defaultReserveRatio correctly updated', () => {
    let parameterUpdated = mockParameterUpdated('defaultReserveRatio')
    handleParameterUpdated(parameterUpdated)
    assert.fieldEquals('GraphNetwork', '1', 'defaultReserveRatio', defaultReserveRatio.toString())
  })
  test('curationTaxPercentage correctly updated', () => {
    let parameterUpdated = mockParameterUpdated('curationTaxPercentage')
    handleParameterUpdated(parameterUpdated)
    assert.fieldEquals(
      'GraphNetwork',
      '1',
      'curationTaxPercentage',
      curationTaxPercentage.toString(),
    )
  })
  test('minimumCurationDeposit correctly updated', () => {
    let parameterUpdated = mockParameterUpdated('minimumCurationDeposit')
    handleParameterUpdated(parameterUpdated)
    assert.fieldEquals(
      'GraphNetwork',
      '1',
      'minimumCurationDeposit',
      minimumCurationDeposit.toString(),
    )
  })
})
