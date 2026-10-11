import { json, JSONValue, JSONValueKind, TypedMap, YAMLValue } from '@graphprotocol/graph-ts'
import { afterEach, assert, clearStore, test } from 'matchstick-as/assembly/index'
import { parseSubgraphDeploymentManifest } from '../src/mappings/ipfs'
import { manifestSchemaPath } from '../src/mappings/helpers/manifest'

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
  assert.dataSourceExists('SubgraphDeploymentSchema', schemaCID)
})

test('string schema links and IPFS URI normalization remain supported', () => {
  parse('{"schema":{"file":"ipfs://' + schemaCID + '/schema.graphql"}}')
  assert.fieldEquals(
    'SubgraphDeploymentManifest',
    manifestID,
    'schemaIpfsHash',
    schemaCID + '/schema.graphql',
  )
  assert.dataSourceExists('SubgraphDeploymentSchema', schemaCID + '/schema.graphql')
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

test('invalid schema links remain unset without creating a file source', () => {
  let root = yamlValue(json.fromString('{"schema":{"file":"/ipfs/not-a-cid"}}'))
  let manifest = parseSubgraphDeploymentManifest(
    manifestID,
    'schema:\n  file: /ipfs/not-a-cid\n',
    root,
  )
  assert.assertNull(manifest.schemaIpfsHash)
  assert.assertNull(manifest.schema)
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
  assert.dataSourceExists('SubgraphDeploymentSchema', expected)
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

test('new CID decoders still reject invalid characters, lengths and CID headers', () => {
  let invalid = [
    schemaCIDBase36 + '!',
    schemaCIDBase16 + 'g',
    schemaCIDBase16 + '0', // Incomplete byte.
    schemaCIDBase16.slice(0, schemaCIDBase16.length - 2), // Truncated digest.
    'f00' + schemaCIDBase16.slice(3), // Invalid version.
    'f8100' + schemaCIDBase16.slice(3), // Non-canonical version varint.
    'f01701221' + schemaCIDBase16.slice(9), // Wrong digest length.
    'k0' + schemaCIDBase36.slice(1), // Leading zero byte is not a CID version.
  ]
  for (let i = 0; i < invalid.length; i++) {
    assert.assertNull(manifestSchemaPath(YAMLValue.newString('/ipfs/' + invalid[i])))
  }
})

test('gateway normalization preserves path validation and cannot extract from query text', () => {
  let invalid = [
    'https:///ipfs/' + schemaCID,
    'https://gateway.example/?next=/ipfs/' + schemaCID,
    'https://gateway.example/#/ipfs/' + schemaCID,
    'https://gateway.example/ipfs/' + schemaCID + '/schema.graphql?x=1',
    'https://gateway.example/ipfs/' + schemaCID + '/../schema.graphql',
    'https://gateway.example/ipfs/' + schemaCID + '/%2e%2e/schema.graphql',
    'https://gateway.example/ipfs/' + schemaCID + '//schema.graphql',
    'https://gateway.example/ipfs/not-a-cid/',
    'https://gateway.example/ipfs/',
    '/ipfs/',
    'ipfs://',
  ]
  for (let i = 0; i < invalid.length; i++) {
    assert.assertNull(manifestSchemaPath(YAMLValue.newString(invalid[i])))
  }
})
