import * as fs from 'fs'
import * as mustache from 'mustache'
import { Addresses } from './addresses.template'

const horizonAddresses = require('@graphprotocol/address-book/horizon/addresses.json')
const subgraphServiceAddresses = require('@graphprotocol/address-book/subgraph-service/addresses.json')

// mustache doesn't like numbered object keys
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renameHorizonAddresses: any = horizonAddresses
renameHorizonAddresses['arbitrum'] = horizonAddresses['42161'] || {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let renameSubgraphServiceAddresses: any = subgraphServiceAddresses
renameSubgraphServiceAddresses['arbitrum'] = subgraphServiceAddresses['42161'] || {}

const combinedAddresses = {
  arbitrum: {
    ...renameHorizonAddresses['arbitrum'],
    ...renameSubgraphServiceAddresses['arbitrum']
  }
}

export let addresses: Addresses = {
  controller: '0x0000000000000000000000000000000000000001',
  graphToken: '0x0000000000000000000000000000000000000000',
  epochManager: '0x0000000000000000000000000000000000000000',
  disputeManager: '0x0000000000000000000000000000000000000000',
  horizonDisputeManager: '0x0000000000000000000000000000000000000000',
  staking: '0x0000000000000000000000000000000000000000',
  stakingExtension: '0x0000000000000000000000000000000000000000',
  curation: '0x0000000000000000000000000000000000000000',
  rewardsManager: '0x0000000000000000000000000000000000000000',
  serviceRegistry: '0x0000000000000000000000000000000000000000',
  gns: '0x0000000000000000000000000000000000000000',
  ens: '0x0000000000000000000000000000000000000000',
  ensPublicResolver: '0x0000000000000000000000000000000000000000',
  blockNumber: '',
  bridgeBlockNumber: '',
  network: '',
  tokenLockManager: '',
  subgraphNFT: '0x0000000000000000000000000000000000000000',
  l1GraphTokenGateway: '',
  l2GraphTokenGateway: '0x0000000000000000000000000000000000000000',
  ethereumDIDRegistry: '0x0000000000000000000000000000000000000000',
  subgraphService: '0x0000000000000000000000000000000000000000',
  graphPayments: '0x0000000000000000000000000000000000000000',
  paymentsEscrow: '0x0000000000000000000000000000000000000000',
  graphTallyCollector: '0x0000000000000000000000000000000000000000',
  isL1: false,
}

const main = (): void => {
  try {
    let output = JSON.parse(mustache.render(JSON.stringify(addresses), combinedAddresses))
    output.blockNumber = '0' // Hardcoded a few thousand blocks before 1st contract deployed
    output.network = 'arbitrum-one'
    output.bridgeBlockNumber = '0' // Bridge deployment block on L2
    output.tokenLockManager = '0x0000000000000000000000000000000000000000'
    output.useTokenLockManager = false
    if(output.ethereumDIDRegistry == '') {
      output.ethereumDIDRegistry = '0x0000000000000000000000000000000000000000' // since the package doesn't have it yet
    }
    if(output.ens == '') {
      output.ens = '0x0000000000000000000000000000000000000000' // to avoid crashes due to bad config
    }
    fs.writeFileSync(__dirname + '/generatedAddresses.json', JSON.stringify(output, null, 2))
  } catch (e) {
    console.log(`Error saving artifacts: ${e.message}`)
  }
}

main()