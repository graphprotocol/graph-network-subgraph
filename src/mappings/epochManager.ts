import { BigInt, ByteArray, Address, Bytes, crypto, log, BigDecimal } from '@graphprotocol/graph-ts'
import { Epoch, GraphNetwork } from '../types/schema'
import { addresses } from '../../config/addresses'
import { EpochRun, EpochLengthUpdate } from '../types/EpochManager/EpochManager'

/**
 * @dev handleEpochRun
 * - updates the last run epoch
 */
export function handleEpochRun(event: EpochRun): void {
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.lastRunEpoch = event.params.epoch
  graphNetwork.save()
}

/**
 * @dev handleEpochLengthUpdate
 * - updates the length and the last block and epoch it happened
 */
export function handleEpochLengthUpdate(event: EpochLengthUpdate): void {
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.epochLength = event.params.epochLength
  graphNetwork.lastLengthUpdateEpoch = graphNetwork.lastRunEpoch
  graphNetwork.lastLengthUpdateBlock = event.block.number
  graphNetwork.save()

  let epoch = Epoch.load(graphNetwork.currentEpoch.toString())
  epoch.endBlock = epoch.startBlock + graphNetwork.epochLength
  epoch.save()
}
