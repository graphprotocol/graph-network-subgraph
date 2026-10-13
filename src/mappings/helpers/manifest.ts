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

// Metadata is opaque text, not HTML or an executable URL. Keep basic bounds
// and reject embedded control characters without imposing format whitelists.
export function manifestMetadataString(value: YAMLValue | null, maxLength: i32): string | null {
  let text = yamlString(value)
  if (text === null || text.length > maxLength) return null
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i)
    if (code < 32 || (code >= 127 && code <= 159)) return null
  }
  return text
}

export function manifestSchemaReference(value: YAMLValue | null): string | null {
  // Published manifests use { '/': '/ipfs/CID' }; also accept string links.
  if (value !== null && value.isObject()) value = yamlField(value, '/')
  return manifestMetadataString(value, 2048)
}

// Normalize familiar references for stable metadata and entity IDs. This is
// not validation: Graph Node receives the original reference for resolution.
export function manifestSchemaPath(reference: string): string {
  let path = reference
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // Keep URL-specific syntax intact instead of reimplementing a URL parser.
    if (path.includes('?') || path.includes('#')) return reference
    let authorityStart = path.startsWith('https://') ? 8 : 7
    let pathStart = path.indexOf('/', authorityStart)
    if (pathStart <= authorityStart) return reference
    let ipfsStart = path.indexOf('/ipfs/', pathStart)
    if (ipfsStart < 0) return reference
    path = path.slice(ipfsStart + 6)
  }
  if (path.startsWith('/ipfs/')) path = path.slice(6)
  else if (path.startsWith('ipfs://')) path = path.slice(7)
  while (path.endsWith('/')) path = path.slice(0, path.length - 1)
  return path.length > 0 ? path : reference
}
