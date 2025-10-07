/* eslint-disable @typescript-eslint/no-var-requires */
import * as fs from 'fs'
import * as mustache from 'mustache'
import { Addresses } from './addresses.template'

const horizonAddresses = require('@graphprotocol/address-book/horizon/addresses.json')
const subgraphServiceAddresses = require('@graphprotocol/address-book/subgraph-service/addresses.json')

// mustache doesn't like numbered object keys
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renameHorizonAddresses: any = horizonAddresses
renameHorizonAddresses['arbsep'] = horizonAddresses['421614']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renameSubgraphServiceAddresses: any = subgraphServiceAddresses
renameSubgraphServiceAddresses['arbsep'] = subgraphServiceAddresses['421614']

const combinedAddresses = {
  arbsep: {
    ...renameHorizonAddresses['arbsep'],
    ...renameSubgraphServiceAddresses['arbsep']
  }
}

export let addresses: Addresses = {
  controller: '{{arbsep.Controller.address}}',
  graphToken: '{{arbsep.L2GraphToken.address}}',
  epochManager: '{{arbsep.EpochManager.address}}',
  disputeManager: '{{arbsep.LegacyDisputeManager.address}}',
  horizonDisputeManager: '{{arbsep.DisputeManager.address}}',
  staking: '{{arbsep.HorizonStaking.address}}',
  stakingExtension: '{{arbsep.HorizonStaking.address}}',
  curation: '{{arbsep.L2Curation.address}}',
  rewardsManager: '{{arbsep.RewardsManager.address}}',
  serviceRegistry: '{{arbsep.LegacyServiceRegistry.address}}',
  gns: '{{arbsep.L2GNS.address}}',
  ens: '{{arbsep.IENS.address}}',
  ensPublicResolver: '{{arbsep.IPublicResolver.address}}',
  blockNumber: '',
  bridgeBlockNumber: '',
  network: '',
  tokenLockManager: '',
  subgraphNFT: '{{arbsep.SubgraphNFT.address}}',
  l1GraphTokenGateway: '',
  l2GraphTokenGateway: '{{arbsep.L2GraphTokenGateway.address}}',
  ethereumDIDRegistry: '{{arbsep.EthereumDIDRegistry.address}}',
  subgraphService: '{{arbsep.SubgraphService.address}}',
  graphPayments: '{{arbsep.GraphPayments.address}}',
  paymentsEscrow: '{{arbsep.PaymentsEscrow.address}}',
  graphTallyCollector: '{{arbsep.GraphTallyCollector.address}}',
  isL1: false,
}

const main = (): void => {
  try {
    let output = JSON.parse(mustache.render(JSON.stringify(addresses), combinedAddresses))
    output.blockNumber = '570450'
    output.bridgeBlockNumber = '570450'
    output.network = 'arbitrum-sepolia'
    output.useTokenLockManager = false
    if(output.ens == '') {
      output.ens = '0x0000000000000000000000000000000000000000'
    }
    if(output.ethereumDIDRegistry == '') {
      output.ethereumDIDRegistry = '0xF5f4cA61481558709AFa94AdEDa7B5F180f4AD59'
    }
    fs.writeFileSync(__dirname + '/generatedAddresses.json', JSON.stringify(output, null, 2))
  } catch (e) {
    console.log(`Error saving artifacts: ${e.message}`)
  }
}

main()