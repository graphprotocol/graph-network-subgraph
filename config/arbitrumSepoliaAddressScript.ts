import * as fs from 'fs'
import * as mustache from 'mustache'
import * as horizonAddresses from '@graphprotocol/address-book/horizon/addresses.json'
import * as subgraphServiceAddresses from '@graphprotocol/address-book/subgraph-service/addresses.json'
import { Addresses } from './addresses.template'

// mustache doesn't like numbered object keys
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renameHorizonAddresses: any = horizonAddresses
renameHorizonAddresses['arbsep'] = horizonAddresses['421614']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renameSubgraphServiceAddresses: any = subgraphServiceAddresses
renameSubgraphServiceAddresses['arbsep'] = subgraphServiceAddresses['421614']

// Combine both address sources for mustache
const combinedAddresses = {
  arbsep: {
    ...renameHorizonAddresses['arbsep'],
    ...renameSubgraphServiceAddresses['arbsep']
  }
}

export let addresses: Addresses = {
  controller: '{{arbsep.Controller.address}}',
  graphToken: '{{arbsep.L2GraphToken.address}}',
  epochManager: '{{arbsep.EpochManager.address}}',
  disputeManager: '{{arbsep.DisputeManager.address}}',
  horizonDisputeManager: '{{arbsep.HorizonDisputeManager.address}}',
  staking: '{{arbsep.HorizonStaking.address}}', // Changed from L2Staking
  stakingExtension: '{{arbsep.HorizonStaking.address}}', // Using same as staking
  curation: '{{arbsep.L2Curation.address}}',
  rewardsManager: '{{arbsep.RewardsManager.address}}',
  serviceRegistry: '{{arbsep.LegacyServiceRegistry.address}}', // Changed from ServiceRegistry
  gns: '{{arbsep.L2GNS.address}}',
  ens: '{{arbsep.IENS.address}}',
  ensPublicResolver: '{{arbsep.IPublicResolver.address}}',
  blockNumber: '',
  bridgeBlockNumber: '',
  network: '',
  tokenLockManager: '',
  subgraphNFT: '{{arbsep.SubgraphNFT.address}}',
  l1GraphTokenGateway: '',
  l2GraphTokenGateway: '{{arbsep.L2GraphTokenGateway.address}}',
  ethereumDIDRegistry: '{{arbsep.EthereumDIDRegistry.address}}',
  subgraphService: '{{arbsep.SubgraphService.address}}',
  graphPayments: '{{arbsep.GraphPayments.address}}',
  paymentsEscrow: '{{arbsep.PaymentsEscrow.address}}',
  graphTallyCollector: '{{arbsep.GraphTallyCollector.address}}',
  isL1: false,
}

const main = (): void => {
  try {
    let output = JSON.parse(mustache.render(JSON.stringify(addresses), combinedAddresses))
    output.blockNumber = '570450'
    output.bridgeBlockNumber = '570450'
    output.network = 'arbitrum-sepolia'
    output.useTokenLockManager = false
    if(output.ens == '') {
      output.ens = '0x0000000000000000000000000000000000000000' // to avoid crashes due to bad config
    }
    if(output.ethereumDIDRegistry == '') {
      output.ethereumDIDRegistry = '0x0000000000000000000000000000000000000000' // to avoid crashes due to bad config
    }
    // remove once we have proper packages
    if(output.subgraphService == '') {
      output.subgraphService = '0x0000000000000000000000000000000000000000' // to avoid crashes due to bad config
    }
    if(output.graphPayments == '') {
      output.graphPayments = '0x0000000000000000000000000000000000000000' // to avoid crashes due to bad config
    }
    if(output.horizonDisputeManager == '') {
      output.horizonDisputeManager = '0x0000000000000000000000000000000000000000' // to avoid crashes due to bad config
    }
    if(output.paymentsEscrow == '') {
      output.paymentsEscrow = '0x0000000000000000000000000000000000000000' // to avoid crashes due to bad config
    }
    if(output.graphTallyCollector == '') {
      output.graphTallyCollector = '0x0000000000000000000000000000000000000000' // to avoid crashes due to bad config
    }
    fs.writeFileSync(__dirname + '/generatedAddresses.json', JSON.stringify(output, null, 2))
  } catch (e) {
    console.log(`Error saving artifacts: ${e.message}`)
  }
}

main()