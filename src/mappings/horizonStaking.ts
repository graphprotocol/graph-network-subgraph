import { BigInt } from '@graphprotocol/graph-ts'
import { addresses } from '../../config/addresses'
import { AllowedLockedVerifierSet, DelegatedTokensWithdrawn, DelegationFeeCutSet, DelegationSlashed, DelegationSlashingEnabled, HorizonStakeDeposited, HorizonStakeLocked, HorizonStakeWithdrawn, MaxThawingPeriodSet, OperatorSet, StakeDelegatedWithdrawn, ThawingPeriodCleared, TokensDelegated, TokensDeprovisioned, TokensToDelegationPoolAdded, TokensUndelegated } from '../types/HorizonStaking/HorizonStaking'
import { DelegatedStake, Delegator, Indexer, Provision, ThawRequest } from '../types/schema'
import { calculateCapacities, createOrLoadDataService, createOrLoadDelegatedStake, createOrLoadDelegatedStakeForProvision, createOrLoadDelegator, createOrLoadEpoch, createOrLoadGraphAccount, createOrLoadGraphNetwork, createOrLoadHorizonOperator, createOrLoadIndexer, createOrLoadProvision, joinID, updateAdvancedIndexerMetrics, updateAdvancedProvisionMetrics, updateDelegationExchangeRate, updateDelegationExchangeRateForProvision } from './helpers/helpers'
import {
    ProvisionCreated,
    ProvisionIncreased,
    ProvisionParametersSet,
    ProvisionParametersStaged,
    ProvisionSlashed,
    ProvisionThawed,
    ThawRequestCreated,
    ThawRequestFulfilled,
} from '../types/HorizonStaking/HorizonStaking'

export function handleHorizonStakeDeposited(event: HorizonStakeDeposited): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    // update indexer
    let indexer = createOrLoadIndexer(event.params.serviceProvider, event.block.timestamp)
    let previousStake = indexer.stakedTokens
    indexer.stakedTokens = indexer.stakedTokens.plus(event.params.tokens)
    indexer.save()

    // Update graph network
    graphNetwork.totalTokensStaked = graphNetwork.totalTokensStaked.plus(event.params.tokens)
    if (previousStake.isZero()) {
        graphNetwork.stakedIndexersCount = graphNetwork.stakedIndexersCount + 1
    }
    graphNetwork.save()

    // Update epoch
    let epoch = createOrLoadEpoch(
        addresses.isL1 ? event.block.number : graphNetwork.currentL1BlockNumber!,
    )
    epoch.stakeDeposited = epoch.stakeDeposited.plus(event.params.tokens)
    epoch.save()
}

export function handleHorizonStakeLocked(event: HorizonStakeLocked): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    // update indexer
    let id = event.params.serviceProvider.toHexString()
    let indexer = Indexer.load(id)!
    indexer.lockedTokens = event.params.tokens
    indexer.tokensLockedUntil = event.params.until.toI32()
    indexer.save()

    // update graph network
    graphNetwork.totalUnstakedTokensLocked = graphNetwork.totalUnstakedTokensLocked.plus(
        event.params.tokens,
    )
    graphNetwork.save()
}

export function handleHorizonStakeWithdrawn(event: HorizonStakeWithdrawn): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    // update indexer
    let id = event.params.serviceProvider.toHexString()
    let indexer = Indexer.load(id)!
    indexer.stakedTokens = indexer.stakedTokens.minus(event.params.tokens)
    indexer.lockedTokens = BigInt.fromI32(0) // set to 0 to prevent issues when Stage 2 comes
    indexer.tokensLockedUntil = 0 // always set to 0 when withdrawn
    indexer.save()

    // Update graph network
    graphNetwork.totalTokensStaked = graphNetwork.totalTokensStaked.minus(event.params.tokens)
    graphNetwork.totalUnstakedTokensLocked = graphNetwork.totalUnstakedTokensLocked.minus(
        event.params.tokens,
    )
    // We might want to introduce the notion of "provisioned indexer count" or "active indexer count" 
    // to each data service since that's what this particular count wanted to convey.
    if (indexer.stakedTokens.isZero()) {
        graphNetwork.stakedIndexersCount = graphNetwork.stakedIndexersCount - 1
    }
    graphNetwork.save()
}

