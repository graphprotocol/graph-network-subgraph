import { Bytes, BigInt, ethereum, log, crypto } from "@graphprotocol/graph-ts";

function strip0xPrefix(input: string): string {
  return input.startsWith("0x") ? input.slice(2) : input;
}

// Gets transactionIndex
// Returns null if the withdrawal call is made under the following conditions:
// - Call is made from another contract (i.e: a multicall call) and
// - Call contains multiple 'OutBoxTransactionExecuted' events (i.e: multiple withdrawals on same multicall call)
export function getTransactionIndex(event: ethereum.Event): BigInt | null {
  return getTransactionIndexFromCalldata(event) || getTransactionIndexFromLogs(event);
}

// Gets transactionIndex from the calldata
// Returns null if the call is made from another contract (i.e: a multicall call)
export function getTransactionIndexFromCalldata(event: ethereum.Event): BigInt | null {
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
  // Original types mapping: (bytes32[],uint256,address,address,uint256,uint256,uint256,uint256,bytes)
  // Modified types mapping: (uint256,uint256,address,address,uint256,uint256,uint256,uint256)
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
export function getTransactionIndexFromLogs(event: ethereum.Event): BigInt | null {
  let receipt = event.receipt;
  if (receipt === null) {
    log.error("Could not get tx receipt!", []);
    return null;
  }

  let eventCount = 0;
  let transactionIndex: BigInt | null = null;

  let logs = receipt.logs;
  for (let i = 0; i < logs.length; i++) {
    let topics = logs[i].topics;

    // OutBoxTransactionExecuted event
    if (isOutBoxTransactionExecutedEvent(topics[0])) {
      eventCount = eventCount + 1;

      // Parse event data to get the transactionIndex
      let data = logs[i].data;
      if (data.length === 32) {
        let amountBytes = Bytes.fromHexString(
          strip0xPrefix(data.toHexString())
        );
        transactionIndex = BigInt.fromUnsignedBytes(
          amountBytes.reverse() as Bytes
        );
      } else {
        log.error("Invalid data length", [
          data.length.toString(),
          data.toHexString(),
        ]);
      }
    }
  }

  if (eventCount != 1) {
    log.error("Event count for 'OutBoxTransactionExecuted' is not 1!", [
      eventCount.toString(),
    ]);
    transactionIndex = null;
  }

  return transactionIndex;
}

function isOutBoxTransactionExecutedEvent(topic: Bytes): boolean {
  return (
    topic ==
    crypto.keccak256(
      Bytes.fromUTF8(
        "OutBoxTransactionExecuted(address,address,uint256,uint256)"
      )
    )
  );
}