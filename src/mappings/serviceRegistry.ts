import { ServiceRegistered, ServiceUnregistered } from '../types/ServiceRegistry/ServiceRegistry'
import { Indexer } from '../types/schema'

import { createOrLoadIndexer, createOrLoadGraphAccount } from './helpers'

/**
 * @dev handleServiceRegistered
 * - updates indexer, creates if needed
 */
export function handleServiceRegistered(event: ServiceRegistered): void {
  let id = event.params.indexer.toHexString()

  // Creates Graph Account, if needed
  createOrLoadGraphAccount(id, event.params.indexer, event.block.timestamp)

  let indexer = createOrLoadIndexer(id, event.block.timestamp)
  indexer.url = event.params.url
  indexer.geoHash = event.params.geohash
  indexer.save()
}

/**
 * @dev handleServiceUnregistered
 * - updates indexer
 */
export function handleServiceUnregistered(event: ServiceUnregistered): void {
  let id = event.params.indexer.toHexString()
  let indexer = Indexer.load(id)
  indexer.url = null
  indexer.geoHash = null
  indexer.save()
}