export function handleProvisionCreated(event: ProvisionCreated): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    let dataService = createOrLoadDataService(event.params.verifier)
    let indexer = Indexer.load(event.params.serviceProvider.toHexString())!
    let provision = createOrLoadProvision(event.params.serviceProvider, event.params.verifier, event.block.timestamp)

    indexer.provisionedTokens = indexer.provisionedTokens.plus(event.params.tokens)
    indexer.save()

    dataService.totalTokensProvisioned = dataService.totalTokensProvisioned.plus(event.params.tokens)
    dataService.save()

    graphNetwork.totalTokensProvisioned = graphNetwork.totalTokensProvisioned.plus(event.params.tokens)
    graphNetwork.save()

    provision.tokensProvisioned = provision.tokensProvisioned.plus(event.params.tokens)
    provision.maxVerifierCut = event.params.maxVerifierCut
    provision.maxVerifierCutPending = event.params.maxVerifierCut
    provision.thawingPeriod = event.params.thawingPeriod
    provision.thawingPeriodPending = event.params.thawingPeriod
    provision.save()
}

export function handleProvisionIncreased(event: ProvisionIncreased): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    let dataService = createOrLoadDataService(event.params.verifier)
    let indexer = Indexer.load(event.params.serviceProvider.toHexString())!
    let provision = createOrLoadProvision(event.params.serviceProvider, event.params.verifier, event.block.timestamp)

    indexer.provisionedTokens = indexer.provisionedTokens.plus(event.params.tokens)
    indexer.save()

    dataService.totalTokensProvisioned = dataService.totalTokensProvisioned.plus(event.params.tokens)
    dataService.save()

    graphNetwork.totalTokensProvisioned = graphNetwork.totalTokensProvisioned.plus(event.params.tokens)
    graphNetwork.save()

    provision.tokensProvisioned = provision.tokensProvisioned.plus(event.params.tokens)
    provision.save()
}

export function handleProvisionThawed(event: ProvisionThawed): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    let dataService = createOrLoadDataService(event.params.verifier)
    let indexer = Indexer.load(event.params.serviceProvider.toHexString())!
    let provision = createOrLoadProvision(event.params.serviceProvider, event.params.verifier, event.block.timestamp)

    indexer.thawingTokens = indexer.thawingTokens.plus(event.params.tokens)
    indexer.save()

    dataService.totalTokensThawing = dataService.totalTokensThawing.plus(event.params.tokens)
    dataService.save()

    graphNetwork.totalTokensThawing = graphNetwork.totalTokensThawing.plus(event.params.tokens)
    graphNetwork.save()

    provision.tokensThawing = provision.tokensThawing.plus(event.params.tokens)
    provision.save()
}

export function handleTokensDeprovisioned(event: TokensDeprovisioned): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    let dataService = createOrLoadDataService(event.params.verifier)
    let indexer = Indexer.load(event.params.serviceProvider.toHexString())!
    let provision = createOrLoadProvision(event.params.serviceProvider, event.params.verifier, event.block.timestamp)

    indexer.provisionedTokens = indexer.provisionedTokens.minus(event.params.tokens)
    indexer.thawingTokens = indexer.thawingTokens.minus(event.params.tokens)
    indexer.save()

    dataService.totalTokensProvisioned = dataService.totalTokensProvisioned.minus(event.params.tokens)
    dataService.totalTokensThawing = dataService.totalTokensThawing.minus(event.params.tokens)
    dataService.save()

    graphNetwork.totalTokensProvisioned = graphNetwork.totalTokensProvisioned.minus(event.params.tokens)
    graphNetwork.totalTokensThawing = graphNetwork.totalTokensThawing.minus(event.params.tokens)
    graphNetwork.save()

    provision.tokensProvisioned = provision.tokensProvisioned.minus(event.params.tokens)
    provision.tokensThawing = provision.tokensThawing.minus(event.params.tokens)
    provision.save()
}

