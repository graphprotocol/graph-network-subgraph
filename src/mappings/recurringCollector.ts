import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts'
import { IndexingAgreement } from '../types/schema'
import {
  AgreementAccepted,
  AgreementCanceled,
  AgreementUpdated,
  RCACollected,
} from '../types/RecurringCollector/RecurringCollector'
import { SubgraphService } from '../types/RecurringCollector/SubgraphService'
import { addresses } from '../../config/addresses'

const BIGINT_ZERO = BigInt.fromI32(0)
const BYTES_ZERO = Bytes.fromI32(0)

export function handleAgreementAccepted(event: AgreementAccepted): void {
  let agreement = new IndexingAgreement(event.params.agreementId)

  agreement.dataService = event.params.dataService
  agreement.payer = event.params.payer
  agreement.serviceProvider = event.params.serviceProvider
  agreement.state = 1 // Accepted
  agreement.acceptedAt = event.params.acceptedAt
  agreement.lastCollectionAt = event.params.acceptedAt
  agreement.endsAt = event.params.endsAt
  agreement.maxInitialTokens = event.params.maxInitialTokens
  agreement.maxOngoingTokensPerSecond = event.params.maxOngoingTokensPerSecond
  agreement.minSecondsPerCollection = event.params.minSecondsPerCollection.toI32()
  agreement.maxSecondsPerCollection = event.params.maxSecondsPerCollection.toI32()
  agreement.canceledAt = BIGINT_ZERO
  agreement.tokensCollected = BIGINT_ZERO

  // Get allocationId and subgraphDeploymentId from SubgraphService
  let subgraphService = SubgraphService.bind(Address.fromString(addresses.subgraphService))
  let iaResult = subgraphService.try_getIndexingAgreement(event.params.agreementId)
  if (!iaResult.reverted) {
    let allocationId = iaResult.value.agreement.allocationId
    agreement.allocationId = allocationId

    let allocResult = subgraphService.try_getAllocation(allocationId)
    if (!allocResult.reverted) {
      agreement.subgraphDeploymentId = allocResult.value.subgraphDeploymentId
    } else {
      agreement.subgraphDeploymentId = BYTES_ZERO
    }
  } else {
    agreement.allocationId = BYTES_ZERO
    agreement.subgraphDeploymentId = BYTES_ZERO
  }

  // Terms: tokensPerSecond and tokensPerEntityPerSecond come from decoded metadata.
  // Set to zero for now — will be populated when we add metadata decoding.
  agreement.tokensPerSecond = BIGINT_ZERO
  agreement.tokensPerEntityPerSecond = BIGINT_ZERO

  agreement.save()
}

export function handleAgreementCanceled(event: AgreementCanceled): void {
  let agreement = IndexingAgreement.load(event.params.agreementId)
  if (agreement == null) return

  // canceledBy: 0=ServiceProvider, 1=Payer, 2=ThirdParty
  if (event.params.canceledBy == 0) {
    agreement.state = 2 // CanceledByServiceProvider
  } else {
    agreement.state = 3 // CanceledByPayer
  }
  agreement.canceledAt = event.params.canceledAt
  agreement.save()
}

export function handleAgreementUpdated(event: AgreementUpdated): void {
  let agreement = IndexingAgreement.load(event.params.agreementId)
  if (agreement == null) return

  agreement.endsAt = event.params.endsAt
  agreement.maxInitialTokens = event.params.maxInitialTokens
  agreement.maxOngoingTokensPerSecond = event.params.maxOngoingTokensPerSecond
  agreement.minSecondsPerCollection = event.params.minSecondsPerCollection.toI32()
  agreement.maxSecondsPerCollection = event.params.maxSecondsPerCollection.toI32()
  agreement.save()
}

export function handleRCACollected(event: RCACollected): void {
  let agreement = IndexingAgreement.load(event.params.agreementId)
  if (agreement == null) return

  agreement.lastCollectionAt = event.block.timestamp
  agreement.tokensCollected = agreement.tokensCollected.plus(event.params.tokens)
  agreement.save()
}
