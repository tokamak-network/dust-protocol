// Stealth address library (ERC-5564/6538)

export type { StealthKeyPair, StealthMetaAddress, GeneratedStealthAddress, StealthAnnouncement, ScanResult, StealthContractAddresses } from './types';
export { SCHEME_ID, CANONICAL_ADDRESSES, DEPLOYMENT_BLOCK } from './types';

export { generateStealthKeyPair, deriveStealthKeyPairFromSignature, formatStealthMetaAddress, parseStealthMetaAddress, isValidCompressedPublicKey, getPublicKeyFromPrivate, decompressPublicKey, STEALTH_KEY_DERIVATION_MESSAGE } from './keys';

export { generateStealthAddress, computeStealthPrivateKey, verifyStealthAddress, computeViewTag, getAddressFromPrivateKey } from './address';

export { scanAnnouncements, scanAnnouncementsViewOnly, getLastScannedBlock, setLastScannedBlock, getAnnouncementCount } from './scanner';

export { registerStealthMetaAddress, registerStealthMetaAddressOnBehalf, lookupStealthMetaAddress, getRegistryNonce, signRegistration, isRegistered, formatBytesToUri } from './registry';

export type { DerivedClaimAddress } from './hdWallet';
export { deriveClaimAddresses, deriveClaimAddressAtIndex, deriveSeedFromSignature, getNextClaimAddress, verifyClaimAddressDerivation, saveClaimAddressesToStorage, loadClaimAddressesFromStorage, saveSignatureHash, verifySignatureHash, updateClaimAddressLabel, CLAIM_ADDRESS_DERIVATION_MESSAGE } from './hdWallet';

export { registerStealthName, resolveStealthName, isNameAvailable, getNameOwner, getNamesOwnedBy, updateNameMetaAddress, transferStealthName, setNameRegistryAddress, getNameRegistryAddress, isNameRegistryConfigured, normalizeName, stripNameSuffix, formatNameWithSuffix, isValidName, isStealthName, NAME_SUFFIX } from './names';

export type { RelayerInfo, FeeCalculation, WithdrawResponse, JobStatus } from './relayer';
export { checkRelayerHealth, getRelayerInfo, calculateRelayerFee, submitRelayerWithdraw, getJobStatus, waitForJobCompletion, getRelayerUrl } from './relayer';
