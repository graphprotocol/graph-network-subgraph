import { json, ipfs, Bytes, JSONValueKind } from '@graphprotocol/graph-ts'
import { GraphAccount, Subgraph, SubgraphVersion } from '../types/schema'
import { jsonToString } from './utils'

export function fetchGraphAccountMetadata(graphAccount: GraphAccount, ipfsHash: string): void {
}

export function fetchSubgraphMetadata(subgraph: Subgraph, ipfsHash: string): void {
}

export function fetchSubgraphVersionMetadata(subgraph: SubgraphVersion, ipfsHash: string): void {
}
