import { DepositInitiated } from '../types/L1GraphTokenGateway/L1GraphTokenGateway'
import { createOrLoadGraphNetwork } from './helpers'

export function handleDepositInitiated(event: DepositInitiated): void {
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.totalGRTDeposited = graphNetwork.totalGRTDeposited.plus(event.params.amount)
  graphNetwork.save()
}
