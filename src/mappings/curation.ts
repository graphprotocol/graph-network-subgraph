import {
  Signalled,
  Burned,
  Collected,
  Curation,
  ParameterUpdated,
} from '../types/Curation/Curation'
import { Curator, GraphNetwork, Signal, SubgraphDeployment } from '../types/schema'
import { Address } from '@graphprotocol/graph-ts'

import {
  createOrLoadSignal,
  createOrLoadSubgraphDeployment,
  createOrLoadCurator,
  createOrLoadEpoch,
  joinID,
} from './helpers'

/**
 * @dev handleStaked
 * - updates curator, creates if needed
 * - updates signal, creates if needed
 * - updates subgraph deployment, creates if needed
 */
export function handleSignalled(event: Signalled): void {
  // Update curator
  let id = event.params.curator.toHexString()
  let curator = createOrLoadCurator(id, event.block.timestamp)
  curator.totalsignalledTokens = curator.totalsignalledTokens.plus(event.params.tokens)
  curator.save()

  // Update signal
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  let signal = createOrLoadSignal(id, subgraphDeploymentID)
  signal.signalledTokens = signal.signalledTokens.plus(event.params.tokens)
  signal.signal = signal.signal.plus(event.params.signal)
  signal.save()

  // Update subgraph deployment
  let deployment = createOrLoadSubgraphDeployment(subgraphDeploymentID, event.block.timestamp)
  deployment.signalledTokens = deployment.signalledTokens.plus(event.params.tokens)
  deployment.signalAmount = deployment.signalAmount.plus(event.params.signal)

  let curation = Curation.bind(event.address)
  deployment.reserveRatio = curation.pools(event.params.subgraphDeploymentID).value0
  deployment.save()

  // Update epoch
  let epoch = createOrLoadEpoch(event.block.number)
  epoch.signalledTokens = epoch.signalledTokens.plus(event.params.tokens)
  epoch.save()

  // Update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalTokensSignalled = graphNetwork.totalTokensSignalled.plus(event.params.tokens)
  graphNetwork.save()
}
/**
 * @dev handleRedeemed
 * - updates curator
 * - updates signal
 * - updates subgraph
 */
export function handleBurned(event: Burned): void {
  // Update curator
  let id = event.params.curator.toHexString()
  let curator = Curator.load(id)
  curator.totalsignalledTokens = curator.totalsignalledTokens.minus(event.params.signal)
  curator.totalUnsignalledTokens = curator.totalUnsignalledTokens.plus(event.params.tokens)

  // Update signal
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  let signalID = joinID([id, subgraphDeploymentID])
  let signal = Signal.load(signalID)
  signal.unsignalledTokens = signal.unsignalledTokens.plus(event.params.tokens)
  signal.signal = signal.signal.minus(event.params.signal)
  signal.save()

  // Update subgraph
  let deployment = SubgraphDeployment.load(subgraphDeploymentID)
  deployment.signalledTokens = deployment.signalledTokens.minus(event.params.tokens)
  deployment.signalAmount = deployment.signalAmount.minus(event.params.signal)
  deployment.save()

  // Update epoch
  let epoch = createOrLoadEpoch(event.block.number)
  epoch.signalledTokens = epoch.signalledTokens.minus(event.params.tokens)
  epoch.save()

  // Update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalTokensSignalled = graphNetwork.totalTokensSignalled.minus(event.params.tokens)
  graphNetwork.save()
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
  deployment.stakedTokens = deployment.stakedTokens.plus(event.params.tokens)
  deployment.curatorFeeRewards = deployment.curatorFeeRewards.plus(event.params.tokens)
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
  } else if (parameter == 'withdrawalFeePercentage') {
    graphNetwork.withdrawalFeePercentage = curation.withdrawalFeePercentage()
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
