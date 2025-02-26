import { BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts"
import { AllocationClosed, AllocationCreated, AllocationResized, IndexingRewardsCollected, QueryFeesCollected, RewardsDestinationSet, ServiceProviderRegistered } from "../types/SubgraphService/SubgraphService"
import { batchUpdateSubgraphSignalledTokens, calculatePricePerShare, createOrLoadEpoch, createOrLoadGraphNetwork, createOrLoadIndexerQueryFeePaymentAggregation, createOrLoadPaymentSource, createOrLoadProvision, createOrLoadSubgraphDeployment, joinID, updateDelegationExchangeRate } from "./helpers/helpers"
import { Allocation, GraphAccount, Indexer, PoiSubmission, SubgraphDeployment } from "../types/schema"
import { addresses } from "../../config/addresses"

export function handleServiceProviderRegistered(event: ServiceProviderRegistered): void {
    let decodedCalldata = ethereum.decode('(string,string,address)', event.params.data)
    if (decodedCalldata != null && decodedCalldata.kind == ethereum.ValueKind.TUPLE) {
        let tupleData = decodedCalldata.toTuple()
        let provision = createOrLoadProvision(event.params.serviceProvider, event.address, event.block.timestamp)
        provision.url = tupleData[0].toString()
        provision.geoHash = tupleData[1].toString()
        provision.save()
    } else {
        log.warning("ServiceProviderRegistered failed to decode: {}", [event.params.data.toHexString()])
    }
}

export function handleRewardsDestinationSet(event: RewardsDestinationSet): void {
    let provision = createOrLoadProvision(event.params.indexer, event.address, event.block.timestamp)
    provision.rewardsDestination = event.params.rewardsDestination
    provision.save()
}

export function handleAllocationCreated(event: AllocationCreated): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    let subgraphDeploymentID = event.params.subgraphDeploymentId.toHexString()
    let indexerID = event.params.indexer.toHexString()
    let allocationID = event.params.allocationId.toHexString()

    // update indexer
    let indexer = Indexer.load(indexerID)!
    indexer.allocatedTokens = indexer.allocatedTokens.plus(event.params.tokens)
    indexer.totalAllocationCount = indexer.totalAllocationCount.plus(BigInt.fromI32(1))
    indexer.allocationCount = indexer.allocationCount + 1
    indexer.save()

    // update provision
    let provision = createOrLoadProvision(event.params.indexer, event.address, event.block.timestamp)
    provision.tokensAllocated = provision.tokensAllocated.plus(event.params.tokens)
    provision.totalAllocationCount = provision.totalAllocationCount.plus(BigInt.fromI32(1))
    provision.allocationCount = provision.allocationCount + 1
    provision.save()

    // update graph network
    graphNetwork.totalTokensAllocated = graphNetwork.totalTokensAllocated.plus(event.params.tokens)
    graphNetwork.allocationCount = graphNetwork.allocationCount + 1
    graphNetwork.activeAllocationCount = graphNetwork.activeAllocationCount + 1
    graphNetwork.save()

    // update subgraph deployment
    let deployment = createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp)
    deployment.stakedTokens = deployment.stakedTokens.plus(event.params.tokens)
    deployment.save()

    // create allocation
    let allocation = new Allocation(allocationID)
    allocation.indexer = indexerID
    allocation.provision = provision.id
    allocation.creator = event.transaction.from
    allocation.activeForIndexer = indexerID
    allocation.activeForProvision = provision.id
    allocation.subgraphDeployment = subgraphDeploymentID
    allocation.allocatedTokens = event.params.tokens
    allocation.effectiveAllocation = BigInt.fromI32(0)
    allocation.createdAtEpoch = event.params.currentEpoch.toI32()
    allocation.createdAtBlockHash = event.block.hash
    allocation.createdAtBlockNumber = (
        addresses.isL1 ? event.block.number : graphNetwork.currentL1BlockNumber!
    ).toI32()
    allocation.queryFeesCollected = BigInt.fromI32(0)
    allocation.queryFeeRebates = BigInt.fromI32(0)
    allocation.distributedRebates = BigInt.fromI32(0)
    allocation.curatorRewards = BigInt.fromI32(0)
    allocation.indexingRewards = BigInt.fromI32(0)
    allocation.indexingIndexerRewards = BigInt.fromI32(0)
    allocation.indexingDelegatorRewards = BigInt.fromI32(0)
    allocation.delegationFees = BigInt.fromI32(0)
    allocation.status = 'Active'
    allocation.totalReturn = BigDecimal.fromString('0')
    allocation.annualizedReturn = BigDecimal.fromString('0')
    allocation.createdAt = event.block.timestamp.toI32()
    allocation.indexingRewardCutAtStart = provision.indexingRewardsCut.toI32()
    allocation.indexingRewardEffectiveCutAtStart = provision.indexingRewardsCut.toBigDecimal()
    allocation.queryFeeCutAtStart = provision.queryFeeCut.toI32()
    allocation.queryFeeEffectiveCutAtStart = provision.queryFeeCut.toBigDecimal()
    allocation.save()
}

