import { BigInt, log } from '@graphprotocol/graph-ts'
import { addresses } from '../../config/addresses'
import { HorizonStakeDeposited, HorizonStakeLocked, HorizonStakeWithdrawn, TokensDeprovisioned } from '../types/HorizonStaking/HorizonStaking'
import { Indexer, GraphNetwork, ThawRequest } from '../types/schema'
import { calculateCapacities, createOrLoadDataService, createOrLoadEpoch, createOrLoadGraphAccount, createOrLoadGraphNetwork, createOrLoadIndexer, createOrLoadProvision, updateAdvancedIndexerMetrics } from './helpers/helpers'
import {
    ProvisionCreated,
    ProvisionIncreased,
    ProvisionParametersSet,
    ProvisionParametersStaged,
    ProvisionSlashed,
    ProvisionThawed,
    ThawRequestCreated,
    ThawRequestFulfilled,
    ThawRequestsFulfilled,
    ThawingPeriodCleared
} from '../types/HorizonStaking/HorizonStaking'

export function handleHorizonStakeDeposited(event: HorizonStakeDeposited): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    // update indexer
    let indexer = createOrLoadIndexer(event.params.serviceProvider, event.block.timestamp)
    let previousStake = indexer.stakedTokens
    indexer.stakedTokens = indexer.stakedTokens.plus(event.params.tokens)
    indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
    indexer = calculateCapacities(indexer as Indexer)
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
    indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
    indexer = calculateCapacities(indexer as Indexer)
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
    indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
    indexer = calculateCapacities(indexer as Indexer)
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
    // To Do
}

export function handleProvisionParametersStaged(event: ProvisionParametersStaged): void {
    // To Do
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