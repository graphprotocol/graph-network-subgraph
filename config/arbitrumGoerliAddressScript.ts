import * as fs from 'fs'
import * as mustache from 'mustache'
import * as networkAddresses from '@graphprotocol/contracts/addresses.json'
import { Addresses } from './addresses.template'

// mustache doesn't like numbered object keys
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renameAddresses: any = networkAddresses
renameAddresses['arbgor'] = networkAddresses['421613']

export let addresses: Addresses = {
  controller: '{{arbgor.Controller.address}}',
  graphToken: '{{arbgor.L2GraphToken.address}}',
  epochManager: '{{arbgor.EpochManager.address}}',
  disputeManager: '{{arbgor.DisputeManager.address}}',
  staking: '{{arbgor.Staking.address}}',
  curation: '{{arbgor.Curation.address}}',
  rewardsManager: '{{arbgor.RewardsManager.address}}',
  serviceRegistry: '{{arbgor.ServiceRegistry.address}}',
  gns: '{{arbgor.GNS.address}}',
  ens: '{{arbgor.IENS.address}}',
  ensPublicResolver: '{{arbgor.IPublicResolver.address}}',
  blockNumber: '',
  bridgeBlockNumber: '',
  network: '',
  tokenLockManager: '',
  subgraphNFT: '{{arbgor.SubgraphNFT.address}}',
  l1GraphTokenGateway: '',
  l2GraphTokenGateway: '{{arbgor.L2GraphTokenGateway.address}}',
  ethereumDIDRegistry: '{{arbgor.IEthereumDIDRegistry.address}}',
  isL1: false,
}

const main = (): void => {
  try {
    let output = JSON.parse(mustache.render(JSON.stringify(addresses), renameAddresses))
    output.blockNumber = '1023264' // Protocol deployment
    output.bridgeBlockNumber = '1023318' // Bridge deployment block on L2
    output.network = 'arbitrum-goerli'
    output.useTokenLockManager = false
    fs.writeFileSync(__dirname + '/generatedAddresses.json', JSON.stringify(output, null, 2))
  } catch (e) {
    console.log(`Error saving artifacts: ${e.message}`)
  }
}

main()
