/**
 * Privacy-hardened localStorage key generation.
 *
 * Problem: raw keys like `dust_payments_0x1234abcd…` directly fingerprint
 * which wallet is active in this browser — anyone with DevTools access can see it.
 *
 * Solution: hash the wallet address with a domain-specific salt using SHA-256.
 * The resulting key is `dust_<prefix>_<chainId?>_<addrHash16>` where addrHash16
 * is the first 16 hex chars (64 bits) of SHA-256(domain || address).
 * 2^64 space makes collisions between wallets negligible in practice.
 *
 * Migration: the first time a hashed key is accessed we check for the legacy
 * raw-address key and migrate its data over, then delete the old key.
 */

/** Synchronous SHA-256 using the @noble/hashes library (already a dep). */
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

/**
 * Returns the first 16 hex chars of SHA-256("dust-storage:<domain>:<address>").
 * Deterministic per (domain, address) pair — never reveals the raw address.
 */
export function addrHash(domain: string, address: string): string {
  const input = new TextEncoder().encode(`dust-storage:${domain}:${address.toLowerCase()}`);
  return bytesToHex(sha256(input)).slice(0, 16);
}

/**
 * Build a privacy-hardened localStorage key.
 * @param prefix  - Short stable prefix, e.g. 'pin', 'keys', 'payments'
 * @param address - Wallet address (will be hashed, never stored in plain text)
 * @param chainId - Optional chain scope
 */
export function storageKey(prefix: string, address: string, chainId?: number): string {
  const hash = addrHash(prefix, address);
  return chainId !== undefined
    ? `dust_${prefix}_${chainId}_${hash}`
    : `dust_${prefix}_${hash}`;
}

/**
 * Migrate a legacy raw-address key to the new hashed key (one-time, silent).
 * Call at the top of every load function.
 */
export function migrateKey(legacyKey: string, newKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = localStorage.getItem(legacyKey);
    if (existing && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, existing);
      localStorage.removeItem(legacyKey);
    }
  } catch { /* quota or security errors — ignore */ }
}
