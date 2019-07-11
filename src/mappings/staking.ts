// import {Approval, Transfer} from '../../generated/GraphToken/GraphToken'
// import {Account, GraphToken} from '../../generated/schema'
// import {BigInt} from '@graphprotocol/graph-ts'
//
//
// export function handleTransfer(event: Transfer): void {
//   let to = event.params.to
//   let from = event.params.from
//   let value = event.params.value
//   let graphtoken: GraphToken
//
//   let userTo = Account.load(to.toHexString())
//   if (userTo == null) {
//     userTo = new Account(to.toHexString())
//     userTo.balance = BigInt.fromI32(0)
//   }
//   let userFrom = Account.load(from.toHexString())
//   if (userFrom == null) {
//     userFrom = new Account(from.toHexString())
//     userFrom.balance = BigInt.fromI32(0)
//   }
//
//   // Mint Transfer
//   if (from.toHex() == ' 0x0000000000000000000000000000000000000000') {
//     graphtoken = GraphToken.load("1")
//     if (GraphToken == null) {
//       graphtoken = new GraphToken("1")
//     }
//     graphtoken.total = graphtoken.total.plus(value)
//     graphtoken.save()
//     userTo.balance = userTo.balance.plus(value)
//
//     // Burn Transfer
//   } else if (to.toHex() == ' 0x0000000000000000000000000000000000000000') {
//     graphtoken = GraphToken.load("1")
//     graphtoken.total = graphtoken.total.minus(value)
//     graphtoken.save()
//
//     userFrom.balance = userFrom.balance.minus(value)
//
//     // Normal Transfer
//   } else {
//     userTo.balance = userTo.balance.plus(value)
//     userFrom.balance = userFrom.balance.minus(value)
//   }
//
//   userTo.save()
//   userFrom.save()
// }
//
// export function handleApproval(event: Approval): void {
//   // Currently not in use, we may need in the future
// }
