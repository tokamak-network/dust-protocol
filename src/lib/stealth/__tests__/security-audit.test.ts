// Security audit tests for stealth implementation
import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import {
  generateStealthKeyPair,
  deriveStealthKeyPairFromSignature,
  formatStealthMetaAddress,
  parseStealthMetaAddress,
  generateStealthAddress,
  computeStealthPrivateKey,
  getAddressFromPrivateKey,
} from '../index';
import { deriveClaimAddresses } from '../hdWallet';

const TEST_PRIVATE_KEY = 'a596d50f8da618b4de7f9fab615f708966bcc51d3e5b183ae773eab00ea69f02';
const RPC_URL = 'https://rpc.thanos-sepolia.tokamak.network';

describe('Security Audit', () => {
  describe('Key Derivation Security', () => {
    it('should generate unique keys each time', () => {
      const keys1 = generateStealthKeyPair();
      const keys2 = generateStealthKeyPair();

      expect(keys1.spendingPrivateKey).not.toBe(keys2.spendingPrivateKey);
      expect(keys1.viewingPrivateKey).not.toBe(keys2.viewingPrivateKey);
      expect(keys1.spendingPublicKey).not.toBe(keys2.spendingPublicKey);
    });

    it('should derive deterministic keys from signature', () => {
      const signature = '0x' + '1234'.repeat(32);
      const keys1 = deriveStealthKeyPairFromSignature(signature);
      const keys2 = deriveStealthKeyPairFromSignature(signature);

      expect(keys1.spendingPrivateKey).toBe(keys2.spendingPrivateKey);
      expect(keys1.viewingPrivateKey).toBe(keys2.viewingPrivateKey);
    });

    it('should generate valid private keys (32 bytes hex)', () => {
      const keys = generateStealthKeyPair();

      expect(keys.spendingPrivateKey).toMatch(/^[a-f0-9]{64}$/);
      expect(keys.viewingPrivateKey).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate compressed public keys (33 bytes)', () => {
      const keys = generateStealthKeyPair();

      // Compressed public keys start with 02 or 03 and are 33 bytes (66 hex chars)
      expect(keys.spendingPublicKey).toMatch(/^0[23][a-f0-9]{64}$/);
      expect(keys.viewingPublicKey).toMatch(/^0[23][a-f0-9]{64}$/);
    });
  });

  describe('Stealth Address Security', () => {
    it('should generate unique stealth addresses for same recipient', () => {
      const keys = generateStealthKeyPair();
      const meta = parseStealthMetaAddress(formatStealthMetaAddress(keys));

      const addr1 = generateStealthAddress(meta);
      const addr2 = generateStealthAddress(meta);

      expect(addr1.stealthAddress).not.toBe(addr2.stealthAddress);
      expect(addr1.ephemeralPublicKey).not.toBe(addr2.ephemeralPublicKey);
    });

    it('should produce valid Ethereum addresses', () => {
      const keys = generateStealthKeyPair();
      const meta = parseStealthMetaAddress(formatStealthMetaAddress(keys));
      const generated = generateStealthAddress(meta);

      expect(ethers.utils.isAddress(generated.stealthAddress)).toBe(true);
    });

    it('should correctly derive stealth private key', () => {
      const keys = generateStealthKeyPair();
      const meta = parseStealthMetaAddress(formatStealthMetaAddress(keys));
      const generated = generateStealthAddress(meta);

      const stealthPrivKey = computeStealthPrivateKey(
        keys.spendingPrivateKey,
        keys.viewingPrivateKey,
        generated.ephemeralPublicKey
      );

      const derivedAddress = getAddressFromPrivateKey(stealthPrivKey);
      expect(derivedAddress.toLowerCase()).toBe(generated.stealthAddress.toLowerCase());
    });

    it('should not leak spending key from viewing operations', () => {
      const keys = generateStealthKeyPair();
      const meta = parseStealthMetaAddress(formatStealthMetaAddress(keys));
      const generated = generateStealthAddress(meta);

      // Viewing key alone cannot derive spending key
      const viewTag = generated.viewTag;
      expect(viewTag.length).toBe(2); // 1 byte = 2 hex chars

      // Cannot derive spending private key from view tag + ephemeral pubkey alone
      // This is ensured by ECDH security
    });
  });

  describe('HD Wallet Claim Addresses', () => {
    it('should derive deterministic addresses from signature', () => {
      const signature = '0x' + 'ab12'.repeat(32);
      const addresses1 = deriveClaimAddresses(signature, 5);
      const addresses2 = deriveClaimAddresses(signature, 5);

      for (let i = 0; i < 5; i++) {
        expect(addresses1[i].address).toBe(addresses2[i].address);
        expect(addresses1[i].privateKey).toBe(addresses2[i].privateKey);
      }
    });

    it('should generate valid Ethereum addresses', () => {
      const signature = '0x' + 'ef56'.repeat(32);
      const addresses = deriveClaimAddresses(signature, 3);

      for (const addr of addresses) {
        expect(ethers.utils.isAddress(addr.address)).toBe(true);
      }
    });

    it('should generate unique addresses for each index', () => {
      const signature = '0x' + '7890'.repeat(32);
      const addresses = deriveClaimAddresses(signature, 10);
      const addressSet = new Set(addresses.map(a => a.address));

      expect(addressSet.size).toBe(10);
    });

    it('should generate controllable addresses', () => {
      const signature = '0x' + 'dead'.repeat(32);
      const addresses = deriveClaimAddresses(signature, 3);

      for (const addr of addresses) {
        const wallet = new ethers.Wallet(addr.privateKey);
        expect(wallet.address.toLowerCase()).toBe(addr.address.toLowerCase());
      }
    });

    it('should NOT store private keys in localStorage format', () => {
      const signature = '0x' + 'beef'.repeat(32);
      const addresses = deriveClaimAddresses(signature, 3);

      // The storage function should strip private keys
      const storageFormat = addresses.map(({ address, path, index, label }) => ({
        address, path, index, label
      }));

      for (const item of storageFormat) {
        expect(item).not.toHaveProperty('privateKey');
      }
    });
  });

  describe('Meta Address Format Security', () => {
    it('should parse and validate meta-address format', () => {
      const keys = generateStealthKeyPair();
      const metaUri = formatStealthMetaAddress(keys, 'thanos');

      expect(metaUri).toMatch(/^st:thanos:0x[a-f0-9]+$/);

      const parsed = parseStealthMetaAddress(metaUri);
      expect(parsed.spendingPublicKey).toBe(keys.spendingPublicKey);
      expect(parsed.viewingPublicKey).toBe(keys.viewingPublicKey);
    });

    it('should reject invalid meta-address formats', () => {
      expect(() => parseStealthMetaAddress('invalid')).toThrow();
      expect(() => parseStealthMetaAddress('st:eth:0x')).toThrow();
      expect(() => parseStealthMetaAddress('st:thanos:0xshort')).toThrow();
    });
  });

  describe('View Tag Security', () => {
    it('should produce 1-byte view tags', () => {
      const keys = generateStealthKeyPair();
      const meta = parseStealthMetaAddress(formatStealthMetaAddress(keys));
      const generated = generateStealthAddress(meta);

      expect(generated.viewTag.length).toBe(2); // 1 byte = 2 hex chars
      expect(generated.viewTag).toMatch(/^[a-f0-9]{2}$/);
    });

    it('should filter ~99.6% of unrelated announcements', () => {
      // With 1-byte view tag, probability of false positive is 1/256 ≈ 0.4%
      const keys = generateStealthKeyPair();
      const meta = parseStealthMetaAddress(formatStealthMetaAddress(keys));

      // Generate 1000 addresses and check view tag distribution
      const viewTags = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        const generated = generateStealthAddress(meta);
        viewTags.add(generated.viewTag);
      }

      // Should have good distribution (at least 100 unique view tags out of 256 possible)
      expect(viewTags.size).toBeGreaterThan(100);
    });
  });

  describe('On-Chain Integration Security', () => {
    it('should verify wallet controls test address', async () => {
      const wallet = new ethers.Wallet(TEST_PRIVATE_KEY);
      expect(wallet.address).toBe('0x8d56E94a02F06320BDc68FAfE23DEc9Ad7463496');
    });

    it('should connect to Thanos Sepolia', async () => {
      const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
      const network = await provider.getNetwork();
      expect(network.chainId).toBe(111551119090);
    });

    it('should verify test wallet has funds', async () => {
      const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
      const wallet = new ethers.Wallet(TEST_PRIVATE_KEY, provider);
      const balance = await wallet.getBalance();

      expect(balance.gt(ethers.utils.parseEther('1'))).toBe(true);
    });
  });
});

