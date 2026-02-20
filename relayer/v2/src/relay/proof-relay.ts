import { ethers } from 'ethers';
import { DUST_POOL_V2_ABI, chainConfigs, getWallet, getProvider, type V2ChainConfig } from '../config/chains';
import { config } from '../config';
import { TreeStore } from '../tree/tree-store';
import { GlobalTree } from '../tree/global-tree';
import { NullifierLock } from './nullifier-lock';

// Shared nullifier lock prevents check-then-act race on concurrent requests
const nullifierLock = new NullifierLock();

export interface WithdrawRequest {
  proof: string;
  merkleRoot: string;
  nullifier0: string;
  nullifier1: string;
  outCommitment0: string;
  outCommitment1: string;
  publicAmount: string;
  publicAsset: string;
  recipient: string;
  tokenAddress: string;
  chainId: number;
}

export interface WithdrawResult {
  txHash: string;
  blockNumber: number;
  gasUsed: string;
}

export interface TransferRequest {
  proof: string;
  merkleRoot: string;
  nullifier0: string;
  nullifier1: string;
  outCommitment0: string;
  outCommitment1: string;
  publicAmount: string;
  publicAsset: string;
  recipient: string;
  chainId: number;
}

function findChain(chainId: number): V2ChainConfig {
  const chain = chainConfigs.find((c) => c.chainId === chainId);
  if (!chain) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }
  return chain;
}

/**
 * Validates a withdrawal request, submits the proof on-chain via DustPoolV2.withdraw(),
 * and records nullifiers + output commitments.
 */
