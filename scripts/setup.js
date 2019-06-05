/*
* This is for quick testing and iterations, rather than writing actual tests
* Writing actual tests will come later
*
* */

/* global it artifacts describe contract before */

// node modules
const Web3 = require('web3')

const options = {
  defaultBlock: 'latest',
  defaultGas: 1,
  defaultGasPrice: 0,
  transactionBlockTimeout: 50,
  transactionConfirmationBlocks: 0,
  transactionPollingTimeout: 480
}

const web3 = new Web3('http://localhost:8545', null, options);

// const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'))

// local modules
const abis = require('./contract-abis') // NOTE - must run from inside of this folder for this to work..... TODO - fix that

// accounts
let accounts = []
let fakeAccounts = []
let governor // Governor currently set to one account for now instead of multisig, to make it easy. TODO - make multisig
let deployer

// Graph Token
let graphToken
let graphTokenAddress // Ends up being '0xD478930d26717C3DD59428bcB80D62780d7E3013' when running deploy on a clean instance of ganache

// GNS
let gns
let gnsAddress

const gnsBytecode = JSON.parse(require('fs').readFileSync('../build/contracts/GNS.json').toString()).bytecode

for (let i = 1; i < 101; i++) {
  if (i < 10) {
    fakeAccounts.push(`0x000000000000000000000000000000000000000${i}`)
  } else if (i < 100) {
    fakeAccounts.push(`0x00000000000000000000000000000000000000${i}`) // one less 0 to account for numbers larger than 9
  } else {
    // dont need larger than 100
  }
}

async function deploy () {
  accounts = await web3.eth.getAccounts()
  deployer = accounts[0]
  governor = accounts[1]
  console.log("yo")
  try {
    gns = new web3.eth.Contract(abis.gns())
    let deployedGNS = await gns.deploy({
      data: gnsBytecode,
      arguments: [governor]
    }).send({
      from: deployer,
      gasPrice: '10000',
      gas: 6700000
    })
    gnsAddress = deployedGNS.options.address
    console.log(gnsAddress)
    console.log('***** GNS Deployed')
    return true
  } catch (err) {
    console.log(err)
    return false
  }
}


/*
  NOTE!
  web3 is broken on this function, and causes the following error:
  (node:97348) UnhandledPromiseRejectionWarning: Error: Empty outputs array given!
    at AbiCoder.decodeParameters (/Users/davidkajpust/coding-no-icloud-backup/thegraph/research/soho-token-contracts/contracts/subgraph/node_modules/web3-eth-abi/dist/web3-eth-abi.cjs.js:61:15)

  So, i commented it out. Follow the issue here https://github.com/ethereum/web3.js/issues/2467
  The transaction works otherwise!
 */

function manyDomainsRegistered () {
  let projects = ['Compound', 'Decentraland', 'Livepeer', 'Origin', 'Uniswap', 'ENS', 'Dharma']
  try {
    for (let i = 0; i < 7; i++) {
      gns.methods.registerDomain(projects[i], governor).send({ from: governor })
    }
    console.log('***** Domain Registrations Complete')
    return true
  } catch (err) {
    console.log(err)
    return false
  }
}

async function start () {
  let deploySuccessful = await deploy()
  if (deploySuccessful) {
    // manyDomainsRegistered()
    console.log("it worked")
  }
}

start()
