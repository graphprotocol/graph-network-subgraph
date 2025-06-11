import { Address, BigDecimal, BigInt, ByteArray, log } from '@graphprotocol/graph-ts'
import { Allocation, Dispute, Attestation } from '../types/schema'
import {
  QueryDisputeCreated,
  IndexingDisputeCreated,
  DisputeRejected,
  DisputeAccepted,
  DisputeDrawn,
  DisputeLinked,
  ArbitratorSet,
  FishermanRewardCutSet,
  MaxSlashingCutSet,
  DisputeCancelled,
  DisputePeriodSet,
  LegacyDisputeCreated,
} from '../types/HorizonDisputeManager/HorizonDisputeManager'
import { createOrLoadGraphNetwork } from './helpers/helpers'

// Define constants locally
const BIGINT_ZERO = BigInt.fromI32(0)
const BIGDECIMAL_ZERO = BigDecimal.fromString('0')
const PPM_DIVISOR = BigDecimal.fromString('1000000')
const ADDRESS_ZERO = Address.fromString('0x0000000000000000000000000000000000000000')

// Dispute Status constants
const STATUS_UNDECIDED = 'Undecided'
const STATUS_ACCEPTED = 'Accepted'
const STATUS_REJECTED = 'Rejected'
const STATUS_DRAWN = 'Draw'
const STATUS_CANCELLED = 'Cancelled'

// Dispute Type constants
const TYPE_SINGLE_QUERY = 'SingleQuery'
const TYPE_INDEXING = 'Indexing'
const TYPE_CONFLICTING = 'Conflicting'
const TYPE_LEGACY = 'Legacy'

// This handles  Single query and Conflicting disputes
export function handleQueryDisputeCreated(event: QueryDisputeCreated): void {
  let id = event.params.disputeId.toHexString()
  let dispute = new Dispute(id)
  dispute.subgraphDeployment = event.params.subgraphDeploymentId.toHexString()
  dispute.fisherman = event.params.fisherman.toHexString()
  dispute.deposit = event.params.tokens
  dispute.isLegacy = false
  dispute.createdAt = event.block.timestamp.toI32()
  dispute.cancellableAt = event.params.cancellableAt.toI32()
  dispute.status = STATUS_UNDECIDED
  dispute.tokensSlashed = BIGDECIMAL_ZERO
  dispute.tokensRewarded = BIGINT_ZERO
  dispute.tokensBurned = BIGDECIMAL_ZERO
  dispute.closedAt = 0
  dispute.type = TYPE_SINGLE_QUERY // It starts off as single query, but if it gets linked, it is updated to Conflicting. The events emitted are QueryDisputeCreated 1, QueryDisputeCreated 2, DisputeLinked

  dispute.indexer = event.params.indexer.toHexString()

  let attestationData = event.params.attestation.toHexString()
  let request = '0x'.concat(attestationData.slice(2, 66))
  let response = '0x'.concat(attestationData.slice(66, 130))
  let attestation = new Attestation(request.concat('-').concat(response))
  let r = attestationData.slice(194, 258)
  let s = attestationData.slice(258, 322)
  let v = attestationData.slice(322, 324)
  attestation.responseCID = response
  attestation.requestCID = request
  attestation.subgraphDeployment = dispute.subgraphDeployment
  attestation.v = ByteArray.fromHexString(v).toI32()
  attestation.r = '0x'.concat(r)
  attestation.s = '0x'.concat(s)
  attestation.save()

  dispute.attestation = attestation.id
  dispute.save()
}

// Just handles indexing disputes
export function handleIndexingDisputeCreated(event: IndexingDisputeCreated): void {
  let allocation = Allocation.load(event.params.allocationId.toHexString())!
  let id = event.params.disputeId.toHexString()
  let dispute = new Dispute(id)
  dispute.subgraphDeployment = allocation.subgraphDeployment
  dispute.fisherman = event.params.fisherman.toHexString()
  dispute.deposit = event.params.tokens
  dispute.isLegacy = false
  dispute.createdAt = event.block.timestamp.toI32()
  dispute.cancellableAt = event.params.cancellableAt.toI32()
  dispute.status = STATUS_UNDECIDED
  dispute.tokensSlashed = BigDecimal.fromString('0')
  dispute.tokensBurned = BigDecimal.fromString('0')
  dispute.tokensRewarded = BigInt.fromI32(0)
  dispute.type = TYPE_INDEXING
  dispute.indexer = event.params.indexer.toHexString()
  dispute.allocation = allocation.id
  dispute.closedAt = 0
  dispute.save()
}

