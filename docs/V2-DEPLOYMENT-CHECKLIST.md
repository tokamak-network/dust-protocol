# DustPoolV2 Deployment Checklist

> Generated 2026-02-21. Covers FflonkVerifier + DustPoolV2 deployment on both testnets.

## Audit Findings

### Issues Identified

| # | Severity | Finding | Impact |
|---|----------|---------|--------|
| 1 | **MEDIUM** | `deploy-v2.sh` uses `--legacy` for both chains | Unnecessary for Ethereum Sepolia (EIP-1559). Not harmful but suboptimal gas pricing. |
| 2 | **LOW** | No `[etherscan]` section in `foundry.toml` | Contract verification requires manual `forge verify-contract` with explicit params |
| 3 | **LOW** | `deploy-v2.sh` missing `--slow` flag | Risk of nonce issues on congested networks |
| 4 | **INFO** | FFLONKVerifier uses floating pragma `>=0.7.0 <0.9.0` | Expected — snarkJS generated code. Compiles fine under 0.8.20. |
| 5 | **INFO** | Addresses hardcoded in 2 separate locations | `contracts.ts` + `relayer/v2/.env` both need updating post-deploy |

### Verification Results

- **Compilation**: `forge build` — passes (solc 0.8.20, optimizer 200 runs)
- **Tests**: 47/47 pass (11 DustPool + 36 DustPoolV2)
- **ABI compatibility**: `IFFLONKVerifier.verifyProof(bytes32[24], uint256[8])` matches generated `FflonkVerifier` signature
- **Proof encoding**: DustPoolV2 expects 768 bytes (24 × 32), parses into `bytes32[24]` — matches FFLONK format
- **Public signals**: 8 signals in correct order `[merkleRoot, nullifier0, nullifier1, outCommitment0, outCommitment1, publicAmount, publicAsset, recipient]`

---

## Pre-Deployment Checks

### 1. Circuit Readiness

- [ ] Circuit recompiled with C2 (asset consistency) + C3 (input range) fixes
- [ ] New FFLONK verifier generated from updated circuit (`snarkjs fflonk export solidityverifier`)
- [ ] Verifier file copied to `contracts/dustpool/src/FFLONKVerifier.sol`
- [ ] `forge build` passes with new verifier
- [ ] `forge test` — all 36 DustPoolV2 tests pass with new verifier

### 2. Environment Variables

```bash
# Required — verify these are set
echo "PRIVATE_KEY: ${PRIVATE_KEY:+SET}"
echo "THANOS_SEPOLIA_RPC_URL: ${THANOS_SEPOLIA_RPC_URL:+SET}"
echo "SEPOLIA_RPC_URL: ${SEPOLIA_RPC_URL:+SET}"
```

- [ ] `PRIVATE_KEY` — deployer wallet private key (will also be initial relayer)
- [ ] `THANOS_SEPOLIA_RPC_URL` — e.g., `https://rpc.thanos-sepolia.tokamak.network`
- [ ] `SEPOLIA_RPC_URL` — e.g., Alchemy/dRPC endpoint

### 3. Deployer Wallet

- [ ] Deployer has sufficient TON on Thanos Sepolia (~0.5 TON for FflonkVerifier + DustPoolV2)
- [ ] Deployer has sufficient ETH on Ethereum Sepolia (~0.05 ETH)
- [ ] Confirm deployer address: `cast wallet address --private-key $PRIVATE_KEY`

### 4. RPC Connectivity

```bash
cast chain-id --rpc-url $THANOS_SEPOLIA_RPC_URL   # expect 111551119090
cast chain-id --rpc-url $SEPOLIA_RPC_URL            # expect 11155111
```

---

## Deployment — Thanos Sepolia (111551119090)

### Step 1: Dry Run (Simulation)

```bash
cd contracts/dustpool

forge script script/DeployV2.s.sol:DeployV2 \
  --rpc-url $THANOS_SEPOLIA_RPC_URL \
  --legacy \
  -vvv
```

- [ ] Simulation succeeds, no reverts
- [ ] Note estimated gas for FflonkVerifier + DustPoolV2

### Step 2: Deploy

```bash
forge script script/DeployV2.s.sol:DeployV2 \
  --rpc-url $THANOS_SEPOLIA_RPC_URL \
  --broadcast \
  --legacy \
  --slow \
  -vvv
```

