import { Router, type Request, type Response } from 'express';
import { ethers } from 'ethers';
import { TreeStore } from '../../tree/tree-store';
import { GlobalTree } from '../../tree/global-tree';
import { relayWithdrawal, type WithdrawRequest } from '../../relay/proof-relay';
import { calculateRelayerFee, formatFee } from '../../relay/fee-calculator';
import { chainConfigs } from '../../config/chains';

// Frontend sends { proof, publicSignals, targetChainId }
// publicSignals[0..7] = [merkleRoot, nullifier0, nullifier1, outCommitment0, outCommitment1, publicAmount, publicAsset, recipient]
interface WithdrawBody {
  proof: string;
  publicSignals: string[];
  targetChainId: number;
  tokenAddress: string;
}

function toBytes32(value: string): string {
  const bn = ethers.BigNumber.from(value);
  return ethers.utils.hexZeroPad(bn.toHexString(), 32);
}

// Per-nullifier rate limiting: prevents gas griefing where attacker submits
// multiple concurrent requests with the same nullifier. All pass validation
// (race condition), all submit on-chain, N-1 revert, relayer pays gas.
const NULLIFIER_COOLDOWN_MS = 60_000;
const recentNullifiers = new Map<string, number>();

setInterval(() => {
  const cutoff = Date.now() - NULLIFIER_COOLDOWN_MS;
  for (const [key, timestamp] of recentNullifiers.entries()) {
    if (timestamp < cutoff) recentNullifiers.delete(key);
  }
}, NULLIFIER_COOLDOWN_MS);

export function createWithdrawRouter(store: TreeStore, tree: GlobalTree): Router {
  const router = Router();

  router.post('/', async (req: Request<unknown, unknown, WithdrawBody>, res: Response) => {
    try {
      const { proof, publicSignals, targetChainId, tokenAddress } = req.body;

      if (!proof || !publicSignals || !targetChainId) {
        res.status(400).json({ error: 'Missing required fields: proof, publicSignals, targetChainId' });
        return;
      }

      if (!Array.isArray(publicSignals) || publicSignals.length !== 8) {
        res.status(400).json({ error: 'publicSignals must be an array of 8 elements' });
        return;
      }

      // Per-nullifier rate limit: reject if same nullifier0 was submitted recently
      const nullifier0Raw = publicSignals[1];
      const lastSeen = recentNullifiers.get(nullifier0Raw);
      if (lastSeen && Date.now() - lastSeen < NULLIFIER_COOLDOWN_MS) {
        res.status(429).json({ error: 'Nullifier recently submitted, please wait' });
        return;
      }

      if (!tokenAddress) {
        res.status(400).json({ error: 'Missing tokenAddress' });
        return;
      }

      if (!ethers.utils.isAddress(tokenAddress)) {
        res.status(400).json({ error: 'Invalid tokenAddress' });
        return;
      }

      const chain = chainConfigs.find((c) => c.chainId === targetChainId);
      if (!chain) {
        res.status(400).json({ error: `Unsupported chain: ${targetChainId}` });
        return;
      }

      // Destructure publicSignals in circuit order
      const [merkleRoot, nullifier0, nullifier1, outCommitment0, outCommitment1, publicAmount, publicAsset, recipient] = publicSignals;

      const recipientAddr = ethers.utils.getAddress(
        ethers.utils.hexZeroPad(ethers.BigNumber.from(recipient).toHexString(), 20)
      );

      const request: WithdrawRequest = {
        proof,
        merkleRoot: toBytes32(merkleRoot),
        nullifier0: toBytes32(nullifier0),
        nullifier1: toBytes32(nullifier1),
        outCommitment0: toBytes32(outCommitment0),
        outCommitment1: toBytes32(outCommitment1),
        publicAmount: publicAmount.toString(),
        publicAsset: publicAsset.toString(),
        recipient: recipientAddr,
        tokenAddress,
        chainId: targetChainId,
      };

      console.log(`[POST /withdraw] Processing withdrawal on chain ${targetChainId}`);

      // Mark nullifier as in-flight before submission to block concurrent duplicates
      recentNullifiers.set(nullifier0Raw, Date.now());

      const result = await relayWithdrawal(request, store, tree);

      const fee = await calculateRelayerFee(chain);

      res.json({
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        fee: formatFee(fee),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[POST /withdraw] Error: ${msg}`);

      if (msg.includes('Unknown Merkle root') || msg.includes('Nullifier') || msg.includes('Invalid')) {
        res.status(400).json({ error: msg });
        return;
      }

      res.status(500).json({ error: 'Withdrawal relay failed' });
    }
  });

  return router;
}
