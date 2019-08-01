import {store} from '@graphprotocol/graph-ts'
import {
  DomainAdded,
  DomainTransferred,
  SubgraphCreated,
  SubgraphIDUpdated,
  DomainDeleted,
  AccountMetadataChanged,
  SubgraphMetadataChanged,
} from '../../generated/GNS/GNS'
import {Domain, Account, Subgraph} from '../../generated/schema'

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
  let id = event.params.topLevelDomainHash.toHexString()
  let domain = new Domain(id)
  domain.name = event.params.subdomainName
  domain.metadataHash = event.params.registeredHash

  // The subddomain is blank, i.e. we are registered to the TLD
  // We ignore the subdomain name (it is blank), and the domain hash is the same as the TLD
  if (event.params.registeredHash.toHexString() ==
    '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470') {
    let id = event.params.topLevelDomainHash.toHexString()
    let domain = new Domain(id)
    domain.save()
    // It is a sub domain, we register a new domain, with a parent domain as the TLD
  } else {
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
  domain.metadataHash = event.params.ipfsHash
  domain.save()
}