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
  originalAmount?: string;
  claimed?: boolean;
  keyMismatch?: boolean;
  autoClaiming?: boolean;
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
    // Strip transient UI state (autoClaiming) on load
    return JSON.parse(raw).map((p: StealthPayment) => ({ ...p, autoClaiming: false }));
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

// Auto-claim a single payment via sponsor-claim API
async function autoClaimPayment(
  stealthAddress: string,
  stealthPrivateKey: string,
  recipient: string,
): Promise<{ txHash: string; amount: string; gasFunded: string } | null> {
  try {
    const res = await fetch('/api/sponsor-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stealthAddress, stealthPrivateKey, recipient }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn('[AutoClaim] Failed for', stealthAddress, ':', data.error);
      return null;
    }
    console.log('[AutoClaim] Success:', stealthAddress, '→', recipient, 'amount:', data.amount, 'TON');
    return data;
  } catch (e) {
    console.warn('[AutoClaim] Error for', stealthAddress, ':', e);
    return null;
  }
}

interface UseStealthScannerOptions {
  autoClaimRecipient?: string;
}

export function useStealthScanner(stealthKeys: StealthKeyPair | null, options?: UseStealthScannerOptions) {
  const { address, isConnected } = useAccount();
  const [payments, setPayments] = useState<StealthPayment[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoClaimingRef = useRef<Set<string>>(new Set());
  const autoClaimCooldownRef = useRef<Map<string, number>>(new Map());

  const autoClaimRecipientRef = useRef(options?.autoClaimRecipient);
  autoClaimRecipientRef.current = options?.autoClaimRecipient;

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

  // Auto-claim: when new unclaimed payments appear and we have a recipient
  const tryAutoClaim = useCallback(async (newPayments: StealthPayment[]) => {
    const recipient = autoClaimRecipientRef.current;
    if (!recipient) return;

    const now = Date.now();
    const claimable = newPayments.filter(p => {
      const txHash = p.announcement.txHash;
      if (p.claimed || p.keyMismatch || parseFloat(p.balance || '0') <= 0) return false;
      if (autoClaimingRef.current.has(txHash)) return false;
      // 30-second cooldown after a failed attempt
      const lastAttempt = autoClaimCooldownRef.current.get(txHash);
      if (lastAttempt && now - lastAttempt < 30000) return false;
      return true;
    });

    if (claimable.length === 0) return;

    for (const payment of claimable) {
      const txHash = payment.announcement.txHash;
      autoClaimingRef.current.add(txHash);

      // Mark as auto-claiming in UI
      setPayments(prev => prev.map(p =>
        p.announcement.txHash === txHash ? { ...p, autoClaiming: true } : p
      ));

      // Verify key matches
      try {
        const derived = getAddressFromPrivateKey(payment.stealthPrivateKey);
        if (derived.toLowerCase() !== payment.announcement.stealthAddress.toLowerCase()) {
          console.warn('[AutoClaim] Key mismatch, skipping:', txHash);
          autoClaimingRef.current.delete(txHash);
          setPayments(prev => prev.map(p =>
            p.announcement.txHash === txHash ? { ...p, autoClaiming: false, keyMismatch: true } : p
          ));
          continue;
        }
      } catch {
        autoClaimingRef.current.delete(txHash);
        continue;
      }

      const result = await autoClaimPayment(
        payment.announcement.stealthAddress,
        payment.stealthPrivateKey,
        recipient,
      );

      if (result) {
        setPayments(prev => prev.map(p =>
          p.announcement.txHash === txHash ? { ...p, claimed: true, balance: '0', autoClaiming: false } : p
        ));
        autoClaimCooldownRef.current.delete(txHash);
      } else {
        setPayments(prev => prev.map(p =>
          p.announcement.txHash === txHash ? { ...p, autoClaiming: false } : p
        ));
        autoClaimCooldownRef.current.set(txHash, Date.now());
      }
      autoClaimingRef.current.delete(txHash);
    }
  }, []);

  const isBgScanningRef = useRef(false);

  const scan = useCallback(async (fromBlock?: number, silent = false) => {
    if (!stealthKeys || !isConnected) {
      if (!silent) setError('No stealth keys or wallet not connected');
      return;
    }

    // Use direct RPC provider for scanning — more reliable than MetaMask
    // Scanning is read-only (events + balances), no signer needed
    const provider = getThanosProvider();

    if (!silent) {
      setError(null);
      setIsScanning(true);
      setProgress({ current: 0, total: 0 });
    }

    try {
      const startBlock = fromBlock ?? DEPLOYMENT_BLOCK;
      const latestBlock = await provider.getBlockNumber();
      console.log(`[useStealthScanner] scan() called. silent=${silent}, stealthKeys present=${!!stealthKeys}, fromBlock=${startBlock}, latestBlock=${latestBlock}`);

      if (!silent) {
        const total = await getAnnouncementCount(provider, startBlock, latestBlock);
        setProgress({ current: 0, total });
      }

      const results = await scanAnnouncements(provider, stealthKeys, startBlock, latestBlock);
      console.log(`[useStealthScanner] scanAnnouncements returned ${results.length} results`);

      const enriched: StealthPayment[] = await Promise.all(
        results.map(async (r) => {
          try {
            // Query current balance AND balance at announcement block (original amount)
            const [bal, historicalBal] = await Promise.all([
              provider.getBalance(r.announcement.stealthAddress),
              provider.getBalance(r.announcement.stealthAddress, r.announcement.blockNumber),
            ]);
            const balance = ethers.utils.formatEther(bal);
            const originalAmount = ethers.utils.formatEther(historicalBal);
            return {
              ...r,
              balance,
              originalAmount,
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

      // Track which payments are new (for auto-claim)
      const newUnclaimed: StealthPayment[] = [];

      setPayments((prev) => {
        const existingMap = new Map(prev.map(p => [p.announcement.txHash, p]));

        enriched.forEach(p => {
          if (existingMap.has(p.announcement.txHash)) {
            const existing = existingMap.get(p.announcement.txHash)!;
            existingMap.set(p.announcement.txHash, {
              ...existing,
              balance: p.balance,
              // Keep original amount from first discovery (before claim drained it)
              originalAmount: existing.originalAmount || p.originalAmount,
              claimed: existing.claimed || p.claimed,
            });
          } else {
            existingMap.set(p.announcement.txHash, p);
            // New unclaimed payment — candidate for auto-claim
            if (!p.claimed && !p.keyMismatch && parseFloat(p.balance || '0') > 0) {
              newUnclaimed.push(p);
            }
          }
        });

        return Array.from(existingMap.values());
      });

      // Also check existing unclaimed (e.g., ones that failed auto-claim before)
      const allUnclaimed = enriched.filter(p =>
        !p.claimed && !p.keyMismatch && parseFloat(p.balance || '0') > 0
      );
      if (allUnclaimed.length > 0) {
        tryAutoClaim(allUnclaimed);
      }

      if (address) {
        saveLastScannedBlock(address, latestBlock);
      }

      if (!silent) {
        const total = await getAnnouncementCount(provider, startBlock, latestBlock);
        setProgress({ current: total, total });
      }
    } catch (e) {
      console.error('[useStealthScanner] Scan error:', e);
      if (!silent) setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      if (!silent) setIsScanning(false);
    }
  }, [stealthKeys, isConnected, address, tryAutoClaim]);

  const scanRef = useRef(scan);
  scanRef.current = scan;

  const scanInBackground = useCallback(() => {
    if (scanIntervalRef.current) return;
    // First scan is visible, subsequent ones are silent
    scanRef.current();
    scanIntervalRef.current = setInterval(() => {
      if (!isBgScanningRef.current) {
        isBgScanningRef.current = true;
        scanRef.current(undefined, true).finally(() => { isBgScanningRef.current = false; });
      }
    }, 3000);
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

  // Keep claimPayment for manual fallback
  const claimPayment = useCallback(async (payment: StealthPayment, recipient: string): Promise<string | null> => {
    setError(null);

    try {
      const derived = getAddressFromPrivateKey(payment.stealthPrivateKey);
      if (derived.toLowerCase() !== payment.announcement.stealthAddress.toLowerCase()) {
        throw new Error('Key mismatch - cannot claim this payment');
      }

      console.log('[Claim] Requesting sponsored withdrawal...');

      const res = await fetch('/api/sponsor-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stealthAddress: payment.announcement.stealthAddress,
          stealthPrivateKey: payment.stealthPrivateKey,
          recipient,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Withdrawal failed');
      }

      console.log('[Claim] Sponsored withdrawal complete:', data.txHash);
      console.log('[Claim] Amount:', data.amount, 'TON, Gas funded:', data.gasFunded, 'TON');

      setPayments(prev => prev.map(p =>
        p.announcement.txHash === payment.announcement.txHash ? { ...p, claimed: true, balance: '0' } : p
      ));

      return data.txHash;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Claim failed';
      setError(msg);
      return null;
    }
  }, []);

  return { payments, scan, scanInBackground, stopBackgroundScan, claimPayment, isScanning, progress, error };
}
