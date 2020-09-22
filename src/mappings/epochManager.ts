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
  let graphNetwork = GraphNetwork.load("1")

  // Edge case to handle when it is the first time, otherwise createOrLoadEpoch fails
  // TODO = make this an event emitted in EpochManager constructor
  // And have this event CLEARLY create the first epoch and update graphNetwork
  if (graphNetwork.epochLength == 0) {
    graphNetwork.epochLength = event.params.epochLength.toI32()
    graphNetwork.save()
  }

  // This returns a new epoch, or current epoch, with the old epoch length
  let epoch = createOrLoadEpoch(event.block.number)
  // We must take this epoch, update its blocks and end it, and make a new epoch
  // Since whenever we update epoch length we end the current epoch and create a new one
  // UNLESS it is the first epoch
  if (epoch.id != '1') {
    epoch.endBlock = event.block.number.toI32()
  }
  epoch.save()

  // Now it is safe to update graphNetwork, since the past epoch is completed
  // But we must reload it, since its currentEpoch may have been updated in createOrLoadEpoch
  graphNetwork = GraphNetwork.load('1') as GraphNetwork
  graphNetwork.epochLength = event.params.epochLength.toI32()
  graphNetwork.lastLengthUpdateBlock = event.block.number.toI32()

  // Now we create the new epoch that starts fresh with the new length,
  // Update graphNetwork for the new epoch
  let newEpochNumber = graphNetwork.currentEpoch + 1

  // create the new epoch, if not first epoch
  if (epoch.id != '1') {
    graphNetwork.currentEpoch = newEpochNumber
    createEpoch(event.block.number.toI32(), graphNetwork.epochLength, newEpochNumber)
  }
  graphNetwork.lastLengthUpdateEpoch = graphNetwork.currentEpoch
  graphNetwork.save()
}
