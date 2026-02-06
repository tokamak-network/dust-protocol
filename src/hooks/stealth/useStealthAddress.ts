import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ethers } from 'ethers';
import {
  generateStealthKeyPair, deriveStealthKeyPairFromSignature, formatStealthMetaAddress,
  parseStealthMetaAddress, registerStealthMetaAddress, lookupStealthMetaAddress,
  isRegistered as checkIsRegistered, STEALTH_KEY_DERIVATION_MESSAGE,
  type StealthKeyPair, type StealthMetaAddress,
  deriveClaimAddresses, saveClaimAddressesToStorage, loadClaimAddressesFromStorage,
  type DerivedClaimAddress,
} from '@/lib/stealth';

const STORAGE_KEY = 'tokamak_stealth_keys_';

function getProvider() {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  return new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider);
}

interface ClaimAddressWithBalance extends DerivedClaimAddress {
  balance?: string;
}

const LABELS = ['Primary', 'Secondary', 'Tertiary'];
const getLabel = (i: number) => LABELS[i] || `Wallet ${i + 1}`;

export function useStealthAddress() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync, isPending: isSigningMessage } = useSignMessage();

  const [stealthKeys, setStealthKeys] = useState<StealthKeyPair | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Claim addresses state (unified with stealth keys)
  const [claimAddresses, setClaimAddresses] = useState<ClaimAddressWithBalance[]>([]);
  const [selectedClaimIndex, setSelectedClaimIndex] = useState(0);
  const signatureRef = useRef<string | null>(null);

  const metaAddress = stealthKeys ? formatStealthMetaAddress(stealthKeys, 'thanos') : null;
  const parsedMetaAddress: StealthMetaAddress | null = metaAddress ? parseStealthMetaAddress(metaAddress) : null;
  const selectedClaimAddress = claimAddresses[selectedClaimIndex] || null;
  const claimAddressesInitialized = claimAddresses.length > 0;

  // Load saved keys
  useEffect(() => {
    if (!address || typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY + address.toLowerCase());
    if (stored) {
      try { setStealthKeys(JSON.parse(stored)); } catch { /* ignore */ }
    }
    // Load claim addresses metadata
    const savedClaims = loadClaimAddressesFromStorage(address);
    if (savedClaims.length > 0) {
      setClaimAddresses(savedClaims.map(a => ({ ...a, privateKey: '' })) as ClaimAddressWithBalance[]);
    }
  }, [address]);

  // Save keys when changed
  useEffect(() => {
    if (address && stealthKeys && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY + address.toLowerCase(), JSON.stringify(stealthKeys));
    }
  }, [address, stealthKeys]);

  const fetchBalance = useCallback(async (addr: string): Promise<string> => {
    const provider = getProvider();
    if (!provider) return '0';
    try {
      const bal = await provider.getBalance(addr);
      return ethers.utils.formatEther(bal);
    } catch {
      return '0';
    }
  }, []);

  const generateKeys = useCallback(() => {
    setError(null);
    setStealthKeys(generateStealthKeyPair());
    setIsRegistered(false);
  }, []);

  // Unified derivation - derives BOTH stealth keys AND claim addresses
  const deriveKeysFromWallet = useCallback(async () => {
    if (!isConnected || !address) { setError('Wallet not connected'); return; }
    setError(null);
    setIsLoading(true);
    try {
      const sig = await signMessageAsync({ message: STEALTH_KEY_DERIVATION_MESSAGE });
      signatureRef.current = sig;

      // Derive stealth keys
      setStealthKeys(deriveStealthKeyPairFromSignature(sig));
      setIsRegistered(false);

      // Derive claim addresses from same signature
      const stored = loadClaimAddressesFromStorage(address);
      const derived = deriveClaimAddresses(sig, 3);
      const withLabels: ClaimAddressWithBalance[] = derived.map(a => ({
        ...a,
        label: stored.find(s => s.address.toLowerCase() === a.address.toLowerCase())?.label || getLabel(a.index),
      }));

      setClaimAddresses(withLabels);
      saveClaimAddressesToStorage(address, withLabels);

      // Fetch balances
      const balances = await Promise.all(withLabels.map(a => fetchBalance(a.address)));
      setClaimAddresses(prev => prev.map((a, i) => ({ ...a, balance: balances[i] })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to derive keys');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, signMessageAsync, fetchBalance]);

  const clearKeys = useCallback(() => {
    setStealthKeys(null);
    setIsRegistered(false);
    setError(null);
    setClaimAddresses([]);
    signatureRef.current = null;
    if (address && typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY + address.toLowerCase());
    }
  }, [address]);

  const importKeys = useCallback((keys: StealthKeyPair) => {
    setStealthKeys(keys);
    setIsRegistered(false);
    setError(null);
  }, []);

  const exportKeys = useCallback(() => stealthKeys, [stealthKeys]);

  const registerMetaAddress = useCallback(async (): Promise<string | null> => {
    if (!metaAddress || !isConnected) { setError('No keys or wallet not connected'); return null; }
    setError(null);
    setIsLoading(true);
    try {
      const provider = getProvider();
      if (!provider) throw new Error('No wallet provider');
      const txHash = await registerStealthMetaAddress(provider.getSigner(), metaAddress);
      setIsRegistered(true);
      return txHash;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to register');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [metaAddress, isConnected]);

  const checkRegistration = useCallback(async (): Promise<boolean> => {
    if (!address || !isConnected) return false;
    setIsLoading(true);
    try {
      const provider = getProvider();
      if (!provider) return false;
      const registered = await checkIsRegistered(provider, address);
      setIsRegistered(registered);
      return registered;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  const lookupAddress = useCallback(async (addr: string): Promise<string | null> => {
    setIsLoading(true);
    try {
      const provider = getProvider();
      return provider ? await lookupStealthMetaAddress(provider, addr) : null;
    } catch {
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectClaimAddress = useCallback((index: number) => {
    if (index >= 0 && index < claimAddresses.length) setSelectedClaimIndex(index);
  }, [claimAddresses.length]);

  const refreshClaimBalances = useCallback(async () => {
    if (!claimAddresses.length) return;
    const balances = await Promise.all(claimAddresses.map(a => fetchBalance(a.address)));
    setClaimAddresses(prev => prev.map((a, i) => ({ ...a, balance: balances[i] })));
  }, [claimAddresses, fetchBalance]);

  // Reset on address change
  useEffect(() => {
    setClaimAddresses([]);
    setSelectedClaimIndex(0);
    signatureRef.current = null;
  }, [address]);

  return {
    stealthKeys, metaAddress, parsedMetaAddress,
    generateKeys, deriveKeysFromWallet, clearKeys, importKeys, exportKeys,
    registerMetaAddress, isRegistered, checkRegistration, lookupAddress,
    isLoading, isSigningMessage, error,
    // Claim addresses (unified)
    claimAddresses, selectedClaimAddress, selectedClaimIndex, claimAddressesInitialized,
    selectClaimAddress, refreshClaimBalances,
  };
}
