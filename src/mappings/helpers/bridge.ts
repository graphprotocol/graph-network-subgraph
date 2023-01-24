import {
  Bytes,
  BigInt,
  ethereum,
  log,
  crypto,
  ByteArray,
} from "@graphprotocol/graph-ts";
import { DepositInitiated } from "../../generated/L1GraphTokenGateway/L1GraphTokenGateway";
import { bigIntToBytes, ensureEvenLength, padZeros, strip0xPrefix } from "./byte";
import { RLPEncodeArray } from "./rlp";
import { getOutBoxTransactionExecutedData } from "./events/OutBoxTransactionExecuted";
import { getMessageDeliveredData } from "./events/MessageDelivered";
import { getInboxMessageDeliveredData } from "./events/InboxMessageDelivered";
import { getTxToL2Data } from "./events/TxToL2";
import { BridgeDepositTransaction } from "../../generated/schema";

// Gets transactionIndex
// Returns null if the withdrawal call is made under the following conditions:
// - Call is made from another contract (i.e: a multicall call) and
// - Call contains multiple 'OutBoxTransactionExecuted' events (i.e: multiple withdrawals on same multicall call)
export function getTransactionIndex(event: ethereum.Event): BigInt | null {
  return (
    getTransactionIndexFromCalldata(event) || getTransactionIndexFromLogs(event)
  );
}

// Gets transactionIndex from the calldata
// Returns null if the call is made from another contract (i.e: a multicall call)
export function getTransactionIndexFromCalldata(
  event: ethereum.Event
): BigInt | null {
  let stringCallData = event.transaction.input.toHexString();
  let strippedCallData = strip0xPrefix(stringCallData);

  // Validate selector
  // Method signature: executeTransaction(bytes32[],uint256,address,address,uint256,uint256,uint256,uint256,bytes)
  // MethodID: 0x08635a95
  let selector = strippedCallData.slice(0, 8);
  if (selector != "08635a95") {
    log.error("Invalid function selector", [selector]);
    return null;
  }

  // Decode ABI using a modified types mapping since the decode method fails with dynamic types
  // - Original types mapping: (bytes32[],uint256,address,address,uint256,uint256,uint256,uint256,bytes)
  // - Modified types mapping: (uint256,uint256,address,address,uint256,uint256,uint256,uint256)
  //
  // The bytes32[] is replaced with uint256, this is ok since it's a dynamic type so the actual value stored
  // is the length of the bytes array which is a uint256 and the array contents are appended at the end of the calldata
  //
  // The bytes at the end can easily be dropped since we don't use it
  let types =
    "(uint256,uint256,address,address,uint256,uint256,uint256,uint256)";

  let decoded = ethereum.decode(
    types,
    Bytes.fromHexString(strippedCallData.substring(8))
  );
  if (decoded !== null) {
    return decoded.toTuple()[1].toBigInt(); // transactionIndex
  } else {
    log.error("Could not decode call data!", []);
    return null;
  }
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
  event: DepositInitiated,
  entity: BridgeDepositTransaction
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

  // TODO: get chainId dynamically
  // 0x066EED = 421613 (Arbitrum Goerli)
  // 0xA4B1 = 42161 (Arbitrum One)
  let l2ChainId = Bytes.fromHexString("0xA4B1");
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
