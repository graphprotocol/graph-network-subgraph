import {
  Bytes,
  BigInt,
  ethereum,
  crypto,
  ByteArray,
  log,
} from "@graphprotocol/graph-ts";
import { DepositInitiated } from "../../types/L1GraphTokenGateway/L1GraphTokenGateway";
import { bigIntToBytes, padZeros } from "./byte";
import { RLPEncodeArray } from "./rlp";
import { getOutBoxTransactionExecutedData } from "./events/OutBoxTransactionExecuted";
import { getMessageDeliveredData } from "./events/MessageDelivered";
import { getInboxMessageDeliveredData } from "./events/InboxMessageDelivered";
import { getTxToL2Data } from "./events/TxToL2";
import { addresses } from "../../../config/addresses";

// Gets transactionIndex
// Returns null if the withdrawal call contains multiple 'OutBoxTransactionExecuted' events (i.e: multiple withdrawals on same multicall call)
export function getTransactionIndex(event: ethereum.Event): BigInt | null {
  return getTransactionIndexFromLogs(event);
}

// Get transactionIndex from the 'OutBoxTransactionExecuted' event, emitted by Arbitrum's Outbox contract on the same tx
// Returns null if the event is not found or if there are multiple events (i.e: a multicall call)
export function getTransactionIndexFromLogs(
  event: ethereum.Event
): BigInt | null {
  let data = getOutBoxTransactionExecutedData(event);
  return data !== null ? data.transactionIndex : null;
}

// Calculates Arbitrum's retryable ticket ID using tx event data
// Returns null if the required events are not found or if there are multiple duplicate events (i.e: a multicall call)
export function getRetryableTicketId(
  event: DepositInitiated
): string | null {
  // Get the data from the events
  let messageDeliveredData = getMessageDeliveredData(event);
  let inboxMessageDeliveredData = getInboxMessageDeliveredData(event);
  let txToL2Data = getTxToL2Data(event);

  if (
    messageDeliveredData === null ||
    inboxMessageDeliveredData === null ||
    txToL2Data === null
  )
    return null;

  // Build the input array
  let fields: ByteArray[] = [];

  // Get the L2 chain id based on the L1 network
  let l2ChainIdHex = "";
  if (addresses.network === "mainnet") {
    l2ChainIdHex = "0xA4B1"; // 0xA4B1 = 42161 (Arbitrum One)
  } else if (addresses.network === "goerli") {
    l2ChainIdHex = "0x066EED"; // 0x066EED = 421613 (Arbitrum Goerli)
  } else if (addresses.network === "sepolia") {
    l2ChainIdHex = "0x066EEE"; // 0x066EEE = 421614 (Arbitrum Sepolia)
  } else {
    log.warning('Unsupported network: {}', [addresses.network]);
    return null;
  }

  let l2ChainId = Bytes.fromHexString(l2ChainIdHex);
  fields.push(l2ChainId);

  let messageNumber = Bytes.fromHexString(
    padZeros(
      Bytes.fromUint8Array(
        Bytes.fromBigInt(event.params.sequenceNumber).reverse()
      ).toHexString()
    )
  );
  fields.push(messageNumber);

  let fromAddress = messageDeliveredData.sender;
  fields.push(fromAddress);

  let l1BaseFee = bigIntToBytes(messageDeliveredData.baseFeeL1);
  fields.push(l1BaseFee);

  let l1CallValue = bigIntToBytes(inboxMessageDeliveredData.l1CallValue);
  fields.push(l1CallValue);

  let maxFeePerGas = bigIntToBytes(inboxMessageDeliveredData.maxFeePerGas);
  fields.push(maxFeePerGas);

  let gasLimit = bigIntToBytes(inboxMessageDeliveredData.gasLimit);
  fields.push(gasLimit);

  let destinationAddress = inboxMessageDeliveredData.to;
  fields.push(destinationAddress);

  let l2CallValue = bigIntToBytes(inboxMessageDeliveredData.l2CallValue);
  fields.push(l2CallValue);

  let callValueRefundAddress = inboxMessageDeliveredData.callValueRefundAddress;
  fields.push(callValueRefundAddress);
 
  let maxSubmissionFee = bigIntToBytes(
    inboxMessageDeliveredData.maxSubmissionCost
  );
  fields.push(maxSubmissionFee);

  let excessFeeRefundAddress = inboxMessageDeliveredData.excessFeeRefundAddress;
  fields.push(excessFeeRefundAddress);

  let data = txToL2Data;
  fields.push(data);

  return calculateSubmitRetryableId(fields);
}

// Calculate the retryable ticket id
// See https://github.com/OffchainLabs/arbitrum-sdk/blob/1d69e5f03f537ef9af7aaa039a28a00cf61b2fc0/src/lib/message/L1ToL2Message.ts#L115-L161
export function calculateSubmitRetryableId(input: ByteArray[]): string {
  let txType = Bytes.fromHexString("0x69"); // arbitrum submit retry transactions have type 0x69
  let encodedFields = Bytes.fromHexString(RLPEncodeArray(input));
  let rlpEnc = txType.concat(encodedFields);

  return crypto.keccak256(rlpEnc).toHexString();
}
