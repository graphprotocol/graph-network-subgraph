import { json, Bytes, dataSource, JSONValueKind } from '@graphprotocol/graph-ts'
import {
  SubgraphMetadata,
  SubgraphVersionMetadata,
  GraphAccountMetadata,
  SubgraphDeploymentSchema,
  SubgraphDeploymentManifest,
  Subgraph
} from '../types/schema'
import { jsonToString } from './utils'
import { createOrLoadSubgraphCategory, createOrLoadSubgraphCategoryRelation } from './helpers/helpers'

export function handleSubgraphMetadata(content: Bytes): void {
  let subgraphMetadata = SubgraphMetadata.load(dataSource.stringParam())
  let subgraph = Subgraph.load(SubgraphMetadata.subgraph)
  let tryData = json.try_fromBytes(content)
  if (tryData.isOk) {
    let data = tryData.value.toObject()
    subgraphMetadata.description = jsonToString(data.get('description'))
    subgraphMetadata.displayName = jsonToString(data.get('displayName'))
    subgraphMetadata.codeRepository = jsonToString(data.get('codeRepository'))
    subgraphMetadata.website = jsonToString(data.get('website'))
    let categories = data.get('categories')

    if (categories != null && !categories.isNull()) {
      let categoriesArray = categories.toArray()

      for (let i = 0; i < categoriesArray.length; i++) {
        let categoryId = jsonToString(categoriesArray[i])
        createOrLoadSubgraphCategory(categoryId)
        createOrLoadSubgraphCategoryRelation(categoryId, subgraph.id)
        if (subgraph.linkedEntity != null) {
          createOrLoadSubgraphCategoryRelation(categoryId, subgraph.linkedEntity!)
        }
      }
    }
    let image = jsonToString(data.get('image'))
    let subgraphImage = data.get('subgraphImage')
    if (subgraphImage != null && subgraphImage.kind === JSONValueKind.STRING) {
      subgraphMetadata.nftImage = image
      subgraphMetadata.image = jsonToString(subgraphImage)
    } else {
      subgraphMetadata.image = image
    }
  }
}

export function handleSubgraphVersionMetadata(content: Bytes): void {
  let subgraphVersionMetadata = SubgraphVersionMetadata.load(dataSource.stringParam())
  const value = json.fromBytes(content).toObject()
  if (value) {
    subgraphMetadata.save()
  }
}

export function handleGraphAccountMetadata(content: Bytes): void {
  let graphAccountMetadata = GraphAccountMetadata.load(dataSource.stringParam())
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
  const value = json.fromBytes(content).toObject()
  if (value) {
    subgraphMetadata.save()
  }
}

export function handleSubgraphDeploymentManifest(content: Bytes): void {
  let subgraphDeploymentManifest = new SubgraphDeploymentManifest(dataSource.stringParam())
  const value = json.fromBytes(content).toObject()
  if (value) {
    subgraphMetadata.save()
  }
}
