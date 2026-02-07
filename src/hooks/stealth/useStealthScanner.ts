import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import {
  scanAnnouncements, setLastScannedBlock as saveLastScannedBlock,
  getAnnouncementCount, getAddressFromPrivateKey, type StealthKeyPair, type ScanResult,
  DEPLOYMENT_BLOCK,
} from '@/lib/stealth';

interface StealthPayment extends ScanResult {
  balance?: string;
  claimed?: boolean;
  keyMismatch?: boolean;
}

// Thanos Sepolia RPC for reliable fee estimation
const THANOS_RPC = 'https://rpc.thanos-sepolia.tokamak.network';

// localStorage keys
const PAYMENTS_STORAGE_KEY = 'stealth_payments_';

function getProvider() {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  return new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider);
}

// Direct RPC provider for accurate fee data (bypasses MetaMask network issues)
function getThanosProvider() {
  return new ethers.providers.JsonRpcProvider(THANOS_RPC);
}

function loadPaymentsFromStorage(address: string): StealthPayment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PAYMENTS_STORAGE_KEY + address.toLowerCase());
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function savePaymentsToStorage(address: string, payments: StealthPayment[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PAYMENTS_STORAGE_KEY + address.toLowerCase(), JSON.stringify(payments));
  } catch { /* quota exceeded etc */ }
}

