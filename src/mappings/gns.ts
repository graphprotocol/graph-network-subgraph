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
import { Domain, Account, Subgraph } from '../../generated/schema'

// new domain is treated as a Subgraph entity with parent set to null
export function handleDomainAdded(event: DomainAdded): void {
  let id = event.params.topLevelDomainHash.toHexString()
  let subgraph = new Subgraph(id)
  subgraph.name = event.params.domainName
  subgraph.owner = event.params.owner
  subgraph.parent = null
  subgraph.save()
}

export function handleDomainTransferred(event: DomainTransferred): void {
  let id = event.params.domainHash.toHexString()
  let subgraph = new Subgraph(id)
  subgraph.owner = event.params.newOwner
  subgraph.save()
}

export function handleSubgraphCreated(event: SubgraphCreated): void {
  let id = event.params.topLevelDomainHash.toHexString()
  let domain = new Domain(id)
  domain.name = event.params.subdomainName
  domain.metadataHash = event.params.registeredHash

  // The subddomain is blank, i.e. we are registered to the TLD
  // In this case both hashes are the same
  // We don't need to store any new data for the domain if TLD = registeredHash
  if (event.params.registeredHash != event.params.topLevelDomainHash) {
    let id = event.params.registeredHash.toHexString()
    let domain = new Domain(id)
    domain.parentDomain = event.params.topLevelDomainHash
    domain.name = event.params.subdomainName
    domain.save()
  }
}

// NOTE: this is not inside of subgraph.yaml
export function handleUpdateDomainSubgraphID(event: SubgraphIDUpdated): void {
  let id = event.params.domainHash.toHexString()
  let domain = new Domain(id)
  domain.subgraphID = event.params.subgraphID
  domain.save()

  // TODO - should we delete the old subgraph here too? it would still exist as its own staking contract, it is just getting remove from the gns. need to think this through a bit
  let subgraphID = event.params.subgraphID.toHexString()
  let subgraph = new Subgraph(subgraphID)
  subgraph.save()
}

export function handleDomainDeleted(event: DomainDeleted): void {
  let id = event.params.domainHash.toHexString()
  store.remove('Subgraph', id)
}

export function handleAccountMetadataChanged(event: AccountMetadataChanged): void {
  let id = event.params.account.toHexString()
  let account = new Account(id)
  account.metadataHash = event.params.ipfsHash
  account.save()
}

export function handleSubgraphIDUpdated(event: SubgraphIDUpdated): void {
  let id = event.params.domainHash.toHexString()
  let subgraph = new Subgraph(id)
}

/* Params:
  - domainHash - becomes a created Subgraph ID
  - ipfsHash - IPFS hash for subgraph metadata
*/
export function handleSubgraphMetadataChanged(event: SubgraphMetadataChanged): void {
  let id = event.params.domainHash.toHexString()
  let subgraph = new Subgraph(id)
  subgraph.metadataHash = event.params.ipfsHash
  subgraph.save()

  let hexHash = addQm(event.params.ipfsHash) as Bytes
  let base58Hash = hexHash.toBase58() // imported crypto function

  // read subgraph metadata from IPFS
  let getSubgraphDataFromIPFS = ipfs.cat(base58Hash)
  if (getSubgraphDataFromIPFS !== null) {
    let data = json.fromBytes(getSubgraphDataFromIPFS as Bytes).toObject()
    let subgraph = new Subgraph(id)
    subgraph.name = data.get('name').toString()
    subgraph.displayName = data.get('displayName').toString()
    subgraph.subtitle = data.get('subtitle').toString()
    subgraph.image = data.get('image').toString()
    subgraph.description = data.get('description').toString()
    subgraph.githubUrl = data.get('githubUrl').toString()
    subgraph.save()
  }
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
