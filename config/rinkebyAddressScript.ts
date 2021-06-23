import * as fs from 'fs'
import * as mustache from 'mustache'
import * as networkAddresses from '@graphprotocol/contracts/addresses.json'
import { Addresses } from './addresses.template'

// mustache doesn't like numbered object keys
let renameAddresses: any = networkAddresses
renameAddresses['rinkeby'] = networkAddresses['4']

export let addresses: Addresses = {
  controller: '{{rinkeby.Controller.address}}',
  graphToken: '{{rinkeby.GraphToken.address}}',
  epochManager: '{{rinkeby.EpochManager.address}}',
  disputeManager: '{{rinkeby.DisputeManager.address}}',
  staking: '{{rinkeby.Staking.address}}',
  curation: '{{rinkeby.Curation.address}}',
  rewardsManager: '{{rinkeby.RewardsManager.address}}',
  serviceRegistry: '{{rinkeby.ServiceRegistry.address}}',
  gns: '{{rinkeby.GNS.address}}',
  ens: '{{rinkeby.IENS.address}}',
  ensPublicResolver: '{{rinkeby.IPublicResolver}}',
  blockNumber: '',
  network: '',
  tokenLockManager: '',
}

const main = (): void => {
  try {
    let output = JSON.parse(mustache.render(JSON.stringify(addresses), renameAddresses))
    output.blockNumber = '7560000' // Hardcoded from first contract deploy of the latest phase
    output.network = 'rinkeby'
    output.tokenLockManager = '0x7B0809048370E69aC0C0844E1188Ecd3aB3A0C5f'
    fs.writeFileSync(__dirname + '/generatedAddresses.json', JSON.stringify(output, null, 2))
  } catch (e) {
    console.log(`Error saving artifacts: ${e.message}`)
  }
}

main()
