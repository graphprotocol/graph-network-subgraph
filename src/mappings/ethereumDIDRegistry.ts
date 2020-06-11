import { json, ipfs, Bytes, JSONValueKind, log } from '@graphprotocol/graph-ts'

import {
  DIDOwnerChanged,
  DIDDelegateChanged,
  DIDAttributeChanged,
} from '../types/EthereumDIDRegistry/EthereumDIDRegistry'

import { GraphAccount } from '../types/schema'
import { addQm } from './helpers'
import { jsonToString } from './utils'

// NOT IN USE
export function handleDIDOwnerChanged(event: DIDOwnerChanged): void {}

// NOT IN USE
export function handleDIDDelegateChanged(event: DIDDelegateChanged): void {}

export function handleDIDAttributeChanged(event: DIDAttributeChanged): void {
  let id = event.params.identity.toHexString()
  let graphAccount = GraphAccount.load(id)
  if (graphAccount != null) {
    // OFFCHAIN_DATANAME = keccak256("GRAPH NAME SERVICE")
    // 0x72abcb436eed911d1b6046bbe645c235ec3767c842eb1005a6da9326c2347e4c
    if (
      event.params.name.toHexString() ==
      '0x72abcb436eed911d1b6046bbe645c235ec3767c842eb1005a6da9326c2347e4c'
    ) {
      // TODO - make this more robust, since value is BYTES not BYTES32, and if someone
      // called it directly, it could crash the subgraph
      let hexHash = addQm(event.params.value) as Bytes
      let base58Hash = hexHash.toBase58()
      graphAccount.metadataHash = event.params.value

      let ipfsData = ipfs.cat(base58Hash)
      if (ipfsData != null) {
        let data = json.fromBytes(ipfsData as Bytes).toObject()
        graphAccount.name = jsonToString(data.get('name'))
        // TODO - not in beta, might need to remove
        // graphAccount.description = jsonToString(data.get('description'))
        // graphAccount.website = jsonToString(data.get('website'))
        // graphAccount.image = jsonToString(data.get('image'))
        // graphAccount.codeRepository = jsonToString(data.get('codeRepository'))

        // TODO, not sure if i need either
        // graphAccount.createdAt = event.block.timestamp.toI32() TODO - THIS MIGHT NOT BELONG HERE
        //   graphAccount.updatedAt = event.block.timestamp.toI32()
        graphAccount.save()
      }
    }
  }
}
