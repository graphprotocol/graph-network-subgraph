import { BigDecimal, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts"
import { AllocationClosed, AllocationCreated, AllocationResized, CurationCutSet, DelegationRatioSet, IndexingRewardsCollected, MaxPOIStalenessSet, ProvisionTokensRangeSet, QueryFeesCollected, RewardsDestinationSet, ServiceProviderRegistered, StakeToFeesRatioSet, ThawingPeriodRangeSet, VerifierCutRangeSet } from "../types/SubgraphService/SubgraphService"
import { batchUpdateSubgraphSignalledTokens, calculatePricePerShare, createOrLoadDataService, createOrLoadGraphNetwork, createOrLoadEpoch,createOrLoadIndexerQueryFeePaymentAggregation, createOrLoadPaymentSource, createOrLoadProvision, createOrLoadSubgraphDeployment, joinID, updateDelegationExchangeRate, calculateCapacities, loadGraphNetwork } from "./helpers/helpers"
import { Allocation, Indexer, PoiSubmission, SubgraphDeployment } from "../types/schema"
import { addresses } from "../../config/addresses"
import { tuplePrefixBytes } from "./helpers/decoder"
import { createOrLoadIndexer } from "./helpers/helpers"

export function handleServiceProviderRegistered(event: ServiceProviderRegistered): void {
    let graphNetwork = loadGraphNetwork()
    let decodedCalldata = ethereum.decode('(string,string,address)', tuplePrefixBytes(event.params.data))
    if (decodedCalldata != null && decodedCalldata.kind == ethereum.ValueKind.TUPLE) {
        let tupleData = decodedCalldata.toTuple()
        let url = tupleData[0].toString()
        let geoHash = tupleData[1].toString()
        let rewardsDestination = tupleData[2].toAddress()
        
        // Update provision
        let provision = createOrLoadProvision(event.params.serviceProvider, event.address, event.block.timestamp)
        provision.url = url
        provision.geoHash = geoHash
        provision.rewardsDestination = rewardsDestination
        provision.save()

        // Update indexer
        let indexer = createOrLoadIndexer(event.params.serviceProvider, event.block.timestamp, graphNetwork)
        indexer.url = url
        indexer.geoHash = geoHash
        indexer.rewardsDestination = rewardsDestination

        // Change legacy status in case the indexer was created before the Horizon upgrade
        indexer.isLegacy = false
        indexer.save()
    } else {
        log.warning("ServiceProviderRegistered failed to decode: {}", [event.params.data.toHexString()])
    }
}

export function handleRewardsDestinationSet(event: RewardsDestinationSet): void {
    let graphNetwork = loadGraphNetwork()
    // Update provision
    let provision = createOrLoadProvision(event.params.indexer, event.address, event.block.timestamp)
    provision.rewardsDestination = event.params.rewardsDestination
    provision.save()

    // Update indexer
    let indexer = createOrLoadIndexer(event.params.indexer, event.block.timestamp, graphNetwork)
    indexer.rewardsDestination = event.params.rewardsDestination
    indexer.save()
}

export function handleDelegationRatioSet(event: DelegationRatioSet): void {
    let dataService = createOrLoadDataService(event.address)
    dataService.delegationRatio = event.params.ratio.toI32()
    dataService.save()
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
    indexer = calculateCapacities(indexer as Indexer)
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

    // update data service
    let dataService = createOrLoadDataService(event.address)
    dataService.totalTokensAllocated = dataService.totalTokensAllocated.plus(event.params.tokens)
    dataService.save()

    // update subgraph deployment
    let deployment = createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp, graphNetwork)
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
    allocation.indexingRewardEffectiveCutAtStart = provision.indexingRewardEffectiveCut
    allocation.queryFeeCutAtStart = provision.queryFeeCut.toI32()
    allocation.queryFeeEffectiveCutAtStart = provision.queryFeeEffectiveCut
    allocation.poiCount = BigInt.fromI32(0)
    allocation.isLegacy = false
    allocation.save()
}

