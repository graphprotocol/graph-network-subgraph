import { Address, BigDecimal, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'

import {
  assert,
  clearStore,
  test,
  beforeAll,
  beforeEach,
  describe,
  afterAll,
  createMockedFunction,
} from 'matchstick-as/assembly/index'

import {
  handleDelegatedTokensWithdrawn,
  handleDelegationFeeCutSet,
  handleDelegationSlashed,
  handleHorizonStakeDeposited,
  handleHorizonStakeWithdrawn,
  handleProvisionCreated,
  handleProvisionIncreased,
  handleProvisionSlashed,
  handleProvisionThawed,
  handleTokensDelegated,
  handleTokensDeprovisioned,
  handleTokensUndelegated,
} from '../src/mappings/horizonStaking'
import {
  mockDelegatedTokensWithdrawn,
  mockDelegationFeeCutSet,
  mockDelegationSlashed,
  mockHorizonStakeDeposited,
  mockHorizonStakeWithdrawn,
  mockProvisionCreated,
  mockProvisionIncreased,
  mockProvisionSlashed,
  mockProvisionThawed,
  mockTokensDelegated,
  mockTokensDeprovisioned,
  mockTokensUndelegated,
} from './factories/horizonStaking'
import {
  createOrLoadGraphNetwork,
  createOrLoadIndexer,
  joinID,
  updateLegacyAdvancedIndexerMetrics,
} from '../src/mappings/helpers/helpers'
import { DataService, Indexer, Provision } from '../src/types/schema'

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
    assertClose(indexerField('indexingRewardEffectiveCut'), '0.167413', 'indexer.indexingRewardEffectiveCut')
    assertClose(indexerField('queryFeeEffectiveCut'), '0.167413', 'indexer.queryFeeEffectiveCut')
  })
})

function grt(tokens: i32): BigInt {
  return BigInt.fromI32(tokens).times(GRT)
}

function setUpAccounting(providerTokens: BigInt, delegationTokens: BigInt): void {
  let network = createOrLoadGraphNetwork(BigInt.fromI32(1), controllerAddress)
  network.delegationRatio = 16
  network.maxThawingPeriod = BigInt.fromI32(100)
  network.epochLength = 2
  network.totalTokensStaked = providerTokens
  network.stakedIndexersCount = 1
  network.save()

  let indexer = createOrLoadIndexer(indexerAddress, BigInt.fromI32(1), network)
  indexer.stakedTokens = providerTokens
  // Migration does not clear this flag; Horizon metrics must still use provision backing.
  indexer.isLegacy = true
  indexer.save()
  handleProvisionCreated(mockProvisionCreated(indexerAddress, dataServiceAddress, providerTokens))
  let service = DataService.load(dataServiceID)!
  service.delegationRatio = 16
  service.save()
  handleDelegationFeeCutSet(
    mockDelegationFeeCutSet(indexerAddress, dataServiceAddress, 0, delegatorFeeCut),
  )
  handleDelegationFeeCutSet(
    mockDelegationFeeCutSet(indexerAddress, dataServiceAddress, 2, delegatorFeeCut),
  )
  handleTokensDelegated(
    mockTokensDelegated(
      indexerAddress,
      dataServiceAddress,
      delegatorAddress,
      delegationTokens,
      delegationTokens,
    ),
  )
}

function assertThawingTotals(provisionThawing: BigInt, aggregateThawing: BigInt): void {
  assert.fieldEquals('Provision', provisionID, 'tokensThawing', provisionThawing.toString())
  assert.fieldEquals('Indexer', indexerID, 'thawingTokens', aggregateThawing.toString())
  assert.fieldEquals(
    'DataService',
    dataServiceID,
    'totalTokensThawing',
    provisionThawing.toString(),
  )
  assert.fieldEquals('GraphNetwork', '1', 'totalTokensThawing', aggregateThawing.toString())
}

function assertDelegationBalances(gross: BigInt, thawing: BigInt, active: BigInt): void {
  assert.fieldEquals('Provision', provisionID, 'delegatedTokens', gross.toString())
  assert.fieldEquals('Provision', provisionID, 'delegatedThawingTokens', thawing.toString())
  assert.fieldEquals('Indexer', indexerID, 'delegatedTokens', gross.toString())
  assert.fieldEquals('Indexer', indexerID, 'delegatedThawingTokens', thawing.toString())
  assert.fieldEquals('GraphNetwork', '1', 'totalDelegatedTokens', active.toString())
  assert.fieldEquals('DataService', dataServiceID, 'totalTokensDelegated', active.toString())
}

