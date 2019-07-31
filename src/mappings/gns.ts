import { log } from '@graphprotocol/graph-ts'
import {
  DomainAdded,
  DomainTransferred,
  SubgraphCreated,
  SubgraphDeployed,
  SubgraphIDUpdated,
  DomainDeleted,
  AccountMetadataChanged,
  SubgraphMetadataChanged,
} from '../../generated/GNS/GNS'
import { Domain, Account } from '../../generated/schema'

export function handleDomainAdded(event: DomainAdded): void {
  let id = event.params.topLevelDomainHash.toHex()
  let domain = new Domain(id)
  domain.name = event.params.domainName
  domain.owner = event.params.owner
  domain.save()
}

export function handleDomainTransferred(event: DomainTransferred): void {
  let id = event.params.domainHash.toHex()
  let domain = new Domain(id)
  domain.owner = event.params.newOwner
  domain.save()
}

export function handleSubgraphCreated(event: SubgraphCreated): void {
  log.debug('Toplevel Domain Hash: {}', [event.params.topLevelDomainHash.toHexString()])

  let id = event.params.topLevelDomainHash.toHex()
  let domain = new Domain(id)
  domain.name = event.params.subdomainName
  domain.metadataHash = event.params.registeredHash
}

export function handleSubgraphDeployed(event: SubgraphDeployed): void {
  log.debug('Subdomain Hash: {}', [event.params.domainHash.toHexString()])

  // Subdomain string is not blank, therefore we are indexing a tld
  if (
    event.params.subdomainHash.toHexString() !=
    '0x1c47c222430ce3cff6bbf3ce14d1374f52c32d129ef0ce041af2c4eea5ff81e2'
  ) {
    let id = event.params.topLevelDomainHash.toHex()
    let domain = new Domain(id)
    domain.subgraphID = event.params.subgraphID
    domain.metadataHash = event.params.ipfsHash // we don't have ipfsHash

    domain.save()

    // We are indexing a subdomain, since the name is not blank
  } else {
    let id = event.params.subdomainHash.toHex()
    let domain = new Domain(id)
    domain.subgraphID = event.params.subgraphID
    domain.metadataHash = event.params.ipfsHash
    domain.parentDomain = event.params.topLevelDomainHash
    domain.name = event.params.subdomainName
    domain.save()
    // name is added previously when domain is registered
  }
}

export function handleSubgraphIDUpdated(event: SubgraphIDUpdated): void {
  if (
    event.params.subdomainHash.toHexString() ==
    'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
  ) {
    let id = event.params.topLevelDomainHash.toHex()
    let domain = new Domain(id)
    domain.subgraphID = event.params.subgraphID
    domain.save()
  } else {
    let id = event.params.subdomainHash.toHex()
    let domain = new Domain(id)
    domain.subgraphID = event.params.subgraphID
    domain.save()
  }
}

// export function handleSubgraphIdDeleted(event: SubgraphIdDeleted): void {
//   if (
//     event.params.subdomainHash.toHexString() ==
//     'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
//   ) {
//     let id = event.params.topLevelDomainHash.toHex()
//     let domain = new Domain(id)
//     domain.subgraphID = null
//     domain.save()
//   } else {
//     let id = event.params.subdomainHash.toHex()
//     let domain = new Domain(id)
//     domain.subgraphID = null
//     domain.save()
//   }
// }

export function handleDomainDeleted(event: DomainDeleted): void {}

export function handleAccountMetadataChanged(event: AccountMetadataChanged): void {
  let id = event.params.account.toHex()
  let account = new Account(id)
  account.metadataHash = event.params.ipfsHash
  account.save()
}

export function handleSubgraphMetadataChanged(event: SubgraphMetadataChanged): void {
  // if (
  //   event.params.subdomainHash.toHexString() ==
  //   'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
  // ) {
  let id = event.params.domainHash.toHex()
  let domain = new Domain(id)
  domain.metadataHash = event.params.ipfsHash
  domain.save()
  // } else {
  //   let id = event.params.subdomainHash.toHex()
  //   let domain = new Domain(id)
  //   domain.metadataHash = event.params.ipfsHash
  //   domain.save()
  // }
}