export function handleAllocationClosed(event: AllocationClosed): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    let indexerID = event.params.indexer.toHexString()
    let allocationID = event.params.allocationId.toHexString()

    // update indexer
    let indexer = Indexer.load(indexerID)!
    const indexerAccount = GraphAccount.load(indexer.account)!
    const closedByIndexer = event.transaction.from == event.params.indexer
    const closedByOperator = indexerAccount.operators.includes(event.transaction.from.toHexString())

    if (!closedByIndexer && !closedByOperator) {
        indexer.forcedClosures = indexer.forcedClosures + 1
    }
    indexer.allocatedTokens = indexer.allocatedTokens.minus(event.params.tokens)
    indexer.allocationCount = indexer.allocationCount - 1
    indexer.save()

    // update provision
    let provision = createOrLoadProvision(event.params.indexer, event.address, event.block.timestamp)
    provision.tokensAllocated = provision.tokensAllocated.minus(event.params.tokens)
    provision.allocationCount = provision.allocationCount - 1
    provision.save()

    // update allocation
    let allocation = Allocation.load(allocationID)!
    allocation.poolClosedIn = graphNetwork.currentEpoch.toString()
    allocation.activeForIndexer = null
    allocation.closedAtEpoch = graphNetwork.currentEpoch
    allocation.closedAtBlockHash = event.block.hash
    allocation.closedAtBlockNumber = (
        addresses.isL1 ? event.block.number : graphNetwork.currentL1BlockNumber!
    ).toI32()
    allocation.status = 'Closed'
    allocation.closedAt = event.block.timestamp.toI32()
    allocation.indexingRewardCutAtStart = provision.indexingRewardsCut.toI32()
    allocation.indexingRewardEffectiveCutAtStart = provision.indexingRewardsCut.toBigDecimal()
    allocation.queryFeeCutAtStart = provision.queryFeeCut.toI32()
    allocation.queryFeeEffectiveCutAtStart = provision.queryFeeCut.toBigDecimal()
    allocation.save()

    // update epoch - We do it here to have more epochs created, instead of seeing none created
    // Likely this problem would go away with a live network with long epochs
    let epoch = createOrLoadEpoch(
        addresses.isL1 ? event.block.number : graphNetwork.currentL1BlockNumber!,
    )
    epoch.save()

    let subgraphDeploymentID = event.params.subgraphDeploymentId.toHexString()
    let deployment = createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp)
    deployment.stakedTokens = deployment.stakedTokens.minus(event.params.tokens)
    deployment.save()

    // update graph network
    graphNetwork.activeAllocationCount = graphNetwork.activeAllocationCount - 1
    graphNetwork.totalTokensAllocated = graphNetwork.totalTokensAllocated.minus(event.params.tokens)
    graphNetwork.save()
}

