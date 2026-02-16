'use client'

/**
 * Hook for generating ZK proofs for DustSwap
 *
 * Wraps the proof generation library with React state management
 * and progress tracking for the UI.
 */

import { useState, useCallback } from 'react'
import {
  generateProofForRelayer,
  type DepositNote,
  type MerkleProof,
  type SwapParams,
  type Groth16Proof,
  type ContractProof,
} from '@/lib/swap/zk'

export type ProofState = 'idle' | 'generating' | 'verifying' | 'success' | 'error'

interface ProofProgress {
  stage: string
  progress: number
}

export function useSwapZKProof() {
  const [state, setState] = useState<ProofState>('idle')
  const [progress, setProgress] = useState<ProofProgress>({ stage: '', progress: 0 })
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    proof: Groth16Proof
    publicSignals: string[]
    contractProof: ContractProof
  } | null>(null)

  const generateProof = useCallback(
    async (
      note: DepositNote,
      merkleProof: MerkleProof,
      swapParams: SwapParams
    ): Promise<{
      proof: Groth16Proof
      publicSignals: string[]
      contractProof: ContractProof
    } | null> => {
      setState('generating')
      setError(null)
      setProgress({ stage: 'Starting...', progress: 0 })

      try {
        const proofResult = await generateProofForRelayer(
          note,
          merkleProof,
          swapParams,
          (stage, progress) => {
            setProgress({ stage, progress })
            if (progress >= 0.9) {
              setState('verifying')
            }
          }
        )

        if (!proofResult.isValid) {
          throw new Error('Generated proof failed verification')
        }

        setState('success')
        setResult(proofResult)

        return {
          proof: proofResult.proof,
          publicSignals: proofResult.publicSignals,
          contractProof: proofResult.contractProof,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate proof'
        setError(message)
        setState('error')
        return null
      }
    },
    []
  )

  const reset = useCallback(() => {
    setState('idle')
    setProgress({ stage: '', progress: 0 })
    setError(null)
    setResult(null)
  }, [])

  return {
    state,
    progress,
    error,
    result,
    generateProof,
    reset,
    isGenerating: state === 'generating' || state === 'verifying',
    isSuccess: state === 'success',
    isError: state === 'error',
  }
}
