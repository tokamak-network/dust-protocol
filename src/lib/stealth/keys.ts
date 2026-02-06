// Stealth key management

import { ec as EC } from 'elliptic';
import { ethers } from 'ethers';
import type { StealthKeyPair, StealthMetaAddress } from './types';

const secp256k1 = new EC('secp256k1');

export const STEALTH_KEY_DERIVATION_MESSAGE =
  'Sign to activate your Private Wallet.\n\n' +
  'This creates your private receiving address and claim wallets.\n\n' +
  'Domain: Tokamak Network\n' +
  'Purpose: Private Wallet Setup';

export function generateStealthKeyPair(): StealthKeyPair {
  const spending = secp256k1.genKeyPair();
  const viewing = secp256k1.genKeyPair();

  return {
    spendingPrivateKey: spending.getPrivate('hex').padStart(64, '0'),
    spendingPublicKey: spending.getPublic(true, 'hex'),
    viewingPrivateKey: viewing.getPrivate('hex').padStart(64, '0'),
    viewingPublicKey: viewing.getPublic(true, 'hex'),
  };
}

export function deriveStealthKeyPairFromSignature(signature: string): StealthKeyPair {
  const entropy = ethers.utils.keccak256(signature);

  const spendingEntropy = ethers.utils.keccak256(
    ethers.utils.concat([entropy, ethers.utils.toUtf8Bytes('spending')])
  );
  const viewingEntropy = ethers.utils.keccak256(
    ethers.utils.concat([entropy, ethers.utils.toUtf8Bytes('viewing')])
  );

  const spending = secp256k1.keyFromPrivate(spendingEntropy.slice(2), 'hex');
  const viewing = secp256k1.keyFromPrivate(viewingEntropy.slice(2), 'hex');

  return {
    spendingPrivateKey: spending.getPrivate('hex').padStart(64, '0'),
    spendingPublicKey: spending.getPublic(true, 'hex'),
    viewingPrivateKey: viewing.getPrivate('hex').padStart(64, '0'),
    viewingPublicKey: viewing.getPublic(true, 'hex'),
  };
}

export function formatStealthMetaAddress(keys: StealthKeyPair, chain = 'eth'): string {
  const spending = keys.spendingPublicKey.replace(/^0x/, '');
  const viewing = keys.viewingPublicKey.replace(/^0x/, '');
  return `st:${chain}:0x${spending}${viewing}`;
}

export function parseStealthMetaAddress(uri: string): StealthMetaAddress {
  const match = uri.match(/^st:([a-z]+):0x([0-9a-fA-F]{132})$/);
  if (!match) {
    throw new Error(`Invalid stealth meta-address: ${uri}`);
  }

  const [, chain, keys] = match;
  const spendingPublicKey = keys.slice(0, 66);
  const viewingPublicKey = keys.slice(66, 132);

  if (!isValidCompressedPublicKey(spendingPublicKey) || !isValidCompressedPublicKey(viewingPublicKey)) {
    throw new Error('Invalid public key in meta-address');
  }

  return { prefix: chain, spendingPublicKey, viewingPublicKey, raw: uri };
}

export function isValidCompressedPublicKey(key: string): boolean {
  const clean = key.replace(/^0x/, '');
  if (clean.length !== 66) return false;

  const prefix = clean.slice(0, 2);
  if (prefix !== '02' && prefix !== '03') return false;

  try {
    secp256k1.keyFromPublic(clean, 'hex');
    return true;
  } catch {
    return false;
  }
}

export function getPublicKeyFromPrivate(privateKey: string, compressed = true): string {
  const key = secp256k1.keyFromPrivate(privateKey.replace(/^0x/, ''), 'hex');
  return key.getPublic(compressed, 'hex');
}

export function decompressPublicKey(compressedKey: string): { x: string; y: string } | null {
  try {
    const key = secp256k1.keyFromPublic(compressedKey.replace(/^0x/, ''), 'hex');
    const pub = key.getPublic();
    return {
      x: pub.getX().toString('hex').padStart(64, '0'),
      y: pub.getY().toString('hex').padStart(64, '0'),
    };
  } catch {
    return null;
  }
}
