import { BigInt } from '@graphprotocol/graph-ts'
import { addresses } from '../../config/addresses'
import { DelegatedTokensWithdrawn, DelegationFeeCutSet, DelegationSlashed, HorizonStakeDeposited, HorizonStakeLocked, HorizonStakeWithdrawn, OperatorSet, StakeDelegatedWithdrawn, TokensDelegated, TokensDeprovisioned, TokensToDelegationPoolAdded, TokensUndelegated } from '../types/HorizonStaking/HorizonStaking'
import { Indexer, ThawRequest } from '../types/schema'
import { createOrLoadDataService, createOrLoadEpoch, createOrLoadGraphAccount, createOrLoadGraphNetwork, createOrLoadIndexer, createOrLoadOperator, createOrLoadProvision, updateDelegationExchangeRate } from './helpers/helpers'
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
    indexer.save()

    dataService.totalTokensProvisioned = dataService.totalTokensProvisioned.minus(event.params.tokens)
    dataService.save()

    graphNetwork.totalTokensProvisioned = graphNetwork.totalTokensProvisioned.minus(event.params.tokens)
    graphNetwork.save()

    provision.tokensProvisioned = provision.tokensProvisioned.minus(event.params.tokens)
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
    let operator = createOrLoadOperator(event.params.operator, event.params.verifier, event.params.serviceProvider)
    let operators = indexerGraphAccount.operators
    // Will have to handle legacy operators list, and horizon provisionedOperators list for extra context
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

    let provisionedOperators = indexerGraphAccount.provisionedOperators
    let provisionedOperatorsIndex = provisionedOperators.indexOf(event.params.operator.toHexString())
    if (provisionedOperatorsIndex != -1) {
        // false - it existed, and we set it to false, so remove from operators and update operator
        if (!event.params.allowed) {
            operators.splice(provisionedOperatorsIndex, 1)
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
    indexerGraphAccount.provisionedOperators = provisionedOperators
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
    request.save()
}

export function handleThawRequestFulfilled(event: ThawRequestFulfilled): void {
    let request = ThawRequest.load(event.params.thawRequestId.toHexString())!
    request.tokens = event.params.tokens
    request.valid = event.params.valid
    request.save()
}

export function handleTokensToDelegationPoolAdded(event: TokensToDelegationPoolAdded): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    let indexer = Indexer.load(event.params.serviceProvider.toHexString())!
    let provision = createOrLoadProvision(event.params.serviceProvider, event.params.verifier, event.block.timestamp)
    provision.delegatedTokens = provision.delegatedTokens.plus(event.params.tokens)
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
    // To Do
}

export function handleDelegationSlashed(event: DelegationSlashed): void {
    // To Do
}

export function handleTokensUndelegated(event: TokensUndelegated): void {
    // To Do
}

export function handleDelegatedTokensWithdrawn(event: DelegatedTokensWithdrawn): void {
    // To Do
}

export function handleStakeDelegatedWithdrawn(event: StakeDelegatedWithdrawn): void {
    // To Do
}