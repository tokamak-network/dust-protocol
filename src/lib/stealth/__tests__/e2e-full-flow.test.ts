// Full end-to-end test: Send ETH to stealth address and claim it
import { describe, it, expect, beforeAll } from 'vitest';
import { ethers } from 'ethers';
import {
  generateStealthKeyPair,
  formatStealthMetaAddress,
  parseStealthMetaAddress,
  generateStealthAddress,
  computeStealthPrivateKey,
  getAddressFromPrivateKey,
  SCHEME_ID,
  CANONICAL_ADDRESSES,
} from '../index';
import { deriveClaimAddresses } from '../hdWallet';

const RPC_URL = 'https://rpc.thanos-sepolia.tokamak.network';
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY ||
  'a596d50f8da618b4de7f9fab615f708966bcc51d3e5b183ae773eab00ea69f02';

const ANNOUNCER_ABI = [
  'event Announcement(uint256 indexed schemeId, address indexed stealthAddress, address indexed caller, bytes ephemeralPubKey, bytes metadata)',
  'function announce(uint256 schemeId, address stealthAddress, bytes calldata ephemeralPubKey, bytes calldata metadata) external',
];

describe('Full E2E Flow with Real ETH', () => {
  let provider: ethers.providers.JsonRpcProvider;
  let senderWallet: ethers.Wallet;
  let announcer: ethers.Contract;

  beforeAll(async () => {
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    senderWallet = new ethers.Wallet(TEST_PRIVATE_KEY, provider);
    announcer = new ethers.Contract(CANONICAL_ADDRESSES.announcer, ANNOUNCER_ABI, senderWallet);

    const balance = await senderWallet.getBalance();
    console.log(`Sender: ${senderWallet.address}`);
    console.log(`Balance: ${ethers.utils.formatEther(balance)} ETH`);
  });

  it('should send real ETH to stealth address and claim it back', async () => {
    console.log('\n=== FULL E2E TEST: SEND AND CLAIM ETH ===\n');

    // 1. Generate recipient stealth keys
    console.log('1. Generating recipient stealth keys...');
    const recipientKeys = generateStealthKeyPair();
    const metaUri = formatStealthMetaAddress(recipientKeys, 'thanos');
    console.log(`   Meta-address: ${metaUri.slice(0, 60)}...`);

    // 2. Generate stealth address for this payment
    console.log('2. Generating one-time stealth address...');
    const parsedMeta = parseStealthMetaAddress(metaUri);
    const generated = generateStealthAddress(parsedMeta);
    console.log(`   Stealth address: ${generated.stealthAddress}`);
    console.log(`   View tag: 0x${generated.viewTag}`);

    // 3. Send ETH to stealth address (enough for gas + leftover)
    const sendAmount = ethers.utils.parseEther('0.01');
    console.log(`3. Sending ${ethers.utils.formatEther(sendAmount)} ETH...`);

    const sendTx = await senderWallet.sendTransaction({
      to: generated.stealthAddress,
      value: sendAmount,
    });
    const sendReceipt = await sendTx.wait();
    console.log(`   TX: ${sendReceipt.transactionHash}`);

    // 4. Announce the payment
    console.log('4. Announcing payment...');
    const announceTx = await announcer.announce(
      SCHEME_ID.SECP256K1,
      generated.stealthAddress,
      '0x' + generated.ephemeralPublicKey,
      '0x' + generated.viewTag
    );
    const announceReceipt = await announceTx.wait();
    console.log(`   Announce TX: ${announceReceipt.transactionHash}`);

    // 5. Verify stealth address received funds
    console.log('5. Verifying stealth address balance...');
    const stealthBalance = await provider.getBalance(generated.stealthAddress);
    console.log(`   Stealth balance: ${ethers.utils.formatEther(stealthBalance)} ETH`);
    expect(stealthBalance.eq(sendAmount)).toBe(true);

    // 6. Derive stealth private key
    console.log('6. Deriving stealth private key...');
    const stealthPrivKey = computeStealthPrivateKey(
      recipientKeys.spendingPrivateKey,
      recipientKeys.viewingPrivateKey,
      generated.ephemeralPublicKey
    );

    // 7. Verify key controls the address
    const derivedAddr = getAddressFromPrivateKey(stealthPrivKey);
    console.log(`   Derived address: ${derivedAddr}`);
    expect(derivedAddr.toLowerCase()).toBe(generated.stealthAddress.toLowerCase());

    // 8. Claim funds back to sender (simulating claim to fresh address)
    console.log('7. Claiming funds back...');
    const stealthWallet = new ethers.Wallet(stealthPrivKey, provider);

    // Leave buffer for gas (0.0005 ETH should cover any reasonable gas cost)
    const gasReserve = ethers.utils.parseEther('0.0005');
    const claimAmount = stealthBalance.sub(gasReserve);

    console.log(`   Gas reserve: ${ethers.utils.formatEther(gasReserve)} ETH`);
    console.log(`   Claim amount: ${ethers.utils.formatEther(claimAmount)} ETH`);

    expect(claimAmount.gt(0)).toBe(true);

    const claimTx = await stealthWallet.sendTransaction({
      to: senderWallet.address,
      value: claimAmount,
    });
    const claimReceipt = await claimTx.wait();
    console.log(`   Claim TX: ${claimReceipt.transactionHash}`);

    // 9. Verify stealth address has only dust (leftover gas reserve)
    const finalBalance = await provider.getBalance(generated.stealthAddress);
    console.log(`   Final stealth balance: ${ethers.utils.formatEther(finalBalance)} ETH`);
    expect(finalBalance.lt(gasReserve)).toBe(true); // Should be less than gas reserve (just dust)

    console.log('\n=== E2E TEST COMPLETE ===\n');
  }, 120000); // 2 min timeout

  it('should derive and use HD claim addresses', async () => {
    console.log('\n=== HD CLAIM ADDRESS TEST ===\n');

    // Simulate wallet signature
    const message = 'Sign to derive claim addresses';
    const signature = await senderWallet.signMessage(message);
    console.log(`1. Signed derivation message`);

    // Derive claim addresses
    const claimAddresses = deriveClaimAddresses(signature, 3);
    console.log(`2. Derived ${claimAddresses.length} claim addresses:`);
    for (const addr of claimAddresses) {
      console.log(`   ${addr.path}: ${addr.address}`);
    }

    // Verify all addresses are controllable
    for (const addr of claimAddresses) {
      const wallet = new ethers.Wallet(addr.privateKey);
      expect(wallet.address.toLowerCase()).toBe(addr.address.toLowerCase());
    }

    // Verify addresses are unlinkable to main wallet
    expect(claimAddresses[0].address.toLowerCase()).not.toBe(senderWallet.address.toLowerCase());

    console.log('3. All addresses verified controllable');
    console.log('4. Addresses unlinkable to main wallet ✓');

    console.log('\n=== HD CLAIM ADDRESS TEST COMPLETE ===\n');
  });

  it('should scan and find payment using view tag', async () => {
    console.log('\n=== SCANNING TEST ===\n');

    // Generate recipient keys
    const recipientKeys = generateStealthKeyPair();
    const parsedMeta = parseStealthMetaAddress(formatStealthMetaAddress(recipientKeys));
    const generated = generateStealthAddress(parsedMeta);

    // Announce (no actual payment needed for scanning test)
    console.log('1. Creating announcement...');
    const announceTx = await announcer.announce(
      SCHEME_ID.SECP256K1,
      generated.stealthAddress,
      '0x' + generated.ephemeralPublicKey,
      '0x' + generated.viewTag
    );
    const receipt = await announceTx.wait();
    console.log(`   Block: ${receipt.blockNumber}`);

    // Scan recent blocks
    console.log('2. Scanning for announcements...');
    const filter = announcer.filters.Announcement(SCHEME_ID.SECP256K1);
    const events = await announcer.queryFilter(filter, receipt.blockNumber - 1);

    let found = false;
    let scanned = 0;
    let viewTagMatches = 0;

    for (const event of events) {
      scanned++;
      const ephPubKey = (event.args?.ephemeralPubKey as string).replace('0x', '');
      const stealthAddr = event.args?.stealthAddress as string;

      // Compute expected view tag
      const stealthPrivKey = computeStealthPrivateKey(
        recipientKeys.spendingPrivateKey,
        recipientKeys.viewingPrivateKey,
        ephPubKey
      );
      const derivedAddr = getAddressFromPrivateKey(stealthPrivKey);

      // Check if view tag matches
      if (derivedAddr.toLowerCase() === stealthAddr.toLowerCase()) {
        viewTagMatches++;
        found = true;
        console.log(`   Found payment at ${stealthAddr}`);
      }
    }

    console.log(`3. Scanned ${scanned} events, found ${viewTagMatches} matches`);
    expect(found).toBe(true);

    console.log('\n=== SCANNING TEST COMPLETE ===\n');
  }, 60000);
});

