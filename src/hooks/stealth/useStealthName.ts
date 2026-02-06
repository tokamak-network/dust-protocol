import { useState, useCallback, useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { ethers } from 'ethers';
import {
  registerStealthName, resolveStealthName, isNameAvailable, getNamesOwnedBy,
  updateNameMetaAddress, isNameRegistryConfigured, stripNameSuffix,
  formatNameWithSuffix, isValidName,
} from '@/lib/stealth';
import { l2Chain } from '@/config/network';

interface OwnedName {
  name: string;
  fullName: string;
}

function getProvider() {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  return new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider);
}

export function useStealthName() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [ownedNames, setOwnedNames] = useState<OwnedName[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = isNameRegistryConfigured();
  const isOnCorrectNetwork = chainId === l2Chain.id;

  const validateName = useCallback((name: string): { valid: boolean; error?: string } => {
    const stripped = stripNameSuffix(name);
    if (!stripped.length) return { valid: false, error: 'Name cannot be empty' };
    if (stripped.length > 32) return { valid: false, error: 'Name too long (max 32 characters)' };
    if (!isValidName(stripped)) return { valid: false, error: 'Only letters, numbers, dash (-), and underscore (_) allowed' };
    return { valid: true };
  }, []);

  const loadOwnedNames = useCallback(async () => {
    if (!isConnected || !address || !isConfigured) {
      setOwnedNames([]);
      return;
    }

    // No wallet provider needed - uses direct Thanos RPC for read-only calls
    setIsLoading(true);
    setError(null);

    try {
      const names = await getNamesOwnedBy(null as unknown as ethers.providers.Provider, address);
      setOwnedNames(names.map(name => ({ name, fullName: formatNameWithSuffix(name) })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load names');
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, isConfigured]);

  useEffect(() => {
    if (isConnected && isConfigured) loadOwnedNames();
  }, [isConnected, isConfigured, loadOwnedNames]);

  const registerName = useCallback(async (name: string, metaAddress: string): Promise<string | null> => {
    if (!isConnected || !isConfigured) {
      setError('Not connected or registry not configured');
      return null;
    }

    const validation = validateName(name);
    if (!validation.valid) {
      setError(validation.error || 'Invalid name');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Auto-switch to Thanos Sepolia if on wrong network
      if (!isOnCorrectNetwork) {
        try {
          await switchChainAsync({ chainId: l2Chain.id });
          // Wait for network switch to complete
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch {
          setError(`Please switch to ${l2Chain.name} network`);
          setIsLoading(false);
          return null;
        }
      }

      const provider = getProvider();
      if (!provider) {
        setError('No wallet provider');
        setIsLoading(false);
        return null;
      }

      const txHash = await registerStealthName(provider.getSigner(), name, metaAddress);
      await loadOwnedNames();
      return txHash;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to register name';
      // Make error more user-friendly
      if (msg.includes('execution reverted')) {
        setError('Transaction failed. Please ensure you are on Thanos Sepolia network.');
      } else {
        setError(msg);
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, isConfigured, isOnCorrectNetwork, validateName, loadOwnedNames, switchChainAsync]);

  const checkAvailability = useCallback(async (name: string): Promise<boolean | null> => {
    if (!isConfigured) {
      console.warn('[useStealthName] Name registry not configured');
      return null;
    }
    // No wallet provider needed - uses direct Thanos RPC for read-only calls
    try {
      return await isNameAvailable(null as unknown as ethers.providers.Provider, name);
    } catch (e) {
      console.error('[useStealthName] checkAvailability error:', e);
      return null;
    }
  }, [isConfigured]);

  const resolveName = useCallback(async (name: string): Promise<string | null> => {
    if (!isConfigured) return null;
    // No wallet provider needed - uses direct Thanos RPC for read-only calls
    try {
      return await resolveStealthName(null as unknown as ethers.providers.Provider, name);
    } catch {
      return null;
    }
  }, [isConfigured]);

  const updateMetaAddress = useCallback(async (name: string, newMetaAddress: string): Promise<string | null> => {
    if (!isConnected || !isConfigured) {
      setError('Not connected or registry not configured');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Auto-switch to Thanos Sepolia if on wrong network
      if (!isOnCorrectNetwork) {
        try {
          await switchChainAsync({ chainId: l2Chain.id });
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch {
          setError(`Please switch to ${l2Chain.name} network`);
          setIsLoading(false);
          return null;
        }
      }

      const provider = getProvider();
      if (!provider) {
        setError('No wallet provider');
        setIsLoading(false);
        return null;
      }

      return await updateNameMetaAddress(provider.getSigner(), name, newMetaAddress);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update meta-address');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, isConfigured, isOnCorrectNetwork, switchChainAsync]);

  return {
    ownedNames, loadOwnedNames, registerName, checkAvailability, resolveName, updateMetaAddress,
    isConfigured, formatName: formatNameWithSuffix, validateName, isLoading, error,
  };
}
