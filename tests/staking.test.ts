import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'

import { clearStore, test, assert, createMockedFunction } from 'matchstick-as/assembly/index'

import { Allocation, Epoch, GraphAccount, GraphNetwork, Indexer } from '../src/types/schema'
import { handleAllocationClosed } from '../src/mappings/staking'
import { mockAllocationClosed } from './factories/staking'
import {
  AllocationClosed,
  Staking__getAllocationResultValue0Struct,
} from '../src/types/Staking/Staking'

const indexerID = '0x0000000000000000000000000000000000000001'
const operatorID = '0x0000000000000000000000000000000000000002'
const otherAccountID = '0x0000000000000000000000000000000000000003'
const allocationID = '0x0000000000000000000000000000000000000033'
const deploymentID = '0x0000000000000000000000000000000000000044'
const poi = '0xdBAfB0D805Df2A8017D87E1fb7C474DE7a301ceb'

let event: AllocationClosed
let indexer: Indexer
let indexerAccount: GraphAccount
let allocation: Allocation
let operatorAccount: GraphAccount
let network: GraphNetwork
let epoch: Epoch

function before(): void {
  // Set up test entities
  indexer = new Indexer(indexerID)
  indexer.account = indexerID
  indexer.save()
  indexerAccount = new GraphAccount(indexerID)
  indexerAccount.operators = [operatorID]
  indexerAccount.save()

  allocation = new Allocation(allocationID)
  allocation.save()

  operatorAccount = new GraphAccount(operatorID)
  operatorAccount.operatorOf = [indexerID]
  operatorAccount.save()

  network = new GraphNetwork('1')
  network.epochLength = 1000
  network.currentEpoch = 1
  network.save()

  epoch = new Epoch('1')
  epoch.save()

  // Mock event
  event = mockAllocationClosed(
    changetype<Address>(Address.fromHexString(indexerID)),
    changetype<Bytes>(Bytes.fromHexString(deploymentID)),
    BigInt.fromI32(10),
    BigInt.fromI32(12312),
    changetype<Address>(Address.fromHexString(allocationID)),
    BigInt.fromI32(123123),
    changetype<Address>(Address.fromHexString(indexerID)),
    changetype<Bytes>(Bytes.fromHexString(poi)),
    false,
  )

  // Mock contract calls
  let stakingContractAddress = event.address
  let returnTuple = new Staking__getAllocationResultValue0Struct(8)
  returnTuple[0] = ethereum.Value.fromAddress(changetype<Address>(Address.fromHexString(indexerID)))
  returnTuple[1] = ethereum.Value.fromBytes(changetype<Bytes>(Bytes.fromHexString(deploymentID)))
  returnTuple[2] = ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))
  returnTuple[3] = ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))
  returnTuple[4] = ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))
  returnTuple[5] = ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))
  returnTuple[6] = ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))
  returnTuple[7] = ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))

  createMockedFunction(
    stakingContractAddress,
    'getAllocation',
    'getAllocation(address):((address,bytes32,uint256,uint256,uint256,uint256,uint256,uint256))',
  )
    .withArgs([
      ethereum.Value.fromAddress(changetype<Address>(Address.fromHexString(allocationID))),
    ])
    .returns([ethereum.Value.fromTuple(returnTuple)])
}

function after(): void {
  clearStore()
}

test('handleAllocationClosed doesnt increase forcedClosures if closed by indexer', () => {
  before()
  event.parameters[6].value = ethereum.Value.fromAddress(
    changetype<Address>(Address.fromHexString(indexerID)),
  )
  handleAllocationClosed(event)
  assert.fieldEquals('Indexer', indexerID, 'forcedClosures', '0')
  after()
})

test('handleAllocationClosed doesnt increase forcedClosures if closed by operator', () => {
  before()
  event.parameters[6].value = ethereum.Value.fromAddress(
    changetype<Address>(Address.fromHexString(operatorID)),
  )
  handleAllocationClosed(event)
  assert.fieldEquals('Indexer', indexerID, 'forcedClosures', '0')
  after()
})

test('handleAllocationClosed increases forcedClosures by 1 if not closed by indexer or operator', () => {
  before()
  event.parameters[6].value = ethereum.Value.fromAddress(
    changetype<Address>(Address.fromHexString(otherAccountID)),
  )
  handleAllocationClosed(event)
  assert.fieldEquals('Indexer', indexerID, 'forcedClosures', '1')
  after()
})
