import { ByteArray, Bytes } from '@graphprotocol/graph-ts';


// Wrap arguments with this function if (and only if) one of the arguments is an array or 'bytes' or 'string' (i.e. variable length arg)
// See:
// - https://medium.com/@r2d2_68242/indexing-transaction-input-data-in-a-subgraph-6ff5c55abf20
// - https://ethereum.stackexchange.com/questions/114582/the-graph-nodes-cant-decode-abi-encoded-data-containing-arrays
// - https://github.com/enzymefinance/subgraphs/blob/main/packages/utils/utils/decode.ts
export function tuplePrefixBytes(input: Bytes): Bytes {
  let inputTypedArray = input.subarray(0);

  let tuplePrefix = ByteArray.fromHexString('0x0000000000000000000000000000000000000000000000000000000000000020');

  let inputAsTuple = new Uint8Array(tuplePrefix.length + inputTypedArray.length);

  inputAsTuple.set(tuplePrefix, 0);
  inputAsTuple.set(inputTypedArray, tuplePrefix.length);

  return Bytes.fromUint8Array(inputAsTuple);
}