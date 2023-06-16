import { json, Bytes, dataSource, JSONValueKind } from '@graphprotocol/graph-ts'
import {
  SubgraphMetadata,
  SubgraphVersionMetadata,
  GraphAccountMetadata,
  SubgraphDeploymentSchema,
  SubgraphDeploymentManifest,
} from '../types/schema'
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
  // let subgraphVersionMetadata = SubgraphVersionMetadata.load(dataSource.stringParam())
  // const value = json.fromBytes(content).toObject()
  // if (value) {
  //   subgraphVersionMetadata.save()
  // }
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
  // let subgraphDeploymentSchema = new SubgraphDeploymentSchema(dataSource.stringParam())
  // const value = json.fromBytes(content).toObject()
  // if (value) {
  //   subgraphDeploymentSchema.save()
  // }
}

export function handleSubgraphDeploymentManifest(content: Bytes): void {
  // let subgraphDeploymentManifest = new SubgraphDeploymentManifest(dataSource.stringParam())
  // const value = json.fromBytes(content).toObject()
  // if (value) {
  //   subgraphDeploymentManifest.save()
  // }
}
