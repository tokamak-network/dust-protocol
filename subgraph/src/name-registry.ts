import {
  NameRegistered,
  NameTransferred,
  MetaAddressUpdated,
  NameRegistry
} from "../generated/NameRegistry/NameRegistry"
import { Name, NameTransfer, User } from "../generated/schema"
import { Bytes, BigInt, crypto, ByteArray, ethereum, log } from "@graphprotocol/graph-ts"

/**
 * Compute entity ID: keccak256 of the lowercased name, matching the contract's
 * internal `keccak256(bytes(_toLowerCase(name)))`.
 */
function computeNameHash(name: string): string {
  let lower = name.toLowerCase()
  return crypto.keccak256(ByteArray.fromUTF8(lower)).toHex()
}

/**
 * Decode the name (first string param) from NameRegistry transaction calldata.
 *
 * All three NameRegistry write functions have `string name` as the first parameter:
 *   - registerName(string, bytes)
 *   - transferName(string, address)
 *   - updateMetaAddress(string, bytes)
 *
 * This is necessary because the events use `string indexed name`, which stores
 * only the keccak256 hash in the log topic — the original string is lost.
 */
function decodeNameFromInput(input: Bytes, abiTypes: string): string | null {
  if (input.length <= 4) return null

  // Strip 4-byte function selector to get ABI-encoded parameters
  let raw = new Uint8Array(input.length - 4)
  for (let i: i32 = 0; i < raw.length; i++) {
    raw[i] = input[i + 4]
  }
  let data = Bytes.fromUint8Array(raw)

  let decoded = ethereum.decode(abiTypes, data)
  if (decoded == null) return null

  return decoded.toTuple()[0].toString()
}

export function handleNameRegistered(event: NameRegistered): void {
  // event.params.name is Bytes (keccak256 hash) because `string indexed` only
  // stores the hash in the log topic. Decode the actual name from tx calldata.
  let decodedName = decodeNameFromInput(event.transaction.input, "(string,bytes)")

  // Fallback: read from contract storage via getNamesOwnedBy
  if (decodedName == null) {
    let contract = NameRegistry.bind(event.address)
    let result = contract.try_getNamesOwnedBy(event.params.owner)
    if (!result.reverted && result.value.length > 0) {
      let names = result.value
      decodedName = names[names.length - 1]
    }
  }

  if (decodedName == null) {
    log.error("handleNameRegistered: could not decode name from tx {}", [
      event.transaction.hash.toHex()
    ])
    return
  }

  // AssemblyScript requires non-null binding after null checks
  let actualName: string = decodedName as string
  if (actualName.length == 0) {
    log.error("handleNameRegistered: decoded empty name from tx {}", [
      event.transaction.hash.toHex()
    ])
    return
  }

  let nameHash = computeNameHash(actualName)

  // Update or create User entity (must exist before Name references it)
  let userId = event.params.owner.toHex()
  let user = User.load(userId)
  if (user == null) {
    user = new User(userId)
    user.registeredNamesCount = BigInt.fromI32(0)
  }
  user.registeredNamesCount = user.registeredNamesCount.plus(BigInt.fromI32(1))
  user.save()

  // Create Name entity
  let name = new Name(nameHash)
  name.name = actualName.toLowerCase()
  name.owner = userId
  name.ownerAddress = event.params.owner
  name.metaAddress = event.params.stealthMetaAddress
  name.registeredAt = event.block.timestamp
  name.updatedAt = event.block.timestamp
  name.save()

  // Create NameTransfer record for the initial registration
  let transferId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let transfer = new NameTransfer(transferId)
  transfer.name = nameHash
  transfer.from = Bytes.fromHexString("0x0000000000000000000000000000000000000000")
  transfer.to = event.params.owner
  transfer.timestamp = event.block.timestamp
  transfer.blockNumber = event.block.number
  transfer.save()
}

export function handleNameTransferred(event: NameTransferred): void {
  // event.params.name is keccak256(name) because `string indexed` stores only the hash.
  // Try calldata decoding first, then fall back to topic hash or contract read.
  let nameHash: string | null = null
  let name: Name | null = null

  // Strategy 1: Decode name from transferName(string,address) calldata
  let decodedName = decodeNameFromInput(event.transaction.input, "(string,address)")
  if (decodedName != null && (decodedName as string).length > 0) {
    nameHash = computeNameHash(decodedName as string)
    name = Name.load(nameHash as string)
  }

  // Strategy 2: Use the indexed topic hash directly as entity ID
  if (name == null) {
    let topicHash = event.params.name.toHex()
    name = Name.load(topicHash)
    if (name != null) {
      nameHash = topicHash
    }
  }

  // Strategy 3: Read actual name from contract's hashToName mapping
  if (name == null) {
    let contract = NameRegistry.bind(event.address)
    let result = contract.try_hashToName(event.params.name)
    if (!result.reverted && result.value.length > 0) {
      nameHash = computeNameHash(result.value)
      name = Name.load(nameHash as string)
    }
  }

  if (name == null || nameHash == null) {
    log.error("handleNameTransferred: could not resolve name from tx {}", [
      event.transaction.hash.toHex()
    ])
    return
  }

  // Update sender user count
  let fromUserId = event.params.previousOwner.toHex()
  let fromUser = User.load(fromUserId)
  if (fromUser != null) {
    fromUser.registeredNamesCount = fromUser.registeredNamesCount.minus(BigInt.fromI32(1))
    fromUser.save()
  }

  // Update receiver user count (must exist before Name references it)
  let toUserId = event.params.newOwner.toHex()
  let toUser = User.load(toUserId)
  if (toUser == null) {
    toUser = new User(toUserId)
    toUser.registeredNamesCount = BigInt.fromI32(0)
  }
  toUser.registeredNamesCount = toUser.registeredNamesCount.plus(BigInt.fromI32(1))
  toUser.save()

  // Update name owner
  name.owner = toUserId
  name.ownerAddress = event.params.newOwner
  name.updatedAt = event.block.timestamp
  name.save()

  // Create transfer record
  let resolvedHash = nameHash as string
  let transferId = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let transfer = new NameTransfer(transferId)
  transfer.name = resolvedHash
  transfer.from = event.params.previousOwner
  transfer.to = event.params.newOwner
  transfer.timestamp = event.block.timestamp
  transfer.blockNumber = event.block.number
  transfer.save()
}

export function handleMetaAddressUpdated(event: MetaAddressUpdated): void {
  // Same 3-strategy fallback as handleNameTransferred
  let name: Name | null = null

  // Strategy 1: Decode name from updateMetaAddress(string,bytes) calldata
  let decodedName = decodeNameFromInput(event.transaction.input, "(string,bytes)")
  if (decodedName != null && (decodedName as string).length > 0) {
    name = Name.load(computeNameHash(decodedName as string))
  }

  // Strategy 2: Use the indexed topic hash directly as entity ID
  if (name == null) {
    name = Name.load(event.params.name.toHex())
  }

  // Strategy 3: Read actual name from contract's hashToName mapping
  if (name == null) {
    let contract = NameRegistry.bind(event.address)
    let result = contract.try_hashToName(event.params.name)
    if (!result.reverted && result.value.length > 0) {
      name = Name.load(computeNameHash(result.value))
    }
  }

  if (name == null) {
    log.error("handleMetaAddressUpdated: could not resolve name from tx {}", [
      event.transaction.hash.toHex()
    ])
    return
  }

  name.metaAddress = event.params.newMetaAddress
  name.updatedAt = event.block.timestamp
  name.save()
}
