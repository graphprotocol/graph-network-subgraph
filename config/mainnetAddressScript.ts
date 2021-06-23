import * as fs from 'fs'
import * as mustache from 'mustache'
import * as networkAddresses from '@graphprotocol/contracts/addresses.json'
import { Addresses } from './addresses.template'

// mustache doesn't like numbered object keys
let renameAddresses: any = networkAddresses
renameAddresses['mainnet'] = networkAddresses['1']

export let addresses: Addresses = {
  controller: '{{mainnet.Controller.address}}',
  graphToken: '{{mainnet.GraphToken.address}}',
  epochManager: '{{mainnet.EpochManager.address}}',
  disputeManager: '{{mainnet.DisputeManager.address}}',
  staking: '{{mainnet.Staking.address}}',
  curation: '{{mainnet.Curation.address}}',
  rewardsManager: '{{mainnet.RewardsManager.address}}',
  serviceRegistry: '{{mainnet.ServiceRegistry.address}}',
  gns: '{{mainnet.GNS.address}}',
  ens: '{{mainnet.IENS.address}}',
  ensPublicResolver: '{{mainnet.IPublicResolver}}',
  blockNumber: '',
  network: '',
  tokenLockManager: ''
}

const main = (): void => {
  try {
    let output = JSON.parse(mustache.render(JSON.stringify(addresses), renameAddresses))
    output.blockNumber = '11440000' // Hardcoded a few thousand blocks before 1st contract deployed
    output.network = 'mainnet'
    output.tokenLockManager = "0xFCf78AC094288D7200cfdB367A8CD07108dFa128"
    fs.writeFileSync(__dirname + '/generatedAddresses.json', JSON.stringify(output, null, 2))
  } catch (e) {
    console.log(`Error saving artifacts: ${e.message}`)
  }
}

main()