export async function relayWithdrawal(
  req: WithdrawRequest,
  store: TreeStore,
  tree: GlobalTree
): Promise<WithdrawResult> {
  // Validate format first (cheap checks before DB lookups)
  if (!req.proof.startsWith('0x') || req.proof.length !== 1538) {
    throw new Error(`Invalid proof length: expected 768 bytes (1538 hex chars), got ${req.proof.length}`);
  }
  if (!ethers.utils.isAddress(req.recipient)) {
    throw new Error('Invalid recipient address');
  }

  // Validate state (DB lookups)
  if (!store.isKnownRoot(req.merkleRoot)) {
    throw new Error('Unknown Merkle root');
  }

  // Lock nullifiers to prevent check-then-act race on concurrent requests
  const nullifiersToLock = [req.nullifier0];
  if (req.nullifier1 !== ethers.constants.HashZero) {
    nullifiersToLock.push(req.nullifier1);
  }
  const releaseNullifiers = await nullifierLock.acquire(nullifiersToLock);

  try {
    if (store.isNullifierSpent(req.nullifier0)) {
      throw new Error('Nullifier0 already spent');
    }
    if (req.nullifier1 !== ethers.constants.HashZero && store.isNullifierSpent(req.nullifier1)) {
      throw new Error('Nullifier1 already spent');
    }

    const chain = findChain(req.chainId);
    const wallet = getWallet(config.relayerPrivateKey, chain);
    const contract = new ethers.Contract(chain.dustPoolV2Address, DUST_POOL_V2_ABI, wallet);

    // Ensure root is published on-chain before submitting (prevents gas waste on revert)
    const isKnownOnChain: boolean = await contract.isKnownRoot(req.merkleRoot);
    if (!isKnownOnChain) {
      console.log(`[proof-relay] Root not yet on-chain, publishing first: ${req.merkleRoot.slice(0, 18)}...`);
      const rootTx: ethers.ContractTransaction = await contract.updateRoot(req.merkleRoot, { gasLimit: 100_000 });
      const rootReceipt = await rootTx.wait();
      if (rootReceipt.status === 0) {
        throw new Error('Failed to publish root on-chain before withdrawal');
      }
      console.log(`[proof-relay] Root published on-chain: ${rootTx.hash}`);
    }

    // Atomically mark both nullifiers spent before submitting on-chain tx.
    // Transaction scope is tight (DB writes only) — NOT held across the on-chain tx.
    try {
      store.beginImmediate();
      store.insertNullifier(req.nullifier0, null);
      if (req.nullifier1 !== ethers.constants.HashZero) {
        store.insertNullifier(req.nullifier1, null);
      }
      store.commit();
    } catch (err) {
      store.rollback();
      throw new Error(`Failed to mark nullifiers spent: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      const tx: ethers.ContractTransaction = await contract.withdraw(
        req.proof,
        req.merkleRoot,
        req.nullifier0,
        req.nullifier1,
        req.outCommitment0,
        req.outCommitment1,
        req.publicAmount,
        req.publicAsset,
        req.recipient,
        req.tokenAddress,
        { gasLimit: 600_000 }
      );

      console.log(`[proof-relay] Withdrawal tx submitted: ${tx.hash} (chain=${req.chainId})`);

      const receipt = await tx.wait();
      if (receipt.status === 0) {
        throw new Error('Withdrawal transaction reverted on-chain');
      }

      return {
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (err) {
      // Rollback optimistic nullifier marking so user can retry
      try {
        store.beginImmediate();
        store.deleteNullifier(req.nullifier0);
        if (req.nullifier1 !== ethers.constants.HashZero) {
          store.deleteNullifier(req.nullifier1);
        }
        store.commit();
      } catch (rollbackErr) {
        store.rollback();
        console.error(`[proof-relay] Failed to rollback nullifiers: ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`);
      }
      throw err;
    }
  } finally {
    releaseNullifiers();
  }
}

// FFLONK verifier ABI (read-only verify function)
const VERIFIER_ABI = [
  'function verifyProof(bytes32[24] proof, uint256[8] pubSignals) external view returns (bool)',
];

/**
 * Process an internal transfer (no on-chain tx needed).
 * Verifies the FFLONK proof via static call to the on-chain verifier,
 * then inserts output commitments into the tree.
 */
export async function relayTransfer(
  req: TransferRequest,
  store: TreeStore,
  tree: GlobalTree
): Promise<void> {
  // Validate format first (cheap checks before DB lookups)
  if (req.publicAmount !== '0') {
    throw new Error('Invalid transfer: publicAmount must be 0');
  }
  if (!req.proof.startsWith('0x') || req.proof.length !== 1538) {
    throw new Error(`Invalid proof length: expected 768 bytes (1538 hex chars), got ${req.proof.length}`);
  }

  // Validate state (DB lookups)
  if (!store.isKnownRoot(req.merkleRoot)) {
    throw new Error('Unknown Merkle root');
  }

  // Lock nullifiers to prevent check-then-act race on concurrent requests
  const nullifiersToLock = [req.nullifier0];
  if (req.nullifier1 !== ethers.constants.HashZero) {
    nullifiersToLock.push(req.nullifier1);
  }
  const releaseNullifiers = await nullifierLock.acquire(nullifiersToLock);

  try {
    if (store.isNullifierSpent(req.nullifier0)) {
      throw new Error('Nullifier0 already spent');
    }
    if (req.nullifier1 !== ethers.constants.HashZero && store.isNullifierSpent(req.nullifier1)) {
      throw new Error('Nullifier1 already spent');
    }

    const chain = findChain(req.chainId);
    if (!chain.verifierAddress) throw new Error(`VERIFIER_ADDRESS not configured for chain ${req.chainId}`);

    const provider = getProvider(chain);
    const verifier = new ethers.Contract(chain.verifierAddress, VERIFIER_ABI, provider);

    // Decode proof bytes into bytes32[24]
    const proofData: string[] = [];
    const proofHex = req.proof.slice(2);
    for (let i = 0; i < 24; i++) {
      proofData.push('0x' + proofHex.slice(i * 64, (i + 1) * 64));
    }

    // Build pubSignals matching circuit order
    const pubSignals = [
      ethers.BigNumber.from(req.merkleRoot),
      ethers.BigNumber.from(req.nullifier0),
      ethers.BigNumber.from(req.nullifier1),
      ethers.BigNumber.from(req.outCommitment0),
      ethers.BigNumber.from(req.outCommitment1),
      ethers.BigNumber.from(req.publicAmount),
      ethers.BigNumber.from(req.publicAsset),
      ethers.BigNumber.from(req.recipient),
    ];

    const isValid = await verifier.callStatic.verifyProof(proofData, pubSignals);
    if (!isValid) {
      throw new Error('Invalid proof: FFLONK verification failed');
    }

    // Count commitments to insert and pre-validate tree capacity
    const commitmentsToInsert: string[] = [];
    if (req.outCommitment0 !== ethers.constants.HashZero) commitmentsToInsert.push(req.outCommitment0);
    if (req.outCommitment1 !== ethers.constants.HashZero) commitmentsToInsert.push(req.outCommitment1);

    const TREE_CAPACITY = 2 ** 20;
    if (tree.leafCount + commitmentsToInsert.length > TREE_CAPACITY) {
      throw new Error(`Merkle tree has insufficient capacity for ${commitmentsToInsert.length} new leaves`);
    }

    // Insert tree leaves first (in-memory, append-only — no undo)
    const insertedLeaves: { leafIndex: number; commitment: string; logIndex: number }[] = [];
    for (let i = 0; i < commitmentsToInsert.length; i++) {
      const leafIndex = await tree.insert(BigInt(commitmentsToInsert[i]));
      insertedLeaves.push({ leafIndex, commitment: commitmentsToInsert[i], logIndex: i });
    }

    // Wrap all DB writes (nullifiers + leaves) in a single atomic transaction.
    // If any DB write fails, the entire batch rolls back. Tree may be ahead of DB
    // but will be rebuilt from DB on restart — acceptable for append-only structure.
    try {
      store.beginImmediate();

      store.insertNullifier(req.nullifier0, null);
      if (req.nullifier1 !== ethers.constants.HashZero) {
        store.insertNullifier(req.nullifier1, null);
      }

      const now = Math.floor(Date.now() / 1000);
      for (const leaf of insertedLeaves) {
        store.insertLeaf({
          leafIndex: leaf.leafIndex,
          commitment: leaf.commitment,
          chainId: req.chainId,
          blockNumber: 0,
          txIndex: 0,
          logIndex: leaf.logIndex,
          amount: '0',
          asset: ethers.constants.AddressZero,
          timestamp: now,
        });
      }

      store.commit();
    } catch (err) {
      store.rollback();
      throw err;
    }
  } finally {
    releaseNullifiers();
  }

  console.log(`[proof-relay] Transfer processed (off-chain, proof verified, chain=${req.chainId})`);
}