export function handleAllocationResized(event: AllocationResized): void {
    let allocationID = event.params.allocationId.toHexString()
    let indexerID = event.params.indexer.toHexString()
    let diffTokens = event.params.newTokens.minus(event.params.oldTokens)

    // update indexer
    let indexer = Indexer.load(indexerID)!
    indexer.allocatedTokens = indexer.allocatedTokens.plus(diffTokens)
    indexer.save()

    // update provision
    let provision = createOrLoadProvision(event.params.indexer, event.address, event.block.timestamp)
    provision.tokensAllocated = provision.tokensAllocated.plus(diffTokens)
    provision.save()

    // update allocation
    let allocation = Allocation.load(allocationID)!
    allocation.allocatedTokens = event.params.newTokens
    allocation.save()
}

export function handleIndexingRewardsCollected(event: IndexingRewardsCollected): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    let indexerID = event.params.indexer.toHexString()
    let allocationID = event.params.allocationId.toHexString()

    // update indexer
    let indexer = Indexer.load(indexerID)!
    indexer.rewardsEarned = indexer.rewardsEarned.plus(event.params.tokensRewards)
    indexer.indexerIndexingRewards = indexer.indexerIndexingRewards.plus(event.params.tokensIndexerRewards)
    indexer.delegatorIndexingRewards = indexer.delegatorIndexingRewards.plus(event.params.tokensDelegationRewards)
    indexer.save()

    // update provision
    let provision = createOrLoadProvision(event.params.indexer, event.address, event.block.timestamp)
    provision.rewardsEarned = provision.rewardsEarned.plus(event.params.tokensRewards)
    provision.indexerIndexingRewards = provision.indexerIndexingRewards.plus(event.params.tokensIndexerRewards)
    provision.delegatorIndexingRewards = provision.delegatorIndexingRewards.plus(event.params.tokensDelegationRewards)
    // No need to update delegated tokens, as that happens in handleTokensToDelegationPoolAdded
    provision.save()

    // update allocation
    let allocation = Allocation.load(allocationID)!
    allocation.indexingRewards = allocation.indexingRewards.plus(event.params.tokensRewards)
    allocation.indexingIndexerRewards = allocation.indexingIndexerRewards.plus(event.params.tokensIndexerRewards)
    allocation.indexingDelegatorRewards = allocation.indexingDelegatorRewards.plus(
        event.params.tokensDelegationRewards,
    )
    allocation.save()

    // Create PoI submission
    let poiSubmission = new PoiSubmission(joinID([event.transaction.hash.toHexString(), event.logIndex.toString()]))
    poiSubmission.allocation = allocation.id
    poiSubmission.poi = event.params.poi
    poiSubmission.submittedAtEpoch = event.params.currentEpoch.toI32()
    poiSubmission.save()

    // Update epoch
    let epoch = createOrLoadEpoch((addresses.isL1 ? event.block.number : graphNetwork.currentL1BlockNumber!))
    epoch.totalRewards = epoch.totalRewards.plus(event.params.tokensRewards)
    epoch.totalIndexerRewards = epoch.totalIndexerRewards.plus(event.params.tokensIndexerRewards)
    epoch.totalDelegatorRewards = epoch.totalDelegatorRewards.plus(event.params.tokensDelegationRewards)
    epoch.save()

    // update subgraph deployment
    let subgraphDeploymentID = allocation.subgraphDeployment
    let subgraphDeployment = createOrLoadSubgraphDeployment(
        subgraphDeploymentID,
        event.block.timestamp,
    )
    subgraphDeployment.indexingRewardAmount = subgraphDeployment.indexingRewardAmount.plus(
        event.params.tokensRewards,
    )
    subgraphDeployment.indexingIndexerRewardAmount = subgraphDeployment.indexingIndexerRewardAmount.plus(
        event.params.tokensIndexerRewards,
    )
    subgraphDeployment.indexingDelegatorRewardAmount = subgraphDeployment.indexingDelegatorRewardAmount.plus(
        event.params.tokensDelegationRewards,
    )
    subgraphDeployment.save()

    // update graph network
    graphNetwork.totalIndexingRewards = graphNetwork.totalIndexingRewards.plus(event.params.tokensRewards)
    graphNetwork.totalIndexingIndexerRewards = graphNetwork.totalIndexingIndexerRewards.plus(
        event.params.tokensIndexerRewards,
    )
    graphNetwork.totalIndexingDelegatorRewards = graphNetwork.totalIndexingDelegatorRewards.plus(
        event.params.tokensDelegationRewards,
    )
    // No need to update delegated tokens, as that happens in handleTokensToDelegationPoolAdded
    graphNetwork.save()
}

