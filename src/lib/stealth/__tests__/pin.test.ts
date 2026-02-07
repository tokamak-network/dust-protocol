/**
 * Tests for PIN-based key derivation and validation
 */

import { describe, it, expect } from 'vitest';
import {
  deriveSpendingSeed, deriveViewingSeed, deriveClaimSeed, validatePin,
} from '../pin';
import {
  deriveStealthKeyPairFromSignatureAndPin,
  deriveStealthKeyPairFromSignature,
  formatStealthMetaAddress,
  parseStealthMetaAddress,
  isValidCompressedPublicKey,
} from '../keys';

const MOCK_SIG = '0x' + 'ab'.repeat(65);
const MOCK_SIG_2 = '0x' + 'cd'.repeat(65);
const MOCK_PIN = '123456';
const MOCK_PIN_2 = '654321';

describe('PIN Validation', () => {
  it('should accept valid 6-digit PINs', () => {
    expect(validatePin('123456')).toEqual({ valid: true });
    expect(validatePin('000000')).toEqual({ valid: true });
    expect(validatePin('999999')).toEqual({ valid: true });
  });

  it('should reject empty PIN', () => {
    const result = validatePin('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should reject PINs that are too short', () => {
    const result = validatePin('123');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('6 digits');
  });

  it('should reject PINs that are too long', () => {
    const result = validatePin('1234567');
    expect(result.valid).toBe(false);
  });

  it('should reject PINs with non-digit characters', () => {
    expect(validatePin('12345a').valid).toBe(false);
    expect(validatePin('abcdef').valid).toBe(false);
    expect(validatePin('12 456').valid).toBe(false);
  });
});

describe('PIN Seed Derivation', () => {
  it('should derive deterministic spending seed', () => {
    const seed1 = deriveSpendingSeed(MOCK_SIG, MOCK_PIN);
    const seed2 = deriveSpendingSeed(MOCK_SIG, MOCK_PIN);
    expect(seed1).toBe(seed2);
    expect(seed1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should derive deterministic viewing seed', () => {
    const seed1 = deriveViewingSeed(MOCK_SIG, MOCK_PIN);
    const seed2 = deriveViewingSeed(MOCK_SIG, MOCK_PIN);
    expect(seed1).toBe(seed2);
    expect(seed1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should derive deterministic claim seed', () => {
    const seed1 = deriveClaimSeed(MOCK_SIG, MOCK_PIN);
    const seed2 = deriveClaimSeed(MOCK_SIG, MOCK_PIN);
    expect(seed1).toBe(seed2);
    expect(seed1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should produce different seeds for spending vs viewing vs claim', () => {
    const spending = deriveSpendingSeed(MOCK_SIG, MOCK_PIN);
    const viewing = deriveViewingSeed(MOCK_SIG, MOCK_PIN);
    const claim = deriveClaimSeed(MOCK_SIG, MOCK_PIN);
    expect(spending).not.toBe(viewing);
    expect(spending).not.toBe(claim);
    expect(viewing).not.toBe(claim);
  });

  it('should produce different seeds for different PINs', () => {
    const seed1 = deriveSpendingSeed(MOCK_SIG, MOCK_PIN);
    const seed2 = deriveSpendingSeed(MOCK_SIG, MOCK_PIN_2);
    expect(seed1).not.toBe(seed2);
  });

  it('should produce different seeds for different signatures', () => {
    const seed1 = deriveSpendingSeed(MOCK_SIG, MOCK_PIN);
    const seed2 = deriveSpendingSeed(MOCK_SIG_2, MOCK_PIN);
    expect(seed1).not.toBe(seed2);
  });
});

describe('PIN-based Key Derivation', () => {
  it('should derive valid stealth keys from signature + PIN', () => {
    const keys = deriveStealthKeyPairFromSignatureAndPin(MOCK_SIG, MOCK_PIN);

    expect(keys.spendingPrivateKey).toMatch(/^[0-9a-f]{64}$/i);
    expect(keys.viewingPrivateKey).toMatch(/^[0-9a-f]{64}$/i);
    expect(isValidCompressedPublicKey(keys.spendingPublicKey)).toBe(true);
    expect(isValidCompressedPublicKey(keys.viewingPublicKey)).toBe(true);
  });

  it('should be deterministic for same inputs', () => {
    const keys1 = deriveStealthKeyPairFromSignatureAndPin(MOCK_SIG, MOCK_PIN);
    const keys2 = deriveStealthKeyPairFromSignatureAndPin(MOCK_SIG, MOCK_PIN);

    expect(keys1.spendingPrivateKey).toBe(keys2.spendingPrivateKey);
    expect(keys1.spendingPublicKey).toBe(keys2.spendingPublicKey);
    expect(keys1.viewingPrivateKey).toBe(keys2.viewingPrivateKey);
    expect(keys1.viewingPublicKey).toBe(keys2.viewingPublicKey);
  });

  it('should produce different keys for different PINs', () => {
    const keys1 = deriveStealthKeyPairFromSignatureAndPin(MOCK_SIG, MOCK_PIN);
    const keys2 = deriveStealthKeyPairFromSignatureAndPin(MOCK_SIG, MOCK_PIN_2);

    expect(keys1.spendingPrivateKey).not.toBe(keys2.spendingPrivateKey);
    expect(keys1.viewingPrivateKey).not.toBe(keys2.viewingPrivateKey);
  });

  it('should produce different keys than legacy (non-PIN) derivation', () => {
    const pinKeys = deriveStealthKeyPairFromSignatureAndPin(MOCK_SIG, MOCK_PIN);
    const legacyKeys = deriveStealthKeyPairFromSignature(MOCK_SIG);

    expect(pinKeys.spendingPrivateKey).not.toBe(legacyKeys.spendingPrivateKey);
    expect(pinKeys.viewingPrivateKey).not.toBe(legacyKeys.viewingPrivateKey);
  });

  it('should produce valid meta-address that round-trips', () => {
    const keys = deriveStealthKeyPairFromSignatureAndPin(MOCK_SIG, MOCK_PIN);
    const metaAddress = formatStealthMetaAddress(keys, 'thanos');

    expect(metaAddress).toMatch(/^st:thanos:0x[0-9a-f]{132}$/i);

    const parsed = parseStealthMetaAddress(metaAddress);
    expect(parsed.spendingPublicKey).toBe(keys.spendingPublicKey);
    expect(parsed.viewingPublicKey).toBe(keys.viewingPublicKey);
  });

  it('should produce different meta-addresses for different PINs', () => {
    const keys1 = deriveStealthKeyPairFromSignatureAndPin(MOCK_SIG, MOCK_PIN);
    const keys2 = deriveStealthKeyPairFromSignatureAndPin(MOCK_SIG, MOCK_PIN_2);
    const meta1 = formatStealthMetaAddress(keys1, 'thanos');
    const meta2 = formatStealthMetaAddress(keys2, 'thanos');

    expect(meta1).not.toBe(meta2);
  });
});

describe('Key Derivation Security', () => {
  it('should not leak PIN in derived keys', () => {
    const keys = deriveStealthKeyPairFromSignatureAndPin(MOCK_SIG, MOCK_PIN);
    const allKeyMaterial = [
      keys.spendingPrivateKey,
      keys.spendingPublicKey,
      keys.viewingPrivateKey,
      keys.viewingPublicKey,
    ].join('');

    // PIN should not appear in hex form
    const pinHex = Buffer.from(MOCK_PIN).toString('hex');
    expect(allKeyMaterial).not.toContain(pinHex);
  });

  it('should produce 32-byte seeds (256-bit security)', () => {
    const spending = deriveSpendingSeed(MOCK_SIG, MOCK_PIN);
    const viewing = deriveViewingSeed(MOCK_SIG, MOCK_PIN);
    const claim = deriveClaimSeed(MOCK_SIG, MOCK_PIN);

    // Each seed should be 32 bytes = 64 hex chars
    expect(spending.length).toBe(64);
    expect(viewing.length).toBe(64);
    expect(claim.length).toBe(64);
  });
});
