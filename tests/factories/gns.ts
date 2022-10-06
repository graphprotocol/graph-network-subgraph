import { newMockEvent } from 'matchstick-as/assembly/index'
import {
  GRTWithdrawn,
  NSignalBurned,
  NSignalMinted,
  NameSignalDisabled,
  NameSignalEnabled,
  NameSignalUpgrade,
  ParameterUpdated,
  SetController,
  SetDefaultName,
  SubgraphDeprecated,
  SubgraphMetadataUpdated,
  SubgraphPublished,
  ContractSynced,
  GRTWithdrawn1,
  LegacySubgraphClaimed,
  SignalBurned,
  SignalMinted,
  SubgraphDeprecated1,
  SubgraphMetadataUpdated1,
  SubgraphPublished1,
  SubgraphUpgraded,
  SubgraphVersionUpdated,
  Transfer
} from '../../src/types/GNS/GNSStitched'
import { Address, BigInt, ethereum, Bytes } from '@graphprotocol/graph-ts'

export function mockGRTWithdrawn(
  graphAccount: Address,
  subgraphNumber: BigInt,
  nameCurator: Address,
  nSignalBurnt: BigInt,
  withdrawnGRT: BigInt,
): GRTWithdrawn {
  let mockEvent = newMockEvent()
  let event = new GRTWithdrawn(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('graphAccount', ethereum.Value.fromAddress(graphAccount)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphNumber', ethereum.Value.fromSignedBigInt(subgraphNumber)),
  )
  event.parameters.push(
    new ethereum.EventParam('nameCurator', ethereum.Value.fromAddress(nameCurator)),
  )
  event.parameters.push(
    new ethereum.EventParam('nSignalBurnt', ethereum.Value.fromUnsignedBigInt(nSignalBurnt)),
  )
  event.parameters.push(
    new ethereum.EventParam('withdrawnGRT', ethereum.Value.fromUnsignedBigInt(withdrawnGRT)),
  )

  return event
}

export function mockNSignalBurned(
  graphAccount: Address,
  subgraphNumber: BigInt,
  nameCurator: Address,
  nSignalBurnt: BigInt,
  vSignalBurnt: BigInt,
  tokensReceived: BigInt,
): NSignalBurned {
  let mockEvent = newMockEvent()
  let event = new NSignalBurned(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('graphAccount', ethereum.Value.fromAddress(graphAccount)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphNumber', ethereum.Value.fromSignedBigInt(subgraphNumber)),
  )
  event.parameters.push(
    new ethereum.EventParam('nameCurator', ethereum.Value.fromAddress(nameCurator)),
  )
  event.parameters.push(
    new ethereum.EventParam('nSignalBurnt', ethereum.Value.fromUnsignedBigInt(nSignalBurnt)),
  )
  event.parameters.push(
    new ethereum.EventParam('vSignalBurnt', ethereum.Value.fromUnsignedBigInt(vSignalBurnt)),
  )
  event.parameters.push(
    new ethereum.EventParam('tokensReceived', ethereum.Value.fromUnsignedBigInt(tokensReceived)),
  )

  return event
}

export function mockNSignalMinted(
  graphAccount: Address,
  subgraphNumber: BigInt,
  nameCurator: Address,
  nSignalBurnt: BigInt,
  vSignalBurnt: BigInt,
  tokensDeposited: BigInt,
): NSignalMinted {
  let mockEvent = newMockEvent()
  let event = new NSignalMinted(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('graphAccount', ethereum.Value.fromAddress(graphAccount)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphNumber', ethereum.Value.fromSignedBigInt(subgraphNumber)),
  )
  event.parameters.push(
    new ethereum.EventParam('nameCurator', ethereum.Value.fromAddress(nameCurator)),
  )
  event.parameters.push(
    new ethereum.EventParam('nSignalBurnt', ethereum.Value.fromUnsignedBigInt(nSignalBurnt)),
  )
  event.parameters.push(
    new ethereum.EventParam('vSignalBurnt', ethereum.Value.fromUnsignedBigInt(vSignalBurnt)),
  )
  event.parameters.push(
    new ethereum.EventParam('tokensDeposited', ethereum.Value.fromUnsignedBigInt(tokensDeposited)),
  )

  return event
}

export function mockNameSignalDisabled(
  graphAccount: Address,
  subgraphNumber: BigInt,
  withdrawableGRT: BigInt,
): NameSignalDisabled {
  let mockEvent = newMockEvent()
  let event = new NameSignalDisabled(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('graphAccount', ethereum.Value.fromAddress(graphAccount)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphNumber', ethereum.Value.fromSignedBigInt(subgraphNumber)),
  )
  event.parameters.push(
    new ethereum.EventParam('withdrawableGRT', ethereum.Value.fromUnsignedBigInt(withdrawableGRT)),
  )

  return event
}

export function mockNameSignalEnabled(
  graphAccount: Address,
  subgraphNumber: BigInt,
  subgraphDeploymenID: Bytes,
  reserveRatio: BigInt,
): NameSignalEnabled {
  let mockEvent = newMockEvent()
  let event = new NameSignalEnabled(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('graphAccount', ethereum.Value.fromAddress(graphAccount)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphNumber', ethereum.Value.fromSignedBigInt(subgraphNumber)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphDeploymenID', ethereum.Value.fromBytes(subgraphDeploymenID)),
  )
  event.parameters.push(
    new ethereum.EventParam('reserveRatio', ethereum.Value.fromUnsignedBigInt(reserveRatio)),
  )

  return event
}

export function mockNameSignalUpgrade(
  graphAccount: Address,
  subgraphNumber: BigInt,
  newSignalCreated: BigInt, 
  tokensSignalled: BigInt,
  subgraphDeploymenID: Bytes,
): NameSignalUpgrade {
  let mockEvent = newMockEvent()
  let event = new NameSignalUpgrade(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('graphAccount', ethereum.Value.fromAddress(graphAccount)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphNumber', ethereum.Value.fromSignedBigInt(subgraphNumber)),
  )
  event.parameters.push(
    new ethereum.EventParam('newSignalCreated', ethereum.Value.fromSignedBigInt(newSignalCreated)),
  )
  event.parameters.push(
    new ethereum.EventParam('tokensSignalled', ethereum.Value.fromSignedBigInt(tokensSignalled)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphDeploymenID', ethereum.Value.fromBytes(subgraphDeploymenID)),
  )

  return event
}

export function mockParameterUpdated(
  params: string
): ParameterUpdated {
  let mockEvent = newMockEvent()
  let event = new ParameterUpdated(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('params', ethereum.Value.fromString(params)),
  )

  return event
}

export function mockSetControllerd(
  controller: Address
): SetController {
  let mockEvent = newMockEvent()
  let event = new SetController(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('controller', ethereum.Value.fromAddress(controller)),
  )

  return event
}

export function mockSetDefaultName(
  graphAccount: Address,
  nameSystem: BigInt,
  nameIdentifier: Bytes,
  name: string,
): SetDefaultName {
  let mockEvent = newMockEvent()
  let event = new SetDefaultName(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('graphAccount', ethereum.Value.fromAddress(graphAccount)),
  )
  event.parameters.push(
    new ethereum.EventParam('nameSystem', ethereum.Value.fromSignedBigInt(nameSystem)),
  )
  event.parameters.push(
    new ethereum.EventParam('nameIdentifier', ethereum.Value.fromBytes(nameIdentifier)),
  )
  event.parameters.push(new ethereum.EventParam('name', ethereum.Value.fromString(name)))

  return event
}

export function mockSubgraphDeprecated(
  graphAccount: Address,
  subgraphNumber: BigInt,
): SubgraphDeprecated {
  let mockEvent = newMockEvent()
  let event = new SubgraphDeprecated(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('graphAccount', ethereum.Value.fromAddress(graphAccount)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphNumber', ethereum.Value.fromSignedBigInt(subgraphNumber)),
  )

  return event
}

export function mockSubgraphMetadataUpdated(
  graphAccount: Address,
  subgraphNumber: BigInt,
  subgraphMetaData: Bytes
): SubgraphMetadataUpdated {
  let mockEvent = newMockEvent()
  let event = new SubgraphMetadataUpdated(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('graphAccount', ethereum.Value.fromAddress(graphAccount)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphNumber', ethereum.Value.fromSignedBigInt(subgraphNumber)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphMetaData', ethereum.Value.fromBytes(subgraphMetaData)),
  )

  return event
}

export function mockSubgraphPublished(
  graphAccount: Address,
  subgraphNumber: BigInt,
  subgraphDeploymentID: Bytes,
  versionMetaData: Bytes
): SubgraphPublished {
  let mockEvent = newMockEvent()
  let event = new SubgraphPublished(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('graphAccount', ethereum.Value.fromAddress(graphAccount)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphNumber', ethereum.Value.fromSignedBigInt(subgraphNumber)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphDeploymentID', ethereum.Value.fromBytes(subgraphDeploymentID)),
  )
  event.parameters.push(
    new ethereum.EventParam('versionMetaData', ethereum.Value.fromBytes(versionMetaData)),
  )

  return event
}

export function mockContractSynced(
  nameHash: Bytes,
  contractAddress: Address
): ContractSynced {
  let mockEvent = newMockEvent()
  let event = new ContractSynced(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('nameHash', ethereum.Value.fromBytes(nameHash)),
  )
  event.parameters.push(
    new ethereum.EventParam('contractAddress', ethereum.Value.fromAddress(contractAddress)),
  )

  return event
}

export function mockGRTWithdrawn1(
  subgraphID: BigInt,
  curator: Address,
  nSignalBurnt: BigInt,
  withdrawnGRT: BigInt
): GRTWithdrawn1 {
  let mockEvent = newMockEvent()
  let event = new GRTWithdrawn1(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('subgraphID', ethereum.Value.fromUnsignedBigInt(subgraphID)),
  )
  event.parameters.push(
    new ethereum.EventParam('curator', ethereum.Value.fromAddress(curator)),
  )
  event.parameters.push(
    new ethereum.EventParam('nSignalBurnt', ethereum.Value.fromUnsignedBigInt(nSignalBurnt)),
  )
  event.parameters.push(
    new ethereum.EventParam('withdrawnGRT', ethereum.Value.fromUnsignedBigInt(withdrawnGRT)),
  )

  return event
}

export function mockLegacySubgraphClaimed(
  graphAccount: Address,
  subgraphNumber: BigInt
): LegacySubgraphClaimed {
  let mockEvent = newMockEvent()
  let event = new LegacySubgraphClaimed(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('graphAccount', ethereum.Value.fromAddress(graphAccount)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphNumber', ethereum.Value.fromUnsignedBigInt(subgraphNumber)),
  )

  return event
}

export function mockSignalBurned(
  subgraphID: BigInt,
  curator: Address,
  nSignalBurnt: BigInt,
  vSignalBurnt: BigInt,
  tokensReceived: BigInt,
): SignalBurned {
  let mockEvent = newMockEvent()
  let event = new SignalBurned(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('subgraphID', ethereum.Value.fromSignedBigInt(subgraphID)),
  )
  event.parameters.push(
    new ethereum.EventParam('curator', ethereum.Value.fromAddress(curator)),
  )
  event.parameters.push(
    new ethereum.EventParam('nSignalBurnt', ethereum.Value.fromUnsignedBigInt(nSignalBurnt)),
  )
  event.parameters.push(
    new ethereum.EventParam('vSignalBurnt', ethereum.Value.fromUnsignedBigInt(vSignalBurnt)),
  )
  event.parameters.push(
    new ethereum.EventParam('tokensReceived', ethereum.Value.fromUnsignedBigInt(tokensReceived)),
  )

  return event
}

export function mockSignalMinted(
  subgraphID: BigInt,
  curator: Address,
  nSignalCreated: BigInt,
  vSignalCreated: BigInt,
  tokensDeposited: BigInt,
): SignalMinted {
  let mockEvent = newMockEvent()
  let event = new SignalMinted(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('subgraphID', ethereum.Value.fromSignedBigInt(subgraphID)),
  )
  event.parameters.push(
    new ethereum.EventParam('curator', ethereum.Value.fromAddress(curator)),
  )
  event.parameters.push(
    new ethereum.EventParam('nSignalCreated', ethereum.Value.fromUnsignedBigInt(nSignalCreated)),
  )
  event.parameters.push(
    new ethereum.EventParam('vSignalCreated', ethereum.Value.fromUnsignedBigInt(vSignalCreated)),
  )
  event.parameters.push(
    new ethereum.EventParam('tokensDeposited', ethereum.Value.fromUnsignedBigInt(tokensDeposited)),
  )

  return event
}

export function mockSubgraphDeprecated1(
  subgraphID: BigInt,
  withdrawableGRT: BigInt,
): SubgraphDeprecated1 {
  let mockEvent = newMockEvent()
  let event = new SubgraphDeprecated1(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('subgraphID', ethereum.Value.fromSignedBigInt(subgraphID)),
  )
  event.parameters.push(
    new ethereum.EventParam('withdrawableGRT', ethereum.Value.fromUnsignedBigInt(withdrawableGRT)),
  )

  return event
}

export function mockSubgraphMetadataUpdated1(
  graphAccount: Address,
  subgraphID: BigInt,
  subgraphMetaData: Bytes
): SubgraphMetadataUpdated1 {
  let mockEvent = newMockEvent()
  let event = new SubgraphMetadataUpdated1(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('subgraphID', ethereum.Value.fromSignedBigInt(subgraphID)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphMetaData', ethereum.Value.fromBytes(subgraphMetaData)),
  )

  return event
}

export function mockSubgraphPublished1(
  subgrapID: BigInt,
  subgraphDeploymenID: Bytes,
  reserveRatio: BigInt,
): SubgraphPublished1 {
  let mockEvent = newMockEvent()
  let event = new SubgraphPublished1(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('subgrapID', ethereum.Value.fromSignedBigInt(subgrapID)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphDeploymenID', ethereum.Value.fromBytes(subgraphDeploymenID)),
  )
  event.parameters.push(
    new ethereum.EventParam('reserveRatio', ethereum.Value.fromUnsignedBigInt(reserveRatio)),
  )

  return event
}

export function mockSubgraphUpgraded(

  subgraphID: BigInt,
  vSignalCreated: BigInt,
  tokensSignalled: BigInt,
  subgraphDeploymentID: Bytes
): SubgraphUpgraded {
  let mockEvent = newMockEvent()
  let event = new SubgraphUpgraded(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('subgraphID', ethereum.Value.fromSignedBigInt(subgraphID)),
  )
  event.parameters.push(
    new ethereum.EventParam('vSignalCreated', ethereum.Value.fromUnsignedBigInt(vSignalCreated)),
  )
  event.parameters.push(
    new ethereum.EventParam('tokensSignalled', ethereum.Value.fromUnsignedBigInt(tokensSignalled)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphDeploymentID', ethereum.Value.fromBytes(subgraphDeploymentID)),
  )

  return event
}

export function mockSubgraphVersionUpdated(
  subgraphID: BigInt,
  subgraphDeploymentID: Bytes,
  versionMetaData: Bytes
): SubgraphVersionUpdated {
  let mockEvent = newMockEvent()
  let event = new SubgraphVersionUpdated(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('subgraphID', ethereum.Value.fromSignedBigInt(subgraphID)),
  )
  event.parameters.push(
    new ethereum.EventParam('subgraphDeploymentID', ethereum.Value.fromBytes(subgraphDeploymentID)),
  )
  event.parameters.push(
    new ethereum.EventParam('versionMetaData', ethereum.Value.fromBytes(versionMetaData)),
  )

  return event
}

export function mockTransfer(
  from: Address,
  to: Address,
  tokenID: BigInt
): Transfer {
  let mockEvent = newMockEvent()
  let event = new Transfer(
    mockEvent.address,
    mockEvent.logIndex,
    mockEvent.transactionLogIndex,
    mockEvent.logType,
    mockEvent.block,
    mockEvent.transaction,
    mockEvent.parameters,
    mockEvent.receipt,
  )

  event.parameters = []
  event.parameters.push(
    new ethereum.EventParam('from', ethereum.Value.fromAddress(from)),
  )
  event.parameters.push(
    new ethereum.EventParam('to', ethereum.Value.fromAddress(to)),
  )
  event.parameters.push(
    new ethereum.EventParam('tokenID', ethereum.Value.fromUnsignedBigInt(tokenID)),
  )

  return event
}