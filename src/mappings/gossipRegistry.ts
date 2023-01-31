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
    let gossipOperator = graphAccount.gossipOperator
  
    gossipOperator = event.params.operator.toHexString()
    // Create the operator as a graph account
    createOrLoadGraphAccount(event.params.operator, event.block.timestamp)
    graphAccount.gossipOperator = gossipOperator
    graphAccount.save()
  }
  