import { Address, BigDecimal, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'

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
  handleDelegatedTokensWithdrawn,
  handleDelegationFeeCutSet,
  handleProvisionCreated,
  handleProvisionThawed,
  handleTokensDelegated,
  handleTokensDeprovisioned,
  handleTokensUndelegated,
} from '../src/mappings/horizonStaking'
import {
  mockDelegatedTokensWithdrawn,
  mockDelegationFeeCutSet,
  mockProvisionCreated,
  mockProvisionThawed,
  mockTokensDelegated,
  mockTokensDeprovisioned,
  mockTokensUndelegated,
} from './factories/horizonStaking'
import { createOrLoadGraphNetwork, createOrLoadIndexer, joinID } from '../src/mappings/helpers/helpers'
import { Indexer, Provision } from '../src/types/schema'

// Reproduces indexer 0x38f4...27c0 on the subgraph service at Arbitrum One block 522,643,996:
// tokensProvisioned 11,278,919 GRT, tokensThawing 0, delegatedTokens 1,439,299 GRT of which
// 36,201 GRT are thawing, indexing reward and query fee cuts 900000 (delegators get 10%).
// Before the fix the provision reported an effective cut of ~0.11636; on active delegation it is ~0.09614.

const graphID = '0x0000000000000000000000000000000000000000'
const graphAddress = Address.fromString(graphID)
const controllerAddress = Address.fromString('0x0000000000000000000000000000000000000001')
const indexerID = '0x38f412c8d6346a17a53ff9ceecd2e01acecd27c0'
const indexerAddress = Address.fromString(indexerID)
const dataServiceID = '0xb2bb92d0de618878e438b55d5846cfecd9301105'
const dataServiceAddress = Address.fromString(dataServiceID)
const delegatorAddress = Address.fromString('0x0000000000000000000000000000000000000006')
const provisionID = joinID([indexerID, dataServiceID])

const GRT = BigInt.fromString('1000000000000000000')
const provisioned = BigInt.fromI32(11278919).times(GRT)
const delegated = BigInt.fromI32(1439299).times(GRT)
const undelegated = BigInt.fromI32(36201).times(GRT)
const provisionThaw = BigInt.fromI32(1000000).times(GRT)
// HorizonStaking feeCut is what delegators receive; the subgraph stores 1e6 - feeCut.
const delegatorFeeCut = BigInt.fromI32(100000)

createMockedFunction(controllerAddress, 'getGovernor', 'getGovernor():(address)')
  .withArgs([])
  .returns([ethereum.Value.fromAddress(controllerAddress)])
createMockedFunction(graphAddress, 'blockNum', 'blockNum():(uint256)')
  .withArgs([])
  .returns([ethereum.Value.fromI32(5)])

function provisionField(name: string): BigDecimal {
  let provision = Provision.load(provisionID)!
  return provision.get(name)!.toBigDecimal()
}

function indexerField(name: string): BigDecimal {
  let indexer = Indexer.load(indexerID)!
  return indexer.get(name)!.toBigDecimal()
}

function assertClose(actual: BigDecimal, expected: string, label: string): void {
  let diff = actual.minus(BigDecimal.fromString(expected))
  let tolerance = BigDecimal.fromString('0.00001')
  assert.assertTrue(
    diff < tolerance && diff > tolerance.neg(),
    label + ': expected ~' + expected + ', got ' + actual.toString(),
  )
}

function setUpReproduction(): void {
  let graphNetwork = createOrLoadGraphNetwork(BigInt.fromI32(1), controllerAddress)
  graphNetwork.delegationRatio = 16
  graphNetwork.save()

  // Stake is deposited before the provision is created; set it directly to avoid the epoch plumbing.
  let indexer = createOrLoadIndexer(Bytes.fromHexString(indexerID), BigInt.fromI32(1), graphNetwork)
  indexer.stakedTokens = provisioned
  indexer.save()

  handleProvisionCreated(mockProvisionCreated(indexerAddress, dataServiceAddress, provisioned))
  // paymentType 0 = query fees, 2 = indexing rewards
  handleDelegationFeeCutSet(mockDelegationFeeCutSet(indexerAddress, dataServiceAddress, 0, delegatorFeeCut))
  handleDelegationFeeCutSet(mockDelegationFeeCutSet(indexerAddress, dataServiceAddress, 2, delegatorFeeCut))
  handleTokensDelegated(
    mockTokensDelegated(indexerAddress, dataServiceAddress, delegatorAddress, delegated, delegated),
  )
  handleTokensUndelegated(
    mockTokensUndelegated(indexerAddress, dataServiceAddress, delegatorAddress, undelegated, undelegated),
  )
}

