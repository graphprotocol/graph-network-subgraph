import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'

import {
  clearStore,
  beforeAll,
  describe,
  afterAll,
  createMockedFunction,
} from 'matchstick-as/assembly/index'

import { createOrLoadGraphNetwork } from '../src/mappings/helpers/helpers'

const controllerID = '0x0000000000000000000000000000000000000001'
const controllerAddress = Address.fromString(controllerID)

// MOCKS
// createOrLoadGraphNetwork calls the getGovernor function of controllerAddress so we mock it here
createMockedFunction(controllerAddress, 'getGovernor', 'getGovernor():(address)')
  .withArgs([])
  .returns([ethereum.Value.fromAddress(controllerAddress)])

// CONSTANTS
const blockNumber = BigInt.fromI32(1)

describe('SetDefaultName', () => {
  beforeAll(() => {
    createOrLoadGraphNetwork(blockNumber, controllerAddress)
  })

  afterAll(() => {
    // Clear the store in order to start the next test off on a clean slate
    clearStore()
  })
})
