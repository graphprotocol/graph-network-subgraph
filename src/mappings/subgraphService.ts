import { ethereum } from "@graphprotocol/graph-ts"
import { RewardsDestinationSet, ServiceProviderRegistered } from "../types/SubgraphService/SubgraphService"
import { createOrLoadProvision } from "./helpers/helpers"

export function handleServiceProviderRegistered(event: ServiceProviderRegistered): void {
    let decodedCalldata = ethereum.decode('(string,string,address)', event.params.data).toTuple()
    let provision = createOrLoadProvision(event.params.serviceProvider, event.address, event.block.timestamp)
    provision.url = decodedCalldata[0].toString()
    provision.geoHash = decodedCalldata[1].toString()
    provision.save()
}

export function handleRewardsDestinationSet(event: RewardsDestinationSet): void {
    let provision = createOrLoadProvision(event.params.indexer, event.address, event.block.timestamp)
    provision.rewardsDestination = event.params.rewardsDestination
    provision.save()
}
