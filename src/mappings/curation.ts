import {
  Staked,
  Redeemed,
  Collected,
  Curation,
  ParameterUpdated,
} from '../../generated/Curation/Curation'
import { Curator, GraphNetwork, Signal, Subgraph } from '../../generated/schema'
import { BigInt } from '@graphprotocol/graph-ts'

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
  signal.signal = signal.tokensRedeemed.plus(event.params.shares)
  signal.save()

  // update subgraph
  let subgraph = Subgraph.load(subgraphID)
  if (subgraph == null) {
    subgraph = createSubgraph(subgraphID, event.block.timestamp)
  }
  subgraph.totalSignaledGRT = subgraph.totalSignaledGRT.plus(event.params.tokens)
  subgraph.totalSignalMinted = subgraph.totalSignalMinted.plus(event.params.shares)
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
  signal.tokensSignaled = signal.tokensSignaled.minus(event.params.tokens)
  signal.signal = signal.tokensRedeemed.minus(event.params.shares)
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
  subgraph.save()
}

/**
 * @dev handleParamterUpdated
 * - updates all parameters of curation, depending on string passed. We then can
 *   call the contract directly to get the updated value
 */
export function handleParamterUpdated(event: ParameterUpdated): void {
  let parameter = event.params.param
  let graphNetwork = GraphNetwork.load('1')
  let staking = Curation.bind(graphNetwork.staking)

  // TODO - can't remember if switch case works in typescript. will try
  if (parameter == 'defaultReserveRatio') {
    graphNetwork.defaultReserveRatio = staking.defaultReserveRatio()
  } else if (parameter == 'staking') {
    // Not in use now, we are waiting till we have a controller contract that
    // houses all the addresses of all contracts. So that there aren't a bunch
    // of different instances of the contract addresses across all contracts
    // graphNetwork.staking = staking.staking()
  } else if (parameter == 'minimumCurationStake') {
    // TODO - it appears Curation contract still is using Stake as a term instead of signal
    // will have to update soon
    graphNetwork.minimumCurationSignal = staking.minimumCurationStake()
  }

  graphNetwork.save()
}
