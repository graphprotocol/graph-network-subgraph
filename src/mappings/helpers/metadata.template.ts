import { json, ipfs, Bytes, log } from '@graphprotocol/graph-ts'
import { GraphAccount, Subgraph, SubgraphVersion, SubgraphDeployment } from '../../types/schema'
import { AccountMetadata, SubgraphMetadata, SubgraphVersionMetadata} from '../../types/templates'
import { jsonToString } from '../utils'
import { createOrLoadNetwork } from './helpers'

export function fetchGraphAccountMetadata(graphAccount: GraphAccount, ipfsHash: string): void {
  {{#ipfs}}
  graphAccount.metadata = ipfsHash
  let tlws = graphAccount.tokenLockWallets
  for (let i = 0; i < tlws.length; i++) {
    let tlw = GraphAccount.load(tlws[i])!
    tlw.metadata = ipfsHash
    tlw.save()
  }
  AccountMetadata.create(ipfsHash)
  {{/ipfs}}
}

export function fetchSubgraphMetadata(subgraph: Subgraph, ipfsHash: string): Subgraph {
  {{#ipfs}}
  subgraph.metadata = ipfsHash;
  SubgraphMetadata.create(ipfsHash);
  {{/ipfs}}
  return subgraph
}

export function fetchSubgraphVersionMetadata(subgraphVersion: SubgraphVersion, ipfsHash: string): SubgraphVersion {
  {{#ipfs}}
  subgraphVersion.metadata = ipfsHash
  SubgraphVersionMetadata.create(ipfsHash);
  {{/ipfs}}
  return subgraphVersion
}

export function fetchSubgraphDeploymentManifest(deployment: SubgraphDeployment, ipfsHash: string): SubgraphDeployment {
  {{#ipfs}}
  let getManifestFromIPFS = ipfs.cat(ipfsHash)
  if (getManifestFromIPFS !== null) {
    deployment.manifest = getManifestFromIPFS.toString()

    let manifest = deployment.manifest!
    // we take the right side of the split, since it's the one which will have the schema ipfs hash
    let schemaSplitTry = manifest.split('schema:\n', 2)
    if (schemaSplitTry.length == 2) {
      let schemaSplit = schemaSplitTry[1]

      let schemaFileSplitTry = schemaSplit.split('/ipfs/', 2)
      if (schemaFileSplitTry.length == 2) {
        let schemaFileSplit = schemaFileSplitTry[1]

        let schemaIpfsHashTry = schemaFileSplit.split('\n', 2)
        if (schemaIpfsHashTry.length == 2) {
          let schemaIpfsHash = schemaIpfsHashTry[0]
          deployment.schemaIpfsHash = schemaIpfsHash

          let getSchemaFromIPFS = ipfs.cat(schemaIpfsHash)
          if (getSchemaFromIPFS !== null) {
            deployment.schema = getSchemaFromIPFS.toString()
          }
        } else {
          log.warning("[MANIFEST PARSING FAIL] Deployment: {}, schema file hash can't be retrieved. Error: schemaIpfsHashTry.length isn't 2, actual length: {}", [ipfsHash, schemaIpfsHashTry.length.toString()])
        }
      } else {
        log.warning("[MANIFEST PARSING FAIL] Deployment: {}, schema file hash can't be retrieved. Error: schemaFileSplitTry.length isn't 2, actual length: {}", [ipfsHash, schemaFileSplitTry.length.toString()])
      }
    } else {
      log.warning("[MANIFEST PARSING FAIL] Deployment: {}, schema file hash can't be retrieved. Error: schemaSplitTry.length isn't 2, actual length: {}", [ipfsHash, schemaSplitTry.length.toString()])
    }

    // We get the first occurrence of `network` since subgraphs can only have data sources for the same network
    let networkSplitTry = manifest.split('network: ', 2)
    if (networkSplitTry.length == 2) {
      let networkSplit = networkSplitTry[1]
      let networkTry = networkSplit.split('\n', 2)
      if (networkTry.length == 2) {
        let network = networkTry[0]

        createOrLoadNetwork(network)
        deployment.network = network
      } else {
        log.warning("[MANIFEST PARSING FAIL] Deployment: {}, network can't be parsed. Error: networkTry.length isn't 2, actual length: {}", [ipfsHash, networkTry.length.toString()])
      }
    } else {
      log.warning("[MANIFEST PARSING FAIL] Deployment: {}, network can't be parsed. Error: networkSplitTry.length isn't 2, actual length: {}", [ipfsHash, networkSplitTry.length.toString()])
    }
  }
  {{/ipfs}}
  return deployment as SubgraphDeployment
}