export function handleAllocationClosed(event: AllocationClosed): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    let indexerID = event.params.indexer.toHexString()
    let allocationID = event.params.allocationId.toHexString()

    // update indexer
    let indexer = Indexer.load(indexerID)!
    let allocation = Allocation.load(allocationID)!

    if (event.params.forceClosed) {
        indexer.forcedClosures = indexer.forcedClosures + 1
    }

    indexer.allocatedTokens = indexer.allocatedTokens.minus(event.params.tokens)
    indexer.allocationCount = indexer.allocationCount - 1
    indexer = calculateCapacities(indexer as Indexer)
    indexer.save()

    // update provision
    let provision = createOrLoadProvision(event.params.indexer, event.address, event.block.timestamp)
    provision.tokensAllocated = provision.tokensAllocated.minus(event.params.tokens)
    provision.allocationCount = provision.allocationCount - 1
    provision.save()

    // update allocation
    allocation.forceClosed = event.params.forceClosed
    allocation.poolClosedIn = graphNetwork.currentEpoch.toString()
    allocation.activeForIndexer = null
    allocation.closedAtEpoch = graphNetwork.currentEpoch
    allocation.closedAtBlockHash = event.block.hash
    allocation.closedAtBlockNumber = (
        addresses.isL1 ? event.block.number : graphNetwork.currentL1BlockNumber!
    ).toI32()
    allocation.status = 'Closed'
    allocation.closedAt = event.block.timestamp.toI32()
    allocation.indexingRewardCutAtClose = provision.indexingRewardsCut.toI32()
    allocation.indexingRewardEffectiveCutAtClose = provision.indexingRewardEffectiveCut
    allocation.queryFeeCutAtClose = provision.queryFeeCut.toI32()
    allocation.queryFeeEffectiveCutAtClose = provision.queryFeeEffectiveCut
    allocation.save()

    let subgraphDeploymentID = event.params.subgraphDeploymentId.toHexString()
    let deployment = createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp, graphNetwork)
    deployment.stakedTokens = deployment.stakedTokens.minus(event.params.tokens)
    deployment.save()

    // update graph network
    graphNetwork.activeAllocationCount = graphNetwork.activeAllocationCount - 1
    graphNetwork.totalTokensAllocated = graphNetwork.totalTokensAllocated.minus(event.params.tokens)
    graphNetwork.save()

    // update data service
    let dataService = createOrLoadDataService(event.address)
    dataService.totalTokensAllocated = dataService.totalTokensAllocated.minus(event.params.tokens)
    dataService.save()
}

