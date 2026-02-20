// V2 DustPool proof input builders
//
// Each builder assembles the public and private signals for the V2 UTXO circuit.
// The circuit enforces:
//   sum(input amounts) + publicAmount == sum(output amounts)
//   each input nullifier is correctly derived
//   each output commitment is correctly derived
//   Merkle proofs are valid for input notes

import { BN254_FIELD_SIZE, TREE_DEPTH } from './constants'
import { computeNoteCommitment } from './commitment'
import { computeNullifier } from './nullifier'
import { createDummyNote, createNote } from './note'
import type { NoteCommitmentV2, NoteV2, ProofInputs, V2Keys } from './types'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Dummy Merkle proof (all zeros, depth = TREE_DEPTH) */
function dummyMerkleProof(): { pathElements: bigint[]; pathIndices: number[] } {
  return {
    pathElements: new Array<bigint>(TREE_DEPTH).fill(0n),
    pathIndices: new Array<number>(TREE_DEPTH).fill(0),
  }
}

/** Convert an Ethereum address to bigint (for the recipient public signal) */
function addressToBigInt(address: string): bigint {
  return BigInt(address)
}

// ── Deposit ──────────────────────────────────────────────────────────────────

/**
 * Build circuit inputs for a deposit operation.
 *
 * - Both input notes are dummy (no notes consumed).
 * - Output 0 is the real note being created; output 1 is dummy.
 * - publicAmount = deposit amount (positive, added to the pool).
 * - No Merkle proof needed (inputs are dummy).
 */
export async function buildDepositInputs(
  note: NoteV2,
  keys: V2Keys
): Promise<ProofInputs> {
  const dummy = createDummyNote()
  const dummyProof = dummyMerkleProof()

  // Circuit constraint: isDummy * nullifier === 0, so dummy nullifiers must be 0
  const nullifier0 = 0n
  const nullifier1 = 0n

  // Output commitments
  const outputCommitment0 = await computeNoteCommitment(note)
  const dummyOutputCommitment = await computeNoteCommitment(dummy)

  return {
    // Public
    merkleRoot: 0n, // No tree state needed for deposit
    nullifier0,
    nullifier1,
    outputCommitment0,
    outputCommitment1: dummyOutputCommitment,
    publicAmount: note.amount,
    publicAsset: note.asset,
    recipient: 0n, // No recipient for deposits

    // Private — input notes (both dummy)
    inOwner: [dummy.owner, dummy.owner],
    inAmount: [dummy.amount, dummy.amount],
    inAsset: [dummy.asset, dummy.asset],
    inChainId: [BigInt(dummy.chainId), BigInt(dummy.chainId)],
    inBlinding: [dummy.blinding, dummy.blinding],
    pathElements: [dummyProof.pathElements, dummyProof.pathElements],
    pathIndices: [dummyProof.pathIndices, dummyProof.pathIndices],
    leafIndex: [0n, 0n],

    // Private — output notes
    outOwner: [note.owner, dummy.owner],
    outAmount: [note.amount, dummy.amount],
    outAsset: [note.asset, dummy.asset],
    outChainId: [BigInt(note.chainId), BigInt(dummy.chainId)],
    outBlinding: [note.blinding, dummy.blinding],

    // Keys
    spendingKey: keys.spendingKey,
    nullifierKey: keys.nullifierKey,
  }
}

// ── Withdraw ─────────────────────────────────────────────────────────────────

/**
 * Build circuit inputs for a withdrawal operation.
 *
 * - Input 0 is the note being consumed; input 1 is dummy.
 * - Output 0 is the change note (if any); output 1 is dummy.
 * - publicAmount = field-negative withdrawal amount (FIELD_SIZE - amount).
 * - recipient = Ethereum address of the withdrawal target.
 */
