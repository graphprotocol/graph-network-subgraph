import { log } from '@graphprotocol/graph-ts'
import {
  DomainAdded,
  DomainTransferred,
  SubgraphIdAdded,
  SubgraphIdChanged,
  SubgraphIdDeleted,
  AccountMetadataChanged,
  SubgraphMetadataChanged
} from '../../generated/GNS/GNS'
import {Domain, Account, Subgraph} from '../../generated/schema'

export function handleDomainAdded(event: DomainAdded): void {
  let id = event.params.topLevelDomainHash.toHex()
  let domain = new Domain(id)
  domain.name = event.params.domainName
  domain.owner = event.params.owner
  domain.save()
}

export function handleDomainTransferred(event: DomainTransferred): void {
  let id = event.params.topLevelDomainHash.toHex()
  let domain = new Domain(id)
  domain.owner = event.params.newOwner
  domain.save()
}

export function handleSubgraphIdAdded(event: SubgraphIdAdded): void {
  // log.debug('Subdomain Hash: {}', [event.params.subdomainHash.toHexString()])

  // Subdomain string is blank, therefore we are indexing a tld
  if (event.params.subdomainHash.toHexString() == "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470") {
    let id = event.params.topLevelDomainHash.toHex()
    let domain = new Domain(id)
    domain.subgraphID = event.params.subgraphId
    domain.metadataHash = event.params.ipfsHash

    domain.save()

    // We are indexing a subdomain, since the name is not blank
  } else {
    let id = event.params.subdomainHash.toHex()
    let domain = new Domain(id)
    domain.subgraphID = event.params.subgraphId
    domain.metadataHash = event.params.ipfsHash
    domain.parentDomain = event.params.topLevelDomainHash
    domain.name = event.params.subdomainName
    domain.save()
    // name is added previously when domain is registered
  }

  let subgraph = new Subgraph(event.params.subgraphId.toHexString())
  subgraph.save()
}

export function handleSubgraphIdChanged(event: SubgraphIdChanged): void {
  if (event.params.subdomainHash.toHexString() == "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470") {
    let id = event.params.topLevelDomainHash.toHex()
    let domain = new Domain(id)
    domain.subgraphID = event.params.subgraphId
    domain.save()
  } else {
    let id = event.params.subdomainHash.toHex()
    let domain = new Domain(id)
    domain.subgraphID = event.params.subgraphId
    domain.save()
  }
  let subgraph = new Subgraph(event.params.subgraphId.toHexString())
  subgraph.save()
}

export function handleSubgraphIdDeleted(event: SubgraphIdDeleted): void {
  if (event.params.subdomainHash.toHexString() == "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470") {
    let id = event.params.topLevelDomainHash.toHex()
    let domain = new Domain(id)
    domain.subgraphID = null
    domain.save()
  } else {
    let id = event.params.subdomainHash.toHex()
    let domain = new Domain(id)
    domain.subgraphID = null
    domain.save()
  }

  // TODO - should we delete the subgraph here? it would still exist as its own staking contract, it is just getting
  // remove from the gns. need to think this through a bit
}

export function handleAccountMetadataChanged(event: AccountMetadataChanged): void {
  let id = event.params.account.toHex()
  let account = new Account(id)
  account.metadataHash = event.params.ipfsHash
  account.save()
}

export function handleSubgraphMetadataChanged(event: SubgraphMetadataChanged): void {
  if (event.params.subdomainHash.toHexString() == "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470") {
    let id = event.params.topLevelDomainHash.toHex()
    let domain = new Domain(id)
    domain.metadataHash = event.params.ipfsHash
    domain.save()
  } else {
    let id = event.params.subdomainHash.toHex()
    let domain = new Domain(id)
    domain.metadataHash = event.params.ipfsHash
    domain.save()
  }
}