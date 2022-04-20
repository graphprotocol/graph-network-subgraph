import { json, ipfs, Bytes, JSONValueKind, log } from '@graphprotocol/graph-ts'
import { GraphAccount, Subgraph, SubgraphVersion, SubgraphDeployment, Contract, ContractEvent } from '../types/schema'
import { jsonToString } from './utils'
import { createOrLoadSubgraphCategory, createOrLoadSubgraphCategoryRelation, createOrLoadNetwork, createOrLoadContract, createOrLoadContractEvent } from './helpers'

export function fetchGraphAccountMetadata(graphAccount: GraphAccount, ipfsHash: string): void {
  {{#ipfs}}
  let ipfsData = ipfs.cat(ipfsHash)
  if (ipfsData !== null) {
    let data = json.fromBytes(ipfsData as Bytes).toObject()
    graphAccount.codeRepository = jsonToString(data.get('codeRepository'))
    graphAccount.description = jsonToString(data.get('description'))
    graphAccount.image = jsonToString(data.get('image'))
    graphAccount.displayName = jsonToString(data.get('displayName'))
    let isOrganization = data.get('isOrganization')
    if (isOrganization != null && isOrganization.kind === JSONValueKind.BOOL) {
      graphAccount.isOrganization = isOrganization.toBool()
    }
    graphAccount.website = jsonToString(data.get('website'))
    graphAccount.save()

    // Update all associated vesting contract addresses
    let tlws = graphAccount.tokenLockWallets
    for (let i = 0; i < tlws.length; i++) {
      let tlw = GraphAccount.load(tlws[i])!
      tlw.codeRepository = graphAccount.codeRepository
      tlw.description = graphAccount.description
      tlw.image = graphAccount.image
      tlw.displayName = graphAccount.displayName
      if (isOrganization != null && isOrganization.kind === JSONValueKind.BOOL) {
        tlw.isOrganization = isOrganization.toBool()
      }
      tlw.website = graphAccount.website
      tlw.save()
    }
  }
  {{/ipfs}}
}

export function fetchSubgraphMetadata(subgraph: Subgraph, ipfsHash: string): Subgraph {
  {{#ipfs}}
  let metadata = ipfs.cat(ipfsHash)
  if (metadata !== null) {
    let tryData = json.try_fromBytes(metadata as Bytes)
    if (tryData.isOk) {
      let data = tryData.value.toObject()
      subgraph.description = jsonToString(data.get('description'))
      subgraph.displayName = jsonToString(data.get('displayName'))
      subgraph.codeRepository = jsonToString(data.get('codeRepository'))
      subgraph.website = jsonToString(data.get('website'))
      let categories = data.get('categories')

      if(categories != null && !categories.isNull()) {
        let categoriesArray = categories.toArray()

        for(let i = 0; i < categoriesArray.length; i++) {
          let categoryId = jsonToString(categoriesArray[i])
          createOrLoadSubgraphCategory(categoryId)
          createOrLoadSubgraphCategoryRelation(categoryId, subgraph.id)
          if(subgraph.linkedEntity != null) {
            createOrLoadSubgraphCategoryRelation(categoryId, subgraph.linkedEntity!)
          }
        }
      }
      let image = jsonToString(data.get('image'))
      let subgraphImage = data.get('subgraphImage')
      if (subgraphImage != null && subgraphImage.kind === JSONValueKind.STRING)  {
        subgraph.nftImage = image
        subgraph.image = jsonToString(subgraphImage)
      } else {
        subgraph.image = image
      }
    }
  }
  {{/ipfs}}
  return subgraph
}

export function fetchSubgraphVersionMetadata(subgraphVersion: SubgraphVersion, ipfsHash: string): SubgraphVersion {
  {{#ipfs}}
  let getVersionDataFromIPFS = ipfs.cat(ipfsHash)
  if (getVersionDataFromIPFS !== null) {
    let tryData = json.try_fromBytes(getVersionDataFromIPFS as Bytes)
    if (tryData.isOk) {
      let data = tryData.value.toObject()
      subgraphVersion.description = jsonToString(data.get('description'))
      subgraphVersion.label = jsonToString(data.get('label'))
    } else {
      subgraphVersion.description = ''
      subgraphVersion.label = ''
    }
  }
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
    let schemaSplit = manifest.split('schema:\n', 2)[1]
    let schemaFileSplit = schemaSplit.split('/ipfs/', 2)[1]
    let schemaIpfsHash = schemaFileSplit.split('\n', 2)[0]
    deployment.schemaIpfsHash = schemaIpfsHash

    let getSchemaFromIPFS = ipfs.cat(schemaIpfsHash)
    if (getSchemaFromIPFS !== null) {
      deployment.schema = getSchemaFromIPFS.toString()
    }

    // We get the first occurrence of `network` since subgraphs can only have data sources for the same network
    let networkSplit = manifest.split('network: ', 2)[1]
    let network = networkSplit.split('\n', 2)[0]

    createOrLoadNetwork(network)
    deployment.network = network
  }
  {{/ipfs}}
  return deployment as SubgraphDeployment
}

/* Subgraph Contract Metadata Extraction & Helpers */

export function stripQuotes(str: String): String {
  let res = ''
  let remove = ['\'','"',' ']
  for(let i = 0; i < str.length; i++) {
    if(!remove.includes(str[i])) res = res.concat(str[i])
  }
  return res as String
}

export function formatEvent(str: String): String {
  let res = ''
  let pass = ''
  // Strip Quotes - TODO breakout into function common to stripQuotes()
  let remove = ['\'','"']
  for(let i = 0; i < str.length; i++) {
    if(!remove.includes(str[i])) pass = pass.concat(str[i])
  }
  // Newline handling
  pass = pass.replaceAll('\r',' ')
  pass = pass.replaceAll('\n',' ')
  pass = pass.replaceAll('>-',' ')
  // Space handling
  let last = ' '
  for(let i = 0; i < pass.length; i++) {
    if(pass[i] == ' ' && last == ' ') {
      continue
    } else {
      res = res.concat(pass[i])
    }
    last = pass[i]
  }
  res = res.trim()
  return res as String
}

export function extractContractEvents(kind: String, contract: Contract): void {
  let eventHandlersSplit = kind.split("eventHandlers:",2)
  let eventHandlersStr = ''
  if(eventHandlersSplit.length >= 2) {
    eventHandlersStr = eventHandlersSplit[1]
  }
  let eventSplit = eventHandlersStr.split("- event:")
  for(let i = 1; i < eventSplit.length; i++) {
    let sanitizeSplit = eventSplit[i].split("handler:",2)
    let eventIso = formatEvent(sanitizeSplit[0])
    log.debug("Contract event extracted: '{}'",[eventIso])
    let contractEvent = createOrLoadContractEvent(contract.id,eventIso)
  }
}

export function extractContractAddresses(ipfsData: String): Array<String> {
  let res = new Array<String>(0)
  // Use split() until a suitable YAML parser is found.  Approach was used in graph-network-subgraph.
  let dataSourcesSplit = ipfsData.split('dataSources:\n',2)
  let dataSourcesStr = ''
  if(dataSourcesSplit.length >= 2) {
    dataSourcesStr = dataSourcesSplit[1];
  } else {
    // Problem
    return res as Array<String>
  }
  // Determine where 'dataSources:' ends, exclude everything thereafter.
  let sanitizeSplit = dataSourcesStr.split('\n')
  let shouldDelete = false
  // Assumes 32 for space.
  dataSourcesStr = ''
  for(let i = 0; i < sanitizeSplit.length; i++) {
    if(sanitizeSplit[i].charAt(0) != ' ' || shouldDelete) {
      shouldDelete = true
    } else {
      dataSourcesStr = dataSourcesStr.concat(sanitizeSplit[i])
      if(i < sanitizeSplit.length - 1) {
        dataSourcesStr = dataSourcesStr.concat('\n')
      }
    }
  }
  // Extract
  let kindSplit = dataSourcesStr.split('- kind:')
  let sourceStr = ''
  let addressStr = ''
  let addressIso = ''
  for(let i = 1; i < kindSplit.length; i++) {
    addressIso = ''
    // Source Address
    let sourceSplit = kindSplit[i].split(' source:',2)
    if(sourceSplit.length < 2) continue
    else sourceStr = sourceSplit[1]
    
    let addressSplit = sourceStr.split(' address:',2)
    if(addressSplit.length < 2) continue
    else addressStr = addressSplit[1]
    
    let addressStrSplit = addressStr.split('\n',2)
    if(addressStrSplit.length < 2) continue
    else addressIso = addressStrSplit[0]
    
    log.debug("Contract address '{}' extracted",[addressIso])
    res.push(stripQuotes(addressIso))

    // Isolate contract events
    let contract = createOrLoadContract(stripQuotes(addressIso))
    extractContractEvents(kindSplit[i],contract)
  }
  
  return res as Array<String>
}

export function processManifestForContracts(subgraph: Subgraph, deployment: SubgraphDeployment): void {
  {{#ipfs}}
  let subgraphDeploymentID = deployment.id
  let subgraphID = subgraph.id
  let prefix = '1220'
  let ipfsHash = Bytes.fromHexString(prefix.concat(subgraphDeploymentID.slice(2))).toBase58()

  log.debug("Checking IPFS for hash '{}'",[ipfsHash])
  
  let ipfsData = ipfs.cat(ipfsHash)
  
  if(ipfsData !== null) {
    let contractAddresses = extractContractAddresses(ipfsData.toString())
    let address = ''
    for(let i = 0; i < contractAddresses.length; i++) {
      address = contractAddresses[i]
      log.debug("Associating address '{}'",[address])
      let contract = createOrLoadContract(address)
      let assoc = deployment.contracts
      if(assoc.indexOf(address) == -1) {
        assoc.push(address)
        deployment.contracts = assoc
        deployment.save()
      }
    }
  }
  {{/ipfs}}
}
