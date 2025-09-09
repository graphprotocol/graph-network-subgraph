import { EpochRun, EpochLengthUpdate } from '../types/EpochManager/EpochManager'
import { createOrLoadEpoch, createEpoch, createOrLoadGraphNetwork } from './helpers/helpers'
import { addresses } from '../../config/addresses'

/**
 * @dev handleEpochRun
 * - updates the last run epoch
 */
export function handleEpochRun(event: EpochRun): void {
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.lastRunEpoch = event.params.epoch.toI32()
  graphNetwork.save()
}

/**
 * @dev handleEpochLengthUpdate
 * - updates the length and the last block and epoch it happened
 */
export function handleEpochLengthUpdate(event: EpochLengthUpdate): void {
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)

  // This event is emitted on EpochManagers constructor, so it has some special logic to handle
  // initialization here
  if (graphNetwork.epochLength == 0) {
    // Will only ever be 0 on initialization in the contracts
    graphNetwork.epochLength = event.params.epochLength.toI32()
    graphNetwork.lastLengthUpdateBlock = (addresses.isL1 ? event.block.number : graphNetwork.currentL1BlockNumber!).toI32()
    graphNetwork.currentEpoch = event.params.epoch.toI32()
    graphNetwork.epochCount = 1
    graphNetwork.lastLengthUpdateEpoch = graphNetwork.currentEpoch
    graphNetwork.save()

    createEpoch((addresses.isL1 ? event.block.number : graphNetwork.currentL1BlockNumber!).toI32(), graphNetwork.epochLength, graphNetwork.currentEpoch)
    // return here so it doesn't run the normal handler
    return
  }

  // This returns a new epoch, or current epoch, with the old epoch length
  let epoch = createOrLoadEpoch(addresses.isL1 ? event.block.number : graphNetwork.currentL1BlockNumber!, graphNetwork)
  epoch.save()

  // Check that the endBlock for the current epoch match what it should based on the
  // changed epoch length
  let newEndBlock = epoch.startBlock + event.params.epochLength.toI32()
  if (epoch.endBlock != newEndBlock) {
    epoch.endBlock = newEndBlock
    epoch.save()
  }

  graphNetwork.epochLength = event.params.epochLength.toI32()
  graphNetwork.currentEpoch = event.params.epoch.toI32()
  graphNetwork.lastLengthUpdateEpoch = event.params.epoch.toI32()
  graphNetwork.lastLengthUpdateBlock = epoch.startBlock
  graphNetwork.save()
}

// export function handleImplementationUpdated(event: ImplementationUpdated): void {
//   let graphNetwork = GraphNetwork.load('1')
//   let implementations = graphNetwork.epochManagerImplementations
//   implementations.push(event.params.newImplementation)
//   graphNetwork.epochManagerImplementations = implementations
//   graphNetwork.save()
// }
