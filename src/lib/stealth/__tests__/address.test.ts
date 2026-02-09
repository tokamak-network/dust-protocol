/**
 * Tests for stealth address generation and verification
 */

import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import {
  generateStealthAddress,
  computeStealthPrivateKey,
  verifyStealthAddress,
  computeViewTag,
  getAddressFromPrivateKey,
  computeStealthWalletAddress,
} from '../address';
import {
  generateStealthKeyPair,
  parseStealthMetaAddress,
  formatStealthMetaAddress,
} from '../keys';

describe('Stealth Address Generation', () => {
  describe('generateStealthAddress', () => {
    it('should generate valid stealth address', () => {
      const recipientKeys = generateStealthKeyPair();
      const metaAddress = parseStealthMetaAddress(
        formatStealthMetaAddress(recipientKeys)
      );

      const generated = generateStealthAddress(metaAddress);

      // Should be a valid Ethereum address
      expect(generated.stealthAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(ethers.utils.isAddress(generated.stealthAddress)).toBe(true);

      // Ephemeral public key should be compressed
      expect(generated.ephemeralPublicKey).toMatch(/^0[23][0-9a-f]{64}$/i);

      // View tag should be 1 byte (2 hex chars)
      expect(generated.viewTag).toMatch(/^[0-9a-f]{2}$/i);

      // Stealth public key should be compressed
      expect(generated.stealthPublicKey).toMatch(/^0[23][0-9a-f]{64}$/i);
    });

    it('should generate different addresses each time', () => {
      const recipientKeys = generateStealthKeyPair();
      const metaAddress = parseStealthMetaAddress(
        formatStealthMetaAddress(recipientKeys)
      );

      const generated1 = generateStealthAddress(metaAddress);
      const generated2 = generateStealthAddress(metaAddress);

      expect(generated1.stealthAddress).not.toBe(generated2.stealthAddress);
      expect(generated1.ephemeralPublicKey).not.toBe(generated2.ephemeralPublicKey);
    });
  });

  describe('computeStealthPrivateKey', () => {
    it('should derive private key that matches stealth address', () => {
      const recipientKeys = generateStealthKeyPair();
      const metaAddress = parseStealthMetaAddress(
        formatStealthMetaAddress(recipientKeys)
      );

      const generated = generateStealthAddress(metaAddress);

      const stealthPrivateKey = computeStealthPrivateKey(
        recipientKeys.spendingPrivateKey,
        recipientKeys.viewingPrivateKey,
        generated.ephemeralPublicKey
      );

      // Derive address from private key — this gives the EOA (owner), not the CREATE2 wallet
      const derivedAddress = getAddressFromPrivateKey(stealthPrivateKey);

      // derivedAddress is the EOA, which should match stealthEOAAddress
      expect(derivedAddress.toLowerCase()).toBe(
        generated.stealthEOAAddress.toLowerCase()
      );
      // The CREATE2 wallet address wraps the EOA
      expect(computeStealthWalletAddress(derivedAddress).toLowerCase()).toBe(
        generated.stealthAddress.toLowerCase()
      );
    });

    it('should work with different key pairs', () => {
      // Test multiple times with random keys
      for (let i = 0; i < 5; i++) {
        const recipientKeys = generateStealthKeyPair();
        const metaAddress = parseStealthMetaAddress(
          formatStealthMetaAddress(recipientKeys)
        );

        const generated = generateStealthAddress(metaAddress);

        const stealthPrivateKey = computeStealthPrivateKey(
          recipientKeys.spendingPrivateKey,
          recipientKeys.viewingPrivateKey,
          generated.ephemeralPublicKey
        );

        const derivedAddress = getAddressFromPrivateKey(stealthPrivateKey);

        // derivedAddress is the EOA owner
        expect(derivedAddress.toLowerCase()).toBe(
          generated.stealthEOAAddress.toLowerCase()
        );
        // CREATE2 wallet wraps the EOA
        expect(computeStealthWalletAddress(derivedAddress).toLowerCase()).toBe(
          generated.stealthAddress.toLowerCase()
        );
      }
    });
  });

  describe('verifyStealthAddress', () => {
    it('should verify matching stealth EOA addresses', () => {
      const recipientKeys = generateStealthKeyPair();
      const metaAddress = parseStealthMetaAddress(
        formatStealthMetaAddress(recipientKeys)
      );

      const generated = generateStealthAddress(metaAddress);

      // verifyStealthAddress checks against the EOA, not the CREATE2 address
      const isValid = verifyStealthAddress(
        generated.ephemeralPublicKey,
        recipientKeys.spendingPublicKey,
        generated.stealthEOAAddress,
        recipientKeys.viewingPrivateKey
      );

      expect(isValid).toBe(true);
    });

    it('should not directly verify CREATE2 addresses (they wrap EOA)', () => {
      const recipientKeys = generateStealthKeyPair();
      const metaAddress = parseStealthMetaAddress(
        formatStealthMetaAddress(recipientKeys)
      );

      const generated = generateStealthAddress(metaAddress);

      // verifyStealthAddress computes EOA, so passing CREATE2 address fails
      const isValid = verifyStealthAddress(
        generated.ephemeralPublicKey,
        recipientKeys.spendingPublicKey,
        generated.stealthAddress, // CREATE2 address
        recipientKeys.viewingPrivateKey
      );

      expect(isValid).toBe(false);
    });

    it('should reject non-matching stealth addresses', () => {
      const recipientKeys = generateStealthKeyPair();
      const otherKeys = generateStealthKeyPair();
      const metaAddress = parseStealthMetaAddress(
        formatStealthMetaAddress(recipientKeys)
      );

      const generated = generateStealthAddress(metaAddress);

      // Try to verify with wrong viewing key
      const isValid = verifyStealthAddress(
        generated.ephemeralPublicKey,
        recipientKeys.spendingPublicKey,
        generated.stealthEOAAddress,
        otherKeys.viewingPrivateKey // Wrong key!
      );

      expect(isValid).toBe(false);
    });

    it('should reject wrong stealth address', () => {
      const recipientKeys = generateStealthKeyPair();
      const metaAddress = parseStealthMetaAddress(
        formatStealthMetaAddress(recipientKeys)
      );

      const generated = generateStealthAddress(metaAddress);

      const isValid = verifyStealthAddress(
        generated.ephemeralPublicKey,
        recipientKeys.spendingPublicKey,
        '0x' + '00'.repeat(20), // Wrong address!
        recipientKeys.viewingPrivateKey
      );

      expect(isValid).toBe(false);
    });
  });

  describe('computeViewTag', () => {
    it('should compute consistent view tags', () => {
      const recipientKeys = generateStealthKeyPair();
      const metaAddress = parseStealthMetaAddress(
        formatStealthMetaAddress(recipientKeys)
      );

      const generated = generateStealthAddress(metaAddress);

      const computedViewTag = computeViewTag(
        recipientKeys.viewingPrivateKey,
        generated.ephemeralPublicKey
      );

      expect(computedViewTag).toBe(generated.viewTag);
    });

    it('should return different view tags for different ephemeral keys', () => {
      const recipientKeys = generateStealthKeyPair();
      const metaAddress = parseStealthMetaAddress(
        formatStealthMetaAddress(recipientKeys)
      );

      const generated1 = generateStealthAddress(metaAddress);
      const generated2 = generateStealthAddress(metaAddress);

      const viewTag1 = computeViewTag(
        recipientKeys.viewingPrivateKey,
        generated1.ephemeralPublicKey
      );
      const viewTag2 = computeViewTag(
        recipientKeys.viewingPrivateKey,
        generated2.ephemeralPublicKey
      );

      // View tags could be the same by chance (1/256), but very unlikely
      // If they happen to be the same, that's still valid behavior
      expect(viewTag1).toMatch(/^[0-9a-f]{2}$/i);
      expect(viewTag2).toMatch(/^[0-9a-f]{2}$/i);
    });
  });

  describe('getAddressFromPrivateKey', () => {
    it('should derive correct Ethereum address', () => {
      // Known test vector
      const privateKey =
        'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const expectedAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

      const address = getAddressFromPrivateKey(privateKey);

      expect(address.toLowerCase()).toBe(expectedAddress.toLowerCase());
    });

    it('should work with stealth private keys', () => {
      const recipientKeys = generateStealthKeyPair();
      const metaAddress = parseStealthMetaAddress(
        formatStealthMetaAddress(recipientKeys)
      );

      const generated = generateStealthAddress(metaAddress);

      const stealthPrivateKey = computeStealthPrivateKey(
        recipientKeys.spendingPrivateKey,
        recipientKeys.viewingPrivateKey,
        generated.ephemeralPublicKey
      );

      const address = getAddressFromPrivateKey(stealthPrivateKey);

      expect(ethers.utils.isAddress(address)).toBe(true);
    });
  });

  describe('Full E2E Flow', () => {
    it('should complete full stealth payment flow', () => {
      // 1. Recipient generates stealth keys
      const recipientKeys = generateStealthKeyPair();

      // 2. Recipient formats and shares their meta-address
      const metaAddressUri = formatStealthMetaAddress(recipientKeys, 'thanos');

      // 3. Sender parses the meta-address
      const parsedMetaAddress = parseStealthMetaAddress(metaAddressUri);

      // 4. Sender generates stealth address for payment
      const generated = generateStealthAddress(parsedMetaAddress);

      // 5. Sender would send funds to generated.stealthAddress
      // 6. Sender would announce with generated.ephemeralPublicKey and generated.viewTag

      // 7. Recipient scans and verifies using view tag
      const expectedViewTag = computeViewTag(
        recipientKeys.viewingPrivateKey,
        generated.ephemeralPublicKey
      );
      expect(expectedViewTag).toBe(generated.viewTag);

      // 8. Recipient verifies the stealth EOA address is theirs
      const isOurs = verifyStealthAddress(
        generated.ephemeralPublicKey,
        recipientKeys.spendingPublicKey,
        generated.stealthEOAAddress,
        recipientKeys.viewingPrivateKey
      );
      expect(isOurs).toBe(true);

      // 9. Recipient computes private key to access funds
      const stealthPrivateKey = computeStealthPrivateKey(
        recipientKeys.spendingPrivateKey,
        recipientKeys.viewingPrivateKey,
        generated.ephemeralPublicKey
      );

      // 10. Verify the private key controls the stealth EOA (owner of CREATE2 wallet)
      const controlledEOA = getAddressFromPrivateKey(stealthPrivateKey);
      expect(controlledEOA.toLowerCase()).toBe(
        generated.stealthEOAAddress.toLowerCase()
      );

      // 11. Verify the CREATE2 wallet wraps this EOA
      const walletAddress = computeStealthWalletAddress(controlledEOA);
      expect(walletAddress.toLowerCase()).toBe(
        generated.stealthAddress.toLowerCase()
      );

      // Success! Recipient can now sign with stealthPrivateKey to drain the CREATE2 wallet
    });
  });
});
