import { json, Bytes, JSONValueKind, dataSource } from '@graphprotocol/graph-ts'
import { AccountMetadata, SubgraphMetadata } from '../types/schema'
import { jsonToString } from './utils'

export function handleSubgraphMetadata(metadata: Bytes): void {
  let subgraphMetadata = new SubgraphMetadata(dataSource.stringParam())
  if (metadata !== null) {
    let tryData = json.try_fromBytes(metadata as Bytes)
    if (tryData.isOk) {
      let data = tryData.value.toObject()
      subgraphMetadata.description = jsonToString(data.get('description'))
      subgraphMetadata.displayName = jsonToString(data.get('displayName'))
      subgraphMetadata.codeRepository = jsonToString(data.get('codeRepository'))
      subgraphMetadata.website = jsonToString(data.get('website'))

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
}

export function handleAccountMetadata(metadata: Bytes): void {
  let accountMetadata = new AccountMetadata(dataSource.stringParam())
  if (metadata !== null) {
    let tryData = json.try_fromBytes(metadata as Bytes)
    if (tryData.isOk) {
      let data = tryData.value.toObject()
      accountMetadata.codeRepository = jsonToString(data.get('codeRepository'))
      accountMetadata.description = jsonToString(data.get('description'))
      accountMetadata.image = jsonToString(data.get('image'))
      accountMetadata.displayName = jsonToString(data.get('displayName'))
      let isOrganization = data.get('isOrganization')
      if (isOrganization != null && isOrganization.kind === JSONValueKind.BOOL) {
        accountMetadata.isOrganization = isOrganization.toBool()
      }
      accountMetadata.website = jsonToString(data.get('website'))
      accountMetadata.save()
    }
  }
}
