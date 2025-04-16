import * as fs from 'fs'
import * as mustache from 'mustache'
// Replace with proper imports once the packages are published
import * as networkAddresses from '/opt/contracts.json'
import { Addresses } from './addresses.template'

// mustache doesn't like numbered object keys
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renameAddresses: any = networkAddresses
renameAddresses['localnetwork'] = networkAddresses['1337']

export let addresses: Addresses = {
  controller: '{{localnetwork.Controller.address}}',
  graphToken: '{{localnetwork.L2GraphToken.address}}',
  epochManager: '{{localnetwork.EpochManager.address}}',
  disputeManager: '{{localnetwork.DisputeManager.address}}',
  staking: '{{localnetwork.HorizonStaking.address}}',
  stakingExtension: '{{localnetwork.HorizonStaking.address}}',
  curation: '{{localnetwork.L2Curation.address}}',
  rewardsManager: '{{localnetwork.RewardsManager.address}}',
  serviceRegistry: '0x0000000000000000000000000000000000000000',
  gns: '{{localnetwork.L2GNS.address}}',
  ens: '{{localnetwork.IENS.address}}',
  ensPublicResolver: '{{localnetwork.IPublicResolver.address}}',
  blockNumber: '',
  bridgeBlockNumber: '',
  network: '',
  tokenLockManager: '',
  subgraphNFT: '{{localnetwork.SubgraphNFT.address}}',
  l1GraphTokenGateway: '',
  l2GraphTokenGateway: '{{localnetwork.L2GraphTokenGateway.address}}',
  ethereumDIDRegistry: '{{localnetwork.EthereumDIDRegistry.address}}',
  subgraphService: '{{localnetwork.SubgraphService.address}}',
  graphPayments: '{{localnetwork.GraphPayments.address}}',
  isL1: false,
}

const main = (): void => {
  try {
    let output = JSON.parse(mustache.render(JSON.stringify(addresses), renameAddresses))
    output.blockNumber = '1'
    output.bridgeBlockNumber = '1'
    output.network = 'hardhat'
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
    fs.writeFileSync(__dirname + '/generatedAddresses.json', JSON.stringify(output, null, 2))
  } catch (e) {
    console.log(`Error saving artifacts: ${e.message}`)
  }
}

main()
