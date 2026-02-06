// Stealth address types (ERC-5564/6538)

export interface StealthKeyPair {
  spendingPrivateKey: string;
  spendingPublicKey: string;
  viewingPrivateKey: string;
  viewingPublicKey: string;
}

export interface StealthMetaAddress {
  prefix: string;
  spendingPublicKey: string;
  viewingPublicKey: string;
  raw: string;
}

export interface GeneratedStealthAddress {
  stealthAddress: string;
  ephemeralPublicKey: string;
  viewTag: string;
  stealthPublicKey: string;
}

export interface StealthAnnouncement {
  schemeId: number;
  stealthAddress: string;
  ephemeralPublicKey: string;
  viewTag: string;
  metadata: string;
  caller: string;
  blockNumber: number;
  txHash: string;
}

export interface ScanResult {
  announcement: StealthAnnouncement;
  stealthPrivateKey: string;
  isMatch: boolean;
  privateKeyVerified?: boolean;
  derivedAddress?: string;
}

export const SCHEME_ID = { SECP256K1: 1 } as const;

export interface StealthContractAddresses {
  announcer: string;
  registry: string;
}

function getEnv(key: string): string | undefined {
  if (typeof window !== 'undefined') {
    return (window as unknown as { __ENV?: Record<string, string> }).__ENV?.[key]
      || process.env[key];
  }
  return process.env[key];
}

function getContractAddresses(): StealthContractAddresses {
  const announcer = getEnv('NEXT_PUBLIC_STEALTH_ANNOUNCER_ADDRESS');
  const registry = getEnv('NEXT_PUBLIC_STEALTH_REGISTRY_ADDRESS');

  if (announcer && registry) return { announcer, registry };

  // Thanos Sepolia defaults
  return {
    announcer: '0x75BD499f7CA8E361b7930e2881b2B3c99Aa1eea1',
    registry: '0x5779192B220876221Bc2871511FB764941314e04',
  };
}

export const CANONICAL_ADDRESSES = getContractAddresses();
