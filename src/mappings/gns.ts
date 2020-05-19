import { store, ByteArray, Bytes, ipfs, json, log, BigInt } from '@graphprotocol/graph-ts'
import {
  DomainAdded,
  DomainTransferred,
  SubgraphCreated,
  SubgraphIDUpdated,
  DomainDeleted,
  AccountMetadataChanged,
  SubgraphMetadataChanged,
} from '../../generated/GNS/GNS'
import { Account, Subgraph, SubgraphVersion } from '../../generated/schema'

// Note - this file will be updated when we have a new PRD - dave may 12 2020

// new domain is treated as a Subgraph entity with parent set to null
export function handleDomainAdded(event: DomainAdded): void {
  // let id = event.params.topLevelDomainHash.toHexString()
  // let subgraph = new Subgraph(id)
  // subgraph.name = event.params.domainName
  // subgraph.owner = event.params.owner
  // subgraph.parent = null
  // subgraph.createdAt = event.block.timestamp.toI32()
  // subgraph.updatedAt = event.block.timestamp.toI32()
  // subgraph.save()
}

export function handleDomainTransferred(event: DomainTransferred): void {
  // let id = event.params.domainHash.toHexString()
  // let subgraph = new Subgraph(id)
  // subgraph.owner = event.params.newOwner
  // subgraph.updatedAt = event.block.timestamp.toI32()
  // subgraph.save()
}

export function handleSubgraphCreated(event: SubgraphCreated): void {
  // // The subddomain is blank, i.e. we are registered to the TLD
  // // In this case both hashes are the same
  // // We don't need to store any new data for the domain if TLD = registeredHash
  // if (event.params.registeredHash != event.params.topLevelDomainHash) {
  //   // Need to load the owner of the parent subgraph
  //   let parent = Subgraph.load(event.params.topLevelDomainHash.toHexString())
  //   let id = event.params.registeredHash.toHexString()
  //   let subgraph = new Subgraph(id)
  //   subgraph.parent = event.params.topLevelDomainHash.toHexString()
  //   subgraph.name = event.params.subdomainName
  //   subgraph.owner = parent.owner
  //   subgraph.createdAt = event.block.timestamp.toI32()
  //   subgraph.save()
  // } else {
  //   let id = event.params.topLevelDomainHash.toHexString()
  //   let subgraph = new Subgraph(id)
  //   subgraph.name = event.params.subdomainName
  //   subgraph.owner = event.params.owner
  //   subgraph.parent = null
  //   subgraph.createdAt = event.block.timestamp.toI32()
  //   subgraph.save()
  // }
}

export function handleDomainDeleted(event: DomainDeleted): void {
  // let id = event.params.domainHash.toHexString()
  // store.remove('Subgraph', id)
}

export function handleAccountMetadataChanged(event: AccountMetadataChanged): void {
  // let id = event.params.account.toHexString()
  // let account = Account.load(id)
  // if (account == null) {
  //   account = new Account(id)
  //   account.balance = BigInt.fromI32(0)
  // }
  // account.metadataHash = event.params.ipfsHash
  // account.save()
}

export function handleSubgraphIDUpdated(event: SubgraphIDUpdated): void {
  // let id = event.params.domainHash.toHexString()
  // let subgraph = Subgraph.load(id)
  // let versions = subgraph.versions
  // if (versions == null) {
  //   versions = []
  // }
  // versions.push(event.params.subgraphID.toHexString())
  // subgraph.updatedAt = event.block.timestamp.toI32()
  // subgraph.versions = versions
  // subgraph.save()
  // // TODO - should we delete the old subgraph here too? it would still exist as its own staking contract, it is just getting remove from the gns. need to think this through a bit
  // let subgraphID = event.params.subgraphID.toHexString()
  // let subgraphVersion = SubgraphVersion.load(subgraphID)
  // if (subgraphVersion == null) {
  //   subgraphVersion = new SubgraphVersion(subgraphID)
  //   subgraphVersion.createdAt = event.block.timestamp.toI32()
  //   subgraphVersion.totalCurationShares = BigInt.fromI32(0)
  //   subgraphVersion.totalCurationStake = BigInt.fromI32(0)
  //   subgraphVersion.totalIndexingStake = BigInt.fromI32(0)
  //   subgraphVersion.reserveRatio = BigInt.fromI32(500000) // TODO - this is hardcoded, until we make staking dependant on GNS
  // }
  // subgraphVersion.subgraph = id
  // subgraphVersion.save()
}

/* Params:
  - domainHash - becomes a created Subgraph ID
  - ipfsHash - IPFS hash for subgraph metadata
*/
export function handleSubgraphMetadataChanged(event: SubgraphMetadataChanged): void {
  // let id = event.params.domainHash.toHexString()
  // let subgraph = new Subgraph(id)
  // subgraph.metadataHash = event.params.ipfsHash
  // subgraph.createdAt = event.block.timestamp.toI32()
  // let hexHash = addQm(event.params.ipfsHash) as Bytes
  // let base58Hash = hexHash.toBase58() // imported crypto function
  // // read subgraph metadata from IPFS
  // let getSubgraphDataFromIPFS = ipfs.cat(base58Hash)
  // if (getSubgraphDataFromIPFS !== null) {
  //   let data = json.fromBytes(getSubgraphDataFromIPFS as Bytes).toObject()
  //   if (data.get('displayName')) {
  //     subgraph.displayName = data.get('displayName').toString()
  //   }
  //   if (data.get('subtitle')) {
  //     subgraph.subtitle = data.get('subtitle').toString()
  //   }
  //   if (data.get('image')) {
  //     subgraph.image = data.get('image').toString()
  //   }
  //   if (data.get('description')) {
  //     subgraph.description = data.get('description').toString()
  //   }
  //   if (data.get('githubURL')) {
  //     subgraph.githubURL = data.get('githubURL').toString()
  //   }
  //   if (data.get('websiteURL')) {
  //     subgraph.websiteURL = data.get('websiteURL').toString()
  //   }
  // }
  // subgraph.save()
}

/*     HELPERS     */
export function addQm(a: ByteArray): ByteArray {
  let out = new Uint8Array(34)
  out[0] = 0x12
  out[1] = 0x20
  for (let i = 0; i < 32; i++) {
    out[i + 2] = a[i]
  }
  return out as ByteArray
}
