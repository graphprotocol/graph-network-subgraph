import * as fs from 'fs'

import * as networkAddresses from '@graphprotocol/contracts/addresses.json'
import * as mustache from 'mustache'

// mustache doesn't like numbered object keys
// TODO - get the contracts to not import with number from npm package
let renameAddresses: any = networkAddresses
renameAddresses['ourRinkeby'] = networkAddresses['4']

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
  graphToken: '{{ourRinkeby.GraphToken.address}}',
  epochManager: '{{ourRinkeby.EpochManager.address}}',
  disputeManager: '{{ourRinkeby.DisputeManager.address}}',
  staking: '{{ourRinkeby.Staking.address}}',
  curation: '{{ourRinkeby.Curation.address}}',
  rewardsManager: '{{ourRinkeby.RewardsManager.address}}',
  serviceRegistry: '{{ourRinkeby.ServiceRegistry.address}}',
  gns: '{{ourRinkeby.GNS.address}}',
  ens: '{{rinkeby.ens}}',
  ensPublicResolver: '{{rinkeby.ensPublicResolver}}',
}

const main = (): void => {
  try {
    let output = JSON.parse(mustache.render(JSON.stringify(addresses), renameAddresses))
    output.blockNumber = '6900000'
    output.network = 'rinkeby' // Todo - make dynamic
    fs.writeFileSync(__dirname + '/generatedAddresses.json', JSON.stringify(output, null, 2))
  } catch (e) {
    console.log(`Error saving artifacts: ${e.message}`)
  }
}

main()
