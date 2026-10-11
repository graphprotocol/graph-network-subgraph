import { BigInt, YAMLValue } from '@graphprotocol/graph-ts'

// Avoid YAMLValue's [] accessor: it asserts when a key is absent.
export function yamlField(value: YAMLValue | null, key: string): YAMLValue | null {
  if (value === null || !value.isObject()) return null
  return value.toObject().get(YAMLValue.newString(key))
}

export function yamlString(value: YAMLValue | null): string | null {
  if (value === null || !value.isString()) return null
  let text = value.toString().trim()
  return text.length > 0 ? text : null
}

// Block numbers must be unsigned integers. YAML NUMBER also includes floats,
// and YAMLValue.toBigInt() does not protect against invalid numeric strings.
export function manifestStartBlock(value: YAMLValue): BigInt | null {
  let text: string
  if (value.isNumber()) {
    text = value.toNumber()
  } else if (value.isString()) {
    text = value.toString().trim()
  } else {
    return null
  }
  if (text.length == 0 || text.length > 20) return null
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i)
    if (code < 48 || code > 57) return null
  }
  if (text.length == 20 && text > '18446744073709551615') return null
  return BigInt.fromString(text)
}

// Decode the CID encodings normally used in published manifests. Unsupported
// encodings are skipped rather than passed to a host function that can abort.
function decodeCid(text: string): Uint8Array | null {
  if (text.length == 0 || text.length > 128) return null
  let base58 = text.startsWith('Qm') || text.startsWith('z')
  if (base58) {
    let encoded = text.startsWith('z') ? text.slice(1) : text
    let alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    let bytes = new Array<u8>()
    for (let i = 0; i < encoded.length; i++) {
      let carry = alphabet.indexOf(encoded.charAt(i))
      if (carry < 0) return null
      for (let j = 0; j < bytes.length; j++) {
        carry += i32(bytes[j]) * 58
        bytes[j] = u8(carry & 255)
        carry >>= 8
      }
      while (carry > 0) {
        bytes.push(u8(carry & 255))
        carry >>= 8
      }
    }
    for (let i = 0; i < encoded.length && encoded.charAt(i) == '1'; i++) bytes.push(0)
    let result = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) result[i] = bytes[bytes.length - i - 1]
    return result
  }
  if (!text.startsWith('b') && !text.startsWith('B')) return null
  let alphabet = text.startsWith('b') ? 'abcdefghijklmnopqrstuvwxyz234567' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let result = new Uint8Array((text.length - 1) * 5 / 8)
  let bits = 0
  let buffer = 0
  let offset = 0
  for (let i = 1; i < text.length; i++) {
    let digit = alphabet.indexOf(text.charAt(i))
    if (digit < 0) return null
    buffer = (buffer << 5) | digit
    bits += 5
    if (bits >= 8) {
      bits -= 8
      result[offset++] = u8(buffer >> bits)
      buffer &= (1 << bits) - 1
    }
  }
  return bits < 5 && buffer == 0 ? result : null
}

function validCid(text: string): bool {
  let bytes = decodeCid(text)
  if (bytes === null) return false
  if (text.startsWith('Qm')) {
    return text.length == 46 && bytes.length == 34 && bytes[0] == 0x12 && bytes[1] == 0x20
  }
  // CIDv1 contains four unsigned varints: version, codec, hash code, digest
  // length; followed by the digest. Graph Node supports digests up to 64 bytes.
  let offset = 0
  for (let field = 0; field < 4; field++) {
    let value: u64 = 0
    let terminated = false
    for (let i = 0; i < 10 && offset < bytes.length; i++) {
      let byte = bytes[offset++]
      if (i == 9 && byte > 1) return false
      value |= u64(byte & 127) << (i * 7)
      if ((byte & 128) == 0) {
        if (i > 0 && byte == 0) return false
        terminated = true
        break
      }
    }
    if (!terminated) return false
    if (field == 0 && value != 1) return false
    if (field == 3) return value <= 64 && value == u64(bytes.length - offset)
  }
  return false
}

export function manifestSchemaPath(value: YAMLValue | null): string | null {
  // Published manifests use { '/': '/ipfs/CID' }; also accept string links.
  if (value !== null && value.isObject()) value = yamlField(value, '/')
  let path = yamlString(value)
  if (path === null || path.length > 2048) return null
  if (path.startsWith('/ipfs/')) path = path.slice(6)
  else if (path.startsWith('ipfs://')) path = path.slice(7)
  let segments = path.split('/')
  if (!validCid(segments[0])) return null
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].length == 0 || segments[i] == '.' || segments[i] == '..') return null
  }
  for (let i = 0; i < path.length; i++) {
    let code = path.charCodeAt(i)
    if (code <= 32 || code == 127 || path.charAt(i) == '?' || path.charAt(i) == '#' || path.charAt(i) == '%' || path.charAt(i) == '\\') return null
  }
  return path
}