export function useStealthScanner(stealthKeys: StealthKeyPair | null) {
  const { address, isConnected } = useAccount();
  const [payments, setPayments] = useState<StealthPayment[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load persisted payments on mount / address change
  useEffect(() => {
    if (address) {
      const stored = loadPaymentsFromStorage(address);
      if (stored.length > 0) {
        setPayments(stored);
      }
    }
  }, [address]);

  // Persist payments whenever they change
  useEffect(() => {
    if (address && payments.length > 0) {
      savePaymentsToStorage(address, payments);
    }
  }, [address, payments]);

  const scan = useCallback(async (fromBlock?: number) => {
    if (!stealthKeys || !isConnected) {
      setError('No stealth keys or wallet not connected');
      return;
    }

    const provider = getProvider();
    if (!provider) { setError('No wallet provider'); return; }

    setError(null);
    setIsScanning(true);
    setProgress({ current: 0, total: 0 });

    try {
      // Always scan from deployment block to catch all historical announcements.
      // This is essential because payments are tied to the stealth keys, and we
      // need to find ALL announcements ever made, not just recent ones.
      const startBlock = fromBlock ?? DEPLOYMENT_BLOCK;
      const latestBlock = await provider.getBlockNumber();
      const total = await getAnnouncementCount(provider, startBlock, latestBlock);
      setProgress({ current: 0, total });

      const results = await scanAnnouncements(provider, stealthKeys, startBlock, latestBlock);

      const enriched: StealthPayment[] = await Promise.all(
        results.map(async (r) => {
          try {
            const bal = await provider.getBalance(r.announcement.stealthAddress);
            const balance = ethers.utils.formatEther(bal);
            return {
              ...r,
              balance,
              claimed: parseFloat(balance) === 0,
              keyMismatch: r.privateKeyVerified === false,
            };
          } catch {
            return {
              ...r,
              balance: '0',
              claimed: false,
              keyMismatch: r.privateKeyVerified === false,
            };
          }
        })
      );

      setPayments((prev) => {
        const existingMap = new Map(prev.map(p => [p.announcement.txHash, p]));

        // Merge: update existing payments with fresh data, add new ones
        enriched.forEach(p => {
          if (existingMap.has(p.announcement.txHash)) {
            const existing = existingMap.get(p.announcement.txHash)!;
            existingMap.set(p.announcement.txHash, {
              ...existing,
              balance: p.balance,
              claimed: existing.claimed || p.claimed,
            });
          } else {
            existingMap.set(p.announcement.txHash, p);
          }
        });

        return Array.from(existingMap.values());
      });

      if (address) {
        saveLastScannedBlock(address, latestBlock);
      }

      setProgress({ current: total, total });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setIsScanning(false);
    }
  }, [stealthKeys, isConnected, address]);

  const scanRef = useRef(scan);
  scanRef.current = scan;

  const scanInBackground = useCallback(() => {
    if (scanIntervalRef.current) return;
    scanRef.current();
    scanIntervalRef.current = setInterval(() => scanRef.current(), 30000);
  }, []);

  const stopBackgroundScan = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  }, []);

  const claimPayment = useCallback(async (payment: StealthPayment, recipient: string): Promise<string | null> => {
    setError(null);

    // Retry logic for transient network errors
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Use direct Thanos RPC for the wallet - bypasses MetaMask network issues entirely
        const thanosProvider = getThanosProvider();
        const wallet = new ethers.Wallet(payment.stealthPrivateKey, thanosProvider);
        const derived = getAddressFromPrivateKey(payment.stealthPrivateKey);

        if (derived.toLowerCase() !== payment.announcement.stealthAddress.toLowerCase()) {
          throw new Error('Key mismatch - cannot claim this payment');
        }

        // Get fresh balance right before calculating send amount
        const balance = await thanosProvider.getBalance(payment.announcement.stealthAddress);
        if (balance.isZero()) throw new Error('No funds to claim');

        // Get current fee data from Thanos network
        const feeData = await thanosProvider.getFeeData();
        const block = await thanosProvider.getBlock('latest');

        // Calculate EIP-1559 gas parameters
        const baseFee = block.baseFeePerGas || feeData.gasPrice || ethers.utils.parseUnits('1', 'gwei');
        const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('1.5', 'gwei');

        // maxFeePerGas = max(2x baseFee, 1.2x (baseFee + priorityFee))
        const twoXBaseFee = baseFee.mul(2);
        const basePlusPriority = baseFee.add(maxPriorityFeePerGas).mul(12).div(10);
        const maxFeePerGas = twoXBaseFee.gt(basePlusPriority) ? twoXBaseFee : basePlusPriority;

        console.log('[Claim] Attempt', attempt + 1, '- Balance:', ethers.utils.formatEther(balance), 'TON');
        console.log('[Claim] MaxFeePerGas:', ethers.utils.formatUnits(maxFeePerGas, 'gwei'), 'gwei');

        // Gas limit for simple ETH transfer
        const gasLimit = ethers.BigNumber.from(21000);
        const maxGasCost = gasLimit.mul(maxFeePerGas);

        // Add 5% safety buffer to gas cost to handle RPC timing differences
        const safetyBuffer = maxGasCost.mul(5).div(100);
        const sendAmount = balance.sub(maxGasCost).sub(safetyBuffer);

        console.log('[Claim] MaxGasCost:', ethers.utils.formatEther(maxGasCost), 'TON');
        console.log('[Claim] SendAmount:', ethers.utils.formatEther(sendAmount), 'TON');

        if (sendAmount.lte(0)) {
          const minRequired = ethers.utils.formatEther(maxGasCost);
          throw new Error(`Balance too low for gas. Need at least ${parseFloat(minRequired).toFixed(6)} TON.`);
        }

        // Re-check balance hasn't changed before sending (TOCTOU protection)
        const balanceBeforeSend = await thanosProvider.getBalance(payment.announcement.stealthAddress);
        if (!balanceBeforeSend.eq(balance)) {
          console.warn('[Claim] Balance changed, recalculating...');
          continue; // Retry with new balance
        }

        // Send transaction with explicit EIP-1559 params
        const tx = await wallet.sendTransaction({
          to: recipient,
          value: sendAmount,
          gasLimit,
          maxFeePerGas,
          maxPriorityFeePerGas,
          type: 2,
        });

        // Wait for receipt with timeout
        const receipt = await Promise.race([
          tx.wait(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Transaction timeout - check explorer')), 60000)
          )
        ]);

        setPayments(prev => prev.map(p =>
          p.announcement.txHash === payment.announcement.txHash ? { ...p, claimed: true, balance: '0' } : p
        ));

        return receipt.transactionHash;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error('Claim failed');
        const msg = lastError.message.toLowerCase();

        // Don't retry on permanent errors
        if (msg.includes('key mismatch') || msg.includes('balance too low') || msg.includes('no funds')) {
          break;
        }

        // Retry on transient network errors
        if (attempt < maxRetries - 1 && (msg.includes('timeout') || msg.includes('network') || msg.includes('nonce'))) {
          console.warn(`[Claim] Retry ${attempt + 1}/${maxRetries}:`, lastError.message);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }

        break;
      }
    }

    const msg = lastError?.message || 'Claim failed';
    setError(msg);
    return null;
  }, []);

  return { payments, scan, scanInBackground, stopBackgroundScan, claimPayment, isScanning, progress, error };
}