export function handleAllocationResized(event: AllocationResized): void {
    let graphNetwork = loadGraphNetwork()
    let allocationID = event.params.allocationId.toHexString()
    let indexerID = event.params.indexer.toHexString()
    let diffTokens = event.params.newTokens.minus(event.params.oldTokens)

    // update indexer
    let indexer = Indexer.load(indexerID)!
    indexer.allocatedTokens = indexer.allocatedTokens.plus(diffTokens)
    indexer = calculateCapacities(indexer as Indexer)
    indexer.save()

    // update provision
    let provision = createOrLoadProvision(event.params.indexer, event.address, event.block.timestamp)
    provision.tokensAllocated = provision.tokensAllocated.plus(diffTokens)
    provision.save()

    // update allocation
    let allocation = Allocation.load(allocationID)!
    allocation.allocatedTokens = event.params.newTokens
    allocation.save()

    // update data service
    let dataService = createOrLoadDataService(event.address)
    dataService.totalTokensAllocated = dataService.totalTokensAllocated.plus(diffTokens)
    dataService.save()

    // update subgraph deployment
    let subgraphDeploymentID = allocation.subgraphDeployment
    let deployment = createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp, graphNetwork)
    deployment.stakedTokens = deployment.stakedTokens.plus(diffTokens)
    deployment.save()

    // update graph network
    graphNetwork.totalTokensAllocated = graphNetwork.totalTokensAllocated.plus(diffTokens)
    graphNetwork.save()
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
    allocation.poiCount = allocation.poiCount!.plus(BigInt.fromI32(1))
    allocation.save()

    // Decode poi metadata
    let poiBlockNumber = 0
    let poiIndexingStatus = 0 // 0 is unknown, 1 is healthy, 2 is unhealthy, 3 is failed
    let publicPoi = Bytes.fromHexString('0x')
    let poiMetadataDecoded = false
    
    let poiMetadata = ethereum.decode('(uint256,bytes32,uint8,uint8,uint256)', event.params.poiMetadata)
    if (poiMetadata != null && poiMetadata.kind == ethereum.ValueKind.TUPLE) {
        poiMetadataDecoded = true

        let tupleData = poiMetadata.toTuple()
        poiBlockNumber = tupleData[0].toI32()
        publicPoi = tupleData[1].toBytes()
        poiIndexingStatus = tupleData[2].toI32()
        
        // TODO: implement error code handling
        // let errorCode = tupleData[3].toBigInt()
        // let errorBlockNumber = tupleData[4].toBigInt()
    } else {
        log.error("IndexingRewardsCollected failed to decode poi metadata: {}", [event.params.poiMetadata.toHexString()])
    }

    // Create PoI submission
    let poiSubmission = new PoiSubmission(joinID([event.transaction.hash.toHexString(), event.logIndex.toString()]))
    poiSubmission.allocation = allocation.id
    poiSubmission.poi = event.params.poi
    poiSubmission.publicPoi = publicPoi
    poiSubmission.submittedAtEpoch = event.params.currentEpoch.toI32()
    poiSubmission.presentedAtTimestamp = event.block.timestamp.toI32()
    poiSubmission.indexingStatus = poiIndexingStatus
    poiSubmission.blockNumber = poiBlockNumber
    poiSubmission.metadataDecoded = poiMetadataDecoded
    poiSubmission.save()

    // Update latest POI in allocation
    allocation.poi = event.params.poi
    allocation.latestPoiPresentedAt = event.block.timestamp.toI32()
    allocation.save()

    // Update epoch
    let epoch = createOrLoadEpoch(addresses.isL1 ? event.block.number : graphNetwork.currentL1BlockNumber!, graphNetwork)
    epoch.totalRewards = epoch.totalRewards.plus(event.params.tokensRewards)
    epoch.totalIndexerRewards = epoch.totalIndexerRewards.plus(event.params.tokensIndexerRewards)
    epoch.totalDelegatorRewards = epoch.totalDelegatorRewards.plus(event.params.tokensDelegationRewards)
    epoch.save()

    // update subgraph deployment
    let subgraphDeploymentID = allocation.subgraphDeployment
    let subgraphDeployment = createOrLoadSubgraphDeployment(
        subgraphDeploymentID,
        event.block.timestamp,
        graphNetwork,
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
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
    let subgraphDeploymentID = event.params.subgraphDeploymentId.toHexString()
    let indexerID = event.params.serviceProvider.toHexString()
    let allocationID = event.params.allocationId.toHexString()
    let paymentAddress = event.params.payer

    // update provision
    let provision = createOrLoadProvision(event.params.serviceProvider, event.address, event.block.timestamp)

    let delegationPoolQueryFees =
        provision.delegatedTokens == BigInt.fromI32(0)
            ? event.params.tokensCollected
            : event.params.tokensCollected
                .times(provision.queryFeeCut)
                .div(BigInt.fromI32(1000000))
    let indexerQueryFees = event.params.tokensCollected.minus(delegationPoolQueryFees)

    provision.queryFeesCollected = provision.queryFeesCollected.plus(event.params.tokensCollected)
    provision.indexerQueryFees = provision.indexerQueryFees.plus(indexerQueryFees)
    provision.delegatorQueryFees = provision.delegatorQueryFees.plus(delegationPoolQueryFees)
    provision.save()

    // update indexer
    let indexer = Indexer.load(indexerID)!
    indexer.queryFeesCollected = indexer.queryFeesCollected.plus(event.params.tokensCollected)
    indexer.queryFeeRebates = indexer.queryFeeRebates.plus(indexerQueryFees)
    indexer.delegatorQueryFees = indexer.delegatorQueryFees.plus(delegationPoolQueryFees)
    indexer.save()

    // Replicate for payment source specific aggregation
    let paymentAggregation = createOrLoadIndexerQueryFeePaymentAggregation(paymentAddress, event.params.serviceProvider)
    paymentAggregation.queryFeesCollected = paymentAggregation.queryFeesCollected.plus(event.params.tokensCollected)
    paymentAggregation.queryFeeRebates = paymentAggregation.queryFeeRebates.plus(indexerQueryFees)
    paymentAggregation.delegatorQueryFees = paymentAggregation.delegatorQueryFees.plus(delegationPoolQueryFees)
    paymentAggregation.save()

    // update allocation
    let allocation = Allocation.load(allocationID)!
    allocation.queryFeesCollected = allocation.queryFeesCollected.plus(event.params.tokensCollected)
    allocation.curatorRewards = allocation.curatorRewards.plus(event.params.tokensCurators)
    allocation.queryFeeRebates = allocation.queryFeeRebates.plus(indexerQueryFees)
    allocation.distributedRebates = allocation.distributedRebates.plus(event.params.tokensCollected)
    allocation.delegationFees = allocation.delegationFees.plus(delegationPoolQueryFees)
    allocation.save()

    // Update epoch
    let epoch = createOrLoadEpoch(
        addresses.isL1 ? event.block.number : graphNetwork.currentL1BlockNumber!,
        graphNetwork
    )
    epoch.totalQueryFees = epoch.totalQueryFees.plus(event.params.tokensCollected).plus(event.params.tokensCurators)
    epoch.queryFeesCollected = epoch.queryFeesCollected.plus(event.params.tokensCollected)
    epoch.curatorQueryFees = epoch.curatorQueryFees.plus(event.params.tokensCurators)
    epoch.queryFeeRebates = epoch.queryFeeRebates.plus(event.params.tokensCollected)
    epoch.save()

    // update subgraph deployment
    let deployment = SubgraphDeployment.load(subgraphDeploymentID)!
    deployment.queryFeesAmount = deployment.queryFeesAmount.plus(event.params.tokensCollected)
    deployment.signalledTokens = deployment.signalledTokens.plus(event.params.tokensCurators)
    deployment.curatorFeeRewards = deployment.curatorFeeRewards.plus(event.params.tokensCurators)
    deployment.pricePerShare = calculatePricePerShare(deployment as SubgraphDeployment)
    deployment.queryFeeRebates = deployment.queryFeeRebates.plus(indexerQueryFees)
    deployment.delegatorsQueryFeeRebates = deployment.delegatorsQueryFeeRebates.plus(delegationPoolQueryFees)
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
    graphNetwork.totalIndexerQueryFeeRebates = graphNetwork.totalIndexerQueryFeeRebates.plus(
        indexerQueryFees,
    )
    graphNetwork.totalDelegatorQueryFeeRebates = graphNetwork.totalDelegatorQueryFeeRebates.plus(
        delegationPoolQueryFees,
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
    paymentSource.totalIndexerQueryFeeRebates = paymentSource.totalIndexerQueryFeeRebates.plus(
        indexerQueryFees,
    )
    paymentSource.totalDelegatorQueryFeeRebates = paymentSource.totalDelegatorQueryFeeRebates.plus(
        delegationPoolQueryFees,
    )
    paymentSource.save()
}

export function handleCurationCutSet(event: CurationCutSet): void {
    let dataService = createOrLoadDataService(event.address)
    dataService.curationCut = event.params.curationCut
    dataService.save()
}

export function handleMaxPOIStalenessSet(event: MaxPOIStalenessSet): void {
    let dataService = createOrLoadDataService(event.address)
    dataService.maxPOIStaleness = event.params.maxPOIStaleness
    dataService.save()
}

export function handleStakeToFeesRatioSet(event: StakeToFeesRatioSet): void {
    let dataService = createOrLoadDataService(event.address)
    dataService.stakeToFeesRatio = event.params.ratio
    dataService.save()
}

export function handleProvisionTokensRangeSet(event: ProvisionTokensRangeSet): void {
    let dataService = createOrLoadDataService(event.address)
    dataService.minimumProvisionTokens = event.params.min
    dataService.maximumProvisionTokens = event.params.max
    dataService.save()
}

export function handleVerifierCutRangeSet(event: VerifierCutRangeSet): void {
    let dataService = createOrLoadDataService(event.address)
    dataService.minimumVerifierCut = event.params.min
    dataService.maximumVerifierCut = event.params.max
    dataService.save()
}

export function handleThawingPeriodRangeSet(event: ThawingPeriodRangeSet): void {
    let dataService = createOrLoadDataService(event.address)
    dataService.minimumThawingPeriod = event.params.min
    dataService.maximumThawingPeriod = event.params.max
    dataService.save()
}
