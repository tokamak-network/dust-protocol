# Privacy Swaps Testing Guide

Guide for testing privacy swap functionality end-to-end.

## Prerequisites

1. **Funded wallet** on Ethereum Sepolia
   - Sepolia ETH for gas
   - Sepolia USDC for deposits

2. **Pool initialized** with liquidity
   - See `contracts/dustswap/README.md` for initialization

3. **Circuit artifacts** in `public/circuits/`
   - privateSwap.wasm
   - privateSwap_final.zkey
   - verification_key.json

## Test Flow

### 1. Deposit to Privacy Pool

1. Navigate to `/swap` page
2. Select token to deposit (ETH or USDC)
3. Enter amount
4. Click "Deposit to Pool"
5. Approve transaction in wallet
6. Wait for confirmation

**Expected**: Deposit appears in "Available Notes" section

### 2. Generate ZK Proof

1. Select a deposit note from "Available Notes"
2. Enter swap parameters:
   - Token to swap to
   - Minimum output amount
   - Relayer fee (default 0.5%)
3. Enter stealth recipient address
4. Click "Generate Proof"

**Expected**:
- Proof generation takes ~5-10 seconds
- Success message shows proof is ready

### 3. Execute Private Swap

1. After proof generation, click "Execute Swap"
2. Approve transaction in wallet
3. Wait for confirmation

**Expected**:
- Swap executes via Uniswap V4
- Output tokens sent to stealth address
- Nullifier marked as spent
- Gas cost ~230k after optimizations

### 4. Verify Privacy

Check that:
- ✅ No on-chain link between deposit and swap
- ✅ Deposit nullifier cannot be reused
- ✅ Stealth address received tokens
- ✅ Output amount matches quote (within slippage)

## Gas Benchmarks

| Operation | Gas Used | Cost @ 50 gwei |
|-----------|----------|----------------|
| Deposit to Pool | ~150k | ~$0.38 |
| Private Swap (baseline) | ~483k | ~$1.21 |
| Private Swap (optimized) | ~236k | ~$0.59 |
| Standard Swap | ~130k | ~$0.33 |

## Common Issues

### "Proof generation failed"

- **Cause**: Missing circuit artifacts or invalid parameters
- **Fix**: Ensure `public/circuits/` has all 3 files
- **Fix**: Check deposit exists and hasn't been spent

### "Invalid Merkle root"

- **Cause**: Deposit not yet included in tree
- **Fix**: Wait a few seconds for tree sync
- **Fix**: Refresh page to sync latest root

### "Nullifier already used"

- **Cause**: Deposit was already spent
- **Fix**: Select a different deposit note

### "Swap failed"

- **Cause**: Insufficient liquidity or slippage too tight
- **Fix**: Increase slippage tolerance
- **Fix**: Reduce swap amount
- **Fix**: Check pool has adequate liquidity

## Security Testing

### Test Nullifier Prevention

1. Deposit once
2. Generate proof and execute swap
3. Try to reuse same deposit
4. **Expected**: Transaction reverts with "NullifierAlreadyUsed"

### Test Invalid Proof Rejection

1. Modify proof data manually
2. Try to execute swap
3. **Expected**: Transaction reverts with "InvalidProof"

### Test Root Validation

1. Generate proof with old Merkle root
2. Try to execute swap
3. **Expected**: Transaction reverts with "InvalidMerkleRoot"

## Performance Testing

### Measure Proof Generation Time

```javascript
const start = Date.now();
await generateProof(inputs);
const duration = Date.now() - start;
console.log(`Proof generation: ${duration}ms`);
```

**Expected**: 5-10 seconds on modern hardware

### Measure Gas Costs

Use Foundry to measure gas:

```bash
cd contracts/dustswap
forge test --match-test testPrivateSwap --gas-report
```

## Integration Testing

Test the full flow programmatically:

```typescript
// 1. Deposit
const depositTx = await poolContract.deposit(commitment, { value: amount });
await depositTx.wait();

// 2. Sync tree
await new Promise(resolve => setTimeout(resolve, 5000));

// 3. Generate proof
const proof = await generateProof({
  merkleRoot,
  secret,
  nullifier,
  recipient,
  // ...
});

// 4. Execute swap
const swapTx = await hookContract.swap(poolKey, swapParams, proof);
await swapTx.wait();

// 5. Verify nullifier spent
const isSpent = await poolContract.isSpent(nullifierHash);
assert(isSpent === true);
```

## Debugging

### Enable verbose logging

```typescript
// In useDustSwap.ts
console.log('Proof inputs:', inputs);
console.log('Generated proof:', proof);
console.log('Public signals:', publicSignals);
```

### Check contract events

```typescript
// Listen for swap events
hookContract.on('PrivateSwapExecuted', (nullifier, recipient, relayer) => {
  console.log('Swap executed:', { nullifier, recipient, relayer });
});
```

### Verify circuit constraints

```bash
cd contracts/dustswap/circuits
circom PrivateSwap.circom --r1cs --wasm --sym
snarkjs r1cs info PrivateSwap.r1cs
```

## Test Coverage

Ensure tests cover:
- ✅ Successful deposit and swap
- ✅ Nullifier prevention
- ✅ Invalid proof rejection
- ✅ Root validation
- ✅ Gas optimization verification
- ✅ Edge cases (zero amounts, max amounts)
- ✅ Relayer fee limits
- ✅ Slippage protection
