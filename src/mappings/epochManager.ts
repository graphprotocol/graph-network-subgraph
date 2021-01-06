import { GraphNetwork } from '../types/schema'
import { EpochRun, EpochLengthUpdate } from '../types/EpochManager/EpochManager'
import { createOrLoadEpoch, createEpoch } from './helpers'
import { log, BigInt } from '@graphprotocol/graph-ts'

/**
 * @dev handleEpochRun
 * - updates the last run epoch
 */
export function handleEpochRun(event: EpochRun): void {
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.lastRunEpoch = event.params.epoch.toI32()
  graphNetwork.save()
}

/**
 * @dev handleEpochLengthUpdate
 * - updates the length and the last block and epoch it happened
 */
export function handleEpochLengthUpdate(event: EpochLengthUpdate): void {
  let graphNetwork = GraphNetwork.load('1')

  // This event is emitted on EpochManagers constructor, so it has some special logic to handle
  // initialization here
  if (graphNetwork.epochLength == 0) {
    // Will only ever be 0 on initialization in the contracts
    graphNetwork.epochLength = event.params.epochLength.toI32()
    graphNetwork.lastLengthUpdateBlock = event.block.number.toI32()
    graphNetwork.currentEpoch = 0
    graphNetwork.epochCount = 1
    graphNetwork.lastLengthUpdateEpoch = graphNetwork.currentEpoch
    graphNetwork.save()

    createEpoch(event.block.number.toI32(), graphNetwork.epochLength, graphNetwork.currentEpoch)
    // return here so it doesn't run the normal handler
    return
  }

  // This returns a new epoch, or current epoch, with the old epoch length
  let epoch = createOrLoadEpoch(event.block.number)
  // We must take this epoch, update its blocks and end it, and make a new epoch
  // Since whenever we update epoch length in the contracts we end the current epoch
  // and create a new one
  epoch.endBlock = event.block.number.toI32()
  epoch.save()

  // Now it is safe to update graphNetwork, since the past epoch is completed
  // But we must reload it, since its currentEpoch may have been updated in createOrLoadEpoch
  graphNetwork = GraphNetwork.load('1') as GraphNetwork
  graphNetwork.epochLength = event.params.epochLength.toI32()
  graphNetwork.lastLengthUpdateBlock = event.block.number.toI32()

  // Now we create the new epoch that starts fresh with the new length,
  let newEpochNumber = graphNetwork.currentEpoch + 1
  createEpoch(event.block.number.toI32(), graphNetwork.epochLength, newEpochNumber)

  // Update graphNetwork for the new epoch
  graphNetwork.currentEpoch = newEpochNumber
  graphNetwork.lastLengthUpdateEpoch = graphNetwork.currentEpoch
  graphNetwork.save()
}

// export function handleImplementationUpdated(event: ImplementationUpdated): void {
//   let graphNetwork = GraphNetwork.load('1')
//   let implementations = graphNetwork.epochManagerImplementations
//   implementations.push(event.params.newImplementation)
//   graphNetwork.epochManagerImplementations = implementations
//   graphNetwork.save()
// }
