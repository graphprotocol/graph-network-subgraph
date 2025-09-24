import { Address, BigInt } from '@graphprotocol/graph-ts'
import { PaymentsEscrowAccount, Payer, Receiver, PaymentsEscrowTransaction } from '../types/schema'
import {
  Deposit,
  Withdraw,
  Thaw,
  CancelThaw,
  EscrowCollected,
} from '../types/PaymentsEscrow/PaymentsEscrow'

const BIGINT_ZERO = BigInt.fromI32(0)

export function handleDeposit(event: Deposit): void {
    let index = event.logIndex.toI32()
    let transactionId = event.transaction.hash.concatI32(index)
    let transaction = new PaymentsEscrowTransaction(transactionId)
    let payer = createOrLoadPayer(event.params.payer)
    let receiver = createOrLoadReceiver(event.params.receiver)
    let escrow = createOrLoadEscrowAccount(event.params.payer, event.params.collector, event.params.receiver)

    escrow.balance = escrow.balance.plus(event.params.tokens)

    transaction.type = 'deposit'
    transaction.payer = payer.id
    transaction.collector = event.params.collector
    transaction.receiver = receiver.id
    transaction.amount = event.params.tokens
    transaction.escrowAccount = escrow.id
    transaction.transactionGroupId = event.transaction.hash
    transaction.timestamp = event.block.timestamp

    transaction.save()
    escrow.save()
}

export function handleWithdraw(event: Withdraw): void {
    let index = event.logIndex.toI32()
    let transactionId = event.transaction.hash.concatI32(index)
    let transaction = new PaymentsEscrowTransaction(transactionId)
    let payer = createOrLoadPayer(event.params.payer)
    let receiver = createOrLoadReceiver(event.params.receiver)
    let escrow = createOrLoadEscrowAccount(event.params.payer, event.params.collector, event.params.receiver)

    escrow.balance = escrow.balance.minus(event.params.tokens)
    escrow.totalAmountThawing = BIGINT_ZERO
    escrow.thawEndTimestamp = BIGINT_ZERO

    transaction.type = 'withdraw'
    transaction.payer = payer.id
    transaction.collector = event.params.collector
    transaction.receiver = receiver.id
    transaction.amount = event.params.tokens
    transaction.escrowAccount = escrow.id
    transaction.transactionGroupId = event.transaction.hash
    transaction.timestamp = event.block.timestamp

    transaction.save()
    escrow.save()
}

export function handleThaw(event: Thaw): void {
    let escrow = createOrLoadEscrowAccount(event.params.payer, event.params.collector, event.params.receiver)

    escrow.totalAmountThawing = event.params.tokens
    escrow.thawEndTimestamp = event.params.thawEndTimestamp
    escrow.save()
}

export function handleCancelThaw(event: CancelThaw): void {
    let escrow = createOrLoadEscrowAccount(event.params.payer, event.params.collector, event.params.receiver)
    escrow.totalAmountThawing = BIGINT_ZERO
    escrow.thawEndTimestamp = BIGINT_ZERO
    escrow.save()
}

export function handleEscrowCollected(event: EscrowCollected): void {
    let escrow = createOrLoadEscrowAccount(event.params.payer, event.params.collector, event.params.receiver)
    escrow.balance = escrow.balance.minus(event.params.tokens)
    escrow.save()
}

export function createOrLoadPayer(address: Address): Payer {
    let payer = Payer.load(address)
    if(payer == null) {
        payer = new Payer(address)
        payer.save()
    }
    return payer
}

export function createOrLoadReceiver(address: Address): Receiver {
    let receiver = Receiver.load(address)
    if(receiver == null) {
        receiver = new Receiver(address)
        receiver.save()
    }
    return receiver
}

export function createOrLoadEscrowAccount(payer: Address, collector: Address, receiver: Address): PaymentsEscrowAccount {
    let sender_receiver = payer.concat(collector).concat(receiver)
    let escrow = PaymentsEscrowAccount.load(sender_receiver)
    if(escrow == null) {
        escrow = new PaymentsEscrowAccount(sender_receiver)
        escrow.balance = BIGINT_ZERO
        escrow.thawEndTimestamp = BIGINT_ZERO
        escrow.totalAmountThawing = BIGINT_ZERO
        escrow.payer = payer
        escrow.collector = collector
        escrow.receiver = receiver
        escrow.save()
    }
    return escrow
}