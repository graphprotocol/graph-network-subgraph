import { log, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { ensureEvenLength } from "../byte";
import { getDataFromEventLog } from "../event-log";

// AS compiler doesn't like interfaces
class InboxMessageDelivered {
  to: Bytes;
  l2CallValue: BigInt;
  l1CallValue: BigInt;
  maxSubmissionCost: BigInt;
  excessFeeRefundAddress: Bytes;
  callValueRefundAddress: Bytes;
  gasLimit: BigInt;
  maxFeePerGas: BigInt;
  dataLength: BigInt;
}

let EVENT_NAME = "InboxMessageDelivered";
let EVENT_SIGNATURE =
  "InboxMessageDelivered(uint256,bytes)";
let EVENT_DATA_TYPES = "(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)";

export function getInboxMessageDeliveredData(
  event: ethereum.Event
): InboxMessageDelivered | null {
  let data = getDataFromEventLog(event, EVENT_SIGNATURE);
  if (data === null) return null;

  return parseInboxMessageDeliveredData(data);
}

export function parseInboxMessageDeliveredData(data: Bytes): InboxMessageDelivered | null {
  let decoded = ethereum.decode(EVENT_DATA_TYPES, data);

  if (decoded !== null) {
    let decodedTuple = decoded.toTuple();
    return {
      to: Bytes.fromHexString(ensureEvenLength(decodedTuple[2].toBigInt().toHexString())),
      l2CallValue: decodedTuple[3].toBigInt(),
      l1CallValue: decodedTuple[4].toBigInt(),
      maxSubmissionCost: decodedTuple[5].toBigInt(),
      excessFeeRefundAddress: Bytes.fromHexString(ensureEvenLength(decodedTuple[6].toBigInt().toHexString())),
      callValueRefundAddress: Bytes.fromHexString(ensureEvenLength(decodedTuple[7].toBigInt().toHexString())),
      gasLimit: decodedTuple[8].toBigInt(),
      maxFeePerGas: decodedTuple[9].toBigInt(),
      dataLength: decodedTuple[10].toBigInt(),
    };
  } else {
    log.error(`Could not decode call data for ${EVENT_NAME}!`, [
      data.toHexString(),
    ]);
    return null;
  }
}
