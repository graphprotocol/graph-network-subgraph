import { addresses } from "../../config/addresses"
import { GraphPaymentCollected } from "../types/GraphPayments/GraphPayments"
import { createOrLoadEpoch, createOrLoadGraphNetwork, createOrLoadPaymentSource } from "./helpers/helpers"

export function handleGraphPaymentCollected(event: GraphPaymentCollected): void {
    let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)

    // Update epoch
    let epoch = createOrLoadEpoch(
        addresses.isL1 ? event.block.number : graphNetwork.currentL1BlockNumber!,
    )
    epoch.taxedQueryFees = epoch.taxedQueryFees.plus(event.params.tokensProtocol)
    epoch.save()

    // update graph network
    graphNetwork.totalTaxedQueryFees = graphNetwork.totalTaxedQueryFees.plus(event.params.tokensProtocol)
    graphNetwork.save()

    // Replicate for payment source specific data
    let paymentSource = createOrLoadPaymentSource(event.params.payer)
    paymentSource.totalTaxedQueryFees = paymentSource.totalTaxedQueryFees.plus(event.params.tokensProtocol)
    paymentSource.save()

    // Might want to add data service tax tracking here
}
