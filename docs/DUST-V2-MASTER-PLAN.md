# Dust V2 — Master Implementation Plan

> **For Claude Code:** Follow tasks sequentially within each priority tier.
> Use `superpowers:subagent-driven-development` for parallel independent tasks.
> This doc supersedes all previous implementation plans.

**Repo:** `/Users/sahil/work/current/thanos-stealth`
**Date:** 2026-02-21
**Sources:** Obsidian vault (`/Users/sahil/Main/Dust protocol/`) — 5 research docs synthesized

---

## Current State Summary

### What's DONE

| Layer | Status | Tests |
|-------|--------|-------|
| DustPoolV2 Contract | Deployed (both chains) | 47 Foundry |
| FFLONK Circuit (2-in-2-out) | Compiled, artifacts in `public/circuits/v2/` | — |
| FFLONKVerifier | Deployed (both chains) | — |
| Relayer V2 (global tree + indexer) | Code complete, NOT running | 51 vitest |
| Frontend SDK (notes, storage, hooks) | Code complete | 61 vitest |
| V2 UI Components | Exist (V2PoolCard, V2SwapCard, modals) | — |
| Security Audit (V2) | Complete — 14 findings, all applied | — |

### Deployed V2 Contracts

| Chain | DustPoolV2 | FFLONKVerifier |
|-------|-----------|----------------|
| Ethereum Sepolia (11155111) | `0x36ECE3c48558630372fa4d35B1C4293Fcc18F7B6` | `0xD1D89bBAeD5b2e4453d6ED59c6e6fa78C13852A7` |
| Thanos Sepolia (111551119090) | `0x6987FE79057D83BefD19B80822Decb52235A5a67` | `0x1f01345e6dCccfC3E213C391C81a70FAa20Ea6bc` |

### What's BROKEN (Critical Bugs)

1. **ERC-6538 registration fails for Privy users** — `registerMetaAddress()` uses `window.ethereum` which Privy embedded wallets don't expose. Social login users can't register stealth keys on-chain. All name lookups fail after storage clear.
   - File: `src/hooks/stealth/useStealthAddress.ts:237`
   - Fix: Use wagmi `walletClient` instead of `window.ethereum`

2. **OnboardingWizard silently swallows failures** — `.catch(() => null)` on stealth key registration
   - File: `src/components/onboarding/OnboardingWizard.tsx` lines 69, 80, 93
   - Fix: Retry 3x with backoff, warn user on failure