describe('EFFECTIVE CUT ON ACTIVE STAKE', () => {
  beforeAll(() => {
    setUpReproduction()
  })

  afterAll(() => {
    clearStore()
  })

  test('reproduction state matches the on-chain provision', () => {
    assert.fieldEquals('Provision', provisionID, 'tokensProvisioned', provisioned.toString())
    assert.fieldEquals('Provision', provisionID, 'tokensThawing', '0')
    assert.fieldEquals('Provision', provisionID, 'delegatedTokens', delegated.toString())
    assert.fieldEquals('Provision', provisionID, 'delegatedThawingTokens', undelegated.toString())
    assert.fieldEquals('Provision', provisionID, 'indexingRewardsCut', '900000')
    assert.fieldEquals('Provision', provisionID, 'queryFeeCut', '900000')
  })

  test('provision effective cuts exclude thawing delegation', () => {
    // D_active = 1,403,098; P_active = 11,278,919; 1 - 0.1 / (1,403,098 / 12,682,017)
    assertClose(provisionField('delegatedStakeRatio'), '0.110637', 'provision.delegatedStakeRatio')
    assertClose(provisionField('ownStakeRatio'), '0.889363', 'provision.ownStakeRatio')
    assertClose(provisionField('indexingRewardEffectiveCut'), '0.096142', 'provision.indexingRewardEffectiveCut')
    assertClose(provisionField('queryFeeEffectiveCut'), '0.096142', 'provision.queryFeeEffectiveCut')
  })

  test('indexer effective cuts exclude thawing delegation', () => {
    assertClose(indexerField('delegatedStakeRatio'), '0.110637', 'indexer.delegatedStakeRatio')
    assertClose(indexerField('indexingRewardEffectiveCut'), '0.096142', 'indexer.indexingRewardEffectiveCut')
    assertClose(indexerField('queryFeeEffectiveCut'), '0.096142', 'indexer.queryFeeEffectiveCut')
  })

  test('withdrawing thawed delegation leaves the effective cut unchanged', () => {
    handleDelegatedTokensWithdrawn(
      mockDelegatedTokensWithdrawn(indexerAddress, dataServiceAddress, delegatorAddress, undelegated),
    )
    assert.fieldEquals('Provision', provisionID, 'delegatedThawingTokens', '0')
    assertClose(provisionField('indexingRewardEffectiveCut'), '0.096142', 'provision.indexingRewardEffectiveCut')
    assertClose(indexerField('indexingRewardEffectiveCut'), '0.096142', 'indexer.indexingRewardEffectiveCut')
  })

  test('thawing provisioned stake is excluded and recalculated', () => {
    handleProvisionThawed(mockProvisionThawed(indexerAddress, dataServiceAddress, provisionThaw))
    // P_active = 10,278,919; 1 - 0.1 / (1,403,098 / 11,682,017)
    assertClose(provisionField('delegatedStakeRatio'), '0.120108', 'provision.delegatedStakeRatio')
    assertClose(provisionField('indexingRewardEffectiveCut'), '0.167413', 'provision.indexingRewardEffectiveCut')
    assertClose(provisionField('queryFeeEffectiveCut'), '0.167413', 'provision.queryFeeEffectiveCut')
    assertClose(indexerField('indexingRewardEffectiveCut'), '0.167413', 'indexer.indexingRewardEffectiveCut')
  })

  test('deprovisioning thawed stake leaves the effective cut unchanged', () => {
    handleTokensDeprovisioned(mockTokensDeprovisioned(indexerAddress, dataServiceAddress, provisionThaw))
    assert.fieldEquals('Provision', provisionID, 'tokensThawing', '0')
    assertClose(provisionField('indexingRewardEffectiveCut'), '0.167413', 'provision.indexingRewardEffectiveCut')
  })
})

describe('EFFECTIVE CUT WHEN ALL DELEGATION IS THAWING', () => {
  beforeAll(() => {
    setUpReproduction()
    let remaining = delegated.minus(undelegated)
    handleTokensUndelegated(
      mockTokensUndelegated(indexerAddress, dataServiceAddress, delegatorAddress, remaining, remaining),
    )
  })

  afterAll(() => {
    clearStore()
  })

  test('falls back to the zero-delegation values', () => {
    assert.fieldEquals('Provision', provisionID, 'delegatedThawingTokens', delegated.toString())
    assert.fieldEquals('Provision', provisionID, 'delegatedStakeRatio', '0')
    assert.fieldEquals('Provision', provisionID, 'ownStakeRatio', '1')
    assert.fieldEquals('Provision', provisionID, 'indexingRewardEffectiveCut', '0')
    assert.fieldEquals('Provision', provisionID, 'queryFeeEffectiveCut', '0')
    assert.fieldEquals('Indexer', indexerID, 'delegatedStakeRatio', '0')
    assert.fieldEquals('Indexer', indexerID, 'indexingRewardEffectiveCut', '0')
  })
})