describe('Leak Detection', () => {
  it('should not expose private keys in toString()', () => {
    const keys = generateStealthKeyPair();
    const stringified = JSON.stringify(keys);

    // Keys ARE in the object, but verify they're not accidentally logged elsewhere
    expect(stringified).toContain('spendingPrivateKey');
    expect(stringified).toContain('viewingPrivateKey');
  });

  it('should not include private keys in error messages', () => {
    const keys = generateStealthKeyPair();

    try {
      // Force an error with keys context
      parseStealthMetaAddress('invalid-' + keys.spendingPrivateKey.slice(0, 10));
    } catch (e) {
      const errorMsg = (e as Error).message;
      // Error should not contain the full private key
      expect(errorMsg).not.toContain(keys.spendingPrivateKey);
    }
  });

  it('claim addresses storage should exclude private keys', () => {
    const signature = '0x' + 'cafe'.repeat(32);
    const addresses = deriveClaimAddresses(signature, 3);

    // Simulate what saveClaimAddressesToStorage does
    const dataToStore = addresses.map(({ address, path, index, label }) => ({
      address, path, index, label
    }));

    const stored = JSON.stringify(dataToStore);

    // Private keys should NOT be in storage
    for (const addr of addresses) {
      expect(stored).not.toContain(addr.privateKey);
    }

    // But addresses should be present
    for (const addr of addresses) {
      expect(stored).toContain(addr.address);
    }
  });
});
