import * as fs from 'fs'
import * as mustache from 'mustache'
import * as networkAddresses from '@graphprotocol/contracts/addresses.json'
import { Addresses } from './addresses.template'

// mustache doesn't like numbered object keys
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renameAddresses: any = networkAddresses
renameAddresses['goerli'] = networkAddresses['5']

export let addresses: Addresses = {
  controller: '{{goerli.Controller.address}}',
  graphToken: '{{goerli.GraphToken.address}}',
  epochManager: '{{goerli.EpochManager.address}}',
  disputeManager: '{{goerli.DisputeManager.address}}',
  staking: '{{goerli.Staking.address}}',
  curation: '{{goerli.Curation.address}}',
  rewardsManager: '{{goerli.RewardsManager.address}}',
  serviceRegistry: '{{goerli.ServiceRegistry.address}}',
  gns: '{{goerli.GNS.address}}',
  ens: '{{goerli.IENS.address}}',
  ensPublicResolver: '{{goerli.IPublicResolver.address}}',
  blockNumber: '',
  bridgeBlockNumber: '',
  network: '',
  tokenLockManager: '',
  subgraphNFT: '{{goerli.SubgraphNFT.address}}',
  l1GraphTokenGateway: '{{goerli.L1GraphTokenGateway.address}}',
  l2GraphTokenGateway: '',
  ethereumDIDRegistry: '{{goerli.IEthereumDIDRegistry.address}}',
  isL1: true,
}

const main = (): void => {
  try {
    let output = JSON.parse(mustache.render(JSON.stringify(addresses), renameAddresses))
    output.blockNumber = '7210000' // Hardcoded from before first contract deploy of the latest phase
    output.bridgeBlockNumber = '7891183' // Bridge deployment block on L1
    output.network = 'goerli'
    output.tokenLockManager = '0x9a7a54e86560f4304d8862Ea00F45D1090c59ac8' // we don't have one, this is rinkebys'
    output.useTokenLockManager = true
    fs.writeFileSync(__dirname + '/generatedAddresses.json', JSON.stringify(output, null, 2))
  } catch (e) {
    console.log(`Error saving artifacts: ${e.message}`)
  }
}

main()
