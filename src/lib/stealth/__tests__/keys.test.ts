/**
 * Tests for stealth address key management
 */

import { describe, it, expect } from 'vitest';
import {
  generateStealthKeyPair,
  deriveStealthKeyPairFromSignature,
  formatStealthMetaAddress,
  parseStealthMetaAddress,
  isValidCompressedPublicKey,
  getPublicKeyFromPrivate,
  decompressPublicKey,
} from '../keys';

describe('Stealth Key Management', () => {
  describe('generateStealthKeyPair', () => {
    it('should generate valid key pairs', () => {
      const keys = generateStealthKeyPair();

      // Check all keys are present
      expect(keys.spendingPrivateKey).toBeDefined();
      expect(keys.spendingPublicKey).toBeDefined();
      expect(keys.viewingPrivateKey).toBeDefined();
      expect(keys.viewingPublicKey).toBeDefined();

      // Private keys should be 64 hex chars (32 bytes)
      expect(keys.spendingPrivateKey).toMatch(/^[0-9a-f]{64}$/i);
      expect(keys.viewingPrivateKey).toMatch(/^[0-9a-f]{64}$/i);

      // Public keys should be compressed (66 hex chars, starting with 02 or 03)
      expect(keys.spendingPublicKey).toMatch(/^0[23][0-9a-f]{64}$/i);
      expect(keys.viewingPublicKey).toMatch(/^0[23][0-9a-f]{64}$/i);
    });

    it('should generate different keys each time', () => {
      const keys1 = generateStealthKeyPair();
      const keys2 = generateStealthKeyPair();

      expect(keys1.spendingPrivateKey).not.toBe(keys2.spendingPrivateKey);
      expect(keys1.viewingPrivateKey).not.toBe(keys2.viewingPrivateKey);
    });
  });

  describe('deriveStealthKeyPairFromSignature', () => {
    it('should derive consistent keys from the same signature', () => {
      const signature = '0x' + 'ab'.repeat(65);

      const keys1 = deriveStealthKeyPairFromSignature(signature);
      const keys2 = deriveStealthKeyPairFromSignature(signature);

      expect(keys1.spendingPrivateKey).toBe(keys2.spendingPrivateKey);
      expect(keys1.spendingPublicKey).toBe(keys2.spendingPublicKey);
      expect(keys1.viewingPrivateKey).toBe(keys2.viewingPrivateKey);
      expect(keys1.viewingPublicKey).toBe(keys2.viewingPublicKey);
    });

    it('should derive different keys from different signatures', () => {
      const sig1 = '0x' + 'ab'.repeat(65);
      const sig2 = '0x' + 'cd'.repeat(65);

      const keys1 = deriveStealthKeyPairFromSignature(sig1);
      const keys2 = deriveStealthKeyPairFromSignature(sig2);

      expect(keys1.spendingPrivateKey).not.toBe(keys2.spendingPrivateKey);
      expect(keys1.viewingPrivateKey).not.toBe(keys2.viewingPrivateKey);
    });

    it('should generate valid keys from signature', () => {
      const signature = '0x' + 'ab'.repeat(65);
      const keys = deriveStealthKeyPairFromSignature(signature);

      expect(isValidCompressedPublicKey(keys.spendingPublicKey)).toBe(true);
      expect(isValidCompressedPublicKey(keys.viewingPublicKey)).toBe(true);
    });
  });

  describe('formatStealthMetaAddress', () => {
    it('should format meta-address correctly', () => {
      const keys = generateStealthKeyPair();
      const metaAddress = formatStealthMetaAddress(keys);

      expect(metaAddress).toMatch(/^st:eth:0x[0-9a-f]{132}$/i);
    });

    it('should support custom chain prefix', () => {
      const keys = generateStealthKeyPair();
      const metaAddress = formatStealthMetaAddress(keys, 'thanos');

      expect(metaAddress).toMatch(/^st:thanos:0x[0-9a-f]{132}$/i);
    });

    it('should combine spending and viewing public keys', () => {
      const keys = generateStealthKeyPair();
      const metaAddress = formatStealthMetaAddress(keys);

      const keysHex = metaAddress.split('0x')[1];
      expect(keysHex.slice(0, 66)).toBe(keys.spendingPublicKey);
      expect(keysHex.slice(66)).toBe(keys.viewingPublicKey);
    });
  });

  describe('parseStealthMetaAddress', () => {
    it('should parse valid meta-address', () => {
      const keys = generateStealthKeyPair();
      const metaAddress = formatStealthMetaAddress(keys, 'thanos');

      const parsed = parseStealthMetaAddress(metaAddress);

      expect(parsed.prefix).toBe('thanos');
      expect(parsed.spendingPublicKey).toBe(keys.spendingPublicKey);
      expect(parsed.viewingPublicKey).toBe(keys.viewingPublicKey);
      expect(parsed.raw).toBe(metaAddress);
    });

    it('should throw on invalid format', () => {
      expect(() => parseStealthMetaAddress('invalid')).toThrow();
      expect(() => parseStealthMetaAddress('st:eth:0x123')).toThrow();
      expect(() => parseStealthMetaAddress('st:eth:' + '00'.repeat(66))).toThrow();
    });

    it('should roundtrip correctly', () => {
      const keys = generateStealthKeyPair();
      const metaAddress = formatStealthMetaAddress(keys);
      const parsed = parseStealthMetaAddress(metaAddress);

      expect(parsed.spendingPublicKey).toBe(keys.spendingPublicKey);
      expect(parsed.viewingPublicKey).toBe(keys.viewingPublicKey);
    });
  });

  describe('isValidCompressedPublicKey', () => {
    it('should validate correct compressed keys', () => {
      const keys = generateStealthKeyPair();
      expect(isValidCompressedPublicKey(keys.spendingPublicKey)).toBe(true);
      expect(isValidCompressedPublicKey(keys.viewingPublicKey)).toBe(true);
    });

    it('should reject invalid keys', () => {
      expect(isValidCompressedPublicKey('00' + '00'.repeat(32))).toBe(false); // wrong prefix
      expect(isValidCompressedPublicKey('02' + '00'.repeat(31))).toBe(false); // wrong length
      expect(isValidCompressedPublicKey('invalid')).toBe(false);
    });
  });

  describe('getPublicKeyFromPrivate', () => {
    it('should derive correct public key', () => {
      const keys = generateStealthKeyPair();
      const derivedPubKey = getPublicKeyFromPrivate(keys.spendingPrivateKey);

      expect(derivedPubKey).toBe(keys.spendingPublicKey);
    });

    it('should return compressed format by default', () => {
      const keys = generateStealthKeyPair();
      const pubKey = getPublicKeyFromPrivate(keys.spendingPrivateKey);

      expect(pubKey.length).toBe(66); // Compressed = 33 bytes = 66 hex chars
    });

    it('should return uncompressed format when requested', () => {
      const keys = generateStealthKeyPair();
      const pubKey = getPublicKeyFromPrivate(keys.spendingPrivateKey, false);

      expect(pubKey.length).toBe(130); // Uncompressed = 65 bytes = 130 hex chars
      expect(pubKey.slice(0, 2)).toBe('04'); // Uncompressed prefix
    });
  });

  describe('decompressPublicKey', () => {
    it('should decompress public key to x,y coordinates', () => {
      const keys = generateStealthKeyPair();
      const result = decompressPublicKey(keys.spendingPublicKey);

      expect(result).not.toBeNull();
      expect(result!.x).toMatch(/^[0-9a-f]{64}$/i);
      expect(result!.y).toMatch(/^[0-9a-f]{64}$/i);
    });

    it('should return null for invalid keys', () => {
      expect(decompressPublicKey('invalid')).toBeNull();
    });
  });
});
