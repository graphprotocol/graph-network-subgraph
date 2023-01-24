import * as fs from 'fs'
import * as mustache from 'mustache'
import * as networkAddresses from '@graphprotocol/contracts/addresses.json'
import { Addresses } from './addresses.template'

// mustache doesn't like numbered object keys
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renameAddresses: any = networkAddresses
renameAddresses['arbitrum'] = networkAddresses['42161']

export let addresses: Addresses = {
  controller: '{{arbitrum.Controller.address}}',
  graphToken: '{{arbitrum.L2GraphToken.address}}',
  epochManager: '{{arbitrum.EpochManager.address}}',
  disputeManager: '{{arbitrum.DisputeManager.address}}',
  staking: '{{arbitrum.Staking.address}}',
  curation: '{{arbitrum.Curation.address}}',
  rewardsManager: '{{arbitrum.RewardsManager.address}}',
  serviceRegistry: '{{arbitrum.ServiceRegistry.address}}',
  gns: '{{arbitrum.GNS.address}}',
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
  isL1: false,
}

const main = (): void => {
  try {
    let output = JSON.parse(mustache.render(JSON.stringify(addresses), renameAddresses))
    output.blockNumber = '42440000' // Hardcoded a few thousand blocks before 1st contract deployed
    output.network = 'arbitrum-one'
    output.bridgeBlockNumber = '42449749' // Bridge deployment block on L2
    output.tokenLockManager = '0xFCf78AC094288D7200cfdB367A8CD07108dFa128'
    output.useTokenLockManager = false
    if(output.ethereumDIDRegistry == '') {
      output.ethereumDIDRegistry = '0xdCa7EF03e98e0DC2B855bE647C39ABe984fcF21B' // since the package doens't have it yet
    }
    fs.writeFileSync(__dirname + '/generatedAddresses.json', JSON.stringify(output, null, 2))
  } catch (e) {
    console.log(`Error saving artifacts: ${e.message}`)
  }
}

main()
