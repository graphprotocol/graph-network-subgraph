import {
  Staked,
  Redeemed,
  Collected,
  Curation,
  ParameterUpdated,
} from '../types/Curation/Curation'
import { Curator, GraphNetwork, Signal, Subgraph } from '../types/schema'
import { Address } from '@graphprotocol/graph-ts'

import { createCurator, createSignal, createSubgraph } from './helpers'

/**
 * @dev handleStaked
 * - updates curator, creates if needed
 * - updates signal, creates if needed
 * - updates subgraph, creates if needed
 */
export function handleStaked(event: Staked): void {
  // update curator
  let id = event.params.curator.toHexString()
  let curator = Curator.load(id)
  if (curator == null) {
    curator = createCurator(id, event.block.timestamp)
  }
  curator.totalSignal = curator.totalSignal.plus(event.params.shares)
  curator.totalSignaledGRT = curator.totalSignaledGRT.plus(event.params.tokens)

  // update signal
  let subgraphID = event.params.subgraphID.toHexString()
  let signalID = id.concat('-').concat(subgraphID)
  let signal = Signal.load(signalID)
  if (signal == null) {
    signal = createSignal(id, subgraphID)
  }
  signal.tokensSignaled = signal.tokensSignaled.plus(event.params.tokens)
  signal.signal = signal.signal.plus(event.params.shares)
  signal.save()

  // update subgraph
  let subgraph = Subgraph.load(subgraphID)
  if (subgraph == null) {
    subgraph = createSubgraph(subgraphID, event.block.timestamp)
  }
  subgraph.totalSignaledGRT = subgraph.totalSignaledGRT.plus(event.params.tokens)
  subgraph.totalSignalMinted = subgraph.totalSignalMinted.plus(event.params.shares)

  let curation = Curation.bind(event.address)
  subgraph.reserveRatio = curation.subgraphs(event.params.subgraphID).value0
  subgraph.save()
}
/**
 * @dev handleRedeemed
 * - updates curator
 * - updates signal
 * - updates subgraph
 */
export function handleRedeemed(event: Redeemed): void {
  // update curator
  let id = event.params.curator.toHexString()
  let curator = Curator.load(id)
  curator.totalSignal = curator.totalSignal.minus(event.params.shares)
  curator.totalRedeemedGRT = curator.totalRedeemedGRT.plus(event.params.tokens)

  // update signal
  let subgraphID = event.params.subgraphID.toHexString()
  let signalID = id.concat('-').concat(subgraphID)
  let signal = Signal.load(signalID)
  signal.tokensRedeemed = signal.tokensRedeemed.plus(event.params.tokens)
  signal.signal = signal.signal.minus(event.params.shares)
  signal.save()

  // update subgraph
  let subgraph = Subgraph.load(subgraphID)
  subgraph.totalSignaledGRT = subgraph.totalSignaledGRT.minus(event.params.tokens)
  subgraph.totalSignalMinted = subgraph.totalSignalMinted.minus(event.params.shares)
  subgraph.save()
}

/**
 * @dev handleCollected
 *  - updates subgraph - TODO - we might add curator earned to this. but it seems really hard
 *  - @note - we do not update totalQueryFeesCollected here, because it is already updated in
 *    staking.handleAllocationSettled()
 */
export function handleCollected(event: Collected): void {
  // update subgraph
  let subgraphID = event.params.subgraphID.toHexString()
  let subgraph = Subgraph.load(subgraphID)
  subgraph.totalSignaledGRT = subgraph.totalSignaledGRT.plus(event.params.tokens)
  subgraph.totalCuratorFeeReward = subgraph.totalCuratorFeeReward.plus(event.params.tokens)
  subgraph.save()
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
