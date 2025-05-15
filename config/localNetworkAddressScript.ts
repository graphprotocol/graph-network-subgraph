import * as fs from 'fs'
import * as mustache from 'mustache'
// Replace with proper imports once the packages are published
import * as horizonAddresses from '/opt/horizon.json'
import * as subgraphServiceAddresses from '/opt/subgraph-service.json'
import { Addresses } from './addresses.template'

// mustache doesn't like numbered object keys
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renameAddresses: any = {
  horizon: horizonAddresses['1337'],
  subgraphService: subgraphServiceAddresses['1337'],
}

export let addresses: Addresses = {
  controller: '{{horizon.Controller.address}}',
  graphToken: '{{horizon.L2GraphToken.address}}',
  epochManager: '{{horizon.EpochManager.address}}',
  disputeManager: '{{subgraphService.DisputeManager.address}}',
  staking: '{{horizon.HorizonStaking.address}}',
  stakingExtension: '{{horizon.HorizonStaking.address}}',
  curation: '{{horizon.L2Curation.address}}',
  rewardsManager: '{{horizon.RewardsManager.address}}',
  serviceRegistry: '0x0000000000000000000000000000000000000000',
  gns: '{{horizon.L2GNS.address}}',
  ens: '{{horizon.IENS.address}}',
  ensPublicResolver: '{{horizon.IPublicResolver.address}}',
  blockNumber: '',
  bridgeBlockNumber: '',
  network: '',
  tokenLockManager: '',
  subgraphNFT: '{{horizon.SubgraphNFT.address}}',
  l1GraphTokenGateway: '',
  l2GraphTokenGateway: '{{horizon.L2GraphTokenGateway.address}}',
  ethereumDIDRegistry: '{{horizon.EthereumDIDRegistry.address}}',
  subgraphService: '{{subgraphService.SubgraphService.address}}',
  graphPayments: '{{horizon.GraphPayments.address}}',
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
    // TODO: Remove this once subgraph service scripts deploy GNS and SubgraphNFT
    if(output.gns == '') {
      output.gns = '0x0000000000000000000000000000000000000000' // to avoid crashes due to bad config
    }
    if(output.subgraphNFT == '') {
      output.subgraphNFT = '0x0000000000000000000000000000000000000000' // to avoid crashes due to bad config
    }
    fs.writeFileSync(__dirname + '/generatedAddresses.json', JSON.stringify(output, null, 2))
  } catch (e) {
    console.log(`Error saving artifacts: ${e.message}`)
  }
}

main()
