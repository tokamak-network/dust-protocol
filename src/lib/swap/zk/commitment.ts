/**
 * Commitment utilities for DustSwap ZK proofs
 *
 * Reuses Dust's existing Poseidon implementation (circomlibjs)
 * Browser-compatible — no Node.js crypto dependency
 */

import {
  poseidon2,
  computeCommitment as dustComputeCommitment,
  computeNullifierHash as dustComputeNullifierHash,
  toBytes32Hex,
  fromBytes32Hex,
} from '@/lib/dustpool/poseidon'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DepositNote {
  nullifier: bigint
  secret: bigint
  amount: bigint
  commitment: bigint
  nullifierHash: bigint
  leafIndex?: number
}

export interface MerkleProof {
  pathElements: bigint[]
  pathIndices: number[]
  root: bigint
}

export interface Groth16Proof {
  pi_a: string[]
  pi_b: string[][]
  pi_c: string[]
  protocol?: string
  curve?: string
}

export interface ContractProof {
  pA: [string, string]
  pB: [[string, string], [string, string]]
  pC: [string, string]
  pubSignals: string[]
}

// ─── Poseidon re-exports ────────────────────────────────────────────────────

export { poseidon2 as poseidonHash }

export const computeCommitment = dustComputeCommitment
export const computeNullifierHash = dustComputeNullifierHash

/**
 * Format commitment as 0x-prefixed bytes32 hex for contract calls
 */
export function formatCommitmentForContract(commitment: bigint): string {
  return toBytes32Hex(commitment)
}

// ─── Random value generation ────────────────────────────────────────────────

/**
 * Generate random 256-bit value using Web Crypto API
 */
export function randomBigInt(): bigint {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return BigInt(
    '0x' +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
  )
}

// ─── Note creation ──────────────────────────────────────────────────────────

/**
 * Create a new deposit note for DustSwap pools
 */
export async function createDepositNote(amount: bigint): Promise<DepositNote> {
  const nullifier = randomBigInt()
  const secret = randomBigInt()

  const commitment = await computeCommitment(nullifier, secret, amount)
  const nullifierHash = await computeNullifierHash(nullifier)

  return {
    nullifier,
    secret,
    amount,
    commitment,
    nullifierHash,
  }
}

// ─── Serialization ──────────────────────────────────────────────────────────

/**
 * Serialize a deposit note to a portable string
 */
export function serializeNote(note: DepositNote): string {
  return JSON.stringify({
    nullifier: note.nullifier.toString(),
    secret: note.secret.toString(),
    amount: note.amount.toString(),
    commitment: note.commitment.toString(),
    nullifierHash: note.nullifierHash.toString(),
    leafIndex: note.leafIndex,
  })
}

/**
 * Deserialize a deposit note from a string
 */
export function deserializeNote(serialized: string): DepositNote {
  const data = JSON.parse(serialized)
  return {
    nullifier: BigInt(data.nullifier),
    secret: BigInt(data.secret),
    amount: BigInt(data.amount),
    commitment: BigInt(data.commitment),
    nullifierHash: BigInt(data.nullifierHash),
    leafIndex: data.leafIndex,
  }
}
