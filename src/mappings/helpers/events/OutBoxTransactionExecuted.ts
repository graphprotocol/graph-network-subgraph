import { log, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { getDataFromEventLog } from "../event-log";

// AS compiler doesn't like interfaces
class OutBoxTransactionExecutedData {
  transactionIndex: BigInt;
}

let EVENT_NAME = "OutBoxTransactionExecuted";
let EVENT_SIGNATURE =
  "OutBoxTransactionExecuted(address,address,uint256,uint256)";
let EVENT_DATA_TYPES = "(uint256)";

export function getOutBoxTransactionExecutedData(
  event: ethereum.Event
): OutBoxTransactionExecutedData | null {
  let data = getDataFromEventLog(event, EVENT_SIGNATURE);
  if (data === null) return null;

  return parseOutBoxTransactionExecutedData(data);
}

function parseOutBoxTransactionExecutedData(
  data: Bytes
): OutBoxTransactionExecutedData | null {
  let decoded = ethereum.decode(EVENT_DATA_TYPES, data);

  if (decoded !== null) {
    return {
      transactionIndex: decoded.toTuple()[0].toBigInt(),
    };
  } else {
    log.error(`Could not decode call data for ${EVENT_NAME}!`, [
      data.toHexString(),
    ]);
    return null;
  }
}