export function handleProvisionParametersSet(event: ProvisionParametersSet): void {
    let provision = createOrLoadProvision(event.params.serviceProvider, event.params.verifier, event.block.timestamp)
    provision.thawingPeriod = event.params.thawingPeriod
    provision.maxVerifierCut = event.params.maxVerifierCut
    provision.save()
}

export function handleProvisionParametersStaged(event: ProvisionParametersStaged): void {
    let provision = createOrLoadProvision(event.params.serviceProvider, event.params.verifier, event.block.timestamp)
    provision.thawingPeriodPending = event.params.thawingPeriod
    provision.maxVerifierCutPending = event.params.maxVerifierCut
    provision.save()
}

export function handleOperatorSet(event: OperatorSet): void {
    let indexerGraphAccount = createOrLoadGraphAccount(event.params.serviceProvider, event.block.timestamp)
    let operator = createOrLoadHorizonOperator(event.params.operator, event.params.verifier, event.params.serviceProvider)
    let operators = indexerGraphAccount.operators
    // Will have to handle legacy operators list, and horizon horizonOperators list for extra context
    let operatorsIndex = operators.indexOf(event.params.operator.toHexString())
    if (operatorsIndex != -1) {
        // false - it existed, and we set it to false, so remove from operators
        if (!event.params.allowed) {
            operators.splice(operatorsIndex, 1)
        }
    } else {
        // true - it did not exist before, and we say add, so add
        if (event.params.allowed) {
            operators.push(event.params.operator.toHexString())
            // Create the operator as a graph account
            createOrLoadGraphAccount(event.params.operator, event.block.timestamp)
        }
    }

    let horizonOperators = indexerGraphAccount.horizonOperators
    let horizonOperatorsIndex = horizonOperators.indexOf(event.params.operator.toHexString())
    if (horizonOperatorsIndex != -1) {
        // false - it existed, and we set it to false, so remove from operators and update operator
        if (!event.params.allowed) {
            operators.splice(horizonOperatorsIndex, 1)
        }
    } else {
        // true - it did not exist before, and we say add, so add
        if (event.params.allowed) {
            operators.push(event.params.operator.toHexString())
            // Create the operator as a graph account
            createOrLoadGraphAccount(event.params.operator, event.block.timestamp)
        }
    }
    operator.allowed = event.params.allowed
    operator.save()
    indexerGraphAccount.operators = operators
    indexerGraphAccount.horizonOperators = horizonOperators
    indexerGraphAccount.save()
}

export function handleDelegationFeeCutSet(event: DelegationFeeCutSet): void {
    let provision = createOrLoadProvision(event.params.serviceProvider, event.params.verifier, event.block.timestamp)
    provision.queryFeeCut = event.params.paymentType == 0 ? event.params.feeCut : provision.queryFeeCut
    provision.indexingFeeCut = event.params.paymentType == 1 ? event.params.feeCut : provision.indexingFeeCut
    provision.indexingRewardsCut = event.params.paymentType == 2 ? event.params.feeCut : provision.indexingRewardsCut
    provision.save()
}

