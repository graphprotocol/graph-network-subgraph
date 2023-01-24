import { Bytes, ethereum, log, crypto } from "@graphprotocol/graph-ts";

// Loops through all logs in an event tx receipt
// Returns the data blob for the log with a matching event signature
// If the event log is not found or there are multiple with the same signature, returns null
export function getDataFromEventLog(
  event: ethereum.Event,
  eventSignature: string
): Bytes | null {
  let receipt = event.receipt;
  if (receipt === null) {
    log.error("Could not get tx receipt!", []);
    return null;
  }

  let eventCount = 0;
  let eventData: Bytes | null = null;

  let logs = receipt.logs;
  for (let i = 0; i < logs.length; i++) {
    let topics = logs[i].topics;

    if (isEventLog(topics[0], eventSignature)) {
      eventCount = eventCount + 1;
      eventData = logs[i].data;
    }
  }

  if (eventCount != 1) {
    let eventName = eventSignature.split("(")[0];
    log.error(`Event count for '${eventName}' is not 1!`, [
      eventCount.toString(),
    ]);
    eventData = null; // reset to null if there are multiple events
  }

  return eventData;
}

// Returns true if the topic corresponds to an event signature
function isEventLog(topic: Bytes, targetEventSignature: string): boolean {
  return topic == crypto.keccak256(Bytes.fromUTF8(targetEventSignature));
}