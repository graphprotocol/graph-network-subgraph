import {
  SetContractProxy,
  NewOwnership,
  PartialPauseChanged,
  PauseChanged,
  NewPauseGuardian,
} from '../types/Controller/Controller'

import { createOrLoadGraphNetwork } from './helpers'

/**
 * @dev handleSetContractProxy
 *
 */
export function handleSetContractProxy(event: SetContractProxy): void {
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  let contractID = event.params.id.toHexString()
  // contract ids are of the form keccak256('ContractName') , i.e. keccak256('Curation')
  let curationID = '0xe6876326c1291dfcbbd3864a6816d698cd591defc7aa2153d7f9c4c04016c89f'
  let gnsID = '0x39605a6c26a173774ca666c67ef70cf491880e5d3d6d0ca66ec0a31034f15ea3'
  let disputeManagerID = '0xf942813d07d17b56de9a9afc8de0ced6e8c053bbfdcc87b7badea4ddcf27c307'
  let epochManagerID = '0xc713c3df6d14cdf946460395d09af88993ee2b948b1a808161494e32c5f67063'
  let rewardsManagerID = '0x966f1e8d8d8014e05f6ec4a57138da9be1f7c5a7f802928a18072f7c53180761'
  let stakingID = '0x1df41cd916959d1163dc8f0671a666ea8a3e434c13e40faef527133b5d167034'
  let graphTokenID = '0x45fc200c7e4544e457d3c5709bfe0d520442c30bbcbdaede89e8d4a4bbc19247'

  if (contractID == curationID) {
    graphNetwork.curation = event.params.contractAddress
  } else if (contractID == gnsID) {
    graphNetwork.gns = event.params.contractAddress
  } else if (contractID == disputeManagerID) {
    graphNetwork.disputeManager = event.params.contractAddress
  } else if (contractID == epochManagerID) {
    graphNetwork.epochManager = event.params.contractAddress
  } else if (contractID == rewardsManagerID) {
    graphNetwork.rewardsManager = event.params.contractAddress
  } else if (contractID == stakingID) {
    graphNetwork.staking = event.params.contractAddress
  } else if (contractID == graphTokenID) {
    graphNetwork.graphToken = event.params.contractAddress
  }
  graphNetwork.save()
}

/**
 * @dev handleNewOwnership
 *
 */
export function handleNewOwnership(event: NewOwnership): void {
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.governor = event.params.to
  graphNetwork.save()
}

/**
 * @dev handlePartialPauseChanged
 *
 */
export function handlePartialPauseChanged(event: PartialPauseChanged): void {
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.isPartialPaused = event.params.isPaused
  graphNetwork.save()
}

/**
 * @dev handlePauseChanged
 *
 */
export function handlePauseChanged(event: PauseChanged): void {
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.isPaused = event.params.isPaused
  graphNetwork.save()
}

/**
 * @dev handleNewPauseGuardian
 *
 */
export function handleNewPauseGuardian(event: NewPauseGuardian): void {
  let graphNetwork = createOrLoadGraphNetwork(event.block.number, event.address)
  graphNetwork.pauseGuardian = event.params.pauseGuardian
  graphNetwork.save()
}
