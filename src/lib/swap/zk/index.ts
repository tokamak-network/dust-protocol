/**
 * DustSwap ZK library — barrel export
 *
 * All types and functions are self-contained.
 * Uses Dust's existing Poseidon and MerkleTree implementations.
 */

// Types
export type {
  DepositNote,
  MerkleProof,
  Groth16Proof,
  ContractProof,
} from './commitment'

// Commitment functions
export {
  poseidonHash,
  randomBigInt,
  createDepositNote,
  computeCommitment,
  computeNullifierHash,
  formatCommitmentForContract,
  serializeNote,
  deserializeNote,
} from './commitment'

// Merkle tree
export {
  MerkleTree,
  MERKLE_TREE_HEIGHT,
  ZERO_VALUE,
  buildMerkleTree,
  formatProofForCircuit,
} from './merkle'

// Proof generation
export {
  generateProof,
  formatProofForContract,
  verifyProofLocally,
  generateProofForRelayer,
  encodeProofAsHookData,
  estimateProofTime,
  supportsWebWorkers,
  terminateProofWorker,
  type PublicSignals,
  type SwapParams,
} from './proof'