`--legacy` required (Thanos Sepolia has no EIP-1559). `--slow` prevents nonce issues.

- [ ] Deployment succeeds
- [ ] Record FflonkVerifier address: `________________`
- [ ] Record DustPoolV2 address: `________________`
- [ ] Record deployer/relayer address: `________________`

### Step 3: Verify on Explorer

Thanos Sepolia explorer may not support standard verification. Check manually:

```bash
# Verify FflonkVerifier (no constructor args)
forge verify-contract <VERIFIER_ADDRESS> FflonkVerifier \
  --chain 111551119090 \
  --verifier-url https://explorer.thanos-sepolia.tokamak.network/api \
  --compiler-version 0.8.20

# Verify DustPoolV2 (constructor arg: verifier address)
forge verify-contract <POOL_ADDRESS> DustPoolV2 \
  --chain 111551119090 \
  --verifier-url https://explorer.thanos-sepolia.tokamak.network/api \
  --compiler-version 0.8.20 \
  --constructor-args $(cast abi-encode "constructor(address)" <VERIFIER_ADDRESS>)
```

- [ ] Verification submitted (or noted if explorer doesn't support it)

### Step 4: Post-Deploy Sanity Check

```bash
# Confirm owner
cast call <POOL_ADDRESS> "owner()(address)" --rpc-url $THANOS_SEPOLIA_RPC_URL

# Confirm relayer is whitelisted
cast call <POOL_ADDRESS> "relayers(address)(bool)" <DEPLOYER_ADDRESS> --rpc-url $THANOS_SEPOLIA_RPC_URL

# Confirm verifier is set
cast call <POOL_ADDRESS> "VERIFIER()(address)" --rpc-url $THANOS_SEPOLIA_RPC_URL
```

- [ ] `owner()` returns deployer address
- [ ] `relayers(deployer)` returns `true`
- [ ] `VERIFIER()` returns FflonkVerifier address

---

## Deployment — Ethereum Sepolia (11155111)

### Step 1: Dry Run (Simulation)

```bash
forge script script/DeployV2.s.sol:DeployV2 \
  --rpc-url $SEPOLIA_RPC_URL \
  -vvv
```

Note: Ethereum Sepolia supports EIP-1559 — no `--legacy` needed for simulation.

### Step 2: Deploy

```bash
forge script script/DeployV2.s.sol:DeployV2 \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --slow \
  -vvv
```

Note: `--legacy` flag in `deploy-v2.sh` works but is suboptimal for Sepolia. Consider omitting for EIP-1559 gas savings.

- [ ] Deployment succeeds
- [ ] Record FflonkVerifier address: `________________`
- [ ] Record DustPoolV2 address: `________________`
- [ ] Record deployer/relayer address: `________________`

### Step 3: Verify on Etherscan

```bash
# Verify FflonkVerifier
forge verify-contract <VERIFIER_ADDRESS> FflonkVerifier \
  --chain 11155111 \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --compiler-version 0.8.20

# Verify DustPoolV2
forge verify-contract <POOL_ADDRESS> DustPoolV2 \
  --chain 11155111 \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --compiler-version 0.8.20 \
  --constructor-args $(cast abi-encode "constructor(address)" <VERIFIER_ADDRESS>)
```

- [ ] FflonkVerifier verified on Etherscan
- [ ] DustPoolV2 verified on Etherscan

### Step 4: Post-Deploy Sanity Check

```bash
cast call <POOL_ADDRESS> "owner()(address)" --rpc-url $SEPOLIA_RPC_URL
cast call <POOL_ADDRESS> "relayers(address)(bool)" <DEPLOYER_ADDRESS> --rpc-url $SEPOLIA_RPC_URL
cast call <POOL_ADDRESS> "VERIFIER()(address)" --rpc-url $SEPOLIA_RPC_URL
```

- [ ] `owner()` returns deployer address
- [ ] `relayers(deployer)` returns `true`
- [ ] `VERIFIER()` returns FflonkVerifier address

---

## Post-Deployment: Frontend Address Updates

### File 1: `src/lib/dustpool/v2/contracts.ts`

Update `getDustPoolV2Address()`:

```typescript
export function getDustPoolV2Address(chainId: number): Address | null {
  const addresses: Record<number, Address> = {
    111551119090: '<NEW_THANOS_POOL_ADDRESS>',
    11155111: '<NEW_SEPOLIA_POOL_ADDRESS>',
  }
  return addresses[chainId] ?? null
}
```

- [ ] Thanos Sepolia address updated
- [ ] Ethereum Sepolia address updated
- [ ] `npm run build` passes (no type errors)

### Downstream consumers (read-only, no changes needed):

These files import from `contracts.ts` and auto-resolve:
- `src/hooks/dustpool/v2/useV2Deposit.ts`
- `src/app/api/v2/withdraw/route.ts`
- `src/app/api/v2/transfer/route.ts`
- `src/app/api/v2/deposit/status/[commitment]/route.ts`
- `src/app/api/v2/tree/root/route.ts`
- `src/app/api/v2/tree/proof/[leafIndex]/route.ts`
- `src/lib/dustpool/v2/relayer-tree.ts`

---

## Post-Deployment: Relayer Configuration

### Option A: Standalone Relayer (`relayer/v2/`)

Update `.env` (copy from `.env.example`):

```env
RELAYER_PRIVATE_KEY=0x...          # Must be whitelisted via setRelayer()
DUST_POOL_V2_THANOS=<NEW_ADDRESS>
DUST_POOL_V2_SEPOLIA=<NEW_ADDRESS>
VERIFIER_THANOS=<NEW_VERIFIER_ADDRESS>
VERIFIER_SEPOLIA=<NEW_VERIFIER_ADDRESS>
```

- [ ] `.env` updated with new addresses
- [ ] Relayer private key is the deployer (already whitelisted) or call `setRelayer()` for a separate key

### Option B: Next.js API Routes (`src/app/api/v2/`)

These routes use `getDustPoolV2Address()` from `contracts.ts` — updating that file (above) is sufficient.

The relayer wallet private key for API routes must be set in the Next.js environment:

- [ ] `V2_RELAYER_PRIVATE_KEY` set in `.env.local` or hosting env
- [ ] Relayer address whitelisted: `cast send <POOL> "setRelayer(address,bool)" <RELAYER_ADDR> true --private-key $PRIVATE_KEY --rpc-url <RPC>`

---

## Final Verification

### Smoke Test — Deposit + Root Update

```bash
# 1. Deposit 0.001 native token with a test commitment
cast send <POOL_ADDRESS> "deposit(bytes32)" 0x0000000000000000000000000000000000000000000000000000000000000001 \
  --value 0.001ether \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

# 2. Check deposit queued
cast call <POOL_ADDRESS> "depositQueueTail()(uint256)" --rpc-url $RPC_URL
# Should return 1

# 3. Update root (as relayer)
cast send <POOL_ADDRESS> "updateRoot(bytes32)" 0x<COMPUTED_ROOT> \
  --private-key $PRIVATE_KEY \
  --rpc-url $RPC_URL

# 4. Verify root stored
cast call <POOL_ADDRESS> "isKnownRoot(bytes32)(bool)" 0x<ROOT> --rpc-url $RPC_URL
# Should return true
```

- [ ] Deposit succeeds on Thanos Sepolia
- [ ] Deposit succeeds on Ethereum Sepolia
- [ ] Root update succeeds on both chains
- [ ] `isKnownRoot()` returns true

### Frontend E2E (Manual)

- [ ] V2PoolCard renders with correct contract status
- [ ] Deposit modal shows connected pool address
- [ ] Relayer API routes respond (GET `/api/v2/tree/root?chainId=11155111`)

---

## Rollback Plan

If issues are found post-deployment:

1. **Contract bugs**: Deploy a new version (immutable contracts can't be patched)
2. **Wrong verifier**: Redeploy with correct `FFLONKVerifier.sol`
3. **Frontend shows old addresses**: Revert `contracts.ts` changes, redeploy frontend
4. **Relayer can't submit**: Check `relayers(address)` mapping, call `setRelayer()` if needed

---

## Address Record

| Chain | Contract | Address | Tx Hash |
|-------|----------|---------|---------|
| Thanos Sepolia | FflonkVerifier | | |
| Thanos Sepolia | DustPoolV2 | | |
| Ethereum Sepolia | FflonkVerifier | | |
| Ethereum Sepolia | DustPoolV2 | | |

> Fill in after deployment. Previous addresses: Thanos `0x6987...5a67`, Sepolia `0x36EC...18F7B6`
