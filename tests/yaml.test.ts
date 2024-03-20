import { test, assert } from 'matchstick-as/assembly/index'
import { getManifestFieldFromExtract } from '../src/mappings/ipfs'

test('Check get field from extract', () => {
  let extract = "dataSources:\n  - kind: ethereum\n    mapping:\n      abis:\n        - file:\n            /: /ipfs/QmdxvRJHRaDpLKYdiQJ294CxtEQExftBmnFxsqrMKcyja2\n          name: milady\n      apiVersion: 0.0.7\n      entities:\n        - Approval\n        - ApprovalForAll\n        - OwnershipTransferred\n        - Transfer\n      eventHandlers:\n        - event: 'Approval(indexed address,indexed address,indexed uint256)'\n          handler: handleApproval\n        - event: 'ApprovalForAll(indexed address,indexed address,bool)'\n          handler: handleApprovalForAll\n        - event: 'OwnershipTransferred(indexed address,indexed address)'\n          handler: handleOwnershipTransferred\n        - event: 'Transfer(indexed address,indexed address,indexed uint256)'\n          handler: handleTransfer\n      file:\n        /: /ipfs/QmXtmRDcZNNR2FnzAgULcLQVnV89fEAowJXipSpfCgKZEp\n      kind: ethereum/events\n      language: wasm/assemblyscript\n    name: milady\n    network: mainnet\n    source:\n      abi: milady\n      address: '0x5af0d9827e0c53e4799bb226655a1de152a425a5'\n      startBlock: 13090020\ndescription: Mailady NFT Subgraph\nschema:\n  file:\n    /: /ipfs/QmP8HWfXhWums3QTxMJ24e83ZnUkHmRVmHo6aTMYh31N72\nspecVersion: 0.0.5\n"
  let name = getManifestFieldFromExtract(extract, "name")
  let apiVersion = getManifestFieldFromExtract(extract, "apiVersion")
  let network = getManifestFieldFromExtract(extract, "network")
  let address = getManifestFieldFromExtract(extract, "address")
  assert.stringEquals("milady", name)
  assert.stringEquals("0.0.7", apiVersion)
  assert.stringEquals("mainnet", network)
  assert.stringEquals("0x5af0d9827e0c53e4799bb226655a1de152a425a5", address)
})