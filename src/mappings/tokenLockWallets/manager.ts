import { BigInt, log } from '@graphprotocol/graph-ts'
import {
  MasterCopyUpdated,
  TokenLockCreated,
  TokensDeposited,
  TokensWithdrawn,
  FunctionCallAuth,
  TokenDestinationAllowed,
} from '../../types/GraphTokenLockManager/GraphTokenLockManager'
import { GraphTokenLockWallet } from '../../types/templates'
import { TokenManager, TokenLockWallet, AuthorizedFunction } from '../../types/schema'
import { createOrLoadGraphAccount } from '../helpers'

export function handleMasterCopyUpdated(event: MasterCopyUpdated): void {
  let tokenLock = TokenManager.load(event.address.toHexString())
  if (tokenLock == null) {
    tokenLock = new TokenManager(event.address.toHexString())
    tokenLock.tokens = BigInt.fromI32(0)
    tokenLock.tokenLockCount = BigInt.fromI32(0)
  }
  tokenLock.masterCopy = event.params.masterCopy
  tokenLock.save()
}

/**
 * @param _contractAddress The address of the contract
 * @param _initHash The hash of the initializer
 * @param _beneficiary Address of the beneficiary of locked tokens
 * @param _token The token being used
 * @param _managedAmount Amount of tokens to be managed by the lock contract
 * @param _startTime Start time of the release schedule
 * @param _endTime End time of the release schedule
 * @param _periods Number of periods between start time and end time
 * @param _releaseStartTime Override time for when the releases start
 * @param _revocable Whether the contract is revocable
 * @param _vestingCliffTime Time the cliff vests, 0 if no cliff
 */
export function handleTokenLockCreated(event: TokenLockCreated): void {
  let manager = TokenManager.load(event.address.toHexString())
  manager.tokenLockCount = manager.tokenLockCount.plus(BigInt.fromI32(1))
  manager.save()

  let id = event.params.contractAddress.toHexString()
  log.warning('[TOKEN LOCK CREATED] id used: {}', [id])
  let tokenLock = new TokenLockWallet(id)
  tokenLock.manager = event.address
  tokenLock.initHash = event.params.initHash
  tokenLock.beneficiary = event.params.beneficiary
  tokenLock.token = event.params.token
  tokenLock.managedAmount = event.params.managedAmount
  tokenLock.startTime = event.params.startTime
  tokenLock.endTime = event.params.endTime
  tokenLock.periods = event.params.periods
  tokenLock.releaseStartTime = event.params.releaseStartTime
  tokenLock.vestingCliffTime = event.params.vestingCliffTime
  tokenLock.tokenDestinationsApproved = false
  tokenLock.tokensWithdrawn = BigInt.fromI32(0)
  tokenLock.tokensRevoked = BigInt.fromI32(0)
  tokenLock.tokensReleased = BigInt.fromI32(0)
  tokenLock.blockNumberCreated = event.block.number
  tokenLock.txHash = event.transaction.hash
  if (event.params.revocable == 0) {
    tokenLock.revocable = 'NotSet'
  } else if (event.params.revocable == 1) {
    tokenLock.revocable = 'Enabled'
  } else {
    tokenLock.revocable = 'Disabled'
  }
  tokenLock.save()
  log.warning('[TOKEN LOCK CREATED] entity saved with id: {}', [id])
  GraphTokenLockWallet.create(event.params.contractAddress)

  createOrLoadGraphAccount(id, event.params.contractAddress, event.block.timestamp)

  let graphAccount = createOrLoadGraphAccount(
    event.params.beneficiary.toHexString(),
    event.params.beneficiary,
    event.block.timestamp,
  )
  let tlws = graphAccount.tokenLockWallets
  tlws.push(event.params.contractAddress.toHexString())
  graphAccount.tokenLockWallets = tlws
  graphAccount.save()
}

export function handleTokensDeposited(event: TokensDeposited): void {
  let tokenLock = TokenManager.load(event.address.toHexString())
  tokenLock.tokens = tokenLock.tokens.plus(event.params.amount)
  tokenLock.save()
}

export function handleTokensWithdrawn(event: TokensWithdrawn): void {
  let tokenLock = TokenManager.load(event.address.toHexString())
  tokenLock.tokens = tokenLock.tokens.minus(event.params.amount)
  tokenLock.save()
}

export function handleFunctionCallAuth(event: FunctionCallAuth): void {
  let auth = new AuthorizedFunction(event.params.signature)
  auth.target = event.params.target
  auth.sigHash = event.params.sigHash
  auth.manager = event.address.toHexString()
  auth.save()
}

export function handleTokenDestinationAllowed(event: TokenDestinationAllowed): void {
  let tokenLock = TokenManager.load(event.address.toHexString())
  let destinations = tokenLock.tokenDestinations

  if (destinations == null) {
    destinations = []
  }
  let index = destinations.indexOf(event.params.dst)

  // It was not there before
  if (index == -1) {
    // Lets add it in
    if (event.params.allowed) {
      destinations.push(event.params.dst)
    }
    // If false was passed, we do nothing
    // It was there before
  } else {
    // We are revoking access
    if (!event.params.allowed) {
      destinations.splice(index, 1)
    }
    // Otherwise do nothing
  }
  tokenLock.tokenDestinations = destinations
  tokenLock.save()
}
