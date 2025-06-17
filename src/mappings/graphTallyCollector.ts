import { Address, BigInt } from '@graphprotocol/graph-ts'
import { PaymentsEscrowTransaction, Signer } from '../types/schema'
import { 
    SignerAuthorized,
    SignerThawing,
    SignerThawCanceled,
    SignerRevoked,
    PaymentCollected
} from '../types/GraphTallyCollector/GraphTallyCollector'
import { createOrLoadEscrowAccount, createOrLoadPayer, createOrLoadReceiver } from './paymentsEscrow'

const BIGINT_ZERO = BigInt.fromI32(0)
const ADDRESS_ZERO = Address.fromString('0x0000000000000000000000000000000000000000')

export function handleSignerAuthorized(event: SignerAuthorized): void {
    let signer = createOrLoadSigner(event.params.signer)
    signer.isAuthorized = true
    signer.payer = event.params.authorizer
    signer.save()
}

export function handleSignerThawing(event: SignerThawing): void {
    let signer = createOrLoadSigner(event.params.signer)
    signer.payer = event.params.authorizer
    signer.isAuthorized = true
    signer.thawEndTimestamp = event.params.thawEndTimestamp
    signer.save()
}

export function handleSignerThawCanceled(event: SignerThawCanceled): void {
    let signer = createOrLoadSigner(event.params.signer)
    signer.payer = event.params.authorizer
    signer.isAuthorized = true
    signer.thawEndTimestamp = BIGINT_ZERO
    signer.save()
}

export function handleSignerRevoked(event: SignerRevoked): void {
    let signer = createOrLoadSigner(event.params.signer)
    signer.payer = event.params.authorizer
    signer.isAuthorized = false
    signer.thawEndTimestamp = BIGINT_ZERO
    signer.save()
}

export function handlePaymentCollected(event: PaymentCollected): void {
    let index = event.logIndex.toI32()
    let transactionId = event.transaction.hash.concatI32(index)
    let transaction = new PaymentsEscrowTransaction(transactionId)

    let payer = createOrLoadPayer(event.params.payer)
    let receiver = createOrLoadReceiver(event.params.receiver)
    let escrow = createOrLoadEscrowAccount(event.params.payer, event.params.dataService, event.params.receiver)
    escrow.balance = escrow.balance.minus(event.params.tokens)

    transaction.type = 'redeem'
    transaction.payer = payer.id
    transaction.collector = event.params.dataService
    transaction.receiver = receiver.id
    transaction.allocationId = Address.fromBytes(event.params.collectionId)
    transaction.amount = event.params.tokens
    transaction.escrowAccount = escrow.id
    transaction.transactionGroupId = event.transaction.hash
    transaction.timestamp = event.block.timestamp

    transaction.save()
    escrow.save()
}

export function createOrLoadSigner(address: Address): Signer {
    let signer = Signer.load(address)
    if(signer == null) {
        signer = new Signer(address)
        signer.isAuthorized = false
        signer.payer = ADDRESS_ZERO
        signer.thawEndTimestamp = BIGINT_ZERO
        signer.save()
    }
    return signer
}