import { log, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { getDataFromEventLog } from "../event-log";

// AS compiler doesn't like interfaces
class MessageDeliveredData {
  sender: Bytes;
  baseFeeL1: BigInt;
}

let EVENT_NAME = "MessageDelivered";
let EVENT_SIGNATURE =
  "MessageDelivered(uint256,bytes32,address,uint8,address,bytes32,uint256,uint64)";
let EVENT_DATA_TYPES = "(address,uint8,address,bytes32,uint256,uint64)";

export function getMessageDeliveredData(
  event: ethereum.Event
): MessageDeliveredData | null {
  let data = getDataFromEventLog(event, EVENT_SIGNATURE);
  if (data === null) return null;

  return parseMessageDeliveredData(data);
}

export function parseMessageDeliveredData(data: Bytes): MessageDeliveredData | null {
  let decoded = ethereum.decode(EVENT_DATA_TYPES, data);

  if (decoded !== null) {
    let decodedTuple = decoded.toTuple();
    return {
      sender: decodedTuple[2].toAddress(),
      baseFeeL1: decodedTuple[4].toBigInt(),
    };
  } else {
    log.error(`Could not decode call data for ${EVENT_NAME}!`, [
      data.toHexString(),
    ]);
    return null;
  }
}
