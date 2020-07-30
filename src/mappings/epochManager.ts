import { GraphNetwork } from '../types/schema'
import { EpochRun, EpochLengthUpdate } from '../types/EpochManager/EpochManager'
import { createOrLoadGraphNetwork, createOrLoadEpoch } from './helpers'

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
  graphNetwork.epochLength = event.params.epochLength.toI32()
  graphNetwork.lastLengthUpdateEpoch = graphNetwork.currentEpoch
  graphNetwork.lastLengthUpdateBlock = event.block.number.toI32()
  graphNetwork.save()

  let epoch = createOrLoadEpoch(event.block.number)
  epoch.endBlock = epoch.startBlock + graphNetwork.epochLength
  epoch.save()
}