export function handleProvisionSlashed(event: ProvisionSlashed): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    let dataService = createOrLoadDataService(event.params.verifier)
    let indexer = Indexer.load(event.params.serviceProvider.toHexString())!
    let provision = createOrLoadProvision(event.params.serviceProvider, event.params.verifier, event.block.timestamp)

    // Due to thawing tokens potentially getting cancelled, we will need to figure the thawing situation
    indexer.provisionedTokens = indexer.provisionedTokens.minus(event.params.tokens)
    indexer.stakedTokens = indexer.stakedTokens.minus(event.params.tokens)
    indexer.save()

    dataService.totalTokensProvisioned = dataService.totalTokensProvisioned.minus(event.params.tokens)
    dataService.save()

    graphNetwork.totalTokensProvisioned = graphNetwork.totalTokensProvisioned.minus(event.params.tokens)
    graphNetwork.totalTokensStaked = graphNetwork.totalTokensStaked.minus(event.params.tokens)
    graphNetwork.save()

    provision.tokensProvisioned = provision.tokensProvisioned.minus(event.params.tokens)
    // To DO, update thawing tokens according to the accounting calculation from the contract
    provision.tokensSlashedServiceProvider = provision.tokensSlashedServiceProvider.plus(event.params.tokens)
    provision.save()
}

export function handleThawRequestCreated(event: ThawRequestCreated): void {
    let dataService = createOrLoadDataService(event.params.verifier)
    let indexer = Indexer.load(event.params.serviceProvider.toHexString())!
    let owner = createOrLoadGraphAccount(event.params.owner, event.block.timestamp)

    let request = new ThawRequest(event.params.thawRequestId.toHexString())
    request.indexer = indexer.id
    request.dataService = dataService.id
    request.owner = owner.id
    request.shares = event.params.shares
    request.tokens = BigInt.fromI32(0)
    request.thawingUntil = event.params.thawingUntil
    request.fulfilled = false
    request.fulfilledAsValid = false
    request.save()
}

export function handleThawRequestFulfilled(event: ThawRequestFulfilled): void {
    let request = ThawRequest.load(event.params.thawRequestId.toHexString())!
    request.tokens = event.params.tokens
    request.fulfilledAsValid = event.params.valid
    request.fulfilled = true
    request.save()
}

export function handleTokensToDelegationPoolAdded(event: TokensToDelegationPoolAdded): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    let indexer = Indexer.load(event.params.serviceProvider.toHexString())!
    let provision = createOrLoadProvision(event.params.serviceProvider, event.params.verifier, event.block.timestamp)
    provision.delegatedTokens = provision.delegatedTokens.plus(event.params.tokens)
    if (provision.delegatorShares != BigInt.fromI32(0)) {
        provision = updateDelegationExchangeRateForProvision(provision as Provision)
    }
    provision.save()

    indexer.delegatedTokens = indexer.delegatedTokens.plus(event.params.tokens) // this only serves as a general tracker, but the real deal is per provision
    if (indexer.delegatorShares != BigInt.fromI32(0)) {
        indexer = updateDelegationExchangeRate(indexer as Indexer)
    }
    indexer.save()

    graphNetwork.totalDelegatedTokens = graphNetwork.totalDelegatedTokens.plus(event.params.tokens)
    graphNetwork.save()
}

// Delegation