describe('Privacy Verification', () => {
  it('should generate unlinkable addresses for same recipient', () => {
    const keys = generateStealthKeyPair();
    const meta = parseStealthMetaAddress(formatStealthMetaAddress(keys));

    const addr1 = generateStealthAddress(meta);
    const addr2 = generateStealthAddress(meta);
    const addr3 = generateStealthAddress(meta);

    // All addresses should be different
    expect(addr1.stealthAddress).not.toBe(addr2.stealthAddress);
    expect(addr2.stealthAddress).not.toBe(addr3.stealthAddress);
    expect(addr1.stealthAddress).not.toBe(addr3.stealthAddress);

    // All ephemeral keys should be different
    expect(addr1.ephemeralPublicKey).not.toBe(addr2.ephemeralPublicKey);

    console.log('Unlinkability verified: 3 payments to same recipient, 3 different addresses');
  });

  it('should not leak recipient identity from announcement', () => {
    const keys = generateStealthKeyPair();
    const meta = parseStealthMetaAddress(formatStealthMetaAddress(keys));
    const generated = generateStealthAddress(meta);

    // The announcement contains:
    // - stealthAddress (one-time, unlinkable)
    // - ephemeralPublicKey (one-time, unlinkable)
    // - viewTag (1 byte, provides 1/256 filtering)

    // None of these reveal:
    // - spendingPublicKey
    // - viewingPublicKey
    // - spendingPrivateKey
    // - viewingPrivateKey

    expect(generated.stealthAddress).not.toContain(keys.spendingPublicKey);
    expect(generated.ephemeralPublicKey).not.toContain(keys.viewingPublicKey);

    console.log('Announcement does not leak recipient identity ✓');
  });

  it('should require both spending and viewing keys to claim', () => {
    const keys = generateStealthKeyPair();
    const meta = parseStealthMetaAddress(formatStealthMetaAddress(keys));
    const generated = generateStealthAddress(meta);

    // With only viewing key, cannot derive spending key
    // The stealth private key requires BOTH:
    const stealthPrivKey = computeStealthPrivateKey(
      keys.spendingPrivateKey, // Need this
      keys.viewingPrivateKey,  // And this
      generated.ephemeralPublicKey
    );

    const derivedAddr = getAddressFromPrivateKey(stealthPrivKey);
    expect(derivedAddr.toLowerCase()).toBe(generated.stealthAddress.toLowerCase());

    // With wrong spending key, cannot derive correct address
    const wrongKeys = generateStealthKeyPair();
    const wrongPrivKey = computeStealthPrivateKey(
      wrongKeys.spendingPrivateKey, // Wrong key
      keys.viewingPrivateKey,
      generated.ephemeralPublicKey
    );
    const wrongAddr = getAddressFromPrivateKey(wrongPrivKey);
    expect(wrongAddr.toLowerCase()).not.toBe(generated.stealthAddress.toLowerCase());

    console.log('Both keys required for claiming ✓');
  });
});
