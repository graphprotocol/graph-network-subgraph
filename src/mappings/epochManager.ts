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
  graphNetwork.lastRunEpoch = event.params.epoch.toI32()
  graphNetwork.save()
}

/**
 * @dev handleEpochLengthUpdate
 * - updates the length and the last block and epoch it happened
 */
export function handleEpochLengthUpdate(event: EpochLengthUpdate): void {
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.epochLength = event.params.epochLength.toI32()
  graphNetwork.lastLengthUpdateEpoch = graphNetwork.lastRunEpoch
  graphNetwork.lastLengthUpdateBlock = event.block.number.toI32()
  graphNetwork.save()

  let epoch = Epoch.load(BigInt.fromI32(graphNetwork.currentEpoch).toString())
  epoch.endBlock = epoch.startBlock + graphNetwork.epochLength
  epoch.save()
}
