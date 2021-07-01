import { Address, BigDecimal, BigInt, ByteArray } from '@graphprotocol/graph-ts'
import {
  Indexer,
  Allocation,
  GraphNetwork,
  SubgraphDeployment,
  Dispute,
  Attestation,
} from '../types/schema'
import {
  ParameterUpdated,
  QueryDisputeCreated,
  IndexingDisputeCreated,
  DisputeRejected,
  DisputeAccepted,
  DisputeDrawn,
  DisputeLinked,
  DisputeManager,
} from '../types/DisputeManager/DisputeManager'
import { DisputeManagerStitched } from '../types/DisputeManager/DisputeManagerStitched'

// This handles  Single query and Conflicting disputes
export function handleQueryDisputeCreated(event: QueryDisputeCreated): void {
  let id = event.params.disputeID.toHexString()
  let dispute = new Dispute(id)
  dispute.subgraphDeployment = event.params.subgraphDeploymentID.toHexString()
  dispute.fisherman = event.params.fisherman.toHexString()
  dispute.deposit = event.params.tokens
  dispute.createdAt = event.block.timestamp.toI32()
  dispute.status = 'Undecided'
  dispute.tokensSlashed = BigDecimal.fromString('0')
  dispute.tokensRewarded = BigInt.fromI32(0)
  dispute.closedAt = 0
  dispute.type = 'SingleQuery' // It starts off as single query, but if it gets linked, it is updated to Conflicting. The events emitted are QueryDisputeCreated 1, QueryDisputeCreated 2, DisputeLinked

  dispute.indexer = event.params.indexer.toHexString()

  let attestationData = event.params.attestation.toHexString()
  let request = '0x'.concat(attestationData.slice(2, 66))
  let response = '0x'.concat(attestationData.slice(66, 130))
  let attestation = new Attestation(request.concat('-').concat(response))
  let v = attestationData.slice(194, 196)
  let r = attestationData.slice(196, 260)
  let s = attestationData.slice(260, 324)
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
  let allocation = Allocation.load(event.params.allocationID.toHexString())
  let id = event.params.disputeID.toHexString()
  let dispute = new Dispute(id)
  dispute.subgraphDeployment = allocation.subgraphDeployment
  dispute.fisherman = event.params.fisherman.toHexString()
  dispute.deposit = event.params.tokens
  dispute.createdAt = event.block.timestamp.toI32()
  dispute.status = 'Undecided'
  dispute.tokensSlashed = BigDecimal.fromString('0')
  dispute.tokensRewarded = BigInt.fromI32(0)
  dispute.type = 'Indexing'
  dispute.indexer = event.params.indexer.toHexString()
  dispute.allocation = allocation.id
  dispute.closedAt = 0
  dispute.save()
}

export function handleDisputeAccepted(event: DisputeAccepted): void {
  let id = event.params.disputeID.toHexString()
  let dispute = Dispute.load(id)
  dispute.status = 'Accepted'
  dispute.tokensRewarded = event.params.tokens.minus(dispute.deposit) // See event, it adds them
  dispute.closedAt = event.block.timestamp.toI32()

  // TODO in next contract launch
  // don't call directly to contract, it will be in the subgraph when we launch new
  // contracts, since all params emit events in constructors there
  let disputeManager = DisputeManager.bind(event.address)
  let fishermanRewardPercentage = disputeManager.fishermanRewardPercentage() // in ppm

  // The fisherman reward is a function of the total slashed tokens. Therefore
  // if fishermanReward is 10%, slashed reward should be 9x that --> (1,000,000 / 100,000) - 1 = 9
  // It must be done like this since the event only emits limited information
  // Note - there is an edge case bug here, where if fishermanReward% = 0, we can't get
  // the tokensSlashed. That is okay for now. There should always be a fisherman reward %
  let slashedRewardRatio =
    fishermanRewardPercentage == BigInt.fromI32(0)
      ? BigDecimal.fromString('0')
      : BigDecimal.fromString('1000000')
          .div(BigDecimal.fromString(fishermanRewardPercentage.toString()))
          .minus(BigDecimal.fromString('1'))
  dispute.tokensSlashed = dispute.tokensRewarded.toBigDecimal().times(slashedRewardRatio)
  dispute.save()

  if (dispute.linkedDispute != null) {
    let rejectedDispute = Dispute.load(dispute.linkedDispute)
    rejectedDispute.status = 'Rejected'
    rejectedDispute.closedAt = event.block.timestamp.toI32()
    rejectedDispute.save()
  }
}

