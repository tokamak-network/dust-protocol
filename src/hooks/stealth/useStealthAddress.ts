import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
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

// Full validation: tries formatStealthMetaAddress + parseStealthMetaAddress round-trip
function areKeysValid(keys: StealthKeyPair): boolean {
  try {
    const meta = formatStealthMetaAddress(keys, 'thanos');
    parseStealthMetaAddress(meta);
    return true;
  } catch {
    return false;
  }
}

interface ClaimAddressWithBalance extends DerivedClaimAddress {
  balance?: string;
}

const LABELS = ['Primary', 'Secondary', 'Tertiary'];
const getLabel = (i: number) => LABELS[i] || `Wallet ${i + 1}`;

export function useStealthAddress() {
  const { address, isConnected } = useAccount();
  const [isSigningMessage, setIsSigningMessage] = useState(false);

  const [stealthKeys, setStealthKeys] = useState<StealthKeyPair | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Claim addresses state (unified with stealth keys)
  const [claimAddresses, setClaimAddresses] = useState<ClaimAddressWithBalance[]>([]);
  const [selectedClaimIndex, setSelectedClaimIndex] = useState(0);
  const signatureRef = useRef<string | null>(null);

  // Derived values — safe because stealthKeys are fully validated before being set
  const metaAddress = stealthKeys ? formatStealthMetaAddress(stealthKeys, 'thanos') : null;
  const parsedMetaAddress: StealthMetaAddress | null = (() => {
    try { return metaAddress ? parseStealthMetaAddress(metaAddress) : null; }
    catch { return null; }
  })();
  const selectedClaimAddress = claimAddresses[selectedClaimIndex] || null;
  const claimAddressesInitialized = claimAddresses.length > 0;

  // Load saved keys — full round-trip validation before setting state
  useEffect(() => {
    if (!address || typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY + address.toLowerCase());
    if (stored) {
      try {
        const keys = JSON.parse(stored) as StealthKeyPair;
        if (areKeysValid(keys)) {
          setStealthKeys(keys);
        } else {
          localStorage.removeItem(STORAGE_KEY + address.toLowerCase());
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY + address.toLowerCase());
      }
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

  // Unified derivation — uses ethers.js directly (bypasses wagmi/viem chain issues)
  const deriveKeysFromWallet = useCallback(async () => {
    if (!isConnected || !address) { setError('Wallet not connected'); return; }
    setError(null);
    setIsLoading(true);
    setIsSigningMessage(true);
    try {
      const provider = getProvider();
      if (!provider) throw new Error('No wallet provider found. Is MetaMask installed?');
      const signer = provider.getSigner();

      const sig = await signer.signMessage(STEALTH_KEY_DERIVATION_MESSAGE);
      signatureRef.current = sig;
      setIsSigningMessage(false);

      // Derive stealth keys
      const newKeys = deriveStealthKeyPairFromSignature(sig);

      // Validate before setting state
      if (!areKeysValid(newKeys)) {
        throw new Error('Derived keys failed validation — please try again');
      }

      setStealthKeys(newKeys);
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
      const msg = e instanceof Error ? e.message : 'Failed to derive keys';
      if (msg.toLowerCase().includes('rejected') || msg.toLowerCase().includes('denied') || msg.includes('ACTION_REJECTED')) {
        setError('Please approve the signature request in your wallet');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
      setIsSigningMessage(false);
    }
  }, [isConnected, address, fetchBalance]);

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
    if (!areKeysValid(keys)) {
      setError('Imported keys are invalid');
      return;
    }
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