export function handleTokensDelegated(event: TokensDelegated): void {
    let zeroShares = event.params.shares.equals(BigInt.fromI32(0))

    let dataService = createOrLoadDataService(event.params.verifier)
    // Might want to track some stuff here in the future
    dataService.save()

    let provision = createOrLoadProvision(event.params.serviceProvider, event.params.verifier, event.block.timestamp)
    provision.delegatedTokens = provision.delegatedTokens.plus(event.params.tokens)
    provision.delegatorShares = provision.delegatorShares.plus(event.params.shares)
    if (provision.delegatorShares != BigInt.fromI32(0)) {
        provision = updateDelegationExchangeRateForProvision(provision as Provision)
    }
    provision = updateAdvancedProvisionMetrics(provision as Provision)
    provision.save()

    // update indexer
    let indexer = createOrLoadIndexer(event.params.serviceProvider, event.block.timestamp)
    indexer.delegatedTokens = indexer.delegatedTokens.plus(event.params.tokens)
    indexer.delegatorShares = indexer.delegatorShares.plus(event.params.shares)
    indexer.save()

    // update delegator
    let delegatorID = event.params.delegator.toHexString()
    let delegator = createOrLoadDelegator(event.params.delegator, event.block.timestamp)
    delegator.totalStakedTokens = delegator.totalStakedTokens.plus(event.params.tokens)
    delegator.save()

    // update delegated stake
    let delegatedStake = createOrLoadDelegatedStakeForProvision(
        delegatorID,
        indexer.id,
        dataService.id,
        event.block.timestamp.toI32(),
    )

    if (!zeroShares) {
        let previousExchangeRate = delegatedStake.personalExchangeRate
        let previousShares = delegatedStake.shareAmount
        let averageCostBasisTokens = previousExchangeRate
            .times(previousShares.toBigDecimal())
            .plus(event.params.tokens.toBigDecimal())
        let averageCostBasisShares = previousShares.plus(event.params.shares)
        if (averageCostBasisShares.gt(BigInt.fromI32(0))) {
            delegatedStake.personalExchangeRate = averageCostBasisTokens
                .div(averageCostBasisShares.toBigDecimal())
                .truncate(18)
        }
    }

    let isStakeBecomingActive = delegatedStake.shareAmount.isZero() && !event.params.shares.isZero()

    delegatedStake.stakedTokens = delegatedStake.stakedTokens.plus(event.params.tokens)
    delegatedStake.shareAmount = delegatedStake.shareAmount.plus(event.params.shares)
    delegatedStake.lastDelegatedAt = event.block.timestamp.toI32()
    delegatedStake.save()

    // reload delegator to avoid edge case where we can overwrite stakesCount if stake is new
    delegator = Delegator.load(delegatorID) as Delegator

    // upgrade graph network
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    graphNetwork.totalDelegatedTokens = graphNetwork.totalDelegatedTokens.plus(event.params.tokens)

    if (isStakeBecomingActive) {
        graphNetwork.activeDelegationCount = graphNetwork.activeDelegationCount + 1
        delegator.activeStakesCount = delegator.activeStakesCount + 1
        // Is delegator becoming active because of the stake becoming active?
        if (delegator.activeStakesCount == 1) {
            graphNetwork.activeDelegatorCount = graphNetwork.activeDelegatorCount + 1
        }
    }

    graphNetwork.save()
    delegator.save()
}

export function handleDelegationSlashed(event: DelegationSlashed): void {
    // This is a delegation pool wide change, no particular delegation or delegator can be updated here.

    // update provision
    let provision = createOrLoadProvision(event.params.serviceProvider, event.params.verifier, event.block.timestamp)
    provision.delegatedTokens = provision.delegatedTokens.minus(event.params.tokens)
    provision.tokensSlashedDelegationPool = provision.tokensSlashedDelegationPool.plus(event.params.tokens)
    if (provision.delegatorShares != BigInt.fromI32(0)) {
        provision = updateDelegationExchangeRateForProvision(provision as Provision)
    }
    provision = updateAdvancedProvisionMetrics(provision as Provision)
    provision.save()

    // update indexer
    let indexerID = event.params.serviceProvider.toHexString()
    let indexer = Indexer.load(indexerID)!
    indexer.delegatedTokens = indexer.delegatedTokens.minus(event.params.tokens)
    indexer.save()

    // upgrade graph network
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    graphNetwork.totalDelegatedTokens = graphNetwork.totalDelegatedTokens.minus(event.params.tokens)
    graphNetwork.save()
}

