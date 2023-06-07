import { json, Bytes, dataSource, JSONValueKind } from '@graphprotocol/graph-ts'
import {
  SubgraphMetadata,
  SubgraphVersionMetadata,
  GraphAccountMetadata,
  SubgraphDeploymentSchema,
  SubgraphDeploymentManifest,
  Subgraph,
  GraphAccount
} from '../types/schema'
import { jsonToString } from './utils'
import { createOrLoadSubgraphCategory, createOrLoadSubgraphCategoryRelation } from './helpers/helpers'

export function handleSubgraphMetadata(content: Bytes): void {
  let subgraphMetadata = SubgraphMetadata.load(dataSource.stringParam())!
  let subgraph = Subgraph.load(subgraphMetadata.subgraph)!
  let tryData = json.try_fromBytes(content)
  if (tryData.isOk) {
    let data = tryData.value.toObject()
    // Duplicating the fields for backwards compatibility
    subgraphMetadata.description = jsonToString(data.get('description'))
    subgraphMetadata.displayName = jsonToString(data.get('displayName'))
    subgraphMetadata.codeRepository = jsonToString(data.get('codeRepository'))
    subgraphMetadata.website = jsonToString(data.get('website'))

    subgraph.description = subgraphMetadata.description
    subgraph.displayName = subgraphMetadata.displayName
    subgraph.codeRepository = subgraphMetadata.codeRepository
    subgraph.website = subgraphMetadata.website
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
      subgraph.nftImage = subgraphMetadata.nftImage
      subgraph.image = subgraphMetadata.image
    } else {
      subgraphMetadata.image = image
      subgraph.image = subgraphMetadata.image
    }
    subgraphMetadata.save()
    subgraph.save()
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
  let graphAccountMetadata = GraphAccountMetadata.load(dataSource.stringParam())!
  let graphAccount = GraphAccount.load(graphAccountMetadata.graphAccount)!
  let tryData = json.try_fromBytes(content)
  if (tryData.isOk) {
    let data = tryData.value.toObject()
    graphAccountMetadata.codeRepository = jsonToString(data.get('codeRepository'))
    graphAccountMetadata.description = jsonToString(data.get('description'))
    graphAccountMetadata.image = jsonToString(data.get('image'))
    graphAccountMetadata.displayName = jsonToString(data.get('displayName'))
    graphAccount.codeRepository = graphAccountMetadata.codeRepository
    graphAccount.description = graphAccountMetadata.description
    graphAccount.image = graphAccountMetadata.image
    graphAccount.displayName = graphAccountMetadata.displayName
    let isOrganization = data.get('isOrganization')
    if (isOrganization != null && isOrganization.kind === JSONValueKind.BOOL) {
      graphAccountMetadata.isOrganization = isOrganization.toBool()
      graphAccount.isOrganization = graphAccountMetadata.isOrganization
    }
    graphAccountMetadata.website = jsonToString(data.get('website'))
    graphAccount.website = graphAccountMetadata.website

    graphAccountMetadata.save()
    graphAccount.save()
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
