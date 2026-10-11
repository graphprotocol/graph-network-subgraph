import { json, Bytes, dataSource, JSONValueKind, log, DataSourceContext, BigInt, yaml, YAMLValue, crypto } from '@graphprotocol/graph-ts'
import {
  SubgraphMeta,
  SubgraphVersionMeta,
  GraphAccountMeta,
  SubgraphDeploymentSchema,
  SubgraphDeploymentManifest,
} from '../types/schema'
import {
  SubgraphDeploymentSchema as SubgraphDeploymentSchemaTemplate
} from '../types/templates'
import { jsonToString } from './utils'
import { yamlField, yamlString, manifestStartBlock, manifestMetadataString, manifestSchemaReference, manifestSchemaPath } from './helpers/manifest'

export function handleSubgraphMetadata(content: Bytes): void {
  let id = dataSource.context().getString("id")
  let subgraphMetadata = new SubgraphMeta(id)
  let tryData = json.try_fromBytes(content)
  if (tryData.isOk) {
    let data = tryData.value.toObject()
    subgraphMetadata.description = jsonToString(data.get('description'))
    subgraphMetadata.displayName = jsonToString(data.get('displayName'))
    subgraphMetadata.codeRepository = jsonToString(data.get('codeRepository'))
    subgraphMetadata.website = jsonToString(data.get('website'))
    let categories = data.get('categories')

    if (categories != null && !categories.isNull()) {
      let categoriesArray = categories.toArray().map<string>((element) => jsonToString(element))
      subgraphMetadata.categories = categoriesArray
    }
    let image = jsonToString(data.get('image'))
    let subgraphImage = data.get('subgraphImage')
    if (subgraphImage != null && subgraphImage.kind === JSONValueKind.STRING) {
      subgraphMetadata.nftImage = image
      subgraphMetadata.image = jsonToString(subgraphImage)
    } else {
      subgraphMetadata.image = image
    }
    subgraphMetadata.save()
  }
}

export function handleSubgraphVersionMetadata(content: Bytes): void {
  let id = dataSource.context().getString("id")
  let subgraphVersionMetadata = new SubgraphVersionMeta(id)
  let tryData = json.try_fromBytes(content)
  if (tryData.isOk) {
    let data = tryData.value.toObject()
    subgraphVersionMetadata.description = jsonToString(data.get('description'))
    subgraphVersionMetadata.label = jsonToString(data.get('label'))
  } 
  subgraphVersionMetadata.save()
}

export function handleGraphAccountMetadata(content: Bytes): void {
  let id = dataSource.context().getString("id")
  let graphAccountMetadata = new GraphAccountMeta(id)
  let tryData = json.try_fromBytes(content)
  if (tryData.isOk) {
    let data = tryData.value.toObject()
    graphAccountMetadata.codeRepository = jsonToString(data.get('codeRepository'))
    graphAccountMetadata.description = jsonToString(data.get('description'))
    graphAccountMetadata.image = jsonToString(data.get('image'))
    graphAccountMetadata.displayName = jsonToString(data.get('displayName'))
    let isOrganization = data.get('isOrganization')
    if (isOrganization != null && isOrganization.kind === JSONValueKind.BOOL) {
      graphAccountMetadata.isOrganization = isOrganization.toBool()
    }
    graphAccountMetadata.website = jsonToString(data.get('website'))
    graphAccountMetadata.save()
  }
}


export function handleSubgraphDeploymentSchema(content: Bytes): void {
  let id = dataSource.context().getString("id")
  let subgraphDeploymentSchema = new SubgraphDeploymentSchema(id)
  if (content !== null) {
    subgraphDeploymentSchema.schema = content.toString()
  }
  subgraphDeploymentSchema.save()
}

function manifestWarning(id: string, field: string): void {
  log.warning('[MANIFEST PARSING FAIL] deployment: {}, invalid or unsupported {}', [id, field])
}

