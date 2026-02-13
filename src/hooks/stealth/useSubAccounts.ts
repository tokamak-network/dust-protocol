// Sub-account management for EIP-7702 stealth addresses
// For 7702 addresses that were initialized (not drained), the owner can manage sub-accounts.

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAccount, useWalletClient } from 'wagmi';
import { STEALTH_SUB_ACCOUNT_7702_ABI } from '@/lib/stealth/types';
import { getChainConfig } from '@/config/chains';
import { getChainProvider } from '@/lib/providers';

interface SubAccount {
  id: number;
  delegate: string;
  dailyLimit: string;
  spentToday: string;
  active: boolean;
}

interface SubAccountState {
  initialized: boolean;
  owner: string;
  subAccounts: SubAccount[];
  loading: boolean;
  error: string | null;
}

export function useSubAccounts(stealthAddress: string | null, chainId: number) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [state, setState] = useState<SubAccountState>({
    initialized: false,
    owner: ethers.constants.AddressZero,
    subAccounts: [],
    loading: false,
    error: null,
  });

  const config = getChainConfig(chainId);
  const is7702 = config.supportsEIP7702 && !!config.contracts.subAccount7702;

  const refresh = useCallback(async () => {
    if (!stealthAddress || !is7702) return;

    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const provider = getChainProvider(chainId);
      const contract = new ethers.Contract(stealthAddress, STEALTH_SUB_ACCOUNT_7702_ABI, provider);

      const [initialized, owner, count] = await Promise.all([
        contract.initialized(),
        contract.owner(),
        contract.subAccountCount(),
      ]);

      const subs: SubAccount[] = [];
      for (let i = 0; i < count.toNumber(); i++) {
        const sub = await contract.subAccounts(i);
        subs.push({
          id: i,
          delegate: sub.delegate,
          dailyLimit: ethers.utils.formatEther(sub.dailyLimit),
          spentToday: ethers.utils.formatEther(sub.spentToday),
          active: sub.active,
        });
      }

      setState({
        initialized,
        owner,
        subAccounts: subs,
        loading: false,
        error: null,
      });
    } catch (e) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load sub-accounts',
      }));
    }
  }, [stealthAddress, chainId, is7702]);

  const createSubAccount = useCallback(async (delegate: string, dailyLimitEth: string) => {
    if (!walletClient || !stealthAddress || !address) throw new Error('Not connected');

    const provider = getChainProvider(chainId);
    const signer = new ethers.providers.Web3Provider(walletClient.transport).getSigner();
    const contract = new ethers.Contract(stealthAddress, STEALTH_SUB_ACCOUNT_7702_ABI, signer);

    const tx = await contract.createSubAccount(delegate, ethers.utils.parseEther(dailyLimitEth));
    await tx.wait();
    await refresh();
  }, [walletClient, stealthAddress, address, chainId, refresh]);

  const revokeSubAccount = useCallback(async (subId: number) => {
    if (!walletClient || !stealthAddress) throw new Error('Not connected');

    const signer = new ethers.providers.Web3Provider(walletClient.transport).getSigner();
    const contract = new ethers.Contract(stealthAddress, STEALTH_SUB_ACCOUNT_7702_ABI, signer);

    const tx = await contract.revokeSubAccount(subId);
    await tx.wait();
    await refresh();
  }, [walletClient, stealthAddress, chainId, refresh]);

  const updateLimit = useCallback(async (subId: number, newLimitEth: string) => {
    if (!walletClient || !stealthAddress) throw new Error('Not connected');

    const signer = new ethers.providers.Web3Provider(walletClient.transport).getSigner();
    const contract = new ethers.Contract(stealthAddress, STEALTH_SUB_ACCOUNT_7702_ABI, signer);

    const tx = await contract.updateSubAccountLimit(subId, ethers.utils.parseEther(newLimitEth));
    await tx.wait();
    await refresh();
  }, [walletClient, stealthAddress, chainId, refresh]);

  return {
    ...state,
    is7702,
    refresh,
    createSubAccount,
    revokeSubAccount,
    updateLimit,
  };
}
