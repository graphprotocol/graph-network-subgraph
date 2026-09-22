import { TargetAllocationUpdated } from '../types/IssuanceAllocator/IssuanceAllocator'
import { createOrLoadGraphNetwork } from './helpers/helpers'
import { addresses } from '../../config/addresses'
import { Address } from '@graphprotocol/graph-ts'

/**
 * @dev handleTargetAllocationUpdated
 * - Keeps GraphNetwork.networkGRTIssuancePerBlock in step with the share of
 *   issuance the RewardsManager actually receives.
 *
 * Since GIP-0076/GIP-0088 the RewardsManager no longer owns the issuance rate:
 * the IssuanceAllocator splits total issuance across targets and the
 * RewardsManager mints only its own allocation. GIP-0089 exercised that for the
 * first time on 2026-09-01, moving 24.146 GRT/block (20%) to the Foundation's
 * Innovation Allocation and leaving the RewardsManager 96.584 of the unchanged
 * 120.73 total.
 *
 * That change is invisible to the RewardsManager's own ParameterUpdated event,
 * so without this handler networkGRTIssuancePerBlock stays at whatever the
 * legacy `issuancePerBlock` storage slot last held — 120.73 — and every
 * downstream APR calculation built on it overstates indexing rewards by 25%.
 *
 * The RewardsManager is an allocator target that mints its own issuance, so
 * `newSelfMintingRate` is the rate it will issue at. The event carries it, so
 * no contract call is needed here.
 */
export function handleTargetAllocationUpdated(event: TargetAllocationUpdated): void {
  if (event.params.target != Address.fromString(addresses.rewardsManager)) {
    return
  }
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.networkGRTIssuancePerBlock = event.params.newSelfMintingRate
  graphNetwork.save()
}
