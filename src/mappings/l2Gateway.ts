import { WithdrawalInitiated } from '../types/L1GraphTokenGateway/L2GraphTokenGateway'
import { GraphNetwork } from '../types/schema'

export function handleWithdrawalInitiated(event: WithdrawalInitiated): void {
  let graphNetwork = GraphNetwork.load('1')!
  graphNetwork.totalGRTWithdrawn = graphNetwork.totalGRTWithdrawn.plus(event.params.amount)
  graphNetwork.save()
}
