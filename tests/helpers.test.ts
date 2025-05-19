import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'

import {
  assert,
  clearStore,
  test,
  afterAll,
  createMockedFunction,
} from 'matchstick-as/assembly/index'

import {
  createOrLoadIndexer,
  createOrLoadGraphAccount,
  createOrLoadGraphNetwork,
} from '../src/mappings/helpers/helpers'

let indexerID = '0xdbafb0d805df2a8017d87e1fb7c474de7a301ceb'
let indexerAddress = Address.fromString(indexerID)
let controllerID = '0xdbafb0d805df2a8017d87e1fb7c474de7a302ceb'
let controllerAddress = Address.fromString(controllerID)
const graphID = '0x0000000000000000000000000000000000000000'
const graphAddress = Address.fromString(graphID)
createMockedFunction(controllerAddress, 'getGovernor', 'getGovernor():(address)')
  .withArgs([])
  .returns([ethereum.Value.fromAddress(controllerAddress)])
// L2 graph network init EpochManager call
createMockedFunction(graphAddress, 'blockNum', 'blockNum():(uint256)')
.withArgs([])
.returns([ethereum.Value.fromI32(1)])

afterAll(() => {
  // Clear the store in order to start the next test off on a clean slate
  clearStore()
})

test('createOrLoadGraphNetwork creates a new graph network', () => {
  createOrLoadGraphNetwork(BigInt.fromI32(1), controllerAddress)
  assert.fieldEquals('GraphNetwork', '1', 'totalQueryFees', '0')
})

test('createOrLoadGraphAccount creates a new graph account', () => {
  createOrLoadGraphAccount(indexerAddress, BigInt.fromI32(1))
  assert.fieldEquals('GraphAccount', indexerID, 'balance', '0')
})

test('createOrLoadIndexer creates a new indexer', () => {
  createOrLoadIndexer(Bytes.fromHexString(indexerID), BigInt.fromI32(1))
  assert.fieldEquals('Indexer', indexerID, 'stakedTokens', '0')
  assert.fieldEquals('Indexer', indexerID, 'legacyIndexingRewardCut', '0')
})
