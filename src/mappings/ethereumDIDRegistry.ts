import { Bytes, DataSourceContext } from '@graphprotocol/graph-ts'
import { DIDAttributeChanged } from '../types/EthereumDIDRegistry/EthereumDIDRegistry'
import { GraphAccountMetadata as GraphAccountMetadataTemplate } from '../types/templates'
import { GraphAccount } from '../types/schema'

import { addQm, createOrLoadGraphAccount } from './helpers/helpers'

export function handleDIDAttributeChanged(event: DIDAttributeChanged): void {
  let graphAccount = createOrLoadGraphAccount(event.params.identity, event.block.timestamp)
  // OFFCHAIN_DATANAME = keccak256("GRAPH NAME SERVICE")
  // 0x72abcb436eed911d1b6046bbe645c235ec3767c842eb1005a6da9326c2347e4c
  if (
    event.params.name.toHexString() ==
    '0x72abcb436eed911d1b6046bbe645c235ec3767c842eb1005a6da9326c2347e4c'
  ) {
    // TODO optimization - make this more robust, since value is BYTES not BYTES32, and if someone
    // called it directly, it could crash the subgraph
    let hexHash = changetype<Bytes>(addQm(event.params.value))
    let base58Hash = hexHash.toBase58()
    let uniqueTxID = event.transaction.hash.toHexString().concat('-').concat(event.logIndex.toString())
    let metadataId = uniqueTxID.concat('-').concat(graphAccount.id.concat('-').concat(base58Hash))
    graphAccount.metadata = metadataId
    graphAccount.save()

    // Update all associated vesting contract addresses
    let tlws = graphAccount.tokenLockWallets
    for (let i = 0; i < tlws.length; i++) {
      let tlw = GraphAccount.load(tlws[i])!
      tlw.metadata = metadataId
      tlw.save()
    }

    let context = new DataSourceContext()
    context.setString('id', metadataId)
    GraphAccountMetadataTemplate.createWithContext(base58Hash, context)
  }
}
