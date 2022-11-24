import { DepositInitiated } from '../types/L1GraphTokenGateway/L1GraphTokenGateway'
import { GraphNetwork } from '../types/schema'

export function handleDepositInitiated(event: DepositInitiated): void {
  let graphNetwork = GraphNetwork.load('1')!
  graphNetwork.totalGRTDeposited = graphNetwork.totalGRTDeposited.plus(event.params.amount)
  graphNetwork.save()
}
