import { BigInt, ByteArray, Bytes } from '@graphprotocol/graph-ts'
import { describe, test, assert, log } from 'matchstick-as/assembly/index'

describe('Hex BIGINT parser', () => {
  test('hex values parse from string', () => {
    let hexString = '0x80000000000000000000000000000000'
    let bytes = changetype<Bytes>(Bytes.fromHexString(hexString).reverse())
    let BIValue = BigInt.fromUnsignedBytes(bytes)
    log.info("BI LENTH {}", [BIValue.length.toString()])
    assert.bigIntEquals(BIValue, BigInt.fromString("170141183460469231731687303715884105728"))
    assert.stringEquals(hexString, BIValue.toHexString())
  })
})
