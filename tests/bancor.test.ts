import { BigInt } from '@graphprotocol/graph-ts'
import { describe, test, assert } from 'matchstick-as/assembly/index'
import { calculateSaleReturn, hexToBI } from '../src/mappings/bancor'

describe('Bancor formula', () => {
  test('hex values parse from string', () => {
    assert.stringEquals(
      '0x80000000000000000000000000000000',
      hexToBI('0x80000000000000000000000000000000').toHexString(),
    )
  })
  test('calculateSaleReturn calculate examples', () => {
    assert.bigIntEquals(
      BigInt.fromString('44789'),
      calculateSaleReturn(
        BigInt.fromString('447898935798884503988'),
        BigInt.fromString('200613456689773262686807'),
        BigInt.fromString('500000'),
        BigInt.fromString('50'),
      ),
    )
    assert.bigIntEquals(
      BigInt.fromString('4478989'),
      calculateSaleReturn(
        BigInt.fromString('447898935798884503988'),
        BigInt.fromString('200613456689773262686807'),
        BigInt.fromString('500000'),
        BigInt.fromString('5000'),
      ),
    )
    assert.bigIntEquals(
      BigInt.fromString('4460894'),
      calculateSaleReturn(
        BigInt.fromString('439706849299598657996'),
        BigInt.fromString('196148601167763635250496'),
        BigInt.fromString('500000'),
        BigInt.fromString('5000'),
      ),
    )
    assert.bigIntEquals(
      BigInt.fromString('892'),
      calculateSaleReturn(
        BigInt.fromString('439706849299598657996'),
        BigInt.fromString('196148601167763635250496'),
        BigInt.fromString('500000'),
        BigInt.fromString('1'),
      ),
    )
  })
  test('calculateSaleReturn with some zeroes', () => {
    assert.bigIntEquals(
      calculateSaleReturn(
        BigInt.fromString('447898935798884503988'),
        BigInt.fromString('200613456689773262686807'),
        BigInt.fromString('500000'),
        BigInt.fromString('0'),
      ),
      BigInt.fromString('0'),
    )
  })
})
