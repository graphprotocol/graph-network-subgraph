import { BigInt } from '@graphprotocol/graph-ts'
import { describe, test, assert } from 'matchstick-as/assembly/index'
import { calculateSaleReturn, FIXED_1 } from '../src/mappings/bancor'

describe('Bancor formula', () => {
  test('hex values parse from string', () => {
    assert.stringEquals('0x80000000000000000000000000000000', FIXED_1.toHexString())
  })
  test(
    'calculateSaleReturn compiles and throw error',
    () => {
      assert.bigIntEquals(
        calculateSaleReturn(
          BigInt.fromI32(0),
          BigInt.fromI32(0),
          BigInt.fromI32(0),
          BigInt.fromI32(0),
        ),
        BigInt.fromI32(0),
      )
    },
    true,
  )
})
