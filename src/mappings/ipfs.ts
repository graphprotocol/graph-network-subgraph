import { json, Bytes, dataSource, JSONValueKind, log } from '@graphprotocol/graph-ts'
import {
  SubgraphMetadata,
  SubgraphVersionMetadata,
  GraphAccountMetadata,
  SubgraphDeploymentSchema,
  SubgraphDeploymentManifest,
} from '../types/schema'
import {
  SubgraphDeploymentSchema as SubgraphDeploymentSchemaTemplate
} from '../types/templates'
import { jsonToString } from './utils'

export function handleSubgraphMetadata(content: Bytes): void {
  let subgraphMetadata = new SubgraphMetadata(dataSource.stringParam())
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
  let subgraphVersionMetadata = new SubgraphVersionMetadata(dataSource.stringParam())
  let tryData = json.try_fromBytes(content)
  if (tryData.isOk) {
    let data = tryData.value.toObject()
    subgraphVersionMetadata.description = jsonToString(data.get('description'))
    subgraphVersionMetadata.label = jsonToString(data.get('label'))
  } 
  subgraphVersionMetadata.save()
}

export function handleGraphAccountMetadata(content: Bytes): void {
  let graphAccountMetadata = new GraphAccountMetadata(dataSource.stringParam())
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
  let subgraphDeploymentSchema = new SubgraphDeploymentSchema(dataSource.stringParam())
  if (content !== null) {
    subgraphDeploymentSchema.schema = content.toString()
  }
}

export function handleSubgraphDeploymentManifest(content: Bytes): void {
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
          subgraphDeploymentManifest.schema = schemaIpfsHash
          subgraphDeploymentManifest.schemaIpfsHash = schemaIpfsHash

          // Can't create this template here yet (due to current implementation limitations on File Data Sources, but once that's sorted out, this should work.)
          //SubgraphDeploymentSchemaTemplate.create(schemaIpfsHash)
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
  }
}