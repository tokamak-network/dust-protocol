// Announcement scanner (ERC-5564)

import { ethers } from 'ethers';
import { ec as EC } from 'elliptic';
import type { StealthAnnouncement, ScanResult, StealthKeyPair } from './types';
import { SCHEME_ID, CANONICAL_ADDRESSES } from './types';
import { computeViewTag, verifyStealthAddress, computeStealthPrivateKey, getAddressFromPrivateKey } from './address';

const secp256k1 = new EC('secp256k1');

const ANNOUNCER_ABI = [
  'event Announcement(uint256 indexed schemeId, address indexed stealthAddress, address indexed caller, bytes ephemeralPubKey, bytes metadata)',
];

function parseEvent(event: ethers.Event, schemeId: number): StealthAnnouncement | null {
  if (!event.args) return null;

  const ephemeralPubKey = event.args.ephemeralPubKey as string;
  const metadata = event.args.metadata as string;
  const viewTag = metadata?.length >= 4 ? metadata.slice(2, 4) : '';

  return {
    schemeId,
    stealthAddress: event.args.stealthAddress,
    ephemeralPublicKey: ephemeralPubKey.replace(/^0x/, ''),
    viewTag,
    metadata,
    caller: event.args.caller,
    blockNumber: event.blockNumber,
    txHash: event.transactionHash,
  };
}

export async function scanAnnouncements(
  provider: ethers.providers.Provider,
  keys: StealthKeyPair,
  fromBlock: number,
  toBlock?: number | 'latest',
  announcerAddress = CANONICAL_ADDRESSES.announcer
): Promise<ScanResult[]> {
  // Verify key consistency
  const derived = secp256k1.keyFromPrivate(keys.spendingPrivateKey.replace(/^0x/, ''), 'hex');
  if (derived.getPublic(true, 'hex') !== keys.spendingPublicKey) {
    throw new Error('Spending key mismatch - keys may be corrupted');
  }

  const announcer = new ethers.Contract(announcerAddress, ANNOUNCER_ABI, provider);
  const filter = announcer.filters.Announcement(SCHEME_ID.SECP256K1, null, null);
  const events = await announcer.queryFilter(filter, fromBlock, toBlock ?? 'latest');

  const results: ScanResult[] = [];

  for (const event of events) {
    const announcement = parseEvent(event, SCHEME_ID.SECP256K1);
    if (!announcement) continue;

    const expectedTag = computeViewTag(keys.viewingPrivateKey, announcement.ephemeralPublicKey);
    if (announcement.viewTag && announcement.viewTag !== expectedTag) continue;

    const isMatch = verifyStealthAddress(
      announcement.ephemeralPublicKey,
      keys.spendingPublicKey,
      announcement.stealthAddress,
      keys.viewingPrivateKey
    );

    if (isMatch) {
      const stealthPrivateKey = computeStealthPrivateKey(
        keys.spendingPrivateKey,
        keys.viewingPrivateKey,
        announcement.ephemeralPublicKey
      );
      const derivedAddress = getAddressFromPrivateKey(stealthPrivateKey);
      const verified = derivedAddress.toLowerCase() === announcement.stealthAddress.toLowerCase();

      results.push({
        announcement,
        stealthPrivateKey,
        isMatch: true,
        privateKeyVerified: verified,
        derivedAddress: verified ? undefined : derivedAddress,
      });
    }
  }

  return results;
}

export async function scanAnnouncementsViewOnly(
  provider: ethers.providers.Provider,
  viewingPrivateKey: string,
  spendingPublicKey: string,
  fromBlock: number,
  toBlock?: number | 'latest',
  announcerAddress = CANONICAL_ADDRESSES.announcer
): Promise<StealthAnnouncement[]> {
  const announcer = new ethers.Contract(announcerAddress, ANNOUNCER_ABI, provider);
  const filter = announcer.filters.Announcement(SCHEME_ID.SECP256K1, null, null);
  const events = await announcer.queryFilter(filter, fromBlock, toBlock ?? 'latest');

  const matches: StealthAnnouncement[] = [];

  for (const event of events) {
    const announcement = parseEvent(event, SCHEME_ID.SECP256K1);
    if (!announcement) continue;

    const expectedTag = computeViewTag(viewingPrivateKey, announcement.ephemeralPublicKey);
    if (announcement.viewTag && announcement.viewTag !== expectedTag) continue;

    if (verifyStealthAddress(announcement.ephemeralPublicKey, spendingPublicKey, announcement.stealthAddress, viewingPrivateKey)) {
      matches.push(announcement);
    }
  }

  return matches;
}

const STORAGE_KEY = 'stealth_last_scanned_';

export function getLastScannedBlock(address: string): number | null {
  if (typeof window === 'undefined') return null;
  const val = localStorage.getItem(STORAGE_KEY + address.toLowerCase());
  return val ? parseInt(val, 10) : null;
}

export function setLastScannedBlock(address: string, block: number): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY + address.toLowerCase(), block.toString());
  }
}

export async function getAnnouncementCount(
  provider: ethers.providers.Provider,
  fromBlock: number,
  toBlock?: number | 'latest',
  announcerAddress = CANONICAL_ADDRESSES.announcer
): Promise<number> {
  const announcer = new ethers.Contract(announcerAddress, ANNOUNCER_ABI, provider);
  const filter = announcer.filters.Announcement(SCHEME_ID.SECP256K1, null, null);
  const events = await announcer.queryFilter(filter, fromBlock, toBlock ?? 'latest');
  return events.length;
}
