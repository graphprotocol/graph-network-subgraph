import {BigInt} from '@graphprotocol/graph-ts'
import {
  DomainAdded
} from '../types/GNS/GNS'
import {Domain} from '../types/schema'

export function handleDomainAdded(event: DomainAdded): void {
  // let id = event.params.domainHash.toHex()
  // let domain = new Domain(id)
  // domain.name = event.params.domainName
  // domain.owner = event.params.owner
  // domain.save()
}

