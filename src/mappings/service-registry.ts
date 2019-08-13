import { ServiceUrlSet } from '../../generated/ServiceRegistry/ServiceRegistry'
import { Indexer } from '../../generated/schema'

export function handleServiceUrlSet(event: ServiceUrlSet): void {
  let id = event.params.serviceProvider.toHexString()
  let indexer = new Indexer(id)
  indexer.url = event.params.url
  indexer.save()
}
