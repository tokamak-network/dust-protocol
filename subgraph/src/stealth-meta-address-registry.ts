import { StealthMetaAddressSet } from "../generated/StealthMetaAddressRegistry/StealthMetaAddressRegistry"
import { StealthMetaAddress, User } from "../generated/schema"
import { BigInt } from "@graphprotocol/graph-ts"

export function handleStealthMetaAddressSet(event: StealthMetaAddressSet): void {
  let registrantHex = event.params.registrant.toHex()
  let entityId = registrantHex + "-" + event.params.schemeId.toString()

  // Create or update StealthMetaAddress entity
  let metaAddress = new StealthMetaAddress(entityId)
  metaAddress.registrant = event.params.registrant
  metaAddress.stealthMetaAddress = event.params.stealthMetaAddress
  metaAddress.schemeId = event.params.schemeId
  metaAddress.registeredAt = event.block.timestamp
  metaAddress.save()

  // Link to User entity
  let user = User.load(registrantHex)
  if (user == null) {
    user = new User(registrantHex)
    user.registeredNamesCount = BigInt.fromI32(0)
  }
  user.metaAddress = entityId
  user.save()
}
