// let gnsABI
//
// try {
//   gnsABI = JSON.parse(require('fs').readFileSync('../build/contracts/GNS.json').toString()).abi
// } catch (err) {
//   console.log('Could not find contract abis. Make sure you have all abis for the subgraph in the abis/ folder. ' +
//     'Make sure they are the full abi, created from truffle, not just the abi array. See the full error below')
//   console.log(err)
// }
//
// module.exports = {
//   gns: function () {
//     return gnsABI
//   }
// }
