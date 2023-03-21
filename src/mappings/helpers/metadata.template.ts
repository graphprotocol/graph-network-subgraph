import { GraphAccount, Subgraph, SubgraphVersion, SubgraphDeployment } from '../../types/schema'
import { AccountMetadata, SubgraphDeploymentMetadata, SubgraphMetadata, SubgraphVersionMetadata} from '../../types/templates'

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
  deployment.metadata = ipfsHash
  SubgraphDeploymentMetadata.create(ipfsHash);
  {{/ipfs}}
  return deployment as SubgraphDeployment
}