function readManifestSchema(manifest: SubgraphDeploymentManifest, root: YAMLValue): void {
  let reference = manifestSchemaReference(yamlField(yamlField(root, 'schema'), 'file'))
  if (reference === null) {
    manifestWarning(manifest.id, 'schema.file')
    return
  }
  let path = manifestSchemaPath(reference)
  let schemaId = manifest.id.concat('-').concat(path)
  // Immutable entity IDs are indexed. Preserve ordinary IDs while bounding
  // their UTF-8 size even when references contain multibyte characters.
  let schemaIdBytes = Bytes.fromUTF8(schemaId)
  if (schemaIdBytes.length > 2048) schemaId = crypto.keccak256(schemaIdBytes).toHexString()
  manifest.schema = schemaId
  manifest.schemaIpfsHash = path
  let context = new DataSourceContext()
  context.setString('id', schemaId)
  // Graph Node validates the original reference and skips invalid IPFS sources.
  SubgraphDeploymentSchemaTemplate.createWithContext(reference, context)
}

function readManifestNetwork(manifest: SubgraphDeploymentManifest, root: YAMLValue): void {
  // Keep the first usable network, falling back to templates when necessary.
  let sections = ['dataSources', 'templates']
  for (let section = 0; section < sections.length; section++) {
    let entries = yamlField(root, sections[section])
    if (entries === null || !entries.isArray()) continue
    let sources = entries.toArray()
    for (let i = 0; i < sources.length; i++) {
      let network = manifestMetadataString(yamlField(sources[i], 'network'), 256)
      if (network !== null) {
        manifest.network = network
        return
      }
    }
  }
  manifestWarning(manifest.id, 'network')
}

function readManifestDataSources(manifest: SubgraphDeploymentManifest, root: YAMLValue): void {
  let sources = yamlField(root, 'dataSources')
  if (sources === null || !sources.isArray() || sources.toArray().length == 0) {
    manifestWarning(manifest.id, 'dataSources')
    return
  }

  let dataSources = sources.toArray()
  let minimum: BigInt | null = null
  let validStartBlocks = true
  let validKinds = true
  let poweredBySubstreams = false
  // Only inspect actual dataSources. Templates, comments and context values
  // must not affect the minimum start block or the deployment's source kind.
  for (let i = 0; i < dataSources.length; i++) {
    let dataSource = dataSources[i]
    let kind = yamlString(yamlField(dataSource, 'kind'))
    if (kind === null) validKinds = false
    else if (kind == 'substreams') poweredBySubstreams = true

    let source = yamlField(dataSource, 'source')
    if (source === null || !source.isObject()) {
      validStartBlocks = false
      continue
    }
    let startBlockValue = yamlField(source, 'startBlock')
    // A missing startBlock defaults to zero. If any source is invalid, keep
    // the manifest's zero default rather than reporting a partial minimum.
    let startBlock = startBlockValue === null ? BigInt.fromI32(0) : manifestStartBlock(startBlockValue)
    if (startBlock === null) {
      validStartBlocks = false
    } else if (minimum === null || startBlock < minimum) {
      minimum = startBlock
    }
  }

  if (poweredBySubstreams || validKinds) manifest.poweredBySubstreams = poweredBySubstreams
  else manifestWarning(manifest.id, 'dataSources.kind')
  if (validStartBlocks && minimum !== null) manifest.startBlock = minimum
  else manifestWarning(manifest.id, 'dataSources.source.startBlock')
}

// Keep field extraction independent of YAML decoding so defaults also apply
// to undecodable documents.
export function parseSubgraphDeploymentManifest(
  id: string,
  content: string,
  root: YAMLValue | null,
): SubgraphDeploymentManifest {
  let manifest = new SubgraphDeploymentManifest(id)
  manifest.manifest = content
  // Preserve the defaults exposed by the original parser, including when
  // malformed or incomplete manifests prevent further field extraction.
  manifest.startBlock = BigInt.fromI32(0)
  manifest.poweredBySubstreams = false
  if (root !== null && root.isObject()) {
    readManifestSchema(manifest, root)
    readManifestNetwork(manifest, root)
    readManifestDataSources(manifest, root)
  }
  return manifest
}

export function handleSubgraphDeploymentManifest(content: Bytes): void {
  let id = dataSource.stringParam()
  let root: YAMLValue | null = null
  // Match the native parser's input limit; retain the raw document and defaults
  // when it cannot be decoded.
  if (content.length > 10000000) {
    manifestWarning(id, 'manifest size')
  } else {
    let parsed = yaml.try_fromBytes(content)
    if (!parsed.isOk) {
      manifestWarning(id, 'YAML')
    } else if (!parsed.value.isObject()) {
      manifestWarning(id, 'manifest root')
    } else {
      root = parsed.value
    }
  }
  let manifest = parseSubgraphDeploymentManifest(id, content.toString(), root)
  manifest.save()
}
