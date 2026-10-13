import { Bytes, json, JSONValue, JSONValueKind, TypedMap, YAMLValue } from '@graphprotocol/graph-ts'
import { afterEach, assert, clearStore, test } from 'matchstick-as/assembly/index'
import { parseSubgraphDeploymentManifest } from '../src/mappings/ipfs'
import { manifestSchemaReference } from '../src/mappings/helpers/manifest'

const manifestID = 'manifest'
const schemaCID = 'QmNVavEGcPsZ651fcvnRJNuLim3HFJxx1vmE9iALRPywBm'

// Matchstick does not implement yaml.try_fromBytes yet. Build the YAML values
// a decoder would return, then exercise the production field extraction and store.
function yamlValue(value: JSONValue): YAMLValue {
  if (value.kind == JSONValueKind.NULL) return YAMLValue.newNull()
  if (value.kind == JSONValueKind.BOOL) return YAMLValue.newBool(value.toBool())
  if (value.kind == JSONValueKind.NUMBER) return YAMLValue.newI64(value.toI64())
  if (value.kind == JSONValueKind.STRING) return YAMLValue.newString(value.toString())
  if (value.kind == JSONValueKind.ARRAY) {
    let values = value.toArray()
    let result = new Array<YAMLValue>()
    for (let i = 0; i < values.length; i++) result.push(yamlValue(values[i]))
    return YAMLValue.newArray(result)
  }
  let entries = value.toObject().entries
  let object = new TypedMap<YAMLValue, YAMLValue>()
  for (let i = 0; i < entries.length; i++) {
    object.set(YAMLValue.newString(entries[i].key), yamlValue(entries[i].value))
  }
  return YAMLValue.newObject(object)
}

function parse(root: string, content: string = ''): void {
  parseSubgraphDeploymentManifest(manifestID, content, yamlValue(json.fromString(root))).save()
}

function assertDefaults(): void {
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'startBlock', '0')
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'poweredBySubstreams', 'false')
}

afterEach(() => {
  clearStore()
})

test('missing, empty and invalid dataSources preserve both legacy defaults', () => {
  let roots = [
    '{}',
    '{"dataSources":[]}',
    '{"dataSources":null}',
    '{"dataSources":{}}',
    '{"dataSources":"invalid"}',
  ]
  for (let i = 0; i < roots.length; i++) {
    clearStore()
    parse(roots[i])
    assertDefaults()
  }
})

test('undecodable documents retain raw content and legacy defaults', () => {
  let content = 'dataSources: [\n'
  parseSubgraphDeploymentManifest(manifestID, content, null).save()
  assertDefaults()
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'manifest', content)
})

test('non-object YAML roots retain legacy defaults', () => {
  let roots = ['null', '[]', '"text"', '123', 'false']
  for (let i = 0; i < roots.length; i++) {
    clearStore()
    parse(roots[i])
    assertDefaults()
  }
})

test('missing or invalid source prevents a misleading partial minimum', () => {
  let invalidSources = ['{}', '{"source":null}', '{"source":[]}', '{"source":"bad"}', 'null']
  for (let i = 0; i < invalidSources.length; i++) {
    clearStore()
    parse(
      '{"dataSources":[{"kind":"ethereum/contract","source":{"startBlock":100}},' +
        invalidSources[i] +
        ']}',
    )
    assertDefaults()
  }
})

test('omitting startBlock from a valid source defaults to zero', () => {
  parse('{"dataSources":[{"kind":"ethereum/contract","source":{}}]}')
  assertDefaults()
})

test('null and invalid start blocks use zero without aborting', () => {
  let invalidBlocks = [
    'null',
    'true',
    '[]',
    '{}',
    '-1',
    '"1.5"',
    '"bad"',
    '""',
    '"18446744073709551616"',
  ]
  for (let i = 0; i < invalidBlocks.length; i++) {
    clearStore()
    parse(
      '{"dataSources":[{"kind":"ethereum/contract","source":{"startBlock":' +
        invalidBlocks[i] +
        '}}]}',
    )
    assertDefaults()
  }
})

test('minimum preserves zero even when later sources have positive start blocks', () => {
  parse(
    '{"dataSources":[{"kind":"ethereum/contract","source":{"startBlock":0}},{"kind":"ethereum/contract","source":{"startBlock":100}}]}',
  )
  assertDefaults()
})

