import { BigInt, log } from '@graphprotocol/graph-ts'
import {
  TokensReleased,
  TokensWithdrawn,
  TokensRevoked,
  ManagerUpdated,
  ApproveTokenDestinations,
  RevokeTokenDestinations,
} from '../../types/templates/GraphTokenLockWallet/GraphTokenLockWallet'

import { TokenLockWallet } from '../../types/schema'

export function handleTokensReleased(event: TokensReleased): void {
  let tokenLockWallet = TokenLockWallet.load(event.address.toHexString())!
  tokenLockWallet.tokensReleased = tokenLockWallet.tokensReleased.plus(event.params.amount)
  tokenLockWallet.save()
}

export function handleTokensWithdrawn(event: TokensWithdrawn): void {
  let tokenLockWallet = TokenLockWallet.load(event.address.toHexString())!
  tokenLockWallet.tokensWithdrawn = tokenLockWallet.tokensWithdrawn.plus(event.params.amount)
  tokenLockWallet.save()
}

export function handleTokensRevoked(event: TokensRevoked): void {
  let tokenLockWallet = TokenLockWallet.load(event.address.toHexString())!
  tokenLockWallet.tokensRevoked = tokenLockWallet.tokensRevoked.plus(event.params.amount)
  tokenLockWallet.save()
}

export function handleManagerUpdated(event: ManagerUpdated): void {
  let id = event.address.toHexString()
  log.warning('address id: {}', [id])
  let tokenLockWallet = TokenLockWallet.load(id)
  if (tokenLockWallet == null) {
    log.warning("wallet doesn't exist", [])
    return
  }
  tokenLockWallet.manager = event.params._newManager
  tokenLockWallet.save()
}

export function handleApproveTokenDestinations(event: ApproveTokenDestinations): void {
  let tokenLockWallet = TokenLockWallet.load(event.address.toHexString())!
  tokenLockWallet.tokenDestinationsApproved = true
  tokenLockWallet.save()
}

export function handleRevokeTokenDestinations(event: RevokeTokenDestinations): void {
  let tokenLockWallet = TokenLockWallet.load(event.address.toHexString())!
  tokenLockWallet.tokenDestinationsApproved = false
  tokenLockWallet.save()
}
