'use client'

/**
 * Hook for syncing and managing the DustSwap Merkle tree
 *
 * Syncs deposit events from on-chain, builds a local Poseidon tree,
 * persists state in IndexedDB, and auto-syncs every 30 seconds.
 */

import { useState, useEffect, useCallback } from 'react'
import { usePublicClient, useChainId } from 'wagmi'
import { MerkleTree, type MerkleProof } from '@/lib/swap/zk'
import { DUST_SWAP_POOL_ABI } from '@/lib/swap/contracts'
import { getSwapContracts, getSwapDeploymentBlock } from '@/lib/swap/constants'
import {
  saveMerkleTreeState,
  loadMerkleTreeState,
  type StoredMerkleTree,
} from '@/lib/swap/storage/merkle-tree'

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error'

type MerkleTreeInstance = InstanceType<typeof MerkleTree>

export function useSwapMerkleTree() {
  const publicClient = usePublicClient()
  const chainId = useChainId()

  const [tree, setTree] = useState<MerkleTreeInstance | null>(null)
  const [state, setState] = useState<SyncState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedBlock, setLastSyncedBlock] = useState<number>(0)
  const [leafCount, setLeafCount] = useState<number>(0)

  // Pool address for the current chain
  const contracts = getSwapContracts(chainId)
  const poolAddress = contracts.dustSwapPoolETH
  const treeId = `${chainId}-${poolAddress}`

  /**
   * Load tree from IndexedDB or create a fresh one
   */
  const loadTree = useCallback(async (): Promise<MerkleTreeInstance | null> => {
    try {
      const stored = await loadMerkleTreeState(treeId)

      if (!stored) {
        const newTree = new MerkleTree()
        await newTree.initialize()
        return newTree
      }

      const restoredTree = new MerkleTree()
      await restoredTree.importState({
        height: stored.height,
        leaves: stored.leaves,
      })

      setLastSyncedBlock(stored.lastSyncedBlock)
      setLeafCount(stored.leaves.length)

      return restoredTree
    } catch (err) {
      console.error('[DustSwap] Failed to load tree:', err)
      return null
    }
  }, [treeId])

  /**
   * Persist tree state to IndexedDB
   */
  const saveTree = useCallback(
    async (merkleTree: MerkleTreeInstance, lastBlock: number): Promise<void> => {
      try {
        const treeState = merkleTree.exportState()
        const root = merkleTree.getRoot()

        const stored: StoredMerkleTree = {
          id: treeId,
          height: treeState.height,
          leaves: treeState.leaves,
          lastSyncedBlock: lastBlock,
          lastUpdated: Date.now(),
          root: root.toString(),
        }

        await saveMerkleTreeState(stored)
        setLastSyncedBlock(lastBlock)
        setLeafCount(treeState.leaves.length)
      } catch (err) {
        console.error('[DustSwap] Failed to save tree:', err)
      }
    },
    [treeId]
  )

  /**
   * Fetch Deposit events from the DustSwapPool contract
   */
  const fetchDeposits = useCallback(
    async (fromBlock: bigint, toBlock: bigint): Promise<bigint[]> => {
      if (!publicClient || !poolAddress) return []

      try {
        const logs = await publicClient.getLogs({
          address: poolAddress as `0x${string}`,
          event: {
            type: 'event',
            name: 'Deposit',
            inputs: [
              { type: 'bytes32', name: 'commitment', indexed: true },
              { type: 'uint32', name: 'leafIndex', indexed: false },
              { type: 'address', name: 'token', indexed: true },
              { type: 'uint256', name: 'amount', indexed: false },
              { type: 'uint256', name: 'timestamp', indexed: false },
            ],
          },
          fromBlock,
          toBlock,
        })

        // Sort by leafIndex to ensure correct insertion order
        const sortedLogs = [...logs].sort((a: any, b: any) => {
          return Number(a.args.leafIndex) - Number(b.args.leafIndex)
        })

        return sortedLogs.map((log: any) => BigInt(log.args.commitment))
      } catch (err) {
        console.error('[DustSwap] Failed to fetch deposits:', err)
        return []
      }
    },
    [publicClient, poolAddress]
  )

  /**
   * Sync tree with on-chain state
   */
  const syncTree = useCallback(async (): Promise<void> => {
    if (!publicClient) {
      setError('Public client not available')
      return
    }

    setState('syncing')
    setError(null)

    try {
      let merkleTree = tree || (await loadTree())

      if (!merkleTree) {
        merkleTree = new MerkleTree()
        await merkleTree.initialize()
      }

      const currentBlock = await publicClient.getBlockNumber()
      const deploymentBlock = getSwapDeploymentBlock(chainId)

      const fromBlock =
        lastSyncedBlock > 0
          ? BigInt(lastSyncedBlock + 1)
          : BigInt(deploymentBlock ?? 0)

      const newCommitments = await fetchDeposits(fromBlock, currentBlock)

      for (const commitment of newCommitments) {
        await merkleTree.insert(commitment)
      }

      // Verify root matches on-chain
      if (poolAddress) {
        try {
          const onChainRoot = (await publicClient.readContract({
            address: poolAddress as `0x${string}`,
            abi: DUST_SWAP_POOL_ABI,
            functionName: 'getLastRoot',
            args: [],
          })) as `0x${string}`

          const computedRoot = merkleTree.getRoot()
          const onChainRootBigInt = BigInt(onChainRoot)

          if (computedRoot !== onChainRootBigInt) {
            console.warn('[DustSwap] Merkle root mismatch!', {
              computed: `0x${computedRoot.toString(16).padStart(64, '0')}`,
              onChain: onChainRoot,
            })
          }
        } catch (verifyErr) {
          console.warn('[DustSwap] Could not verify root against on-chain:', verifyErr)
        }
      }

      await saveTree(merkleTree, Number(currentBlock))

      setTree(merkleTree)
      setState('synced')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed'
      setError(message)
      setState('error')
      console.error('[DustSwap] Tree sync failed:', err)
    }
  }, [publicClient, tree, lastSyncedBlock, chainId, poolAddress, loadTree, fetchDeposits, saveTree])

  /**
   * Get Merkle proof for a given leaf index
   */
  const getProof = useCallback(
    async (leafIndex: number): Promise<MerkleProof | null> => {
      if (!tree) {
        setError('Tree not initialized')
        return null
      }

      try {
        return tree.getProof(leafIndex)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate proof'
        setError(message)
        return null
      }
    },
    [tree]
  )

  /**
   * Get current root
   */
  const getRoot = useCallback(async (): Promise<bigint | null> => {
    if (!tree) return null
    try {
      return tree.getRoot()
    } catch {
      return null
    }
  }, [tree])

  /**
   * Check if tree needs syncing
   */
  const needsSync = useCallback(async (): Promise<boolean> => {
    if (!publicClient) return false
    try {
      const currentBlock = await publicClient.getBlockNumber()
      return Number(currentBlock) > lastSyncedBlock
    } catch {
      return false
    }
  }, [publicClient, lastSyncedBlock])

  /**
   * Force refresh (clear cache and resync)
   */
  const forceRefresh = useCallback(async (): Promise<void> => {
    setLastSyncedBlock(0)
    setTree(null)
    await syncTree()
  }, [syncTree])

  // Auto-load tree on mount
  useEffect(() => {
    loadTree().then((loadedTree) => {
      if (loadedTree) {
        setTree(loadedTree)
        setState('synced')
      }
    })
  }, [loadTree])

  // Auto-sync every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      needsSync().then((needs) => {
        if (needs && state !== 'syncing') {
          syncTree()
        }
      })
    }, 30000)

    return () => clearInterval(interval)
  }, [syncTree, needsSync, state])

  return {
    tree,
    state,
    error,
    lastSyncedBlock,
    leafCount,
    syncTree,
    getProof,
    getRoot,
    needsSync,
    forceRefresh,
    isSyncing: state === 'syncing',
    isSynced: state === 'synced',
    isError: state === 'error',
  }
}
