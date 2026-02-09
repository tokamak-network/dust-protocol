import { useState, useEffect, useRef, useCallback } from 'react';
import { ethers } from 'ethers';

const THANOS_RPC = 'https://rpc.thanos-sepolia.tokamak.network';
const POLL_INTERVAL_MS = 3000;

function getReadOnlyProvider() {
  return new ethers.providers.JsonRpcProvider(THANOS_RPC);
}

interface BalancePollerResult {
  balance: string;
  hasDeposit: boolean;
  depositAmount: string;
  isPolling: boolean;
}

export function useBalancePoller(address: string | null): BalancePollerResult {
  const [balance, setBalance] = useState('0');
  const [hasDeposit, setHasDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('0');
  const [isPolling, setIsPolling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);

  const stopPolling = useCallback(() => {
    stoppedRef.current = true;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!address || !ethers.utils.isAddress(address)) return;

    stoppedRef.current = false;
    setIsPolling(true);
    setHasDeposit(false);
    setBalance('0');
    setDepositAmount('0');

    const provider = getReadOnlyProvider();

    const poll = async () => {
      if (stoppedRef.current) return;
      try {
        const bal = await provider.getBalance(address);
        if (stoppedRef.current) return; // unmounted during await
        const formatted = ethers.utils.formatEther(bal);
        setBalance(formatted);

        if (bal.gt(0)) {
          setHasDeposit(true);
          setDepositAmount(formatted);
          stopPolling();
        }
      } catch (err) {
        if (!stoppedRef.current) {
          console.warn('[useBalancePoller] RPC error:', err);
        }
      }
    };

    // Initial poll immediately
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      stopPolling();
    };
  }, [address, stopPolling]);

  return { balance, hasDeposit, depositAmount, isPolling };
}
