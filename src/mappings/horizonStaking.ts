import { BigInt } from '@graphprotocol/graph-ts'
import { addresses } from '../../config/addresses'
import { HorizonStakeDeposited, HorizonStakeLocked, HorizonStakeWithdrawn } from '../types/HorizonStaking/HorizonStaking'
import { Indexer } from '../types/schema'
import { calculateCapacities, createOrLoadEpoch, createOrLoadGraphNetwork, createOrLoadIndexer, updateAdvancedIndexerMetrics } from './helpers/helpers'


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