export function handleQueryFeesCollected(event: QueryFeesCollected): void {
    // To Do

    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    let subgraphDeploymentID = event.params.subgraphDeploymentId.toHexString()
    let indexerID = event.params.serviceProvider.toHexString()
    let allocationID = event.params.allocationId.toHexString()
    let paymentAddress = event.params.payer

    // update indexer
    let indexer = Indexer.load(indexerID)!
    indexer.queryFeesCollected = indexer.queryFeesCollected.plus(event.params.tokensCollected)
    indexer.save()

    // update provision
    let provision = createOrLoadProvision(event.params.serviceProvider, event.address, event.block.timestamp)
    provision.queryFeesCollected = provision.queryFeesCollected.plus(event.params.tokensCollected)
    provision.save()

    // Replicate for payment source specific aggregation
    let paymentAggregation = createOrLoadIndexerQueryFeePaymentAggregation(paymentAddress, event.params.serviceProvider)
    paymentAggregation.queryFeesCollected = paymentAggregation.queryFeesCollected.plus(event.params.tokensCollected)
    paymentAggregation.save()

    // update allocation
    let allocation = Allocation.load(allocationID)!
    allocation.queryFeesCollected = allocation.queryFeesCollected.plus(event.params.tokensCollected)
    allocation.curatorRewards = allocation.curatorRewards.plus(event.params.tokensCurators)
    allocation.save()

    // Update epoch
    let epoch = createOrLoadEpoch(
        addresses.isL1 ? event.block.number : graphNetwork.currentL1BlockNumber!,
    )
    epoch.totalQueryFees = epoch.totalQueryFees.plus(event.params.tokensCollected).plus(event.params.tokensCurators)
    epoch.queryFeesCollected = epoch.queryFeesCollected.plus(event.params.tokensCollected)
    epoch.curatorQueryFees = epoch.curatorQueryFees.plus(event.params.tokensCurators)
    epoch.save()

    // update subgraph deployment
    let deployment = SubgraphDeployment.load(subgraphDeploymentID)!
    deployment.queryFeesAmount = deployment.queryFeesAmount.plus(event.params.tokensCollected)
    deployment.signalledTokens = deployment.signalledTokens.plus(event.params.tokensCurators)
    deployment.curatorFeeRewards = deployment.curatorFeeRewards.plus(event.params.tokensCurators)
    deployment.pricePerShare = calculatePricePerShare(deployment as SubgraphDeployment)
    deployment.save()

    batchUpdateSubgraphSignalledTokens(deployment as SubgraphDeployment)

    // update graph network
    graphNetwork.totalQueryFees = graphNetwork.totalQueryFees.plus(event.params.tokensCollected).plus(event.params.tokensCurators)
    graphNetwork.totalIndexerQueryFeesCollected = graphNetwork.totalIndexerQueryFeesCollected.plus(
        event.params.tokensCollected,
    )
    graphNetwork.totalCuratorQueryFees = graphNetwork.totalCuratorQueryFees.plus(
        event.params.tokensCurators,
    )
    graphNetwork.save()

    // Replicate for payment source specific data
    let paymentSource = createOrLoadPaymentSource(paymentAddress)
    paymentSource.totalQueryFees = paymentSource.totalQueryFees.plus(event.params.tokensCollected).plus(event.params.tokensCurators)
    paymentSource.totalIndexerQueryFeesCollected = paymentSource.totalIndexerQueryFeesCollected.plus(
        event.params.tokensCollected,
    )
    paymentSource.totalCuratorQueryFees = paymentSource.totalCuratorQueryFees.plus(
        event.params.tokensCurators,
    )
    paymentSource.save()
}
