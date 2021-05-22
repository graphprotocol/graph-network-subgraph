import { Bytes } from '@graphprotocol/graph-ts'
import { DIDAttributeChanged } from '../types/EthereumDIDRegistry/EthereumDIDRegistry'

import { addQm, createOrLoadGraphAccount } from './helpers'
import { fetchGraphAccountMetadata } from './metadataHelpers'

export function handleDIDAttributeChanged(event: DIDAttributeChanged): void {
  let id = event.params.identity.toHexString()
  let graphAccount = createOrLoadGraphAccount(id, event.params.identity, event.block.timestamp)
  // OFFCHAIN_DATANAME = keccak256("GRAPH NAME SERVICE")
  // 0x72abcb436eed911d1b6046bbe645c235ec3767c842eb1005a6da9326c2347e4c
  if (
    event.params.name.toHexString() ==
    '0x72abcb436eed911d1b6046bbe645c235ec3767c842eb1005a6da9326c2347e4c'
  ) {
    // TODO optimization - make this more robust, since value is BYTES not BYTES32, and if someone
    // called it directly, it could crash the subgraph
    let hexHash = addQm(event.params.value) as Bytes
    let base58Hash = hexHash.toBase58()
    graphAccount.metadataHash = event.params.value

    fetchGraphAccountMetadata(graphAccount, base58Hash)
  }
}
