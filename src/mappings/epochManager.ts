import { GraphNetwork } from '../types/schema'
import { EpochRun, EpochLengthUpdate } from '../types/EpochManager/EpochManager'
import { createOrLoadGraphNetwork, createOrLoadEpoch, createEpoch } from './helpers'

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
  let graphNetwork = createOrLoadGraphNetwork()
  let startingEpochLength = graphNetwork.epochLength
  graphNetwork.epochLength = event.params.epochLength.toI32()
  graphNetwork.lastLengthUpdateEpoch = graphNetwork.currentEpoch
  graphNetwork.lastLengthUpdateBlock = event.block.number.toI32()

  // Edge case where at the very start, we save it ahead, otherwise divide by zero error.
  // related to the comment below
  if (startingEpochLength == 0) {
    graphNetwork.save()
  }

  // This returns a new epoch, or current epoch, with the old epoch length
  let epoch = createOrLoadEpoch(event.block.number)

  // We must take this epoch, update its blocks and end it, and make a new epoch
  // Since whenever we update epoch length we end the current epoch and create a new one
  epoch.endBlock = event.block.number.toI32()
  epoch.save()
  createEpoch(
    event.block.number.toI32(),
    graphNetwork.epochLength,
    graphNetwork.currentEpoch + 1,
  )

  // We now save the new length. If done earlier, if would back fill with the wrong epoch length
  graphNetwork.save()
}
