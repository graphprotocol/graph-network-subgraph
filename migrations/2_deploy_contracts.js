const GNS = artifacts.require("GNS")

// using network ---> if("network" == "ganache") { //do X } etc.

module.exports = (deployer, network, accounts) => {
  deployer.deploy(GNS, accounts[0])
}