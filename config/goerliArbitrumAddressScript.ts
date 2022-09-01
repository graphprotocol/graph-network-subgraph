import * as fs from 'fs'
import * as mustache from 'mustache'
import * as networkAddresses from '@graphprotocol/contracts/addresses.json'
import { Addresses } from './addresses.template'

// mustache doesn't like numbered object keys
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renameAddresses: any = networkAddresses
renameAddresses['arbitrum-goerli'] = networkAddresses['421613']

export let addresses: Addresses = {
  controller: '{{arbitrum-goerli.Controller.address}}',
  graphToken: '{{arbitrum-goerli.L2GraphToken.address}}',
  epochManager: '{{arbitrum-goerli.EpochManager.address}}',
  disputeManager: '{{arbitrum-goerli.DisputeManager.address}}',
  staking: '{{arbitrum-goerli.Staking.address}}',
  curation: '{{arbitrum-goerli.Curation.address}}',
  rewardsManager: '{{arbitrum-goerli.RewardsManager.address}}',
  serviceRegistry: '{{arbitrum-goerli.ServiceRegistry.address}}',
  gns: '{{arbitrum-goerli.GNS.address}}',
  ens: '{{arbitrum-goerli.IENS.address}}',
  ensPublicResolver: '{{arbitrum-goerli.IPublicResolver.address}}',
  blockNumber: '',
  network: '',
  tokenLockManager: '',
  subgraphNFT: '{{arbitrum-goerli.SubgraphNFT.address}}',
}

const main = (): void => {
  try {
    let output = JSON.parse(mustache.render(JSON.stringify(addresses), renameAddresses))
    output.blockNumber = '10000' // Hardcoded from before first contract deploy of the latest phase
    output.network = 'arbitrum-goerli'
    output.tokenLockManager = '0x9a7a54e86560f4304d8862Ea00F45D1090c59ac8' // we don't have one, this is rinkebys'
    output.useTokenLockManager = false
    fs.writeFileSync(__dirname + '/generatedAddresses.json', JSON.stringify(output, null, 2))
  } catch (e) {
    console.log(`Error saving artifacts: ${e.message}`)
  }
}

main()