export function handleLegacyDisputeCreated(event: LegacyDisputeCreated): void {
  let allocation = Allocation.load(event.params.allocationId.toHexString())!
  let id = event.params.disputeId.toHexString()
  let dispute = new Dispute(id)
  dispute.subgraphDeployment = allocation.subgraphDeployment
  dispute.fisherman = event.params.fisherman.toHexString()
  dispute.deposit = BigInt.fromString('0')
  dispute.isLegacy = true
  dispute.createdAt = event.block.timestamp.toI32()
  dispute.cancellableAt = 0 // Legacy disputes are not cancellable
  dispute.status = STATUS_UNDECIDED
  dispute.tokensSlashed = BigDecimal.fromString('0')
  dispute.tokensBurned = BigDecimal.fromString('0')
  dispute.tokensRewarded = BigInt.fromString('0')
  dispute.type = TYPE_LEGACY
  dispute.indexer = event.params.indexer.toHexString()
  dispute.allocation = allocation.id
  dispute.closedAt = 0
  dispute.save()
}

export function handleDisputeAccepted(event: DisputeAccepted): void {
  let id = event.params.disputeId.toHexString()
  let dispute = Dispute.load(id)!
  dispute.status = STATUS_ACCEPTED
  dispute.tokensRewarded = event.params.tokens.minus(dispute.deposit) // See event, it adds them
  dispute.closedAt = event.block.timestamp.toI32()

  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  let fishermanRewardPercentage = graphNetwork.fishermanRewardCut

  // The fisherman reward is a function of the total slashed tokens. Therefore
  // if fishermanReward is 10%, slashed reward should be 9x that --> (1,000,000 / 100,000) - 1 = 9
  // It must be done like this since the event only emits limited information
  // Note - there is an edge case bug here, where if fishermanReward% = 0, we can't get
  // the tokensSlashed. That is okay for now. There should always be a fisherman reward %
  let slashedRewardRatio =
    fishermanRewardPercentage == 0
      ? BigDecimal.fromString('0')
      : BigDecimal.fromString('1000000')
          .div(BigDecimal.fromString(fishermanRewardPercentage.toString()))
          .minus(BigDecimal.fromString('1'))
  dispute.tokensBurned = dispute.tokensRewarded.toBigDecimal().times(slashedRewardRatio)
  dispute.tokensSlashed = dispute.tokensRewarded.toBigDecimal().plus(dispute.tokensBurned)
  dispute.save()

  if (dispute.linkedDispute != null) {
    let rejectedDispute = Dispute.load(dispute.linkedDispute!)!
    rejectedDispute.status = STATUS_REJECTED
    rejectedDispute.closedAt = event.block.timestamp.toI32()
    rejectedDispute.save()
  }
}

// Note - it is impossible to call reject on a conflicting dispute, it is either draw or accept
// This is because if you accept 1 in a conflict, the other is rejected
export function handleDisputeRejected(event: DisputeRejected): void {
  let id = event.params.disputeId.toHexString()
  let dispute = Dispute.load(id)!
  dispute.status = STATUS_REJECTED
  dispute.closedAt = event.block.timestamp.toI32()
  dispute.save()
}

export function handleDisputeDrawn(event: DisputeDrawn): void {
  let id = event.params.disputeId.toHexString()
  let dispute = Dispute.load(id)!
  dispute.status = STATUS_DRAWN
  dispute.closedAt = event.block.timestamp.toI32()
  dispute.save()

  if (dispute.linkedDispute != null) {
    let linkedDispute = Dispute.load(dispute.linkedDispute!)!
    linkedDispute.status = STATUS_DRAWN
    linkedDispute.closedAt = event.block.timestamp.toI32()
    linkedDispute.save()
  }
}

export function handleDisputeLinked(event: DisputeLinked): void {
  let id1 = event.params.disputeId1.toHexString()
  let id2 = event.params.disputeId2.toHexString()
  let dispute1 = Dispute.load(id1)!
  let dispute2 = Dispute.load(id2)!

  dispute1.linkedDispute = id2
  dispute1.type = TYPE_CONFLICTING
  dispute1.save()

  dispute2.linkedDispute = id1
  dispute2.type = TYPE_CONFLICTING
  dispute2.save()
}


// Handles Horizon DisputeCancelled events
export function handleDisputeCancelled(event: DisputeCancelled): void {
  let disputeId = event.params.disputeId.toHexString()
  let dispute = Dispute.load(disputeId)!

  dispute.status = STATUS_CANCELLED
  dispute.closedAt = event.block.timestamp.toI32()
  dispute.save()
}

// Handles ArbitratorSet events
export function handleArbitratorSet(event: ArbitratorSet): void {
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.arbitrator = event.params.arbitrator
  graphNetwork.save()
}

// Handles FishermanRewardCutSet events
export function handleFishermanRewardCutSet(event: FishermanRewardCutSet): void {
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.fishermanRewardCut = event.params.fishermanRewardCut.toI32()
  graphNetwork.save()
}

// Handles MaxSlashingCutSet events
export function handleMaxSlashingCutSet(event: MaxSlashingCutSet): void {
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.maxSlashingCut = event.params.maxSlashingCut.toI32()
  graphNetwork.save()
}

// Handles DisputePeriodSet events
export function handleDisputePeriodSet(event: DisputePeriodSet): void {
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.disputePeriod = event.params.disputePeriod
  graphNetwork.save()
}

