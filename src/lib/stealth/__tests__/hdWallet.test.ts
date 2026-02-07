/**
 * Tests for HD wallet claim address derivation (legacy + PIN-based)
 */

import { describe, it, expect } from 'vitest';
import {
  deriveSeedFromSignature, deriveSeedFromSignatureAndPin,
  deriveClaimAddressAtIndex, deriveClaimAddresses, deriveClaimAddressesWithPin,
} from '../hdWallet';

const MOCK_SIG = '0x' + 'ab'.repeat(65);
const MOCK_SIG_2 = '0x' + 'cd'.repeat(65);
const MOCK_PIN = '123456';
const MOCK_PIN_2 = '654321';

describe('Seed Derivation', () => {
  it('should derive deterministic seed from signature', () => {
    const seed1 = deriveSeedFromSignature(MOCK_SIG);
    const seed2 = deriveSeedFromSignature(MOCK_SIG);
    expect(seed1).toBe(seed2);
    expect(seed1).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('should derive different seed for different signatures', () => {
    const seed1 = deriveSeedFromSignature(MOCK_SIG);
    const seed2 = deriveSeedFromSignature(MOCK_SIG_2);
    expect(seed1).not.toBe(seed2);
  });

  it('should derive deterministic seed from signature + PIN', () => {
    const seed1 = deriveSeedFromSignatureAndPin(MOCK_SIG, MOCK_PIN);
    const seed2 = deriveSeedFromSignatureAndPin(MOCK_SIG, MOCK_PIN);
    expect(seed1).toBe(seed2);
    expect(seed1).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('should derive different seed for different PINs', () => {
    const seed1 = deriveSeedFromSignatureAndPin(MOCK_SIG, MOCK_PIN);
    const seed2 = deriveSeedFromSignatureAndPin(MOCK_SIG, MOCK_PIN_2);
    expect(seed1).not.toBe(seed2);
  });

  it('PIN-based seed should differ from legacy seed', () => {
    const legacy = deriveSeedFromSignature(MOCK_SIG);
    const pinBased = deriveSeedFromSignatureAndPin(MOCK_SIG, MOCK_PIN);
    expect(legacy).not.toBe(pinBased);
  });
});

describe('Claim Address Derivation', () => {
  it('should derive valid Ethereum address at index', () => {
    const seed = deriveSeedFromSignature(MOCK_SIG);
    const claim = deriveClaimAddressAtIndex(seed, 0);

    expect(claim.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(claim.privateKey).toMatch(/^[0-9a-f]{64}$/);
    expect(claim.index).toBe(0);
    expect(claim.path).toBe('stealth/0');
  });

  it('should derive different addresses at different indices', () => {
    const seed = deriveSeedFromSignature(MOCK_SIG);
    const claim0 = deriveClaimAddressAtIndex(seed, 0);
    const claim1 = deriveClaimAddressAtIndex(seed, 1);
    const claim2 = deriveClaimAddressAtIndex(seed, 2);

    expect(claim0.address).not.toBe(claim1.address);
    expect(claim0.address).not.toBe(claim2.address);
    expect(claim1.address).not.toBe(claim2.address);
  });

  it('should be deterministic for same seed + index', () => {
    const seed = deriveSeedFromSignature(MOCK_SIG);
    const claim1 = deriveClaimAddressAtIndex(seed, 0);
    const claim2 = deriveClaimAddressAtIndex(seed, 0);

    expect(claim1.address).toBe(claim2.address);
    expect(claim1.privateKey).toBe(claim2.privateKey);
  });
});

describe('deriveClaimAddresses (legacy)', () => {
  it('should derive correct number of addresses', () => {
    const claims = deriveClaimAddresses(MOCK_SIG, 3);
    expect(claims).toHaveLength(3);
  });

  it('should derive unique addresses', () => {
    const claims = deriveClaimAddresses(MOCK_SIG, 3);
    const addresses = claims.map(c => c.address);
    expect(new Set(addresses).size).toBe(3);
  });

  it('should have sequential indices', () => {
    const claims = deriveClaimAddresses(MOCK_SIG, 3);
    expect(claims[0].index).toBe(0);
    expect(claims[1].index).toBe(1);
    expect(claims[2].index).toBe(2);
  });
});

describe('deriveClaimAddressesWithPin', () => {
  it('should derive correct number of addresses', () => {
    const claims = deriveClaimAddressesWithPin(MOCK_SIG, MOCK_PIN, 3);
    expect(claims).toHaveLength(3);
  });

  it('should derive unique addresses', () => {
    const claims = deriveClaimAddressesWithPin(MOCK_SIG, MOCK_PIN, 3);
    const addresses = claims.map(c => c.address);
    expect(new Set(addresses).size).toBe(3);
  });

  it('should produce different addresses than legacy derivation', () => {
    const legacy = deriveClaimAddresses(MOCK_SIG, 3);
    const pinBased = deriveClaimAddressesWithPin(MOCK_SIG, MOCK_PIN, 3);

    for (let i = 0; i < 3; i++) {
      expect(legacy[i].address).not.toBe(pinBased[i].address);
    }
  });

  it('should produce different addresses for different PINs', () => {
    const claims1 = deriveClaimAddressesWithPin(MOCK_SIG, MOCK_PIN, 3);
    const claims2 = deriveClaimAddressesWithPin(MOCK_SIG, MOCK_PIN_2, 3);

    for (let i = 0; i < 3; i++) {
      expect(claims1[i].address).not.toBe(claims2[i].address);
    }
  });

  it('should be deterministic', () => {
    const claims1 = deriveClaimAddressesWithPin(MOCK_SIG, MOCK_PIN, 3);
    const claims2 = deriveClaimAddressesWithPin(MOCK_SIG, MOCK_PIN, 3);

    for (let i = 0; i < 3; i++) {
      expect(claims1[i].address).toBe(claims2[i].address);
      expect(claims1[i].privateKey).toBe(claims2[i].privateKey);
    }
  });
});
