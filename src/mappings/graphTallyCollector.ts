import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts'
import { PaymentsEscrowTransaction, Signer, GraphTallyTokensCollected } from '../types/schema'
import { 
    SignerAuthorized,
    SignerThawing,
    SignerThawCanceled,
    SignerRevoked,
    PaymentCollected
} from '../types/GraphTallyCollector/GraphTallyCollector'
import { createOrLoadEscrowAccount, createOrLoadPayer, createOrLoadReceiver } from './paymentsEscrow'
import { addresses } from '../../config/addresses'

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
    let collector = Bytes.fromHexString(addresses.graphTallyCollector) as Bytes
    let escrow = createOrLoadEscrowAccount(event.params.payer, collector, event.params.receiver)
    let tokensCollected = createOrLoadGraphTallyTokensCollected(event.params.payer, event.params.receiver, event.params.collectionId)
    tokensCollected.tokens = tokensCollected.tokens.plus(event.params.tokens)

    transaction.type = 'redeem'
    transaction.payer = payer.id
    transaction.collector = event.params.dataService
    transaction.receiver = receiver.id
    transaction.allocationId = Address.fromBytes(Bytes.fromUint8Array(event.params.collectionId.slice(12)))
    transaction.amount = event.params.tokens
    transaction.escrowAccount = escrow.id
    transaction.transactionGroupId = event.transaction.hash
    transaction.timestamp = event.block.timestamp

    transaction.save()
    escrow.save()
    tokensCollected.save()
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

export function createOrLoadGraphTallyTokensCollected(payer: Address, receiver: Address, collectionId: Bytes): GraphTallyTokensCollected {
    let id = payer.concat(receiver).concat(collectionId)
    let tokensCollected = GraphTallyTokensCollected.load(id)
    if(tokensCollected == null) {
        tokensCollected = new GraphTallyTokensCollected(id)
        tokensCollected.payer = payer
        tokensCollected.receiver = receiver
        tokensCollected.collectionId = collectionId
        tokensCollected.tokens = BIGINT_ZERO
        tokensCollected.save()
    }
    return tokensCollected
}