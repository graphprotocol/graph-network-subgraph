import * as fs from 'fs'

import * as networkAddresses from '@graphprotocol/contracts/addresses.json'
import * as mustache from 'mustache'

// mustache doesn't like numbered object keys
// TODO - get the contracts to not import with number from npm package
let renameAddresses: any = networkAddresses
renameAddresses['ourKovan'] = networkAddresses['42']

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
  graphToken: '{{ourKovan.GraphToken.address}}',
  epochManager: '{{ourKovan.EpochManager.address}}',
  disputeManager: '{{ourKovan.DisputeManager.address}}',
  staking: '{{ourKovan.Staking.address}}',
  curation: '{{ourKovan.Curation.address}}',
  rewardsManager: '{{ourKovan.RewardsManager.address}}',
  serviceRegistry: '{{ourKovan.ServiceRegistry.address}}',
  gns: '{{ourKovan.GNS.address}}',
  ens: '{{kovan.ens}}',
  ensPublicResolver: '{{kovan.ensPublicResolver}}',
}

const main = (): void => {
  try {
    let output = JSON.parse(mustache.render(JSON.stringify(addresses), renameAddresses))
    // blockNumber = Hardcoded value about 1000 before our first contract, helps the subgraph skip early blocks for syncing
    output.blockNumber = '19750000'
    output.network = 'kovan' // Todo - make dynamic
    fs.writeFileSync(__dirname + '/generatedAddresses.json', JSON.stringify(output, null, 2))
  } catch (e) {
    console.log(`Error saving artifacts: ${e.message}`)
  }
}

main()
