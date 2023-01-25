import { WithdrawalInitiated } from '../types/L2GraphTokenGateway/L2GraphTokenGateway'
import { GraphNetwork } from '../types/schema'
import { createOrLoadGraphNetwork } from './helpers'

export function handleWithdrawalInitiated(event: WithdrawalInitiated): void {
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.totalGRTWithdrawn = graphNetwork.totalGRTWithdrawn.plus(event.params.amount)
  graphNetwork.save()
}
