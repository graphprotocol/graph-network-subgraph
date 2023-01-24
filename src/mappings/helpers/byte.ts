import { BigInt, ByteArray, Bytes } from "@graphprotocol/graph-ts";

export function numberToBytes(num: u64): ByteArray {
  return stripZeros(Bytes.fromU64(num).reverse());
}

export function bigIntToBytes(num: BigInt): Bytes {
  return Bytes.fromUint8Array(stripZeros(Bytes.fromBigInt(num).reverse()));
}

export function stripZeros(bytes: Uint8Array): ByteArray {
  let i = 0;
  while (i < bytes.length && bytes[i] == 0) {
    i++;
  }
  return Bytes.fromUint8Array(bytes.slice(i));
}

export function strip0xPrefix(input: string): string {
  return input.startsWith("0x") ? input.slice(2) : input;
}

// Pads a hex string with zeros to 64 characters
export function padZeros(input: string): string {
  let data = strip0xPrefix(input);
  return "0x".concat(data.padStart(64, "0"));
}

export function ensureEvenLength(input: string): string {
  if (input.length % 2 == 0) return input
  return "0x0".concat(strip0xPrefix(input.toString()));
}