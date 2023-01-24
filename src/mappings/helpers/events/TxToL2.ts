import { log, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { getDataFromEventLog } from "../event-log";

let EVENT_NAME = "TxToL2";
let EVENT_SIGNATURE =
  "TxToL2(address,address,uint256,bytes)";
let EVENT_DATA_TYPES = "(uint256,uint256)";

export function getTxToL2Data(
  event: ethereum.Event
): Bytes | null {
  let data = getDataFromEventLog(event, EVENT_SIGNATURE);
  if (data === null) return null;

  return parseTxToL2Data(data)
}

export function parseTxToL2Data(
  data: Bytes
): Bytes | null {
  let decoded = ethereum.decode(EVENT_DATA_TYPES, data);

  if (decoded !== null) {
    let dataLength = decoded.toTuple()[1].toBigInt();
    return Bytes.fromUint8Array(data.subarray(64, 64 + dataLength.toI32()));
  } else {
    log.error(`Could not decode call data for ${EVENT_NAME}!`, [
      data.toHexString(),
    ]);
    return null;
  }
}