/**
 * End-to-end tests for stealth address contracts on Thanos Sepolia
 * These tests interact with the actual deployed contracts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ethers } from 'ethers';
import {
  generateStealthKeyPair,
  formatStealthMetaAddress,
  parseStealthMetaAddress,
  generateStealthAddress,
  computeStealthPrivateKey,
  verifyStealthAddress,
  computeViewTag,
  getAddressFromPrivateKey,
  SCHEME_ID,
} from '../index';

// Contract addresses on Thanos Sepolia (deployed)
const ANNOUNCER_ADDRESS = '0x75BD499f7CA8E361b7930e2881b2B3c99Aa1eea1';
const REGISTRY_ADDRESS = '0x5779192B220876221Bc2871511FB764941314e04';
const RPC_URL = 'https://rpc.thanos-sepolia.tokamak.network';

// Test private key (use a funded account for actual E2E tests)
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY ||
  'a596d50f8da618b4de7f9fab615f708966bcc51d3e5b183ae773eab00ea69f02';

// Contract ABIs
const ANNOUNCER_ABI = [
  'event Announcement(uint256 indexed schemeId, address indexed stealthAddress, address indexed caller, bytes ephemeralPubKey, bytes metadata)',
  'function announce(uint256 schemeId, address stealthAddress, bytes calldata ephemeralPubKey, bytes calldata metadata) external',
];

const REGISTRY_ABI = [
  'event StealthMetaAddressSet(address indexed registrant, uint256 indexed schemeId, bytes stealthMetaAddress)',
  'function stealthMetaAddressOf(address registrant, uint256 schemeId) external view returns (bytes)',
  'function registerKeys(uint256 schemeId, bytes calldata stealthMetaAddress) external',
  'function nonceOf(address registrant) external view returns (uint256)',
];

describe('Stealth Contract E2E Tests', () => {
  let provider: ethers.providers.JsonRpcProvider;
  let wallet: ethers.Wallet;
  let announcer: ethers.Contract;
  let registry: ethers.Contract;

  beforeAll(async () => {
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    wallet = new ethers.Wallet(TEST_PRIVATE_KEY, provider);
    announcer = new ethers.Contract(ANNOUNCER_ADDRESS, ANNOUNCER_ABI, wallet);
    registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, wallet);

    // Check connection
    const network = await provider.getNetwork();
    console.log(`Connected to chain ID: ${network.chainId}`);
    console.log(`Test wallet: ${wallet.address}`);

    const balance = await wallet.getBalance();
    console.log(`Balance: ${ethers.utils.formatEther(balance)} TOKAMAK`);
  });

  describe('ERC5564Announcer', () => {
    it('should announce a stealth payment', async () => {
      const recipientKeys = generateStealthKeyPair();
      const metaAddress = parseStealthMetaAddress(
        formatStealthMetaAddress(recipientKeys)
      );
      const generated = generateStealthAddress(metaAddress);

      // Announce the payment
      const tx = await announcer.announce(
        SCHEME_ID.SECP256K1,
        generated.stealthAddress,
        '0x' + generated.ephemeralPublicKey,
        '0x' + generated.viewTag
      );

      const receipt = await tx.wait();
      expect(receipt.status).toBe(1);

      // Check event was emitted
      const event = receipt.events?.find(
        (e: ethers.Event) => e.event === 'Announcement'
      );
      expect(event).toBeDefined();
      expect(event?.args?.schemeId.toNumber()).toBe(SCHEME_ID.SECP256K1);
      expect(event?.args?.stealthAddress.toLowerCase()).toBe(
        generated.stealthAddress.toLowerCase()
      );
      expect(event?.args?.caller.toLowerCase()).toBe(
        wallet.address.toLowerCase()
      );

      console.log(`Announcement tx: ${receipt.transactionHash}`);
    });

    it('should be able to query announcement events', async () => {
      // Get recent announcements
      const filter = announcer.filters.Announcement(SCHEME_ID.SECP256K1);
      const events = await announcer.queryFilter(filter, -100); // Last 100 blocks

      expect(events.length).toBeGreaterThan(0);

      const lastEvent = events[events.length - 1];
      expect(lastEvent.args?.schemeId.toNumber()).toBe(SCHEME_ID.SECP256K1);

      console.log(`Found ${events.length} announcements`);
    });
  });

  describe('ERC6538Registry', () => {
    it('should register a stealth meta-address', async () => {
      const keys = generateStealthKeyPair();
      const metaAddressBytes =
        '0x' + keys.spendingPublicKey + keys.viewingPublicKey;

      const tx = await registry.registerKeys(
        SCHEME_ID.SECP256K1,
        metaAddressBytes
      );
      const receipt = await tx.wait();

      expect(receipt.status).toBe(1);

      // Check event
      const event = receipt.events?.find(
        (e: ethers.Event) => e.event === 'StealthMetaAddressSet'
      );
      expect(event).toBeDefined();
      expect(event?.args?.registrant.toLowerCase()).toBe(
        wallet.address.toLowerCase()
      );
      expect(event?.args?.schemeId.toNumber()).toBe(SCHEME_ID.SECP256K1);

      console.log(`Registration tx: ${receipt.transactionHash}`);
    });

    it('should lookup registered meta-address', async () => {
      // First register
      const keys = generateStealthKeyPair();
      const metaAddressBytes =
        '0x' + keys.spendingPublicKey + keys.viewingPublicKey;

      await (
        await registry.registerKeys(SCHEME_ID.SECP256K1, metaAddressBytes)
      ).wait();

      // Then lookup
      const stored = await registry.stealthMetaAddressOf(
        wallet.address,
        SCHEME_ID.SECP256K1
      );

      expect(stored.toLowerCase()).toBe(metaAddressBytes.toLowerCase());
    });

    it('should return nonce', async () => {
      const nonce = await registry.nonceOf(wallet.address);
      expect(nonce).toBeDefined();
      console.log(`Current nonce for ${wallet.address}: ${nonce.toString()}`);
    });
  });

  describe('Full E2E Stealth Payment Flow', () => {
    it('should complete full payment and scanning flow', async () => {
      console.log('\n=== Full E2E Stealth Payment Test ===\n');

      // 1. RECIPIENT: Generate stealth keys
      console.log('1. Recipient generating stealth keys...');
      const recipientKeys = generateStealthKeyPair();
      const metaAddressUri = formatStealthMetaAddress(recipientKeys, 'thanos');
      console.log(`   Meta-address: ${metaAddressUri.slice(0, 50)}...`);

      // 2. RECIPIENT: Register meta-address (optional but recommended)
      console.log('2. Recipient registering meta-address on-chain...');
      const metaAddressBytes =
        '0x' + recipientKeys.spendingPublicKey + recipientKeys.viewingPublicKey;
      const regTx = await registry.registerKeys(
        SCHEME_ID.SECP256K1,
        metaAddressBytes
      );
      await regTx.wait();
      console.log('   Registered!');

      // 3. SENDER: Parse recipient's meta-address
      console.log('3. Sender parsing meta-address...');
      const parsedMeta = parseStealthMetaAddress(metaAddressUri);

      // 4. SENDER: Generate stealth address
      console.log('4. Sender generating stealth address...');
      const generated = generateStealthAddress(parsedMeta);
      console.log(`   Stealth address: ${generated.stealthAddress}`);
      console.log(`   View tag: 0x${generated.viewTag}`);

      // 5. SENDER: Send funds (in real scenario)
      console.log('5. Sender would send funds to stealth address...');
      console.log('   (Skipping actual transfer in test)');

      // 6. SENDER: Announce the payment
      console.log('6. Sender announcing payment...');
      const announceTx = await announcer.announce(
        SCHEME_ID.SECP256K1,
        generated.stealthAddress,
        '0x' + generated.ephemeralPublicKey,
        '0x' + generated.viewTag
      );
      const announceReceipt = await announceTx.wait();
      console.log(`   Announced! Block: ${announceReceipt.blockNumber}`);

      // 7. RECIPIENT: Scan for announcements
      console.log('7. Recipient scanning for announcements...');
      const fromBlock = announceReceipt.blockNumber - 1;
      const filter = announcer.filters.Announcement(SCHEME_ID.SECP256K1);
      const events = await announcer.queryFilter(filter, fromBlock);

      let foundPayment = false;
      for (const event of events) {
        const ephPubKey = (event.args?.ephemeralPubKey as string).replace(
          '0x',
          ''
        );
        const metadata = event.args?.metadata as string;
        const stealthAddr = event.args?.stealthAddress as string;

        // 8. RECIPIENT: Quick filter with view tag
        const expectedViewTag = computeViewTag(
          recipientKeys.viewingPrivateKey,
          ephPubKey
        );

        // Extract view tag from metadata
        const eventViewTag = metadata.slice(2, 4);

        if (expectedViewTag !== eventViewTag) {
          continue; // Not for us
        }

        // 9. RECIPIENT: Verify full address
        const isOurs = verifyStealthAddress(
          ephPubKey,
          recipientKeys.spendingPublicKey,
          stealthAddr,
          recipientKeys.viewingPrivateKey
        );

        if (isOurs) {
          console.log('   Found our payment!');
          foundPayment = true;

          // 10. RECIPIENT: Derive private key
          console.log('8. Recipient deriving stealth private key...');
          const stealthPrivKey = computeStealthPrivateKey(
            recipientKeys.spendingPrivateKey,
            recipientKeys.viewingPrivateKey,
            ephPubKey
          );

          // 11. Verify we control the address
          const controlledAddr = getAddressFromPrivateKey(stealthPrivKey);
          expect(controlledAddr.toLowerCase()).toBe(stealthAddr.toLowerCase());

          console.log('   Private key derived successfully!');
          console.log(`   Controls address: ${controlledAddr}`);

          // 12. RECIPIENT could now use stealthPrivKey to spend funds
          console.log('9. Recipient can now spend funds from stealth address!');

          break;
        }
      }

      expect(foundPayment).toBe(true);
      console.log('\n=== E2E Test Complete! ===\n');
    });

    it('should handle multiple payments to same recipient', async () => {
      const recipientKeys = generateStealthKeyPair();
      const metaAddress = parseStealthMetaAddress(
        formatStealthMetaAddress(recipientKeys)
      );

      // Generate multiple stealth addresses
      const payments = [];
      for (let i = 0; i < 3; i++) {
        const generated = generateStealthAddress(metaAddress);

        // Announce
        const tx = await announcer.announce(
          SCHEME_ID.SECP256K1,
          generated.stealthAddress,
          '0x' + generated.ephemeralPublicKey,
          '0x' + generated.viewTag
        );
        await tx.wait();

        payments.push(generated);
      }

      // All addresses should be different
      const addresses = payments.map((p) => p.stealthAddress.toLowerCase());
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(3);

      // Recipient should be able to derive all private keys
      for (const payment of payments) {
        const privKey = computeStealthPrivateKey(
          recipientKeys.spendingPrivateKey,
          recipientKeys.viewingPrivateKey,
          payment.ephemeralPublicKey
        );

        const derivedAddr = getAddressFromPrivateKey(privKey);
        expect(derivedAddr.toLowerCase()).toBe(
          payment.stealthAddress.toLowerCase()
        );
      }

      console.log(`Successfully handled ${payments.length} payments`);
    });
  });

  describe('View Tag Filtering Performance', () => {
    it('should efficiently filter announcements using view tags', async () => {
      const recipientKeys = generateStealthKeyPair();

      // Create 4 announcements (some for us, some not) - reduced for faster testing
      const ourPayments = [];
      const otherPayments = [];

      // 2 payments for us
      for (let i = 0; i < 2; i++) {
        const metaAddress = parseStealthMetaAddress(
          formatStealthMetaAddress(recipientKeys)
        );
        const generated = generateStealthAddress(metaAddress);
        ourPayments.push(generated);

        await (
          await announcer.announce(
            SCHEME_ID.SECP256K1,
            generated.stealthAddress,
            '0x' + generated.ephemeralPublicKey,
            '0x' + generated.viewTag
          )
        ).wait();
      }

      // 2 payments for others
      for (let i = 0; i < 2; i++) {
        const otherKeys = generateStealthKeyPair();
        const metaAddress = parseStealthMetaAddress(
          formatStealthMetaAddress(otherKeys)
        );
        const generated = generateStealthAddress(metaAddress);
        otherPayments.push(generated);

        await (
          await announcer.announce(
            SCHEME_ID.SECP256K1,
            generated.stealthAddress,
            '0x' + generated.ephemeralPublicKey,
            '0x' + generated.viewTag
          )
        ).wait();
      }

      // Scan and filter
      const filter = announcer.filters.Announcement(SCHEME_ID.SECP256K1);
      const events = await announcer.queryFilter(filter, -50);

      let viewTagMatches = 0;
      let fullVerifyMatches = 0;

      for (const event of events) {
        const ephPubKey = (event.args?.ephemeralPubKey as string).replace(
          '0x',
          ''
        );
        const metadata = event.args?.metadata as string;
        const stealthAddr = event.args?.stealthAddress as string;

        // Quick view tag check (fast)
        const expectedViewTag = computeViewTag(
          recipientKeys.viewingPrivateKey,
          ephPubKey
        );
        const eventViewTag = metadata.slice(2, 4);

        if (expectedViewTag === eventViewTag) {
          viewTagMatches++;

          // Full verification (slower)
          if (
            verifyStealthAddress(
              ephPubKey,
              recipientKeys.spendingPublicKey,
              stealthAddr,
              recipientKeys.viewingPrivateKey
            )
          ) {
            fullVerifyMatches++;
          }
        }
      }

      console.log(`Total events scanned: ${events.length}`);
      console.log(`View tag matches: ${viewTagMatches}`);
      console.log(`Full verify matches: ${fullVerifyMatches}`);

      // We should find at least our 2 payments
      expect(fullVerifyMatches).toBeGreaterThanOrEqual(2);
    }, 120000); // 2 minute timeout for this test
  });
});
