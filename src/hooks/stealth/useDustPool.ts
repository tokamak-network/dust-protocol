import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import {
  loadDeposits,
  saveDeposits,
  storedToDepositData,
  buildTreeFromEvents,
  generateWithdrawProof,
  toBytes32Hex,
  type StoredDeposit,
} from '@/lib/dustpool';
import { getChainConfig, DEFAULT_CHAIN_ID } from '@/config/chains';
import { getChainProvider } from '@/lib/providers';

export interface ConsolidateProgress {
  phase: 'idle' | 'loading' | 'proving' | 'submitting' | 'done' | 'error';
  current: number;
  total: number;
  message: string;
}

export function useDustPool(chainId?: number) {
  const activeChainId = chainId ?? DEFAULT_CHAIN_ID;
  const config = getChainConfig(activeChainId);
  const dustPoolAddress = config.contracts.dustPool;
  const dustPoolDeploymentBlock = config.dustPoolDeploymentBlock;
  const hasDustPool = !!dustPoolAddress && !!dustPoolDeploymentBlock;
  const { address } = useAccount();
  const [deposits, setDeposits] = useState<StoredDeposit[]>([]);
  const [poolBalance, setPoolBalance] = useState('0');
  const [progress, setProgress] = useState<ConsolidateProgress>({
    phase: 'idle', current: 0, total: 0, message: '',
  });
  const isConsolidatingRef = useRef(false);

  // Load deposits from storage
  const loadPoolDeposits = useCallback(() => {
    if (!address) return;
    const stored = loadDeposits(address, activeChainId);
    setDeposits(stored);

    // Calculate pool balance from unwithdrawable deposits
    const total = stored
      .filter(d => !d.withdrawn)
      .reduce((sum, d) => sum + BigInt(d.amount), BigInt(0));
    setPoolBalance(ethers.utils.formatEther(total));
  }, [address, activeChainId]);

  useEffect(() => {
    loadPoolDeposits();
  }, [loadPoolDeposits]);

  // Consolidate: generate proofs for all unwithdrawable deposits, submit withdrawals
  const consolidate = useCallback(async (freshRecipient: string) => {
    if (!address || isConsolidatingRef.current || !hasDustPool) return;

    isConsolidatingRef.current = true;
    const unwithdrawn = deposits.filter(d => !d.withdrawn);

    if (unwithdrawn.length === 0) {
      setProgress({ phase: 'error', current: 0, total: 0, message: 'No deposits to withdraw' });
      isConsolidatingRef.current = false;
      return;
    }

    try {
      setProgress({
        phase: 'loading', current: 0, total: unwithdrawn.length,
        message: 'Rebuilding Merkle tree from on-chain events...',
      });

      const provider = getChainProvider(activeChainId);
      const { tree } = await buildTreeFromEvents(
        provider,
        dustPoolAddress!,
        dustPoolDeploymentBlock!,
      );

      if (process.env.NODE_ENV === 'development') {
        console.log('[DustPool] Tree rebuilt with', tree.leafCount, 'leaves, root:', toBytes32Hex(tree.root));
      }

      // Reconcile: remove phantom deposits that don't exist on-chain
      // (e.g. from previous failed server transactions that saved to localStorage)
      const onChainCommitments = new Set<string>();
      for (let li = 0; li < tree.leafCount; li++) {
        const leaf = tree.getLeaf(li);
        if (leaf !== undefined) onChainCommitments.add(toBytes32Hex(leaf));
      }

      const validDeposits: StoredDeposit[] = [];
      const phantomDeposits: StoredDeposit[] = [];
      for (const stored of unwithdrawn) {
        if (onChainCommitments.has(stored.commitment)) {
          validDeposits.push(stored);
        } else {
          phantomDeposits.push(stored);
        }
      }

      if (phantomDeposits.length > 0) {
        console.warn(`[DustPool] Pruning ${phantomDeposits.length} phantom deposit(s) not found on-chain`);
        // Remove phantom deposits from storage
        const allDeposits = loadDeposits(address, activeChainId);
        const phantomCommitments = new Set(phantomDeposits.map(d => d.commitment));
        const cleaned = allDeposits.filter(d => !phantomCommitments.has(d.commitment));
        saveDeposits(address, cleaned, activeChainId);
      }

      if (validDeposits.length === 0) {
        // Refresh state after pruning
        loadPoolDeposits();
        setProgress({
          phase: 'done', current: 0, total: 0,
          message: phantomDeposits.length > 0
            ? `Cleaned ${phantomDeposits.length} invalid deposit(s). No valid deposits to withdraw.`
            : 'No deposits to withdraw',
        });
        isConsolidatingRef.current = false;
        return;
      }

      const txHashes: string[] = [];

      for (let i = 0; i < validDeposits.length; i++) {
        const stored = validDeposits[i];
        const depositData = storedToDepositData(stored);

        // Find the actual on-chain leafIndex for this commitment
        // (stored leafIndex may be wrong if from a failed/retried deposit)
        let actualLeafIndex = -1;
        for (let li = 0; li < tree.leafCount; li++) {
          const leaf = tree.getLeaf(li);
          if (leaf !== undefined && toBytes32Hex(leaf) === stored.commitment) {
            actualLeafIndex = li;
            break;
          }
        }

        if (actualLeafIndex === -1) {
          console.error(`[DustPool] Commitment not found in tree despite reconciliation check`);
          continue;
        }

        if (actualLeafIndex !== stored.leafIndex) {
          console.warn(`[DustPool] Correcting leafIndex: stored=${stored.leafIndex}, actual=${actualLeafIndex}`);
          stored.leafIndex = actualLeafIndex;
        }

        // Phase 2: Generate ZK proof
        setProgress({
          phase: 'proving', current: i + 1, total: validDeposits.length,
          message: `Generating proof ${i + 1}/${validDeposits.length}...`,
        });

        const merkleProof = tree.getProof(actualLeafIndex);
        const withdrawProof = await generateWithdrawProof(
          depositData,
          merkleProof,
          freshRecipient,
        );

        // Phase 3: Submit withdrawal
        setProgress({
          phase: 'submitting', current: i + 1, total: validDeposits.length,
          message: `Submitting withdrawal ${i + 1}/${validDeposits.length}...`,
        });

        const res = await fetch('/api/pool-withdraw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proof: withdrawProof.proof,
            root: withdrawProof.root,
            nullifierHash: withdrawProof.nullifierHash,
            recipient: freshRecipient,
            amount: withdrawProof.amount,
            chainId: activeChainId,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Withdrawal failed');
        }

        txHashes.push(data.txHash);

        // Mark as withdrawn in storage
        stored.withdrawn = true;
      }

      // Save updated deposits (mark withdrawn + remove phantoms)
      const remainingDeposits = loadDeposits(address, activeChainId);
      for (const stored of validDeposits) {
        const idx = remainingDeposits.findIndex(d => d.commitment === stored.commitment);
        if (idx >= 0) remainingDeposits[idx].withdrawn = true;
      }
      saveDeposits(address, remainingDeposits, activeChainId);
      setDeposits(remainingDeposits);

      const totalAmount = validDeposits.reduce((sum, d) => sum + BigInt(d.amount), BigInt(0));
      setPoolBalance('0');

      setProgress({
        phase: 'done', current: validDeposits.length, total: validDeposits.length,
        message: `Withdrew ${ethers.utils.formatEther(totalAmount)} ${config.nativeCurrency.symbol} to ${freshRecipient.slice(0, 8)}...`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Withdrawal failed';
      setProgress({
        phase: 'error', current: 0, total: 0,
        message: msg,
      });
    } finally {
      isConsolidatingRef.current = false;
    }
  }, [address, deposits, activeChainId, hasDustPool, dustPoolAddress, dustPoolDeploymentBlock, config.nativeCurrency.symbol, loadPoolDeposits]);

  const resetProgress = useCallback(() => {
    setProgress({ phase: 'idle', current: 0, total: 0, message: '' });
  }, []);

  return {
    deposits,
    poolBalance,
    progress,
    consolidate,
    resetProgress,
    loadPoolDeposits,
    hasDustPool,
    isConsolidating: progress.phase === 'proving' || progress.phase === 'submitting' || progress.phase === 'loading',
  };
}
