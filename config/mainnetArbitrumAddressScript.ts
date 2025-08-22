import * as fs from 'fs'
import * as mustache from 'mustache'
import * as horizonAddresses from '@graphprotocol/address-book/horizon/addresses.json'
import * as subgraphServiceAddresses from '@graphprotocol/address-book/subgraph-service/addresses.json'
import { Addresses } from './addresses.template'

// mustache doesn't like numbered object keys
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renameHorizonAddresses: any = horizonAddresses
renameHorizonAddresses['arbitrum'] = horizonAddresses['42161'] || {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renameSubgraphServiceAddresses: any = subgraphServiceAddresses
renameSubgraphServiceAddresses['arbitrum'] = subgraphServiceAddresses['42161'] || {}

// Combine both address sources for mustache
const combinedAddresses = {
  arbitrum: {
    ...renameHorizonAddresses['arbitrum'],
    ...renameSubgraphServiceAddresses['arbitrum']
  }
}

export let addresses: Addresses = {
  controller: '{{arbitrum.Controller.address}}',
  graphToken: '{{arbitrum.L2GraphToken.address}}',
  epochManager: '{{arbitrum.EpochManager.address}}',
  disputeManager: '{{arbitrum.DisputeManager.address}}',
  horizonDisputeManager: '{{arbitrum.HorizonDisputeManager.address}}',
  staking: '{{arbitrum.HorizonStaking.address}}', // Changed from L2Staking
  stakingExtension: '{{arbitrum.HorizonStaking.address}}', // Using same as staking
  curation: '{{arbitrum.L2Curation.address}}',
  rewardsManager: '{{arbitrum.RewardsManager.address}}',
  serviceRegistry: '{{arbitrum.LegacyServiceRegistry.address}}', // Changed from ServiceRegistry
  gns: '{{arbitrum.L2GNS.address}}',
  ens: '{{arbitrum.IENS.address}}',
  ensPublicResolver: '{{arbitrum.IPublicResolver.address}}',
  blockNumber: '',
  bridgeBlockNumber: '',
  network: '',
  tokenLockManager: '',
  subgraphNFT: '{{arbitrum.SubgraphNFT.address}}',
  l1GraphTokenGateway: '',
  l2GraphTokenGateway: '{{arbitrum.L2GraphTokenGateway.address}}',
  ethereumDIDRegistry: '{{arbitrum.IEthereumDIDRegistry.address}}',
  subgraphService: '{{arbitrum.SubgraphService.address}}',
  graphPayments: '{{arbitrum.GraphPayments.address}}',
  paymentsEscrow: '{{arbitrum.PaymentsEscrow.address}}',
  graphTallyCollector: '{{arbitrum.GraphTallyCollector.address}}',
  isL1: false,
}

const main = (): void => {
  try {
    let output = JSON.parse(mustache.render(JSON.stringify(addresses), combinedAddresses))
    output.blockNumber = '42440000' // Hardcoded a few thousand blocks before 1st contract deployed
    output.network = 'arbitrum-one'
    output.bridgeBlockNumber = '42449749' // Bridge deployment block on L2
    output.tokenLockManager = '0xFCf78AC094288D7200cfdB367A8CD07108dFa128'
    output.useTokenLockManager = false
    if(output.ethereumDIDRegistry == '') {
      output.ethereumDIDRegistry = '0xdCa7EF03e98e0DC2B855bE647C39ABe984fcF21B' // since the package doesn't have it yet
    }
    if(output.ens == '') {
      output.ens = '0x0000000000000000000000000000000000000000' // to avoid crashes due to bad config
    }
    // Set defaults for all missing addresses until the package has them
    if(output.controller == '') {
      output.controller = '0x0000000000000000000000000000000000000000'
    }
    if(output.graphToken == '') {
      output.graphToken = '0x0000000000000000000000000000000000000000'
    }
    if(output.epochManager == '') {
      output.epochManager = '0x0000000000000000000000000000000000000000'
    }
    if(output.disputeManager == '') {
      output.disputeManager = '0x0000000000000000000000000000000000000000'
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
    if(output.subgraphService == '') {
      output.subgraphService = '0x0000000000000000000000000000000000000000'
    }
    if(output.graphPayments == '') {
      output.graphPayments = '0x0000000000000000000000000000000000000000'
    }
    if(output.horizonDisputeManager == '') {
      output.horizonDisputeManager = '0x0000000000000000000000000000000000000000'
    }
    if(output.paymentsEscrow == '') {
      output.paymentsEscrow = '0x0000000000000000000000000000000000000000'
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