import { json, Bytes, dataSource, JSONValueKind, log, DataSourceContext, BigInt } from '@graphprotocol/graph-ts'
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

export function handleSubgraphDeploymentManifest(content: Bytes): void {
  // Shouldn't need ID since the handler isn't gonna be called more than once, given that it's only on deployment creation.
  let subgraphDeploymentManifest = new SubgraphDeploymentManifest(dataSource.stringParam())
  if (content !== null) {
    subgraphDeploymentManifest.manifest = content.toString()

    let manifest = subgraphDeploymentManifest.manifest!
    // we take the right side of the split, since it's the one which will have the schema ipfs hash
    let schemaSplitTry = manifest.split('schema:\n', 2)
    if (schemaSplitTry.length == 2) {
      let schemaSplit = schemaSplitTry[1]

      let schemaFileSplitTry = schemaSplit.split('/ipfs/', 2)
      if (schemaFileSplitTry.length == 2) {
        let schemaFileSplit = schemaFileSplitTry[1]

        let schemaIpfsHashTry = schemaFileSplit.split('\n', 2)
        if (schemaIpfsHashTry.length == 2) {
          let schemaIpfsHash = schemaIpfsHashTry[0]
          let schemaId = subgraphDeploymentManifest.id.concat('-').concat(schemaIpfsHash)
          subgraphDeploymentManifest.schema = schemaId
          subgraphDeploymentManifest.schemaIpfsHash = schemaIpfsHash

          let context = new DataSourceContext()
          context.setString('id', schemaId)
          SubgraphDeploymentSchemaTemplate.createWithContext(schemaIpfsHash, context)
        } else {
          log.warning("[MANIFEST PARSING FAIL] subgraphDeploymentManifest: {}, schema file hash can't be retrieved. Error: schemaIpfsHashTry.length isn't 2, actual length: {}", [dataSource.stringParam(), schemaIpfsHashTry.length.toString()])
        }
      } else {
        log.warning("[MANIFEST PARSING FAIL] subgraphDeploymentManifest: {}, schema file hash can't be retrieved. Error: schemaFileSplitTry.length isn't 2, actual length: {}", [dataSource.stringParam(), schemaFileSplitTry.length.toString()])
      }
    } else {
      log.warning("[MANIFEST PARSING FAIL] subgraphDeploymentManifest: {}, schema file hash can't be retrieved. Error: schemaSplitTry.length isn't 2, actual length: {}", [dataSource.stringParam(), schemaSplitTry.length.toString()])
    }

    // We get the first occurrence of `network` since subgraphs can only have data sources for the same network
    let networkSplitTry = manifest.split('network: ', 2)
    if (networkSplitTry.length == 2) {
      let networkSplit = networkSplitTry[1]
      let networkTry = networkSplit.split('\n', 2)
      if (networkTry.length == 2) {
        let network = networkTry[0]

        subgraphDeploymentManifest.network = network
      } else {
        log.warning("[MANIFEST PARSING FAIL] subgraphDeploymentManifest: {}, network can't be parsed. Error: networkTry.length isn't 2, actual length: {}", [dataSource.stringParam(), networkTry.length.toString()])
      }
    } else {
      log.warning("[MANIFEST PARSING FAIL] subgraphDeploymentManifest: {}, network can't be parsed. Error: networkSplitTry.length isn't 2, actual length: {}", [dataSource.stringParam(), networkSplitTry.length.toString()])
    }
    let substreamsSplitTry = manifest.split('- kind: substreams', 2)
    subgraphDeploymentManifest.poweredBySubstreams = substreamsSplitTry.length > 1

    // startBlock calculation
    let templatesSplit = manifest.split("templates:")
    let nonTemplateManifestSplit = templatesSplit[0] // we take the left as we want to remove the templates for the source checks.
    let sourcesSplit = nonTemplateManifestSplit.split("source:") // We want to know how many source definitions we have
    let startBlockSplit = nonTemplateManifestSplit.split("startBlock: ") // And how many startBlock definitions we have to know if we should set startBlock to 0
    
    if (sourcesSplit.length > startBlockSplit.length) {
      subgraphDeploymentManifest.startBlock = BigInt.fromI32(0)
    } else {
      // need to figure the minimum startBlock defined, we skip i = 0 as we know it's not gonna contain a start block num, since it's before the first appearance of "startBlock:"
      let min = BigInt.fromI32(0)
      for(let i = 1; i < startBlockSplit.length; i++) {
        let numString = startBlockSplit[i].split("\n", 1)[0].toString()
        let num = BigInt.fromString(numString)
        min = min == BigInt.fromI32(0) ? num : min <= num ? min : num
      }
      subgraphDeploymentManifest.startBlock = min
    }
  }
  subgraphDeploymentManifest.save()
}