// Note - it is impossible to call reject on a conflicting dispute, it is either draw or accept
// This is because if you accept 1 in a conflict, the other is rejected
export function handleDisputeRejected(event: DisputeRejected): void {
  let id = event.params.disputeID.toHexString()
  let dispute = Dispute.load(id)
  dispute.status = 'Rejected'
  dispute.closedAt = event.block.timestamp.toI32()
  dispute.save()
}

export function handleDisputeDrawn(event: DisputeDrawn): void {
  let id = event.params.disputeID.toHexString()
  let dispute = Dispute.load(id)
  dispute.status = 'Draw'
  dispute.closedAt = event.block.timestamp.toI32()
  dispute.save()

  if (dispute.linkedDispute != null) {
    let linkedDispute = Dispute.load(dispute.linkedDispute)
    linkedDispute.status = 'Draw'
    linkedDispute.closedAt = event.block.timestamp.toI32()
    linkedDispute.save()
  }
}

export function handleDisputeLinked(event: DisputeLinked): void {
  let id1 = event.params.disputeID1.toHexString()
  let id2 = event.params.disputeID2.toHexString()
  let dispute1 = Dispute.load(id1)
  let dispute2 = Dispute.load(id2)

  dispute1.linkedDispute = id2
  dispute1.type = 'Conflicting'
  dispute1.save()

  dispute2.linkedDispute = id1
  dispute2.type = 'Conflicting'
  dispute2.save()
}

/**
 * @dev handleParameterUpdated
 * - handlers updating all parameters
 */
export function handleParameterUpdated(event: ParameterUpdated): void {
  let parameter = event.params.param
  let graphNetwork = GraphNetwork.load('1')
  let disputeManager = DisputeManagerStitched.bind(event.address as Address)

  if (parameter == 'arbitrator') {
    graphNetwork.arbitrator = disputeManager.arbitrator()
  } else if (parameter == 'minimumDeposit') {
    graphNetwork.minimumDisputeDeposit = disputeManager.minimumDeposit()
  } else if (parameter == 'slashingPercentage') {
    let slashingPercentageResponse = disputeManager.try_slashingPercentage()
    if(!slashingPercentageResponse.reverted) {
      graphNetwork.querySlashingPercentage = slashingPercentageResponse.value.toI32()
      graphNetwork.indexingSlashingPercentage = slashingPercentageResponse.value.toI32()
      graphNetwork.slashingPercentage = slashingPercentageResponse.value.toI32()
    } else {
      let qryResponse = disputeManager.try_qrySlashingPercentage()
      let idxResponse = disputeManager.try_idxSlashingPercentage()
      graphNetwork.querySlashingPercentage = qryResponse.reverted ? graphNetwork.querySlashingPercentage : qryResponse.value.toI32()
      graphNetwork.indexingSlashingPercentage = idxResponse.reverted ? graphNetwork.indexingSlashingPercentage : idxResponse.value.toI32()
      graphNetwork.slashingPercentage = idxResponse.reverted ? graphNetwork.slashingPercentage : idxResponse.value.toI32()
    }
  } else if (parameter == 'qrySlashingPercentage') {
    let qryResponse = disputeManager.try_qrySlashingPercentage()
    graphNetwork.querySlashingPercentage = qryResponse.reverted ? graphNetwork.querySlashingPercentage : qryResponse.value.toI32()
  } else if (parameter == 'idxSlashingPercentage') {
    let idxResponse = disputeManager.try_idxSlashingPercentage()
    graphNetwork.indexingSlashingPercentage = idxResponse.reverted ? graphNetwork.indexingSlashingPercentage : idxResponse.value.toI32()
    graphNetwork.slashingPercentage = idxResponse.reverted ? graphNetwork.slashingPercentage : idxResponse.value.toI32()
  } else if (parameter == 'fishermanRewardPercentage') {
    graphNetwork.fishermanRewardPercentage = disputeManager.fishermanRewardPercentage().toI32()
  }
  graphNetwork.save()
}