export function handleTokensUndelegated(event: TokensUndelegated): void {
    // update provision
    let provision = createOrLoadProvision(event.params.serviceProvider, event.params.verifier, event.block.timestamp)

    let beforeUpdateDelegationExchangeRate = provision.delegationExchangeRate

    provision.delegatedTokens = provision.delegatedTokens.minus(event.params.tokens)
    provision.delegatorShares = provision.delegatorShares.minus(event.params.shares)
    if (provision.delegatorShares != BigInt.fromI32(0)) {
        provision = updateDelegationExchangeRateForProvision(provision as Provision)
    }
    provision = updateAdvancedProvisionMetrics(provision as Provision)
    provision.save()

    // update indexer
    let indexerID = event.params.serviceProvider.toHexString()
    let indexer = Indexer.load(indexerID)!
    indexer.delegatedTokens = indexer.delegatedTokens.minus(event.params.tokens)
    indexer.delegatorShares = indexer.delegatorShares.minus(event.params.shares)
    indexer.save()

    // update delegated stake
    let delegatorID = event.params.delegator.toHexString()
    let id = joinID([delegatorID, provision.id])
    let delegatedStake = DelegatedStake.load(id)!

    let isStakeBecomingInactive =
        !delegatedStake.shareAmount.isZero() && delegatedStake.shareAmount == event.params.shares

    delegatedStake.unstakedTokens = delegatedStake.unstakedTokens.plus(event.params.tokens)
    delegatedStake.shareAmount = delegatedStake.shareAmount.minus(event.params.shares)
    delegatedStake.lockedTokens = delegatedStake.lockedTokens.plus(event.params.tokens)
    //delegatedStake.lockedUntil = event.params.until.toI32() // until always updates and overwrites the past lockedUntil time
    delegatedStake.lastUndelegatedAt = event.block.timestamp.toI32()

    let currentBalance = event.params.shares.toBigDecimal().times(beforeUpdateDelegationExchangeRate)
    let oldBalance = event.params.shares.toBigDecimal().times(delegatedStake.personalExchangeRate)
    let realizedRewards = currentBalance.minus(oldBalance)

    delegatedStake.realizedRewards = delegatedStake.realizedRewards.plus(realizedRewards)
    delegatedStake.save()

    // update delegator
    let delegator = Delegator.load(delegatorID)!
    delegator.totalUnstakedTokens = delegator.totalUnstakedTokens.plus(event.params.tokens)
    delegator.totalRealizedRewards = delegator.totalRealizedRewards.plus(realizedRewards)

    // upgrade graph network
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    graphNetwork.totalDelegatedTokens = graphNetwork.totalDelegatedTokens.minus(event.params.tokens)

    if (isStakeBecomingInactive) {
        graphNetwork.activeDelegationCount = graphNetwork.activeDelegationCount - 1
        delegator.activeStakesCount = delegator.activeStakesCount - 1
        // Is delegator becoming inactive because of the stake becoming inactive?
        if (delegator.activeStakesCount == 0) {
            graphNetwork.activeDelegatorCount = graphNetwork.activeDelegatorCount - 1
        }
    }

    graphNetwork.save()
    delegator.save()
}

export function handleDelegatedTokensWithdrawn(event: DelegatedTokensWithdrawn): void {
    let provision = createOrLoadProvision(event.params.serviceProvider, event.params.verifier, event.block.timestamp)
    // might want to track locked/thawing tokens in provision too
    provision.save()

    // update delegated stake
    let delegatorID = event.params.delegator.toHexString()
    let id = joinID([delegatorID, provision.id])
    let delegatedStake = DelegatedStake.load(id)!
    delegatedStake.lockedTokens = delegatedStake.lockedTokens.minus(event.params.tokens)
    delegatedStake.save()
}

export function handleMaxThawingPeriodSet(event: MaxThawingPeriodSet): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    graphNetwork.maxThawingPeriod = event.params.maxThawingPeriod
    graphNetwork.save()
}

export function handleThawingPeriodCleared(event: ThawingPeriodCleared): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    graphNetwork.thawingPeriod = 0
    graphNetwork.save()
}

export function handleDelegationSlashingEnabled(event: DelegationSlashingEnabled): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    graphNetwork.delegationSlashingEnabled = true
    graphNetwork.save()
}

export function handleAllowedLockedVerifierSet(event: AllowedLockedVerifierSet): void {
    let dataService = createOrLoadDataService(event.params.verifier)
    dataService.allowedWithTokenLockWallets = event.params.allowed
    dataService.save()
}
