import {
  ServiceRegistered,
  ServiceUnregistered,
} from '../types/ServiceRegistry/ServiceRegistry'
import { Indexer, GraphAccount } from '../types/schema'

import { createIndexer, createGraphAccount } from './helpers'

/**
 * @dev handleServiceRegistered
 * - updates indexer, creates if needed
 */
export function handleServiceRegistered(event: ServiceRegistered): void {
  let id = event.params.indexer.toHexString()

  // Creates Graph Account, if needed
  let graphAccount = GraphAccount.load(id)
  if (graphAccount == null) {
    graphAccount = createGraphAccount(id, event.params.indexer, event.block.timestamp)
  }

  let indexer = Indexer.load(id)
  if (indexer == null) {
    indexer = createIndexer(id, event.block.timestamp)
  }
  indexer.urlString = event.params.url
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
  indexer.urlString = null
  indexer.geoHash = null
  indexer.save()
}
