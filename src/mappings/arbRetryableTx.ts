import { Bytes } from "@graphprotocol/graph-ts";
import { RedeemScheduled } from "../types/ArbRetryableTx/ArbRetryableTx";
import {
  RetryableTicket,
  RetryableTicketRedeemAttempt,
} from "../types/schema";

export function handleRedeemScheduled(event: RedeemScheduled): void {
  // Retryable ticket
  // Retryable ticket id is guaranteed to be unique
  let retryable = createOrLoadRetryableTicket(event.params.ticketId);
  retryable.txHash = event.transaction.hash;
  retryable.redeemCount = retryable.redeemCount + 1;
  retryable.save();

  // Redeem attempt
  // ID needs to be the txHash so that we can load it easily
  // It's not expected from the sequencer to create multiple redeem attempts on the same tx
  let attempt = new RetryableTicketRedeemAttempt(
    event.params.retryTxHash.toHexString()
  );
  attempt.txHash = event.params.retryTxHash;
  attempt.sequenceNumber = event.params.sequenceNum.toI32();
  attempt.ticketId = event.params.ticketId.toHexString();

  attempt.save();
}

function createOrLoadRetryableTicket(ticketId: Bytes): RetryableTicket {
  let retryable = RetryableTicket.load(ticketId.toHexString());
  if (retryable == null) {
    retryable = new RetryableTicket(ticketId.toHexString());
    retryable.redeemCount = 0;
  }

  return retryable;
}