test('valid numeric and quoted blocks still produce the actual minimum', () => {
  parse(
    '{"dataSources":[{"kind":"ethereum/contract","source":{"startBlock":100}},{"kind":"ethereum/contract","source":{"startBlock":"42"}}]}',
  )
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'startBlock', '42')
})

test('maximum unsigned block number remains supported without rounding', () => {
  parse(
    '{"dataSources":[{"kind":"ethereum/contract","source":{"startBlock":"18446744073709551615"}}]}',
  )
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'startBlock', '18446744073709551615')
})

test('missing kind defaults to false without discarding a valid start block', () => {
  parse('{"dataSources":[{"source":{"startBlock":42}}]}')
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'startBlock', '42')
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'poweredBySubstreams', 'false')
})

test('a Substreams source is detected even alongside missing kinds and invalid sources', () => {
  parse('{"dataSources":[{}, {"kind":"substreams"}]}')
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'startBlock', '0')
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'poweredBySubstreams', 'true')
})

test('templates, context and comments do not change source kind or minimum', () => {
  parse(
    '{"dataSources":[{"kind":"ethereum/contract","source":{"startBlock":100},"context":{"startBlock":1}}],"templates":[{"kind":"substreams","source":{"startBlock":0}}]}',
    '# - kind: substreams\n# startBlock: 0\n',
  )
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'startBlock', '100')
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'poweredBySubstreams', 'false')
})

test('decoded network takes precedence over text in comments and is trimmed', () => {
  parse('{"dataSources":[{"network":" mainnet "}]}', '# network: wrong\n')
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'network', 'mainnet')
})

test('template network still takes precedence over text in comments', () => {
  parse('{"templates":[{"network":"arbitrum-one"}]}', '# network: wrong\n')
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'network', 'arbitrum-one')
})

test('decoded schema reference takes precedence over text in comments', () => {
  parse('{"schema":{"file":{"/":"/ipfs/' + schemaCID + '"}}}', '# schema:\n#   file: /ipfs/wrong\n')
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'schemaIpfsHash', schemaCID)
  assert.fieldEquals(
    'SubgraphDeploymentManifest',
    manifestID,
    'schema',
    manifestID + '-' + schemaCID,
  )
  assert.dataSourceExists('SubgraphDeploymentSchema', '/ipfs/' + schemaCID)
})

test('string schema links and IPFS URI normalization remain supported', () => {
  parse('{"schema":{"file":"ipfs://' + schemaCID + '/schema.graphql"}}')
  assert.fieldEquals(
    'SubgraphDeploymentManifest',
    manifestID,
    'schemaIpfsHash',
    schemaCID + '/schema.graphql',
  )
  assert.dataSourceExists('SubgraphDeploymentSchema', 'ipfs://' + schemaCID + '/schema.graphql')
})

test('comments and misplaced fields cannot supply network or schema metadata', () => {
  let root = yamlValue(
    json.fromString(
      '{"context":{"network":"mainnet","schema":{"file":"/ipfs/' + schemaCID + '"}}}',
    ),
  )
  let content = '# network: mainnet\n# schema:\n#   file: /ipfs/' + schemaCID + '\n'
  let manifest = parseSubgraphDeploymentManifest(manifestID, content, root)
  assert.assertNull(manifest.network)
  assert.assertNull(manifest.schemaIpfsHash)
  assert.assertNull(manifest.schema)
})

test('unrecognized schema references are retained for Graph Node to validate', () => {
  // Matchstick records the request; Graph Node logs/skips invalid references.
  assertSchemaPath('/ipfs/not-a-cid', 'not-a-cid')
})

test('absent network and schema are not replaced with invented strings', () => {
  let manifest = parseSubgraphDeploymentManifest(manifestID, '{}', yamlValue(json.fromString('{}')))
  assert.assertNull(manifest.network)
  assert.assertNull(manifest.schemaIpfsHash)
  assert.assertNull(manifest.schema)
})

// Generated from schemaCID using multiformats; all identify the same content.
const schemaCIDBase16 = 'f017012200249f0d875bbdcd83ca3e477cfc8363c7d9f1dadec3aafbf6f662b7c211a9968'
const schemaCIDBase36 = 'k2jmtxrf5wu8a5vjq1gbchq8qpcfe9s1z4h3xsc3mi50yzb67ugc4go8'

