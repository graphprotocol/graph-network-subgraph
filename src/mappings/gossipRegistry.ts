import {
  SetGossipOperator
} from '../types/GossipRegistry/GossipRegistry'

import { createOrLoadGraphAccount } from './helpers'

/**
 * @dev handleSetGossipOperator
 *
 */
export function handleSetGossipOperator(event: SetGossipOperator): void {
  let graphAccount = createOrLoadGraphAccount(event.params.indexer, event.block.timestamp)
  let gossipOperators = graphAccount.gossipOperators
  let index = gossipOperators.indexOf(event.params.operator.toHexString())
  if (index != -1) {
    // false - it existed, and we set it to false, so remove from gossipOperators
    if (!event.params.allowed) {
      gossipOperators.splice(index, 1)
    }
  } else {
    // true - it did not exist before, and we say add, so add
    if (event.params.allowed) {
      gossipOperators.push(event.params.operator.toHexString())
      // Create the operator as a graph account
      createOrLoadGraphAccount(event.params.operator, event.block.timestamp)
    }
  }
  graphAccount.gossipOperators = gossipOperators
  graphAccount.save()
}
