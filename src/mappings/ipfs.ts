import { json, Bytes, dataSource, JSONValueKind, log, DataSourceContext, BigInt, yaml, YAMLValue } from '@graphprotocol/graph-ts'
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
import { yamlField, yamlString, manifestStartBlock, manifestSchemaPath } from './helpers/manifest'

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
  let path = manifestSchemaPath(yamlField(yamlField(root, 'schema'), 'file'))
  if (path === null) {
    manifestWarning(manifest.id, 'schema.file')
    return
  }
  let schemaId = manifest.id.concat('-').concat(path)
  manifest.schema = schemaId
  manifest.schemaIpfsHash = path
  let context = new DataSourceContext()
  context.setString('id', schemaId)
  SubgraphDeploymentSchemaTemplate.createWithContext(path, context)
}

function readManifestNetwork(manifest: SubgraphDeploymentManifest, root: YAMLValue): void {
  // Keep the first usable network, falling back to templates when necessary.
  let sections = ['dataSources', 'templates']
  for (let section = 0; section < sections.length; section++) {
    let entries = yamlField(root, sections[section])
    if (entries === null || !entries.isArray()) continue
    let sources = entries.toArray()
    for (let i = 0; i < sources.length; i++) {
      let network = yamlString(yamlField(sources[i], 'network'))
      if (network !== null && validManifestNetwork(network)) {
        manifest.network = network
        return
      }
    }
  }
  manifestWarning(manifest.id, 'network')
}

function validManifestNetwork(network: string): bool {
  if (network.length > 256) return false
  for (let i = 0; i < network.length; i++) {
    let code = network.charCodeAt(i)
    if (code <= 32 || code == 127) return false
  }
  return true
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
    // A missing startBlock defaults to zero. An explicit null or malformed
    // value is unknown, so we cannot reliably report a minimum.
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

export function handleSubgraphDeploymentManifest(content: Bytes): void {
  let manifest = new SubgraphDeploymentManifest(dataSource.stringParam())
  manifest.manifest = content.toString()
  // Match the native parser's input limit; retain the raw manifest on failure.
  if (content.length > 10000000) {
    manifestWarning(manifest.id, 'manifest size')
    manifest.save()
    return
  }
  let parsed = yaml.try_fromBytes(content)
  if (!parsed.isOk) {
    manifestWarning(manifest.id, 'YAML')
  } else if (!parsed.value.isObject()) {
    manifestWarning(manifest.id, 'manifest root')
  } else {
    readManifestSchema(manifest, parsed.value)
    readManifestNetwork(manifest, parsed.value)
    readManifestDataSources(manifest, parsed.value)
  }
  manifest.save()
}