3. **Username re-registration after storage clear** — Subgraph lookup fails because ERC-6538 data was never written (bug #1 above)

4. **Pay link error** — "unknown account #0" when friend opens pay link
   - Likely: server route uses `getProviderWithAccounts()` which requires `window.ethereum`

5. **Dashboard not showing received stealth payments** — Scanner may not be finding announcements

### What's NOT DONE

| Item | Priority | Effort |
|------|----------|--------|
| Circuit fixes (C2 asset constraints, C3 input range) | CRITICAL (blocks mainnet) | 1-2 days |
| Fix ERC-6538 Privy registration bug | CRITICAL (blocks all social login) | 4-8 hours |
| Fix OnboardingWizard silent failures | HIGH | 2-4 hours |
| Fix pay link "unknown account" error | HIGH | 2-4 hours |
| Relayer V2 deployment + hosting | HIGH | 1 day |
| V2 UI polish (deposit/withdraw/transfer flow) | MEDIUM | 2-3 days |
| Unified pool architecture (merge DustPool + DustSwap) | FUTURE | 4-6 weeks |
| Hidden amounts (Pedersen commitments) | FUTURE | 8-12 weeks |
| Nova/HyperNova batch proofs | FUTURE | 12+ weeks |
| Cross-chain root posting (LayerZero v2) | FUTURE | 8-12 weeks |
| Private mempool (Shutter) integration | FUTURE | 4-6 weeks |
| Decentralized relayer network | FUTURE | 12+ weeks |

---

## Priority 0: Critical Bug Fixes

### P0.1 — Fix ERC-6538 Registration for Privy Users

**Problem:** `registerMetaAddress()` in `useStealthAddress.ts` calls `getProviderWithAccounts()` which resolves to `window.ethereum`. Privy embedded wallets (social login: Google, Twitter, Farcaster) don't expose via `window.ethereum`. Result: stealth keys never register on ERC-6538 contract.

**Impact:** ALL social login users are broken. Names can't be looked up after storage clear. Username re-registration bug is a symptom of this.

**Fix Strategy:**
1. In `useStealthAddress.ts`, replace `getProviderWithAccounts()` with wagmi `useWalletClient()`
2. Pattern to follow: `deriveKeysFromWallet()` in same file already does this correctly
3. Use `walletClient.signMessage()` for the ERC-6538 `registerKeysOnBehalf` call
4. Test with both MetaMask (external wallet) and Privy embedded wallet (social login)

**Files to modify:**
- `src/hooks/stealth/useStealthAddress.ts` — main fix
- `src/components/onboarding/OnboardingWizard.tsx` — stop swallowing errors

**Verification:**
- Social login → onboarding → check ERC-6538 `keysOf(wallet)` returns data
- Clear localStorage → re-login → name resolves from subgraph without re-registration

### P0.2 — Fix OnboardingWizard Silent Failures

**Problem:** Lines 69, 80, 93 have `.catch(() => null)` swallowing ERC-6538 registration failures.

**Fix:**
- Retry 3x with exponential backoff (1s, 2s, 4s)
- If all retries fail, show warning: "Account created but stealth keys not registered. Your account won't be discoverable from other devices."
- Log error to console for debugging

### P0.3 — Fix Pay Link Error

**Problem:** "unknown account #0" when opening pay link — server route likely uses `getProviderWithAccounts()`.

**Investigation needed:**
- Check `src/app/pay/[name]/page.tsx` and related API routes
- Check `src/app/api/sponsor-announce/route.ts`
- The server-side provider should use `getServerProvider()` (no accounts needed for read ops)
- For signing, ensure the Privy-compatible path is used

### P0.4 — Fix Dashboard Missing Received Payments

**Investigation needed:**
- Check `useStealthScanner` — is it scanning the right block range?
- Check if announcements are being filtered correctly
- Check if the scanner is using the correct chain's announcer contract

---

## Priority 1: V2 Infrastructure

### P1.1 — Circuit Fixes (C2 + C3)

**MUST be done before mainnet.** Testnet is OK without these.

**C2 — Asset Consistency (CRITICAL):**
Add to input note loop in `DustV2Transaction.circom`:
```
inAmount[i] * (inAsset[i] - publicAsset) === 0;
```
Add to output note loop:
```
outAmount[j] * (outAsset[j] - publicAsset) === 0;
```

**C3 — Input Amount Range (CRITICAL):**
Add to input note loop:
```
inAmountRange[i] = Num2Bits(64);
inAmountRange[i].in <== inAmount[i];
```

**After fixing:**
1. Recompile circuit: `circom DustV2Transaction.circom --r1cs --wasm --sym`
2. New FFLONK setup: `snarkjs fflonk setup`
3. Export new verifier: `snarkjs fflonk export solidityverifier`
4. Redeploy FFLONKVerifier + DustPoolV2 on both chains
5. Copy new WASM + zkey to `public/circuits/v2/`
6. Update contract addresses in `src/lib/dustpool/v2/contracts.ts`

**Files:**
- `contracts/dustpool/circuits/v2/DustV2Transaction.circom`
- `contracts/dustpool/src/FFLONKVerifier.sol` (regenerated)
- `contracts/dustpool/src/DustPoolV2.sol` (if interface changes)
- `public/circuits/v2/` (new WASM + zkey)
- `src/lib/dustpool/v2/contracts.ts` (new addresses)

### P1.2 — Relayer V2 Deployment

**Code exists at:** `relayer/v2/`

**Tasks:**
1. Set up hosting (Railway/Fly.io/VPS)
2. Configure environment: RPC URLs for both chains, relayer private key, SQLite path
3. Start indexing existing DustPoolV2 DepositQueued events from both chains
4. Expose API: `GET /tree/root`, `GET /tree/proof/:leafIndex`, `POST /withdraw`, `POST /transfer`
5. Update frontend relayer URL: `src/lib/dustpool/v2/relayer-client.ts` (currently hardcoded `localhost:3002`)
6. Set `NEXT_PUBLIC_V2_RELAYER_URL` env var

### P1.3 — V2 UI Integration Polish

V2 components exist but need wiring verification:

**Files to check/update:**
- `src/components/dustpool/V2PoolCard.tsx` — deposit/withdraw/transfer flows
- `src/components/dustpool/V2DepositModal.tsx` — deposit to DustPoolV2
- `src/components/dustpool/V2WithdrawModal.tsx` — withdraw via relayer
- `src/components/dustpool/V2TransferModal.tsx` — off-chain transfer via relayer
- `src/components/swap/V2SwapCard.tsx` — V2 on pools page
- `src/app/dashboard/page.tsx` — V2PoolCard integration
- `src/app/pools/page.tsx` — V2SwapCard integration

**Verify:**
- V2 deposit sends ETH to DustPoolV2 contract, emits DepositQueued
- V2 balance shows correctly from IndexedDB notes
- V2 withdraw generates FFLONK proof in browser, submits to relayer
- V2 transfer generates proof, submits to relayer (zero gas)

---

## Priority 2: Architecture Evolution (Future)

### P2.1 — Unified Pool Architecture

**Goal:** One pool per token, supports both private transfer AND privacy swap.

**Current:** DustPool (transfers, arbitrary amounts) + DustSwap (swaps, fixed denominations) = two separate Merkle trees, split anonymity set.

**Target:** One `DustPoolUnified` per token:
- Single deposit → access both transfer and swap
- One Merkle tree → full anonymity set
- Observer can't distinguish transfer vs swap

**Design:** See `research/Implementation Roadmap - Unified Pool Migration.md`

**Key changes:**
- New `DustPoolUnified.sol` contract with both `withdrawTransfer()` and `withdrawSwap()`
- Unified Merkle tree
- Frontend switches new deposits to unified pool
- Old pools stay live for existing withdrawals

### P2.2 — Hidden Amounts (Pedersen Commitments)

**Goal:** Remove amount from public signals. Currently `publicAmount` is visible on-chain.

**Approach:** Zcash Sapling-style:
- Deposit: store Pedersen commitment to amount
- Withdraw: prove amount knowledge inside circuit, contract verifies commitment
- Amount never appears in public signals

**Impact:** Full amount privacy — deposit and withdrawal amounts hidden.

### P2.3 — Batch Deposit

**Goal:** Split arbitrary amounts into fixed denominations in one transaction.

**Contract change:** Add `batchDeposit(bytes32[] commitments, uint256[] amounts)` to DustPoolV2.
**Frontend change:** Auto-split (e.g., 1.37 ETH → [1, 0.25, 0.1, 0.02]) invisible to user.

### P2.4 — Note Combining

**Goal:** Prove ownership of N notes, withdraw all in one proof.

**Currently:** 5 deposits = 5 withdrawal proofs.
**Target:** 5 deposits = 1 proof (N-input circuit or recursive proof).

### P2.5 — Cross-Chain Global Tree

**Goal:** Deposits on any chain share one global anonymity set.

**Design from architecture doc:**
- One global Merkle tree maintained by relayer
- Each chain has tiny DustPoolV2 contract (verify proof → send tokens)
- Root posted to all chains periodically via LayerZero v2 ($14/day for 10 chains)
- Nullifier sequencing by relayer (prevents cross-chain double-spend)

### P2.6 — Private Mempool (Shutter)

**Goal:** Encrypt withdrawal/swap transactions before public mempool.
**Integration:** Add Shutter RPC endpoint option. Works with current arch, no breaking changes.

### P2.7 — Nova/HyperNova Batch Proofs

**Goal:** Fold N transaction proofs into 1. Relayer-side batching.
**Tool:** Sonobe (PSE's folding lib) — EVM-verifiable via DeciderEth.
**Benefit:** Gas per tx: ~207k/N.

### P2.8 — Decentralized Relayer Network

**Goal:** Anyone can stake to become a relayer, earn fees (up to 5%).
**Removes:** Single point of failure/censorship.

---

## Architecture Reference

### V2 Circuit: Universal 2-in-2-out

```
Public Signals (8): [merkleRoot, nullifier0, nullifier1, outCommitment0, outCommitment1, publicAmount, publicAsset, recipient]

Operations via dummy notes (amount=0):
- Deposit:  dummy+dummy → real+dummy,  publicAmount = +X
- Withdraw: real+dummy  → change+dummy, publicAmount = -X (field neg)
- Transfer: real+dummy  → recipient+dummy, publicAmount = 0
- Split:    real+dummy  → noteA+noteB, publicAmount = 0
- Merge:    noteA+noteB → merged+dummy, publicAmount = 0
```

### Note Structure
```
Note { owner: Poseidon(spendingKey), amount: uint64, asset: Poseidon(chainId, tokenAddress), chainId: uint32, blinding: Field }
commitment = Poseidon(owner, amount, asset, chainId, blinding)
nullifier = Poseidon(nullifierKey, commitment, leafIndex)
```

### Key Derivation
```
walletSignature + 6-digit PIN → PBKDF2 (100K iterations, salt v2)
→ spendingSeed → spendingKey (mod BN254)
→ viewingSeed → nullifierKey (mod BN254)
owner = Poseidon(spendingKey)
```

### Gas (FFLONK, 8 public signals)
| Operation | L1 Gas | L2 Cost |
|-----------|--------|---------|
| Deposit (ETH) | ~25k | ~$0.03 |
| Withdraw (ETH) | ~258k | ~$0.50 |
| Transfer (off-chain) | 0 | $0 |
| updateRoot | ~25k | ~$0.03 |

### Key File Map

**Contracts:**
- `contracts/dustpool/src/DustPoolV2.sol` — main V2 contract
- `contracts/dustpool/src/IFFLONKVerifier.sol` — verifier interface
- `contracts/dustpool/src/FFLONKVerifier.sol` — snarkjs-generated
- `contracts/dustpool/circuits/v2/DustV2Transaction.circom` — main circuit
- `contracts/dustpool/test/DustPoolV2.t.sol` — 47 Foundry tests

**Relayer:**
- `relayer/v2/src/tree/global-tree.ts` — Poseidon Merkle tree (depth 20)
- `relayer/v2/src/tree/tree-store.ts` — SQLite persistence
- `relayer/v2/src/relay/proof-relay.ts` — withdrawal/transfer relay
- `relayer/v2/src/api/server.ts` — Express API

**Frontend SDK:**
- `src/lib/dustpool/v2/types.ts` — NoteV2, V2Keys, ProofInputs
- `src/lib/dustpool/v2/note.ts` — createNote, createDummyNote
- `src/lib/dustpool/v2/commitment.ts` — Poseidon hashing
- `src/lib/dustpool/v2/nullifier.ts` — nullifier computation
- `src/lib/dustpool/v2/proof-inputs.ts` — build circuit inputs
- `src/lib/dustpool/v2/keys.ts` — deriveV2Keys (PBKDF2)
- `src/lib/dustpool/v2/proof.ts` — FFLONK proof gen (Web Worker)
- `src/lib/dustpool/v2/storage.ts` — IndexedDB note storage
- `src/lib/dustpool/v2/contracts.ts` — ABI + address resolution
- `src/lib/dustpool/v2/relayer-client.ts` — relayer API client

**Frontend Hooks:**
- `src/hooks/dustpool/v2/useV2Deposit.ts`
- `src/hooks/dustpool/v2/useV2Withdraw.ts`
- `src/hooks/dustpool/v2/useV2Transfer.ts`
- `src/hooks/dustpool/v2/useV2Balance.ts`
- `src/hooks/dustpool/v2/useV2Notes.ts`
- `src/hooks/dustpool/v2/useV2Keys.ts`

**V2 UI:**
- `src/components/dustpool/V2PoolCard.tsx`
- `src/components/dustpool/V2DepositModal.tsx`
- `src/components/dustpool/V2WithdrawModal.tsx`
- `src/components/dustpool/V2TransferModal.tsx`
- `src/components/swap/V2SwapCard.tsx`

**V1 (stealth core, DO NOT modify):**
- `src/lib/stealth/` — address, keys, scanner, names, pin
- `src/hooks/stealth/` — useStealthScanner, useStealthSend, etc.
- `contracts/dustpool/src/DustPool.sol` — V1 pool (stays live)
- `contracts/dustswap/` — V1 swap (stays live)

---

## Rules

1. **Never modify V1 files** — V1 contracts and circuits stay untouched
2. **All V2 code in `v2/` subdirectories** — clean separation
3. **Private keys in React refs only** — never state, never localStorage
4. **FFLONK not Groth16** — use `snarkjs fflonk` commands
5. **Chain-aware** — no hardcoded addresses, use config
6. **Gas target** — withdraw < 260k gas on L1
7. **Test before moving on** — TDD for contracts, verify for frontend

---

## Session Workflow

For each task:
1. Read the task description fully
2. Check relevant files exist and understand current state
3. Implement the fix/feature
4. Verify: build passes, no type errors, tests pass
5. Mark complete, move to next

**Start with Priority 0 (critical bugs), then Priority 1.**