function assertSchemaPath(input: string, expected: string): void {
  clearStore()
  parse('{"schema":{"file":{"/":"' + input + '"}}}')
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'schemaIpfsHash', expected)
  assert.fieldEquals(
    'SubgraphDeploymentManifest',
    manifestID,
    'schema',
    manifestID + '-' + expected,
  )
  assert.dataSourceExists('SubgraphDeploymentSchema', input)
}

test('CIDv1 base16 and base36 schemas are ingested in both letter cases', () => {
  let cids = [
    schemaCIDBase16,
    schemaCIDBase16.toUpperCase(),
    schemaCIDBase36,
    schemaCIDBase36.toUpperCase(),
  ]
  for (let i = 0; i < cids.length; i++) assertSchemaPath('/ipfs/' + cids[i], cids[i])
})

test('CIDv1 base32 and base58 schemas remain supported', () => {
  let cids = [
    'bafybeiacjhynq5n33tmdzi7eo7h4qnr4pwpr3lpmhkx3633gfn6ccguzna',
    'BAFYBEIACJHYNQ5N33TMDZI7EO7H4QNR4PWPR3LPMHKX3633GFN6CCGUZNA',
    'zdj7WVaqHfLTsM9xnKbMfk3AkjuLyEixrP5tFAkpWZ1EqYqMh',
  ]
  for (let i = 0; i < cids.length; i++) assertSchemaPath('/ipfs/' + cids[i], cids[i])
})

test('base16 accepts a valid 64-byte digest longer than the old text limit', () => {
  let cid =
    'f0170134001010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101'
  assertSchemaPath('/ipfs/' + cid, cid)
})

test('gateway schema URLs normalize to CID and optional file path', () => {
  let prefixes = [
    'https://ipfs.io/ipfs/',
    'http://localhost:8080/ipfs/',
    'https://gateway.example/prefix/ipfs/',
  ]
  for (let i = 0; i < prefixes.length; i++) {
    assertSchemaPath(prefixes[i] + schemaCID, schemaCID)
    assertSchemaPath(
      prefixes[i] + schemaCIDBase36 + '/schema.graphql',
      schemaCIDBase36 + '/schema.graphql',
    )
  }
})

test('trailing slashes normalize for plain CIDs, IPFS links and gateway URLs', () => {
  let prefixes = ['', '/ipfs/', 'ipfs://', 'https://ipfs.io/ipfs/']
  for (let i = 0; i < prefixes.length; i++) {
    assertSchemaPath(prefixes[i] + schemaCID + '/', schemaCID)
    assertSchemaPath(prefixes[i] + schemaCID + '/schema.graphql///', schemaCID + '/schema.graphql')
  }
})

test('all CID encodings are passed through without an encoding whitelist', () => {
  let cids = [
    'uAXASIAJJ8Nh1u9zYPKPkd8_INjx9nx2t7Dqvv29mK3whGplo',
    'v05o1480297odgtdrrjc3p8v4ev7sgdhsfmfhrbfc7anrurr65du226kpd0',
    'cafybeiacjhynq5n33tmdzi7eo7h4qnr4pwpr3lpmhkx3633gfn6ccguzna======',
  ]
  for (let i = 0; i < cids.length; i++) assertSchemaPath('/ipfs/' + cids[i], cids[i])
})

test('literal IPFS filenames retain spaces and URL-like characters', () => {
  let names = [
    'my schema.graphql',
    'schema%20name.graphql',
    'schema#v1.graphql',
    'schema+name.graphql',
  ]
  for (let i = 0; i < names.length; i++) {
    assertSchemaPath('/ipfs/' + schemaCID + '/' + names[i], schemaCID + '/' + names[i])
  }
})

