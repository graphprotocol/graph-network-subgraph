import { Staked, Redeemed, Collected, Curation, ParameterUpdated } from '../types/Curation/Curation'
import { Curator, GraphNetwork, Signal, SubgraphDeployment } from '../types/schema'
import { Address } from '@graphprotocol/graph-ts'

import { createOrLoadSignal, createOrLoadSubgraphDeployment, createOrLoadCurator, joinID } from './helpers'

/**
 * @dev handleStaked
 * - updates curator, creates if needed
 * - updates signal, creates if needed
 * - updates subgraph deployment, creates if needed
 */
export function handleStaked(event: Staked): void {
  // Update curator
  let id = event.params.curator.toHexString()
  let curator = createOrLoadCurator(id, event.block.timestamp)
  curator.totalSignal = curator.totalSignal.plus(event.params.shares)
  curator.totalSignaledGRT = curator.totalSignaledGRT.plus(event.params.tokens)
  curator.save()

  // Update signal
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  let signal = createOrLoadSignal(id, subgraphDeploymentID)
  signal.tokensSignaled = signal.tokensSignaled.plus(event.params.tokens)
  signal.signal = signal.signal.plus(event.params.shares)
  signal.save()

  // Update subgraph deployment
  let deployment = createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp)
  deployment.totalSignaledGRT = deployment.totalSignaledGRT.plus(event.params.tokens)
  deployment.totalSignalMinted = deployment.totalSignalMinted.plus(event.params.shares)

  let curation = Curation.bind(event.address)
  deployment.reserveRatio = curation.pools(event.params.subgraphDeploymentID).value0
  deployment.save()
}
/**
 * @dev handleRedeemed
 * - updates curator
 * - updates signal
 * - updates subgraph
 */
export function handleRedeemed(event: Redeemed): void {
  // Update curator
  let id = event.params.curator.toHexString()
  let curator = Curator.load(id)
  curator.totalSignal = curator.totalSignal.minus(event.params.shares)
  curator.totalRedeemedGRT = curator.totalRedeemedGRT.plus(event.params.tokens)

  // Update signal
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  let signalID =  joinID([id, subgraphDeploymentID])
  let signal = Signal.load(signalID)
  signal.tokensRedeemed = signal.tokensRedeemed.plus(event.params.tokens)
  signal.signal = signal.signal.minus(event.params.shares)
  signal.save()

  // Update subgraph
  let deployment = SubgraphDeployment.load(subgraphDeploymentID)
  deployment.totalSignaledGRT = deployment.totalSignaledGRT.minus(event.params.tokens)
  deployment.totalSignalMinted = deployment.totalSignalMinted.minus(event.params.shares)
  deployment.save()
}

/**
 * @dev handleCollected
 *  - updates subgraph - TODO - we might add curator earned to this. but it seems really hard
 *  - @note - we do not update totalQueryFeesCollected here, because it is already updated in
 *    staking.handleAllocationSettled()
 */
export function handleCollected(event: Collected): void {
  // update subgraph
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  let deployment = SubgraphDeployment.load(subgraphDeploymentID)
  deployment.totalSignaledGRT = deployment.totalSignaledGRT.plus(event.params.tokens)
  deployment.totalCuratorFeeReward = deployment.totalCuratorFeeReward.plus(event.params.tokens)
  deployment.save()
}

/**
 * @dev handleParamterUpdated
 * - updates all parameters of curation, depending on string passed. We then can
 *   call the contract directly to get the updated value
 */
export function handleParameterUpdated(event: ParameterUpdated): void {
  let parameter = event.params.param
  let graphNetwork = GraphNetwork.load('1')
  let curationAddress = graphNetwork.curation
  let curation = Curation.bind(curationAddress as Address)

  if (parameter == 'defaultReserveRatio') {
    graphNetwork.defaultReserveRatio = curation.defaultReserveRatio()
  } else if (parameter == 'staking') {
    // Not in use now, we are waiting till we have a controller contract that
    // houses all the addresses of all contracts. So that there aren't a bunch
    // of different instances of the contract addresses across all contracts
    // graphNetwork.staking = staking.staking()
  } else if (parameter == 'minimumCurationStake') {
    // TODO - it appears Curation contract still is using Stake as a term instead of signal
    // will have to update soon
    graphNetwork.minimumCurationSignal = curation.minimumCurationStake()
  }

  graphNetwork.save()
}
