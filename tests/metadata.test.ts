import { assert, test } from "matchstick-as/assembly/index"
import { Address, BigInt, DataSourceContext, store, Value, Bytes, log, ethereum } from "@graphprotocol/graph-ts"
import { standardizeAddress } from '../src/mappings/helpers'

test("testStandardizeAddresses", () => {
  let addresses = [
    "f55041e37e12cd407ad00ce2910b8269b01263b9",
    "F55041E37E12cD407ad00CE2910B8269B01263b9",
    "0xf55041e37e12cd407ad00ce2910b8269b01263b9",
    "0xF55041E37E12cD407ad00CE2910B8269B01263b9",
  ]
  
  addresses.forEach(function(x) {
    let stdAddr = standardizeAddress(x);
    let refAddr = "0xf55041e37e12cd407ad00ce2910b8269b01263b9";
    assert.equals(ethereum.Value.fromString(stdAddr),ethereum.Value.fromString(refAddr));
  });
})