test('RPC URLs and query or fragment syntax are delegated intact to Graph Node', () => {
  let references = [
    'https://ipfs.example/api/v0/cat?arg=/ipfs/' + schemaCID,
    'https://ipfs.example/api/v0/cat?arg=%2Fipfs%2F' + schemaCID,
    'https://gateway.example/ipfs/' + schemaCID + '/schema.graphql?download=true',
    'https://gateway.example/ipfs/' + schemaCID + '#fragment',
    'https://gateway.example/?next=/ipfs/' + schemaCID,
    'https://gateway.example/#/ipfs/' + schemaCID,
  ]
  for (let i = 0; i < references.length; i++) assertSchemaPath(references[i], references[i])
})

test('gateway URL encoding and path resolution use the original reference', () => {
  // Normalized metadata must never replace the reference Graph Node resolves.
  let input = 'https://gateway.example/ipfs/' + schemaCID + '/folder/../schema%20name.graphql'
  assertSchemaPath(input, schemaCID + '/folder/../schema%20name.graphql')
})

test('empty normalized paths do not erase nonempty metadata', () => {
  let references = ['/ipfs/', 'ipfs://', '/']
  for (let i = 0; i < references.length; i++) assertSchemaPath(references[i], references[i])
})

test('multibyte references retain metadata without oversized schema entity IDs', () => {
  let reference = 'https://gateway.example/ipfs/' + schemaCID + '#' + new Array<string>(1900).fill('界').join('')
  let root = yamlValue(json.fromString('{"schema":{"file":"' + reference + '"}}'))
  let manifest = parseSubgraphDeploymentManifest(manifestID, '', root)
  assert.stringEquals(manifest.schemaIpfsHash!, reference)
  assert.assertTrue(Bytes.fromUTF8(manifest.schema!).length <= 2048)
  assert.dataSourceExists('SubgraphDeploymentSchema', reference)
  let repeated = parseSubgraphDeploymentManifest(manifestID, '', root)
  let other = parseSubgraphDeploymentManifest('other-manifest', '', root)
  assert.stringEquals(manifest.schema!, repeated.schema!)
  assert.assertTrue(manifest.schema! != other.schema!)
})

test('schema IDs preserve the UTF-8 byte boundary and hash only oversized IDs', () => {
  let reference = new Array<string>(2048 - manifestID.length - 1).fill('a').join('')
  assertSchemaPath(reference, reference)
  let root = yamlValue(json.fromString('{"schema":{"file":"' + reference + 'a"}}'))
  let manifest = parseSubgraphDeploymentManifest(manifestID, '', root)
  assert.stringEquals(manifest.schemaIpfsHash!, reference + 'a')
  assert.assertTrue(Bytes.fromUTF8(manifest.schema!).length <= 2048)
  assert.dataSourceExists('SubgraphDeploymentSchema', reference + 'a')
})

test('schema references require a nonempty string of bounded size', () => {
  let invalid = ['null', 'false', '12', '[]', '{}', '{"/":42}', '""', '"   "']
  for (let i = 0; i < invalid.length; i++) {
    assert.assertNull(manifestSchemaReference(yamlValue(json.fromString(invalid[i]))))
  }
  let boundary = new Array<string>(2048).fill('a').join('')
  assert.stringEquals(manifestSchemaReference(YAMLValue.newString(boundary))!, boundary)
  assert.assertNull(manifestSchemaReference(YAMLValue.newString(boundary + 'a')))
})

test('embedded control characters are rejected while ordinary whitespace is retained', () => {
  let controls = ['\u0000', '\t', '\n', '\r', '\u001f', '\u007f', '\u0085', '\u009f']
  for (let i = 0; i < controls.length; i++) {
    assert.assertNull(
      manifestSchemaReference(YAMLValue.newString('/ipfs/' + schemaCID + '/a' + controls[i] + 'b')),
    )
  }
  assert.stringEquals(
    manifestSchemaReference(YAMLValue.newString('  /ipfs/' + schemaCID + '/my schema.graphql  '))!,
    '/ipfs/' + schemaCID + '/my schema.graphql',
  )
})

test('network metadata uses basic string checks without a format whitelist', () => {
  parse('{"dataSources":[{"network":" Example network "}]}')
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'network', 'Example network')
})

test('unusable network fields still fall back to the first usable template network', () => {
  parse(
    '{"dataSources":[{"network":123},{"network":"bad\\u0000network"}],"templates":[{"network":"mainnet"}]}',
  )
  assert.fieldEquals('SubgraphDeploymentManifest', manifestID, 'network', 'mainnet')
})
