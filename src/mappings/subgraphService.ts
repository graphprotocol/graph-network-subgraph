import { ethereum, ValueKind, log } from "@graphprotocol/graph-ts"
import { RewardsDestinationSet, ServiceProviderRegistered } from "../types/SubgraphService/SubgraphService"
import { createOrLoadProvision } from "./helpers/helpers"

export function handleServiceProviderRegistered(event: ServiceProviderRegistered): void {
    let decodedCalldata = ethereum.decode('(string,string,address)', event.params.data)
    if( decodedCalldata != null && decodedCalldata.kind == ethereum.ValueKind.TUPLE) {
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
