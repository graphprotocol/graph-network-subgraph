import {Subgraph, GraphNetwork} from "../../generated/schema";
import {BigInt} from "@graphprotocol/graph-ts";


export function createSubgraph(subgraphID: string, timestamp: BigInt): Subgraph {
    let subgraph = new Subgraph(subgraphID)
    subgraph.createdAt = timestamp.toI32()
    subgraph.totalStake = BigInt.fromI32(0)
    subgraph.totalSubraphIndexingRewards = BigInt.fromI32(0)
    subgraph.totalSignaledGRT = BigInt.fromI32(0)
    subgraph.totalSignalMinted = BigInt.fromI32(0)
    subgraph.totalQueryFeesCollected = BigInt.fromI32(0)

    let graphNetwork = GraphNetwork.load("1");
    subgraph.reserveRatio = graphNetwork.defaultReserveRatio
    subgraph.save()

    return subgraph
}