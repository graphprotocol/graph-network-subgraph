import * as fs from 'fs'

import * as networkAddresses from '@graphprotocol/contracts/addresses.json'
import * as mustache from 'mustache'

// mustache doesn't like numbered object keys
// TODO - get the contracts to not import with number from npm package
let renameAddresses: any = networkAddresses
renameAddresses['rinkeby'] = networkAddresses['4']

export interface Addresses {
  graphToken: string
  epochManager: string
  disputeManager: string
  staking: string
  curation: string
  rewardsManager: string
  serviceRegistry: string
  gns: string
  ens: string
  ensPublicResolver: string
}

export let addresses: Addresses = {
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
}

const main = (): void => {
  try {
    let output = JSON.parse(mustache.render(JSON.stringify(addresses), renameAddresses))
    // blockNumber = Hardcoded value about 1000 before our first contract, helps the subgraph skip early blocks for syncing
    output.blockNumber = '6900000'
    output.network = 'rinkeby' // Todo - make dynamic
    fs.writeFileSync(__dirname + '/generatedAddresses.json', JSON.stringify(output, null, 2))
  } catch (e) {
    console.log(`Error saving artifacts: ${e.message}`)
  }
}

main()
