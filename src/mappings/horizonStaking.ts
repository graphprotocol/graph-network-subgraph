import { BigInt } from '@graphprotocol/graph-ts'
import { addresses } from '../../config/addresses.template'
import { HorizonStakeDeposited, HorizonStakeLocked, HorizonStakeWithdrawn} from '../types/HorizonStaking/HorizonStaking'
import { Indexer } from '../types/schema'
import { calculateCapacities, createOrLoadEpoch, createOrLoadGraphNetwork, createOrLoadIndexer, updateAdvancedIndexerMetrics } from './helpers/helpers'


export function handleHorizonStakeDeposited(event: HorizonStakeDeposited): void {
    // To Do
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
    if (previousStake == BigInt.fromI32(0)) {
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
  // To Do
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  // update indexer
  let id = event.params.serviceProvider.toHexString()
  let indexer = Indexer.load(id)!
  let oldLockedTokens = indexer.lockedTokens
  indexer.lockedTokens = event.params.tokens
  indexer.tokensLockedUntil = event.params.until.toI32()
  indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
  indexer = calculateCapacities(indexer as Indexer)
  indexer.save()

  // update graph network
  // the tokens from the event replace the previously locked tokens
  // from this indexer
  graphNetwork.totalUnstakedTokensLocked = graphNetwork.totalUnstakedTokensLocked.plus(
    event.params.tokens,
  ).minus(oldLockedTokens)
  if (indexer.stakedTokens == indexer.lockedTokens) {
    graphNetwork.stakedIndexersCount = graphNetwork.stakedIndexersCount - 1
  }
  graphNetwork.save()
}

export function handleHorizonStakeWithdrawn(event: HorizonStakeWithdrawn): void {
  // To Do
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  // update indexer
  let id = event.params.serviceProvider.toHexString()
  let indexer = Indexer.load(id)!
  indexer.stakedTokens = indexer.stakedTokens.minus(event.params.tokens)
  indexer.lockedTokens = indexer.lockedTokens.minus(event.params.tokens)
  indexer.tokensLockedUntil = 0 // always set to 0 when withdrawn
  indexer = updateAdvancedIndexerMetrics(indexer as Indexer)
  indexer = calculateCapacities(indexer as Indexer)
  indexer.save()

  // Update graph network
  graphNetwork.totalTokensStaked = graphNetwork.totalTokensStaked.minus(event.params.tokens)
  graphNetwork.totalUnstakedTokensLocked = graphNetwork.totalUnstakedTokensLocked.minus(
    event.params.tokens,
  )
  graphNetwork.save()
}
