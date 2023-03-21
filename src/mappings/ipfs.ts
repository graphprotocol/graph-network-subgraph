import { json, Bytes, JSONValueKind, dataSource, log } from '@graphprotocol/graph-ts'
import {
  AccountMetadata,
  SubgraphDeploymentMetadata,
  SubgraphMetadata,
  SubgraphVersionMetadata,
} from '../types/schema'
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

export function handleSubgraphVersionMetadata(metadata: Bytes): void {
  let subgraphVersionMetadata = new SubgraphVersionMetadata(dataSource.stringParam())
  if (metadata !== null) {
    let tryData = json.try_fromBytes(metadata as Bytes)
    if (tryData.isOk) {
      let data = tryData.value.toObject()
      subgraphVersionMetadata.description = jsonToString(data.get('description'))
      subgraphVersionMetadata.label = jsonToString(data.get('label'))
      subgraphVersionMetadata.save()
    }
  }
}

export function handleSubgraphDeploymentMetadata(metadata: Bytes): void {
  let ipfsHash = dataSource.stringParam()
  let subgrapjDeploymentMetadata = new SubgraphDeploymentMetadata(ipfsHash)
  if (metadata !== null) {
    subgrapjDeploymentMetadata.manifest = metadata.toString()

    let manifest = subgrapjDeploymentMetadata.manifest!
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
          subgrapjDeploymentMetadata.schemaIpfsHash = schemaIpfsHash
        } else {
          log.warning(
            "[MANIFEST PARSING FAIL] Deployment: {}, schema file hash can't be retrieved. Error: schemaIpfsHashTry.length isn't 2, actual length: {}",
            [ipfsHash, schemaIpfsHashTry.length.toString()],
          )
        }
      } else {
        log.warning(
          "[MANIFEST PARSING FAIL] Deployment: {}, schema file hash can't be retrieved. Error: schemaFileSplitTry.length isn't 2, actual length: {}",
          [ipfsHash, schemaFileSplitTry.length.toString()],
        )
      }
    } else {
      log.warning(
        "[MANIFEST PARSING FAIL] Deployment: {}, schema file hash can't be retrieved. Error: schemaSplitTry.length isn't 2, actual length: {}",
        [ipfsHash, schemaSplitTry.length.toString()],
      )
    }

    // We get the first occurrence of `network` since subgraphs can only have data sources for the same network
    let networkSplitTry = manifest.split('network: ', 2)
    if (networkSplitTry.length == 2) {
      let networkSplit = networkSplitTry[1]
      let networkTry = networkSplit.split('\n', 2)
      if (networkTry.length == 2) {
        let network = networkTry[0]

        subgrapjDeploymentMetadata.network = network
      } else {
        log.warning(
          "[MANIFEST PARSING FAIL] Deployment: {}, network can't be parsed. Error: networkTry.length isn't 2, actual length: {}",
          [ipfsHash, networkTry.length.toString()],
        )
      }
    } else {
      log.warning(
        "[MANIFEST PARSING FAIL] Deployment: {}, network can't be parsed. Error: networkSplitTry.length isn't 2, actual length: {}",
        [ipfsHash, networkSplitTry.length.toString()],
      )
    }
    subgrapjDeploymentMetadata.save()
  }
}