describe('HORIZON ACTIVE STAKE ACCOUNTING', () => {
  beforeEach(() => {
    clearStore()
  })

  afterAll(() => {
    clearStore()
  })

  test('idle deposits and withdrawals do not change effective cuts', () => {
    setUpAccounting(grt(100), grt(20))
    handleHorizonStakeDeposited(mockHorizonStakeDeposited(indexerAddress, grt(100)))
    assertClose(indexerField('indexingRewardEffectiveCut'), '0.4', 'cut after idle deposit')
    assertClose(indexerField('queryFeeEffectiveCut'), '0.4', 'query cut after idle deposit')
    handleHorizonStakeWithdrawn(mockHorizonStakeWithdrawn(indexerAddress, grt(100)))
    assertClose(indexerField('indexingRewardEffectiveCut'), '0.4', 'cut after idle withdrawal')
    assert.fieldEquals('Indexer', indexerID, 'stakedTokens', grt(100).toString())
  })

  test('provisioning idle stake updates ratios, and deprovisioning preserves active backing', () => {
    setUpAccounting(grt(100), grt(20))
    handleHorizonStakeDeposited(mockHorizonStakeDeposited(indexerAddress, grt(100)))
    handleProvisionIncreased(mockProvisionIncreased(indexerAddress, dataServiceAddress, grt(50)))
    assertClose(indexerField('indexingRewardEffectiveCut'), '0.15', 'cut after provision increase')
    assertClose(
      provisionField('indexingRewardEffectiveCut'),
      '0.15',
      'provision cut after increase',
    )
    handleProvisionThawed(mockProvisionThawed(indexerAddress, dataServiceAddress, grt(50)))
    assertClose(indexerField('indexingRewardEffectiveCut'), '0.4', 'cut after thaw')
    handleTokensDeprovisioned(mockTokensDeprovisioned(indexerAddress, dataServiceAddress, grt(50)))
    assertClose(indexerField('indexingRewardEffectiveCut'), '0.4', 'cut after deprovision')
    assert.fieldEquals('Indexer', indexerID, 'stakedTokens', grt(200).toString())
  })

  test('idle stake does not increase the Horizon overdelegation limit', () => {
    setUpAccounting(grt(100), grt(2000))
    assertClose(indexerField('overDelegationDilution'), '0.2', 'initial dilution')
    handleHorizonStakeDeposited(mockHorizonStakeDeposited(indexerAddress, grt(100)))
    assertClose(indexerField('overDelegationDilution'), '0.2', 'dilution after idle deposit')
    handleProvisionIncreased(mockProvisionIncreased(indexerAddress, dataServiceAddress, grt(100)))
    assert.fieldEquals('Indexer', indexerID, 'overDelegationDilution', '0')
  })

  test('partial provision slash updates thawing totals before effective cuts', () => {
    setUpAccounting(grt(100), grt(20))
    handleProvisionThawed(mockProvisionThawed(indexerAddress, dataServiceAddress, grt(80)))
    handleProvisionSlashed(mockProvisionSlashed(indexerAddress, dataServiceAddress, grt(50)))
    assertThawingTotals(grt(40), grt(40))
    assert.fieldEquals('Provision', provisionID, 'tokensProvisioned', grt(50).toString())
    assert.fieldEquals('Provision', provisionID, 'tokensSlashedServiceProvider', grt(50).toString())
    assert.fieldEquals('Indexer', indexerID, 'stakedTokens', grt(50).toString())
    assert.fieldEquals('Indexer', indexerID, 'provisionedTokens', grt(50).toString())
    assert.fieldEquals('GraphNetwork', '1', 'totalTokensStaked', grt(50).toString())
    assert.fieldEquals('GraphNetwork', '1', 'totalTokensProvisioned', grt(50).toString())
    assert.fieldEquals('DataService', dataServiceID, 'totalTokensProvisioned', grt(50).toString())
    assert.fieldEquals('Indexer', indexerID, 'tokenCapacity', grt(30).toString())
    assertClose(provisionField('indexingRewardEffectiveCut'), '0.85', 'provision cut after slash')
    assertClose(indexerField('indexingRewardEffectiveCut'), '0.85', 'indexer cut after slash')
    assertClose(indexerField('queryFeeEffectiveCut'), '0.85', 'query cut after slash')
    handleTokensDeprovisioned(mockTokensDeprovisioned(indexerAddress, dataServiceAddress, grt(40)))
    assertThawingTotals(grt(0), grt(0))
    assertClose(
      indexerField('indexingRewardEffectiveCut'),
      '0.85',
      'cut after post-slash deprovision',
    )
  })

  test('provision slashing rounds remaining thawing down to whole wei', () => {
    setUpAccounting(grt(100).plus(BigInt.fromI32(1)), grt(20))
    handleProvisionThawed(
      mockProvisionThawed(indexerAddress, dataServiceAddress, grt(80).plus(BigInt.fromI32(1))),
    )
    handleProvisionSlashed(mockProvisionSlashed(indexerAddress, dataServiceAddress, grt(50)))
    assertThawingTotals(grt(40), grt(40))
    assert.fieldEquals(
      'Provision',
      provisionID,
      'tokensProvisioned',
      grt(50).plus(BigInt.fromI32(1)).toString(),
    )
  })

  test('full provision slash clears thawing balances', () => {
    setUpAccounting(grt(100), grt(20))
    handleProvisionThawed(mockProvisionThawed(indexerAddress, dataServiceAddress, grt(80)))
    handleProvisionSlashed(mockProvisionSlashed(indexerAddress, dataServiceAddress, grt(100)))
    assertThawingTotals(grt(0), grt(0))
    assert.fieldEquals('Indexer', indexerID, 'provisionedTokens', '0')
    assert.fieldEquals('Indexer', indexerID, 'tokenCapacity', '0')
    assert.fieldEquals('Indexer', indexerID, 'indexingRewardEffectiveCut', '0')
  })

  test('slashing one provision preserves other provisions in the aggregate thawing balance', () => {
    setUpAccounting(grt(100), grt(20))
    let otherService = Address.fromString('0x0000000000000000000000000000000000000007')
    handleHorizonStakeDeposited(mockHorizonStakeDeposited(indexerAddress, grt(20)))
    handleProvisionCreated(mockProvisionCreated(indexerAddress, otherService, grt(20)))
    handleProvisionThawed(mockProvisionThawed(indexerAddress, otherService, grt(10)))
    handleProvisionThawed(mockProvisionThawed(indexerAddress, dataServiceAddress, grt(80)))
    handleProvisionSlashed(mockProvisionSlashed(indexerAddress, dataServiceAddress, grt(50)))
    assertThawingTotals(grt(40), grt(50))
    assert.fieldEquals(
      'Provision',
      joinID([indexerID, otherService.toHexString()]),
      'tokensThawing',
      grt(10).toString(),
    )
  })

  test('delegation slash separates active losses from thawing losses and updates exchange rates', () => {
    setUpAccounting(grt(100), grt(100))
    handleTokensUndelegated(
      mockTokensUndelegated(indexerAddress, dataServiceAddress, delegatorAddress, grt(40), grt(40)),
    )
    // The contract exhausts provider stake before slashing delegation.
    handleProvisionSlashed(mockProvisionSlashed(indexerAddress, dataServiceAddress, grt(100)))
    handleDelegationSlashed(mockDelegationSlashed(indexerAddress, dataServiceAddress, grt(50)))
    assertDelegationBalances(grt(50), grt(20), grt(30))
    assert.fieldEquals('Provision', provisionID, 'delegationExchangeRate', '0.5')
    assert.fieldEquals('Indexer', indexerID, 'delegationExchangeRate', '0.5')
    assert.fieldEquals('Provision', provisionID, 'delegatorShares', grt(60).toString())
    assert.fieldEquals('Indexer', indexerID, 'delegatorShares', grt(60).toString())
    assert.fieldEquals('Provision', provisionID, 'tokensSlashedDelegationPool', grt(50).toString())
    handleDelegatedTokensWithdrawn(
      mockDelegatedTokensWithdrawn(indexerAddress, dataServiceAddress, delegatorAddress, grt(20)),
    )
    assertDelegationBalances(grt(30), grt(0), grt(30))
    assert.fieldEquals('Indexer', indexerID, 'delegationExchangeRate', '0.5')
  })

  test('delegation slashing applies contract rounding to active aggregate losses', () => {
    setUpAccounting(grt(100), grt(100).plus(BigInt.fromI32(1)))
    let thawed = grt(40).plus(BigInt.fromI32(1))
    handleTokensUndelegated(
      mockTokensUndelegated(indexerAddress, dataServiceAddress, delegatorAddress, thawed, thawed),
    )
    handleProvisionSlashed(mockProvisionSlashed(indexerAddress, dataServiceAddress, grt(100)))
    handleDelegationSlashed(mockDelegationSlashed(indexerAddress, dataServiceAddress, grt(50)))
    assertDelegationBalances(
      grt(50).plus(BigInt.fromI32(1)),
      grt(20),
      grt(30).plus(BigInt.fromI32(1)),
    )
  })

  test('full delegation slash clears tokens but preserves active shares', () => {
    setUpAccounting(grt(100), grt(100))
    handleTokensUndelegated(
      mockTokensUndelegated(indexerAddress, dataServiceAddress, delegatorAddress, grt(40), grt(40)),
    )
    handleProvisionSlashed(mockProvisionSlashed(indexerAddress, dataServiceAddress, grt(100)))
    handleDelegationSlashed(mockDelegationSlashed(indexerAddress, dataServiceAddress, grt(100)))
    assertDelegationBalances(grt(0), grt(0), grt(0))
    assert.fieldEquals('Provision', provisionID, 'delegatorShares', grt(60).toString())
    assert.fieldEquals('Indexer', indexerID, 'delegatorShares', grt(60).toString())
    assert.fieldEquals('Provision', provisionID, 'delegationExchangeRate', '0')
    assert.fieldEquals('Indexer', indexerID, 'delegationExchangeRate', '0')
    assert.fieldEquals('Provision', provisionID, 'indexingRewardEffectiveCut', '0')
  })

  test('slashing an entirely thawing delegation pool does not subtract active totals again', () => {
    setUpAccounting(grt(100), grt(100))
    handleTokensUndelegated(
      mockTokensUndelegated(
        indexerAddress,
        dataServiceAddress,
        delegatorAddress,
        grt(100),
        grt(100),
      ),
    )
    handleProvisionSlashed(mockProvisionSlashed(indexerAddress, dataServiceAddress, grt(100)))
    handleDelegationSlashed(mockDelegationSlashed(indexerAddress, dataServiceAddress, grt(50)))
    assertDelegationBalances(grt(50), grt(50), grt(0))
    assert.fieldEquals('Provision', provisionID, 'delegatorShares', '0')
    assert.fieldEquals('Indexer', indexerID, 'delegatorShares', '0')
  })

  test('legacy metrics still use unlocked staked tokens without provisions', () => {
    let network = createOrLoadGraphNetwork(BigInt.fromI32(1), controllerAddress)
    network.delegationRatio = 16
    network.save()
    let indexer = createOrLoadIndexer(indexerAddress, BigInt.fromI32(1), network)
    indexer.isLegacy = true
    indexer.stakedTokens = grt(100)
    indexer.lockedTokens = grt(20)
    indexer.delegatedTokens = grt(40)
    indexer.legacyIndexingRewardCut = 900000
    indexer.legacyQueryFeeCut = 900000
    indexer = updateLegacyAdvancedIndexerMetrics(indexer)
    indexer.save()
    assertClose(indexerField('ownStakeRatio'), '0.666667', 'legacy own stake ratio')
    assertClose(indexerField('legacyIndexingRewardEffectiveCut'), '0.7', 'legacy effective cut')
    assertClose(indexerField('legacyQueryFeeEffectiveCut'), '0.7', 'legacy query cut')
    indexer.delegatedTokens = grt(1600)
    indexer = updateLegacyAdvancedIndexerMetrics(indexer)
    indexer.save()
    assertClose(indexerField('overDelegationDilution'), '0.2', 'legacy dilution')
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
