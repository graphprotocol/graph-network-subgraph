import { test, assert } from 'matchstick-as/assembly/index'
import { getAliasedL2SubgraphID } from '../src/mappings/helpers/helpers'
import { BigInt, log } from '@graphprotocol/graph-ts'

test('68799548758199140224151701590582019137924969401915573086349306511960790045480 -> 76518903584215901360101128371327830133575246547365152314382604005408245851193', () => {
  let input = BigInt.fromString(
    '68799548758199140224151701590582019137924969401915573086349306511960790045480',
  )
  let expectedOutput = BigInt.fromString(
    '76518903584215901360101128371327830133575246547365152314382604005408245851193',
  )
  testAliasedL2ID(input, expectedOutput)
})

function testAliasedL2ID(input: BigInt, expectedOutput: BigInt): void {
  let output = getAliasedL2SubgraphID(input)
  assert.assertTrue(output == expectedOutput)
}
