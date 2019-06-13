const GNS = artifacts.require('./GNS.sol')
const exceptions = require('./exceptions')

contract('UpgradableContract', accounts => {

  let gnsInstance

  before(async () => {
    // Deploy a gns
    gnsInstance = await GNS.new(accounts[0])
  })

  it('...should allow governance to be transferred, only by the current governor', async () => {
    // Ensure it fails when called by a non governor account
    await exceptions.catchRevert(gnsInstance.contract.methods.transferGovernance(accounts[1]).send({ from: accounts[9] }))
    const originalGovernor = await gnsInstance.governor.call()
    assert.equal(originalGovernor, accounts[0], 'Governor was transferred by a non-governor account')

    // Passes when called by governor
    let governanceTransfered = await gnsInstance.contract.methods.transferGovernance(accounts[1]).send({ from: accounts[0] })
    assert(governanceTransfered)
    const newGovernor = await gnsInstance.governor.call()
    assert.equal(newGovernor, accounts[1], 'Goverenor was not transferred')
  })

  it('...should allow only governor to register domains, and then allow it to be called by getDomainOwner()', async () => {
    const governor = await gnsInstance.governor.call()
    assert.equal(governor, accounts[1], 'Governor is not account 0')

    // Ensure it fails when called by a non governor account
    await exceptions.catchRevert(gnsInstance.contract.methods.registerDomain('thegraph', accounts[1]).send({ from: accounts[9] }))

    // Passes when called by governor
    let tx = await gnsInstance.contract.methods.registerDomain('thegraph', accounts[2]).send({ from: accounts[1] })
    let tld = tx.events.DomainAdded.returnValues.topLevelDomainHash
    let ownerEmitted = tx.events.DomainAdded.returnValues.owner
    let domainName = tx.events.DomainAdded.returnValues.domainName

    assert.equal('0x119a01e2c505e362c57d2eafe4cd45b752f4e2ee3bcf1e4d038193f0d62cba61', tld, 'thegraph was not hashed correctly')
    const owner = await gnsInstance.getDomainOwner.call(tld)
    assert.equal(owner, ownerEmitted, 'Owner does not own the domain specified')
    assert.equal(domainName, 'thegraph', 'Domain name was not emitted correctly')

  })

  it('...should allow only domain owner to call addSubgraphToDomain() repeatedly, making it possible for the subgraph to update', async () => {
    let tld = '0x119a01e2c505e362c57d2eafe4cd45b752f4e2ee3bcf1e4d038193f0d62cba61'
    let subdomain = "dave-"
    let subgraphID = '0x7c83ee62ef9e4cd116c2a47fb01bce6deec8d59069a0f4c56698e93345616e63'// "QmWihwkA1YN5rArLWTk2VqA82gGv8KonbpxACVfZwX44J6" is the ipfs hash. must pass as bytes
    let ipfsHash = '0xb7fe081ef41160a57b591356186076e5eec77402385325bc1a0816b5bb764adb' // "Qmaisz6NMhDB51cCvNWa1GMS7LU1pAxdF4Ld6Ft9kZEP2a" is the ipfs hash. must pass as bytes

    await exceptions.catchRevert(gnsInstance.contract.methods.addSubgraphToDomain(tld, 'dave-', subgraphID, ipfsHash).send({ from: accounts[9] }))

   let tx = await gnsInstance.contract.methods.addSubgraphToDomain(tld, subdomain, subgraphID, ipfsHash).send({ from: accounts[2] })

    let tldEmitted = tx.events.SubgraphIdAdded.returnValues.topLevelDomainHash
    let subdomainHashEmitted = tx.events.SubgraphIdAdded.returnValues.subdomainHash
    let subgraphIDEmitted = tx.events.SubgraphIdAdded.returnValues.subgraphId
    let subdomainNameEmitted = tx.events.SubgraphIdAdded.returnValues.subdomainName
    let ipfsHashEmitted = tx.events.SubgraphIdAdded.returnValues.ipfsHash

    assert.equal(tld, tldEmitted, 'tld not in logs')
    assert.equal(subdomain, subdomainNameEmitted, 'subdomain not in logs')
    assert.equal(subgraphID, subgraphIDEmitted, 'subgraphID not in logs')
    assert.equal(ipfsHash, ipfsHashEmitted, 'ipfsHash not in logs')
    assert.equal("0x1c47c222430ce3cff6bbf3ce14d1374f52c32d129ef0ce041af2c4eea5ff81e2", subdomainHashEmitted, 'tld not in logs')

    /*** Second round of updating ***/
    let subgraphID2 = '0xa6d9c55bc4ca4e61b3c39f37934bb95b6c7aab23de1957ae186a732d28ebfc0a'// "QmZZxz64y5BfLSzQxtf5vZLQnCwGnn6mfUitY53kd6Kp1F" is the ipfs hash. must pass as bytes
    let ipfsHash2 = '0xe3d8d4b7a15cb359c1a41aa394589e4e5f5e11518195f3dc2c7168e022627da3' // "Qmdg52JdtCwHUXDdoaJzT8B9v7oMiGVz4tgrhfKT3R25fG" is the ipfs hash. must pass as bytes

    let tx2 = await gnsInstance.contract.methods.addSubgraphToDomain(tld, subdomain, subgraphID2, ipfsHash2).send({ from: accounts[2] })

    let subgraphIDEmitted2 = tx2.events.SubgraphIdAdded.returnValues.subgraphId
    let ipfsHashEmitted2 = tx2.events.SubgraphIdAdded.returnValues.ipfsHash

    let tldEmitted2 = tx2.events.SubgraphIdAdded.returnValues.topLevelDomainHash
    let subdomainHashEmitted2 = tx2.events.SubgraphIdAdded.returnValues.subdomainHash
    let subdomainNameEmitted2 = tx2.events.SubgraphIdAdded.returnValues.subdomainName

    assert.equal(subgraphID2, subgraphIDEmitted2, 'subgraphID not in logs')
    assert.equal(ipfsHash2, ipfsHashEmitted2, 'ipfsHash not in logs')

    assert.equal(tld, tldEmitted2, 'tld not in logs')
    assert.equal(subdomain, subdomainNameEmitted2, 'subdomain not in logs')
    assert.equal("0x1c47c222430ce3cff6bbf3ce14d1374f52c32d129ef0ce041af2c4eea5ff81e2", subdomainHashEmitted2, 'tld not in logs')

  })

  it('...should allow only domain owner to call changeDomainSubgraphId() and call it repeatedly to siulate updating', async () => {
    let tld = '0x119a01e2c505e362c57d2eafe4cd45b752f4e2ee3bcf1e4d038193f0d62cba61' // thegraph
    let subdomainHash = "0x1c47c222430ce3cff6bbf3ce14d1374f52c32d129ef0ce041af2c4eea5ff81e2" // -dave
    let subgraphID = '0x558d8e593b19abcaa591677f5a0508a9a8dfdb107440d636a96cbf473afe5a77'// "QmU6cZF7K1h3ZH5RN1JtYmAbNJZVVwmiCjyCnhty983WPg" is the ipfs hash. must pass as bytes

    await exceptions.catchRevert(gnsInstance.contract.methods.changeDomainSubgraphId(tld, subdomainHash, subgraphID).send({ from: accounts[9] }))

    let tx = await gnsInstance.contract.methods.changeDomainSubgraphId(tld, subdomainHash, subgraphID).send({ from: accounts[2] })

    let tldEmitted = tx.events.SubgraphIdChanged.returnValues.topLevelDomainHash
    let subdomainHashEmitted = tx.events.SubgraphIdChanged.returnValues.subdomainHash
    let subgraphIDEmitted = tx.events.SubgraphIdChanged.returnValues.subgraphId

    assert.equal(tld, tldEmitted, 'tld not in logs')
    assert.equal(subdomainHash, subdomainHashEmitted, 'subdomain not in logs')
    assert.equal(subgraphID, subgraphIDEmitted, 'subgraphID not in logs')

    /*** Second round of updating ***/
    let subgraphID2 = '0x1c9d1996a5c0c02c3660ef0e71d7f5260870f04f517372d3ec7607d4052ecf42'// "QmU6cZF7K1h3ZH5RN1JtYmAbNJZVVwmiCjyCnhty983WPg" is the ipfs hash. must pass as bytes

    let tx2 = await gnsInstance.contract.methods.changeDomainSubgraphId(tld, subdomainHash, subgraphID2).send({ from: accounts[2] })

    let tldEmitted2 = tx2.events.SubgraphIdChanged.returnValues.topLevelDomainHash
    let subdomainHashEmitted2 = tx2.events.SubgraphIdChanged.returnValues.subdomainHash
    let subgraphIDEmitted2 = tx2.events.SubgraphIdChanged.returnValues.subgraphId

    assert.equal(tld, tldEmitted2, 'tld not in logs')
    assert.equal(subdomainHash, subdomainHashEmitted2, 'subdomain not in logs')
    assert.equal(subgraphID2, subgraphIDEmitted2, 'subgraphID not in logs')

  })


  it('...should allow deleteSubdomain to be called by only the owner()', async () => {
    let tld = '0x119a01e2c505e362c57d2eafe4cd45b752f4e2ee3bcf1e4d038193f0d62cba61' // thegraph
    let subdomainHash = "0x1c47c222430ce3cff6bbf3ce14d1374f52c32d129ef0ce041af2c4eea5ff81e2" // -dave

    await exceptions.catchRevert(gnsInstance.contract.methods.deleteSubdomain(tld, subdomainHash).send({ from: accounts[9] }))

    let tx = await gnsInstance.contract.methods.deleteSubdomain(tld, subdomainHash).send({ from: accounts[2] })

    let tldEmitted = tx.events.SubgraphIdDeleted.returnValues.topLevelDomainHash
    let subdomainHashEmitted = tx.events.SubgraphIdDeleted.returnValues.subdomainHash

    assert.equal(tld, tldEmitted, 'tld not in logs')
    assert.equal(subdomainHash, subdomainHashEmitted, 'subdomain not in logs')

  })

  it('...should allow for transferDomainOwnership() to work, and then call and compare the new owner with getDomainOwner()', async () => {
    let tld = '0x119a01e2c505e362c57d2eafe4cd45b752f4e2ee3bcf1e4d038193f0d62cba61' // thegraph

    await exceptions.catchRevert(gnsInstance.contract.methods.transferDomainOwnership(tld, accounts[3]).send({ from: accounts[9] }))

    let tx = await gnsInstance.contract.methods.transferDomainOwnership(tld, accounts[3]).send({ from: accounts[2] })

    let tldEmitted = tx.events.DomainTransferred.returnValues.topLevelDomainHash
    let newOwnerEmitted = tx.events.DomainTransferred.returnValues.newOwner

    assert.equal(tld, tldEmitted, 'tld not in logs')
    assert.equal(accounts[3], newOwnerEmitted, 'owner was not updated')

    const ownerStored = await gnsInstance.getDomainOwner.call(tld)
    assert.equal(ownerStored, accounts[3], 'Owner does not own the domain specified')
  })


  it('...should allow changeAccountMetadata() to be called repeatedly, making it possible for the subgraph to update. Only callable by msg.sender', async () => {

    let ipfsHash = '0xfd4e9cc838fa37dd97e0f0973a2e7b83d1b0f32dac40b8d566d5cde10e1b94b7'// "QmfPTP8Kao6kTGRRRDyHKnsQWgDU1ytAqhezJuP3Spq86A" is the ipfs hash. must pass as bytes

    let tx = await gnsInstance.contract.methods.changeAccountMetadata(ipfsHash).send({ from: accounts[2] })

    let msgSender = tx.events.AccountMetadataChanged.returnValues.account
    let newIPFSHash = tx.events.AccountMetadataChanged.returnValues.ipfsHash

    assert.equal(ipfsHash, newIPFSHash, 'tld not in logs')
    assert.equal(accounts[2], msgSender, 'owner isnt correct')

    /*** Second round of updating ***/
    let ipfsHash2 = '0x02dde1b1306093141bb800043b34e7a8e262b6e008758787df24a23b7c34281c'// "QmNXqkvgb34NGx8qsfrndo61nqkzBfCNiMqgrEPPRtiLiF" is the ipfs hash. must pass as bytes

    let tx2 = await gnsInstance.contract.methods.changeAccountMetadata(ipfsHash2).send({ from: accounts[2] })

    let msgSender2 = tx2.events.AccountMetadataChanged.returnValues.account
    let newIPFSHash2 = tx2.events.AccountMetadataChanged.returnValues.ipfsHash

    assert.equal(ipfsHash2, newIPFSHash2, 'tld not in logs')
    assert.equal(accounts[2], msgSender2, 'owner isnt correct')
  })


  it('...should allow only domain owner changeSubgraphMetadata() to be called repeatedly, making it possible for the subgraph to update', async () => {

    let ipfsHash = '0x99e548ce9fb4d37591fdd45c9202140663ec02d3262fd587b942046cc13a3449'// "QmYhPsGobdbAGUVUX6o6kspZDRWM7s1AF3ZAtXQF1NQh8k" is the ipfs hash. must pass as bytes
    let tld = '0x119a01e2c505e362c57d2eafe4cd45b752f4e2ee3bcf1e4d038193f0d62cba61' // thegraph
    let subdomainHash = "0x1c47c222430ce3cff6bbf3ce14d1374f52c32d129ef0ce041af2c4eea5ff81e2" // -dave

    await exceptions.catchRevert(gnsInstance.contract.methods.changeSubgraphMetadata(ipfsHash, tld, subdomainHash).send({ from: accounts[9] }))


    let tx = await gnsInstance.contract.methods.changeSubgraphMetadata(ipfsHash, tld, subdomainHash).send({ from: accounts[3] })

    let tldEmitted = tx.events.SubgraphMetadataChanged.returnValues.topLevelDomainHash
    let subdomainHashEmitted = tx.events.SubgraphMetadataChanged.returnValues.subdomainHash
    let ipfsEmitted = tx.events.SubgraphMetadataChanged.returnValues.ipfsHash

    assert.equal(tld, tldEmitted, 'tld not in logs')
    assert.equal(subdomainHash, subdomainHashEmitted, 'subdomain hash not in logs')
    assert.equal(ipfsHash, ipfsEmitted, 'ipfs hash not in logs')

    /*** Second round of updating ***/
    let ipfsHash2 = '0x39b5bc6d77ad32d4ea31b5dbb0bfad895940412d8fdc68b32fe836121383291a'// "QmSDvgCJUe9iJyAaLYSuGNPgCt9nnG8JgSgzA3KErRYCnd" is the ipfs hash. must pass as bytes

    let tx2 = await gnsInstance.contract.methods.changeSubgraphMetadata(ipfsHash2, tld, subdomainHash).send({ from: accounts[3] })

    let newIPFSHash2 = tx2.events.SubgraphMetadataChanged.returnValues.ipfsHash

    assert.equal(ipfsHash2, newIPFSHash2, 'tld not in logs')
  })
})
