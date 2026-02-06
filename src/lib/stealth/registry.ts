// ERC-6538 Registry

import { ethers } from 'ethers';
import { SCHEME_ID, CANONICAL_ADDRESSES } from './types';

const REGISTRY_ABI = [
  'function registerKeys(uint256 schemeId, bytes calldata stealthMetaAddress) external',
  'function registerKeysOnBehalf(address registrant, uint256 schemeId, bytes calldata signature, bytes calldata stealthMetaAddress) external',
  'function stealthMetaAddressOf(address registrant, uint256 schemeId) external view returns (bytes)',
  'function nonceOf(address registrant) external view returns (uint256)',
];

const EIP712_DOMAIN = { name: 'ERC6538Registry', version: '1' };

const REGISTER_TYPES = {
  Erc6538RegistryEntry: [
    { name: 'schemeId', type: 'uint256' },
    { name: 'stealthMetaAddress', type: 'bytes' },
    { name: 'nonce', type: 'uint256' },
  ],
};

function toBytes(metaAddress: string): string {
  if (metaAddress.startsWith('st:')) {
    const match = metaAddress.match(/st:[a-z]+:0x([0-9a-fA-F]+)/);
    if (!match) throw new Error('Invalid stealth meta-address URI');
    return '0x' + match[1];
  }
  return metaAddress.startsWith('0x') ? metaAddress : '0x' + metaAddress;
}

export async function registerStealthMetaAddress(
  signer: ethers.Signer,
  metaAddress: string,
  schemeId = SCHEME_ID.SECP256K1,
  registryAddress = CANONICAL_ADDRESSES.registry
): Promise<string> {
  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, signer);
  const tx = await registry.registerKeys(schemeId, toBytes(metaAddress));
  const receipt = await tx.wait();
  return receipt.transactionHash;
}

export async function registerStealthMetaAddressOnBehalf(
  signer: ethers.Signer,
  registrant: string,
  metaAddress: string,
  signature: string,
  schemeId = SCHEME_ID.SECP256K1,
  registryAddress = CANONICAL_ADDRESSES.registry
): Promise<string> {
  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, signer);
  const tx = await registry.registerKeysOnBehalf(registrant, schemeId, signature, toBytes(metaAddress));
  const receipt = await tx.wait();
  return receipt.transactionHash;
}

export async function lookupStealthMetaAddress(
  provider: ethers.providers.Provider,
  address: string,
  schemeId = SCHEME_ID.SECP256K1,
  registryAddress = CANONICAL_ADDRESSES.registry
): Promise<string | null> {
  try {
    const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);
    const result = await registry.stealthMetaAddressOf(address, schemeId);
    return result && result !== '0x' && result.length > 4 ? result : null;
  } catch {
    return null;
  }
}

export async function getRegistryNonce(
  provider: ethers.providers.Provider,
  address: string,
  registryAddress = CANONICAL_ADDRESSES.registry
): Promise<ethers.BigNumber> {
  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);
  return registry.nonceOf(address);
}

export async function signRegistration(
  signer: ethers.Signer,
  metaAddress: string,
  nonce: ethers.BigNumberish,
  chainId: number,
  schemeId = SCHEME_ID.SECP256K1,
  registryAddress = CANONICAL_ADDRESSES.registry
): Promise<string> {
  const domain = { ...EIP712_DOMAIN, chainId, verifyingContract: registryAddress };
  const message = {
    schemeId,
    stealthMetaAddress: toBytes(metaAddress),
    nonce: ethers.BigNumber.from(nonce).toString(),
  };
  return (signer as ethers.providers.JsonRpcSigner)._signTypedData(domain, REGISTER_TYPES, message);
}

export async function isRegistered(
  provider: ethers.providers.Provider,
  address: string,
  schemeId = SCHEME_ID.SECP256K1,
  registryAddress = CANONICAL_ADDRESSES.registry
): Promise<boolean> {
  const result = await lookupStealthMetaAddress(provider, address, schemeId, registryAddress);
  return result !== null;
}

export function formatBytesToUri(bytes: string, chain = 'eth'): string {
  return `st:${chain}:0x${bytes.replace(/^0x/, '')}`;
}
