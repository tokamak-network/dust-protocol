// Stealth address generation (ERC-5564)

import { ec as EC } from 'elliptic';
import BN from 'bn.js';
import { ethers } from 'ethers';
import type { StealthMetaAddress, GeneratedStealthAddress } from './types';

const secp256k1 = new EC('secp256k1');

function clean(hex: string): string {
  return hex.replace(/^0x/, '');
}

function computeSharedSecret(privateKey: string, publicKey: string): string {
  const priv = secp256k1.keyFromPrivate(clean(privateKey), 'hex');
  const pub = secp256k1.keyFromPublic(clean(publicKey), 'hex');
  return priv.derive(pub.getPublic()).toString('hex').padStart(64, '0');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pubKeyToAddress(pubPoint: any): string {
  const uncompressed = pubPoint.encode('hex', false).slice(2);
  const hash = ethers.utils.keccak256('0x' + uncompressed);
  return ethers.utils.getAddress('0x' + hash.slice(-40));
}

export function generateStealthAddress(meta: StealthMetaAddress): GeneratedStealthAddress {
  const ephemeral = secp256k1.genKeyPair();
  const ephemeralPublicKey = ephemeral.getPublic(true, 'hex');

  const sharedSecret = computeSharedSecret(
    ephemeral.getPrivate('hex'),
    meta.viewingPublicKey
  );
  const secretHash = ethers.utils.keccak256('0x' + sharedSecret);
  const viewTag = secretHash.slice(2, 4);

  const spendingKey = secp256k1.keyFromPublic(meta.spendingPublicKey, 'hex');
  const hashKey = secp256k1.keyFromPrivate(secretHash.slice(2), 'hex');
  const stealthPubPoint = spendingKey.getPublic().add(hashKey.getPublic());

  return {
    stealthAddress: pubKeyToAddress(stealthPubPoint),
    ephemeralPublicKey,
    viewTag,
    stealthPublicKey: stealthPubPoint.encode('hex', true),
  };
}

export function computeStealthPrivateKey(
  spendingPrivateKey: string,
  viewingPrivateKey: string,
  ephemeralPublicKey: string
): string {
  const sharedSecret = computeSharedSecret(viewingPrivateKey, ephemeralPublicKey);
  const secretHash = ethers.utils.keccak256('0x' + sharedSecret);

  const spend = new BN(clean(spendingPrivateKey), 16);
  const hash = new BN(secretHash.slice(2), 16);
  const n = secp256k1.curve.n as BN;

  return spend.add(hash).mod(n).toString('hex').padStart(64, '0');
}

export function verifyStealthAddress(
  ephemeralPublicKey: string,
  spendingPublicKey: string,
  expectedAddress: string,
  viewingPrivateKey: string
): boolean {
  try {
    const sharedSecret = computeSharedSecret(viewingPrivateKey, ephemeralPublicKey);
    const secretHash = ethers.utils.keccak256('0x' + sharedSecret);

    const spendingKey = secp256k1.keyFromPublic(clean(spendingPublicKey), 'hex');
    const hashKey = secp256k1.keyFromPrivate(secretHash.slice(2), 'hex');
    const stealthPubPoint = spendingKey.getPublic().add(hashKey.getPublic());

    return pubKeyToAddress(stealthPubPoint).toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}

export function computeViewTag(viewingPrivateKey: string, ephemeralPublicKey: string): string {
  try {
    const sharedSecret = computeSharedSecret(viewingPrivateKey, ephemeralPublicKey);
    const hash = ethers.utils.keccak256('0x' + sharedSecret);
    return hash.slice(2, 4);
  } catch {
    return '';
  }
}

export function getAddressFromPrivateKey(privateKey: string): string {
  return new ethers.Wallet(privateKey).address;
}
