import {
  Signalled,
  Burned,
  Collected,
  Curation,
  ParameterUpdated,
} from '../types/Curation/Curation'
import {
  Curator,
  GraphNetwork,
  Signal,
  SubgraphDeployment,
  SignalTransaction,
} from '../types/schema'
import { Address, BigInt } from '@graphprotocol/graph-ts'

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
  curator.totalSignalledTokens = curator.totalSignalledTokens.plus(event.params.tokens)
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
  deployment.reserveRatio = curation.pools(event.params.subgraphDeploymentID).value1.toI32()
  deployment.save()

  // Update epoch
  let epoch = createOrLoadEpoch(event.block.number)
  epoch.signalledTokens = epoch.signalledTokens.plus(event.params.tokens)
  epoch.save()

  // Update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalTokensSignalled = graphNetwork.totalTokensSignalled.plus(event.params.tokens)
  graphNetwork.save()

  // Create n signal tx
  let signalTransaction = new SignalTransaction(
    event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString()),
  )
  signalTransaction.blockNumber = event.block.number.toI32()
  signalTransaction.timestamp = event.block.timestamp.toI32()
  signalTransaction.signer = event.params.curator.toHexString()
  signalTransaction.type = 'MintSignal'
  signalTransaction.signal = event.params.signal
  signalTransaction.tokens = event.params.tokens
  signalTransaction.withdrawalFees = BigInt.fromI32(0)
  signalTransaction.subgraphDeployment = event.params.subgraphDeploymentID.toHexString()
  signalTransaction.save()
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
  curator.totalUnsignalledTokens = curator.totalUnsignalledTokens.plus(event.params.tokens)

  // Update signal
  let subgraphDeploymentID = event.params.subgraphDeploymentID.toHexString()
  let signalID = joinID([id, subgraphDeploymentID])
  let signal = Signal.load(signalID)
  // Note - if you immediately deposited and then withdrew, you would lose 5%, and you were
  // realize this loss by seeing unsignaled tokens being 95 and signalled 100
  signal.unsignalledTokens = signal.unsignalledTokens.plus(event.params.tokens)
  signal.signal = signal.signal.minus(event.params.signal)
  signal.save()

  // Update subgraph
  let deployment = SubgraphDeployment.load(subgraphDeploymentID)
  deployment.signalledTokens = deployment.signalledTokens.minus(event.params.tokens)
  deployment.signalAmount = deployment.signalAmount.minus(event.params.signal)
  deployment.save()

  // Update epoch - none

  // Update graph network
  let graphNetwork = GraphNetwork.load('1')
  graphNetwork.totalTokensSignalled = graphNetwork.totalTokensSignalled.minus(event.params.tokens)
  graphNetwork.save()

  // Create n signal tx
  let signalTransaction = new SignalTransaction(
    event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString()),
  )
  signalTransaction.blockNumber = event.block.number.toI32()
  signalTransaction.timestamp = event.block.timestamp.toI32()
  signalTransaction.signer = event.params.curator.toHexString()
  signalTransaction.type = 'BurnSignal'
  signalTransaction.signal = event.params.signal
  signalTransaction.tokens = event.params.tokens
  signalTransaction.withdrawalFees = BigInt.fromI32(0)
  signalTransaction.subgraphDeployment = event.params.subgraphDeploymentID.toHexString()
  signalTransaction.save()
}

/**
 * @dev handleParamterUpdated
 * - updates all parameters of curation, depending on string passed. We then can
 *   call the contract directly to get the updated value
 */
export function handleParameterUpdated(event: ParameterUpdated): void {
  let parameter = event.params.param
  let graphNetwork = GraphNetwork.load('1')
  let curation = Curation.bind(event.address)

  if (parameter == 'defaultReserveRatio') {
    graphNetwork.defaultReserveRatio = curation.defaultReserveRatio().toI32()
  } else if (parameter == 'curationTaxPercentage') {
    graphNetwork.curationTaxPercentage = curation.curationTaxPercentage().toI32()
    // TODO - i Hard coded this since these are set on deployment. Should fix this
    // maybe emit an event in the constructor
    graphNetwork.minimumCurationDeposit = curation.minimumCurationDeposit()
    graphNetwork.defaultReserveRatio = curation.defaultReserveRatio().toI32()
  } else if (parameter == 'staking') {
    // Not in use now, we are waiting till we have a controller contract that
    // houses all the addresses of all contracts. So that there aren't a bunch
    // of different instances of the contract addresses across all contracts
    // graphNetwork.staking = staking.staking()
  } else if (parameter == 'minimumCurationDeposit') {
    graphNetwork.minimumCurationDeposit = curation.minimumCurationDeposit()
  }
  graphNetwork.save()
}

// export function handleImplementationUpdated(event: ImplementationUpdated): void {
//   let graphNetwork = GraphNetwork.load('1')
//   let implementations = graphNetwork.curationImplementations
//   implementations.push(event.params.newImplementation)
//   graphNetwork.curationImplementations = implementations
//   graphNetwork.save()
// }
