import { ServiceUrlSet } from '../../generated/ServiceRegistry/ServiceRegistry'
import { Indexer } from '../../generated/schema'

export function handleServiceUrlSet(event: ServiceUrlSet): void {
  let id = event.params.serviceProvider.toHexString()
  let indexer = new Indexer(id)
  indexer.urlBytes = event.params.urlBytes
  indexer.urlString = event.params.urlString
  indexer.save()
}
