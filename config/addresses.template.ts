// AS compiler does not like interface
export class Addresses {
  controller: string
  graphToken: string
  epochManager: string
  disputeManager: string
  horizonDisputeManager: string
  staking: string
  stakingExtension: string
  curation: string
  rewardsManager: string
  serviceRegistry: string
  gns: string
  ens: string
  ensPublicResolver: string
  blockNumber: string
  bridgeBlockNumber: string
  network: string
  tokenLockManager: string
  subgraphNFT: string
  l1GraphTokenGateway: string
  l2GraphTokenGateway: string
  ethereumDIDRegistry: string
  subgraphService: string
  graphPayments: string
  isL1: boolean
}

// AS compiler does not like const
export let addresses: Addresses = {
  controller: '{{controller}}',
  graphToken: '{{graphToken}}',
  epochManager: '{{epochManager}}',
  disputeManager: '{{disputeManager}}',
  horizonDisputeManager: '{{horizonDisputeManager}}',
  staking: '{{staking}}',
  stakingExtension: '{{stakingExtension}}',
  curation: '{{curation}}',
  rewardsManager: '{{rewardsManager}}',
  serviceRegistry: '{{serviceRegistry}}',
  gns: '{{gns}}',
  ens: '{{ens}}',
  ensPublicResolver: '{{ensPublicResolver}}',
  blockNumber: '{{blockNumber}}',
  bridgeBlockNumber: '{{bridgeBlockNumber}}',
  network: '{{network}}',
  tokenLockManager: '{{tokenLockManager}}',
  subgraphNFT: '{{subgraphNFT}}',
  l1GraphTokenGateway: '{{l1GraphTokenGateway}}',
  l2GraphTokenGateway: '{{l2GraphTokenGateway}}',
  ethereumDIDRegistry: '{{ethereumDIDRegistry}}',
  subgraphService: '{{subgraphService}}',
  graphPayments: '{{graphPayments}}',
  isL1: {{isL1}},
}
