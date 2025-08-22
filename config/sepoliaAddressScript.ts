import * as fs from 'fs'
import * as mustache from 'mustache'
const horizonAddresses = require('@graphprotocol/address-book/horizon/addresses.json')
const subgraphServiceAddresses = require('@graphprotocol/address-book/subgraph-service/addresses.json')
import { Addresses } from './addresses.template'

// mustache doesn't like numbered object keys
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renameHorizonAddresses: any = horizonAddresses
renameHorizonAddresses['sepolia'] = horizonAddresses['11155111']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renameSubgraphServiceAddresses: any = subgraphServiceAddresses
renameSubgraphServiceAddresses['sepolia'] = subgraphServiceAddresses['11155111']

// Combine both address sources for mustache
const combinedAddresses = {
  sepolia: {
    ...renameHorizonAddresses['sepolia'],
    ...renameSubgraphServiceAddresses['sepolia']
  }
}

export let addresses: Addresses = {
  controller: '{{sepolia.Controller.address}}',
  graphToken: '{{sepolia.L2GraphToken.address}}',
  epochManager: '{{sepolia.EpochManager.address}}',
  disputeManager: '{{sepolia.DisputeManager.address}}',
  horizonDisputeManager: '{{sepolia.HorizonDisputeManager.address}}',
  staking: '{{sepolia.HorizonStaking.address}}',
  stakingExtension: '{{sepolia.HorizonStaking.address}}',
  curation: '{{sepolia.L2Curation.address}}',
  rewardsManager: '{{sepolia.RewardsManager.address}}',
  serviceRegistry: '{{sepolia.LegacyServiceRegistry.address}}',
  gns: '{{sepolia.L2GNS.address}}',
  ens: '{{sepolia.IENS.address}}',
  ensPublicResolver: '{{sepolia.IPublicResolver.address}}',
  blockNumber: '',
  bridgeBlockNumber: '',
  network: '',
  tokenLockManager: '',
  subgraphNFT: '{{sepolia.SubgraphNFT.address}}',
  l1GraphTokenGateway: '',
  l2GraphTokenGateway: '{{sepolia.L2GraphTokenGateway.address}}',
  ethereumDIDRegistry: '{{sepolia.EthereumDIDRegistry.address}}',
  subgraphService: '{{sepolia.SubgraphService.address}}',
  graphPayments: '{{sepolia.GraphPayments.address}}',
  paymentsEscrow: '{{sepolia.PaymentsEscrow.address}}',
  graphTallyCollector: '{{sepolia.GraphTallyCollector.address}}',
  isL1: false,
}

const main = (): void => {
  try {
    let output = JSON.parse(mustache.render(JSON.stringify(addresses), combinedAddresses))
    output.blockNumber = '4454000'
    output.bridgeBlockNumber = '4454000'
    output.network = 'sepolia'
    //output.tokenLockManager = '0x9a7a54e86560f4304d8862Ea00F45D1090c59ac8' // we don't have one, this is rinkebys'
    output.useTokenLockManager = false
    if(output.ens == '') {
      output.ens = '0x0000000000000000000000000000000000000000' // to avoid crashes due to bad config
    }
    if(output.ethereumDIDRegistry == '') {
      output.ethereumDIDRegistry = '0x0000000000000000000000000000000000000000' // to avoid crashes due to bad config
    }
    // Set defaults for missing addresses
    if(output.controller == '') {
      output.controller = '0x0000000000000000000000000000000000000000'
    }
    if(output.graphToken == '') {
      output.graphToken = '0x0000000000000000000000000000000000000000'
    }
    if(output.epochManager == '') {
      output.epochManager = '0x0000000000000000000000000000000000000000'
    }
    if(output.staking == '') {
      output.staking = '0x0000000000000000000000000000000000000000'
    }
    if(output.stakingExtension == '') {
      output.stakingExtension = '0x0000000000000000000000000000000000000000'
    }
    if(output.curation == '') {
      output.curation = '0x0000000000000000000000000000000000000000'
    }
    if(output.rewardsManager == '') {
      output.rewardsManager = '0x0000000000000000000000000000000000000000'
    }
    if(output.serviceRegistry == '') {
      output.serviceRegistry = '0x0000000000000000000000000000000000000000'
    }
    if(output.gns == '') {
      output.gns = '0x0000000000000000000000000000000000000000'
    }
    if(output.subgraphNFT == '') {
      output.subgraphNFT = '0x0000000000000000000000000000000000000000'
    }
    if(output.l2GraphTokenGateway == '') {
      output.l2GraphTokenGateway = '0x0000000000000000000000000000000000000000'
    }
    if(output.horizonDisputeManager == '') {
      output.horizonDisputeManager = '0x0000000000000000000000000000000000000000'
    }
    if(output.graphTallyCollector == '') {
      output.graphTallyCollector = '0x0000000000000000000000000000000000000000'
    }
    fs.writeFileSync(__dirname + '/generatedAddresses.json', JSON.stringify(output, null, 2))
  } catch (e) {
    console.log(`Error saving artifacts: ${e.message}`)
  }
}

main()