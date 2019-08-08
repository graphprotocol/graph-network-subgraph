import {store, BigInt} from '@graphprotocol/graph-ts'
import {
  DomainAdded,
  DomainTransferred,
  SubgraphCreated,
  SubgraphIDUpdated,
  DomainDeleted,
  AccountMetadataChanged,
  SubgraphMetadataChanged,
} from '../../generated/GNS/GNS'
import {Domain, Account, Subgraph, TotalSubgraphs} from '../../generated/schema'

export function handleDomainAdded(event: DomainAdded): void {
  let id = event.params.topLevelDomainHash.toHexString()
  let domain = new Domain(id)
  domain.name = event.params.domainName
  domain.owner = event.params.owner
  domain.save()
}

export function handleDomainTransferred(event: DomainTransferred): void {
  let id = event.params.domainHash.toHexString()
  let domain = new Domain(id)
  domain.owner = event.params.newOwner
  domain.save()
}

export function handleSubgraphCreated(event: SubgraphCreated): void {
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
  store.remove("Domain", id)
}

export function handleAccountMetadataChanged(event: AccountMetadataChanged): void {
  let id = event.params.account.toHexString()
  let account = new Account(id)
  account.metadataHash = event.params.ipfsHash
  account.save()
}

export function handleSubgraphMetadataChanged(event: SubgraphMetadataChanged): void {
  let id = event.params.domainHash.toHexString()
  let domain = new Domain(id)
  domain.save()

  let totalSubgraphs = TotalSubgraphs.load("1")
  if (totalSubgraphs == null){
    totalSubgraphs = new TotalSubgraphs("1")
  }
  let subgraphID =  BigInt.fromI32(totalSubgraphs.total).toString()
  let subgraph = new Subgraph(subgraphID)
  subgraph.metadataHash = event.params.ipfsHash
}