export async function buildWithdrawInputs(
  inputNote: NoteCommitmentV2,
  amount: bigint,
  recipient: string,
  keys: V2Keys,
  merkleProof: { pathElements: bigint[]; pathIndices: number[] },
  changeNote?: NoteV2
): Promise<ProofInputs> {
  if (amount > inputNote.note.amount) {
    throw new Error(
      `Withdrawal amount (${amount}) exceeds note balance (${inputNote.note.amount})`
    )
  }

  const dummy = createDummyNote()
  const dummyProof = dummyMerkleProof()

  // Compute change
  const changeAmount = inputNote.note.amount - amount
  const resolvedChange =
    changeNote ??
    (changeAmount > 0n
      ? createNote(
          inputNote.note.owner,
          changeAmount,
          inputNote.note.asset,
          inputNote.note.chainId
        )
      : createDummyNote())

  // Nullifiers
  const nullifier0 = await computeNullifier(
    keys.nullifierKey,
    inputNote.commitment,
    inputNote.leafIndex
  )
  // Circuit constraint: isDummy * nullifier === 0, so dummy nullifier must be 0
  const nullifier1 = 0n

  // Output commitments
  const outputCommitment0 = await computeNoteCommitment(resolvedChange)
  const dummyOutputCommitment = await computeNoteCommitment(dummy)

  // Negative amount in field arithmetic: FIELD_SIZE - amount represents -amount
  const negativeAmount = BN254_FIELD_SIZE - amount

  const { poseidonHash } = await import('./commitment')
  let currentHash = inputNote.commitment
  for (let i = 0; i < TREE_DEPTH; i++) {
    if (merkleProof.pathIndices[i] === 0) {
      currentHash = await poseidonHash([currentHash, merkleProof.pathElements[i]])
    } else {
      currentHash = await poseidonHash([merkleProof.pathElements[i], currentHash])
    }
  }
  const merkleRoot = currentHash

  return {
    // Public
    merkleRoot,
    nullifier0,
    nullifier1,
    outputCommitment0,
    outputCommitment1: dummyOutputCommitment,
    publicAmount: negativeAmount,
    publicAsset: inputNote.note.asset,
    recipient: addressToBigInt(recipient),

    // Private — input notes
    inOwner: [inputNote.note.owner, dummy.owner],
    inAmount: [inputNote.note.amount, dummy.amount],
    inAsset: [inputNote.note.asset, dummy.asset],
    inChainId: [BigInt(inputNote.note.chainId), BigInt(dummy.chainId)],
    inBlinding: [inputNote.note.blinding, dummy.blinding],
    pathElements: [merkleProof.pathElements, dummyProof.pathElements],
    pathIndices: [merkleProof.pathIndices, dummyProof.pathIndices],
    leafIndex: [BigInt(inputNote.leafIndex), 0n],

    // Private — output notes
    outOwner: [resolvedChange.owner, dummy.owner],
    outAmount: [resolvedChange.amount, dummy.amount],
    outAsset: [resolvedChange.asset, dummy.asset],
    outChainId: [BigInt(resolvedChange.chainId), BigInt(dummy.chainId)],
    outBlinding: [resolvedChange.blinding, dummy.blinding],

    // Keys
    spendingKey: keys.spendingKey,
    nullifierKey: keys.nullifierKey,
  }
}

// ── Transfer ─────────────────────────────────────────────────────────────────

/**
 * Build circuit inputs for an off-chain transfer.
 *
 * - Input 0 is the note being consumed; input 1 is dummy.
 * - Output 0 goes to the recipient; output 1 is change back to sender.
 * - publicAmount = 0 (no value enters or leaves the pool).
 */
export async function buildTransferInputs(
  inputNote: NoteCommitmentV2,
  recipientOwner: bigint,
  amount: bigint,
  keys: V2Keys,
  merkleProof: { pathElements: bigint[]; pathIndices: number[] }
): Promise<ProofInputs> {
  if (amount > inputNote.note.amount) {
    throw new Error(
      `Transfer amount (${amount}) exceeds note balance (${inputNote.note.amount})`
    )
  }

  const dummy = createDummyNote()
  const dummyProof = dummyMerkleProof()

  // Output to recipient
  const recipientNote = createNote(
    recipientOwner,
    amount,
    inputNote.note.asset,
    inputNote.note.chainId
  )

  // Change back to sender
  const changeAmount = inputNote.note.amount - amount
  const changeNote =
    changeAmount > 0n
      ? createNote(
          inputNote.note.owner,
          changeAmount,
          inputNote.note.asset,
          inputNote.note.chainId
        )
      : createDummyNote()

  // Nullifiers
  const nullifier0 = await computeNullifier(
    keys.nullifierKey,
    inputNote.commitment,
    inputNote.leafIndex
  )
  // Circuit constraint: isDummy * nullifier === 0, so dummy nullifier must be 0
  const nullifier1 = 0n

  // Output commitments
  const outputCommitment0 = await computeNoteCommitment(recipientNote)
  const outputCommitment1 = await computeNoteCommitment(changeNote)

  const { poseidonHash } = await import('./commitment')
  let currentHash = inputNote.commitment
  for (let i = 0; i < TREE_DEPTH; i++) {
    if (merkleProof.pathIndices[i] === 0) {
      currentHash = await poseidonHash([currentHash, merkleProof.pathElements[i]])
    } else {
      currentHash = await poseidonHash([merkleProof.pathElements[i], currentHash])
    }
  }
  const merkleRoot = currentHash

  return {
    // Public
    merkleRoot,
    nullifier0,
    nullifier1,
    outputCommitment0,
    outputCommitment1,
    publicAmount: 0n,
    publicAsset: inputNote.note.asset,
    recipient: 0n, // No external recipient for transfers (stays in pool)

    // Private — input notes
    inOwner: [inputNote.note.owner, dummy.owner],
    inAmount: [inputNote.note.amount, dummy.amount],
    inAsset: [inputNote.note.asset, dummy.asset],
    inChainId: [BigInt(inputNote.note.chainId), BigInt(dummy.chainId)],
    inBlinding: [inputNote.note.blinding, dummy.blinding],
    pathElements: [merkleProof.pathElements, dummyProof.pathElements],
    pathIndices: [merkleProof.pathIndices, dummyProof.pathIndices],
    leafIndex: [BigInt(inputNote.leafIndex), 0n],

    // Private — output notes
    outOwner: [recipientNote.owner, changeNote.owner],
    outAmount: [recipientNote.amount, changeNote.amount],
    outAsset: [recipientNote.asset, changeNote.asset],
    outChainId: [BigInt(recipientNote.chainId), BigInt(changeNote.chainId)],
    outBlinding: [recipientNote.blinding, changeNote.blinding],

    // Keys
    spendingKey: keys.spendingKey,
    nullifierKey: keys.nullifierKey,
  }
}
