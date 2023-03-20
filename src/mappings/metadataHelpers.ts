import { json, ipfs, Bytes, JSONValueKind, log } from '@graphprotocol/graph-ts'
import { GraphAccount, Subgraph, SubgraphVersion, SubgraphDeployment } from '../types/schema'
import { jsonToString } from './utils'
import { createOrLoadSubgraphCategory, createOrLoadSubgraphCategoryRelation, createOrLoadNetwork } from './helpers'

export function fetchGraphAccountMetadata(graphAccount: GraphAccount, ipfsHash: string): void {
}

export function fetchSubgraphMetadata(subgraph: Subgraph, ipfsHash: string): Subgraph {
  return subgraph
}

export function fetchSubgraphVersionMetadata(subgraphVersion: SubgraphVersion, ipfsHash: string): SubgraphVersion {
  return subgraphVersion
}

export function fetchSubgraphDeploymentManifest(deployment: SubgraphDeployment, ipfsHash: string): SubgraphDeployment {
  return deployment as SubgraphDeployment
}
