# Gas Sponsorship (Relayer)

> **Note:** The standalone relayer service in this directory is deprecated. Gas sponsorship now runs as Next.js API routes with ERC-4337 Account Abstraction.

## Current Architecture

All gas sponsorship is handled through two mechanisms:

### ERC-4337 Bundle API (primary — new payments)

New stealth payments use ERC-4337 smart accounts. Claims go through EntryPoint + DustPaymaster:

```
POST /api/bundle       → Server builds UserOp with paymaster signature
                       ← Returns { userOp, userOpHash }

Client signs userOpHash locally (key never leaves browser)

POST /api/bundle/submit → Server calls entryPoint.handleOps()
                        ← Returns { txHash }
```

The DustPaymaster pays all gas. Its deposit in EntryPoint auto-refills when it drops below 0.1 TON.

### Legacy Sponsor API (backward compat — old payments)

Old CREATE2 and EOA stealth payments are claimed via:

```
POST /api/sponsor-claim → Server relays deployAndDrain() or direct transfer
                        ← Returns { txHash, amount, gasFunded }
```

## Configuration

Only one environment variable is needed:

```
RELAYER_PRIVATE_KEY=<deployer-private-key>
```

This key is used by the Next.js API routes to:
- Sign paymaster authorizations for ERC-4337 claims
- Call `entryPoint.handleOps()` as the self-bundler
- Relay legacy `deployAndDrain()` calls
- Sponsor on-chain announcements and name registrations

## Contracts

| Contract | Address | Role |
|----------|---------|------|
| EntryPoint (v0.6) | `0x5c058Eb93CDee95d72398E5441d989ef6453D038` | Executes UserOperations |
| DustPaymaster | `0x9e2eb36F7161C066351DC9E418E7a0620EE5d095` | Sponsors gas for claims |
| StealthAccountFactory | `0x0D93df03e6CF09745A24Ee78A4Cab032781E7aa6` | Deploys stealth accounts |
| StealthWalletFactory | `0x85e7Fe33F594AC819213e63EEEc928Cb53A166Cd` | Legacy CREATE2 wallets |

## Monitoring

Check paymaster deposit:

```bash
cast call 0x5c058Eb93CDee95d72398E5441d989ef6453D038 \
  "balanceOf(address)(uint256)" \
  0x9e2eb36F7161C066351DC9E418E7a0620EE5d095 \
  --rpc-url https://rpc.thanos-sepolia.tokamak.network
```

Manual top-up (if auto-top-up is insufficient):

```bash
cast send 0x5c058Eb93CDee95d72398E5441d989ef6453D038 \
  "depositTo(address)" \
  0x9e2eb36F7161C066351DC9E418E7a0620EE5d095 \
  --value 1ether \
  --private-key $RELAYER_PRIVATE_KEY \
  --rpc-url https://rpc.thanos-sepolia.tokamak.network
```

## Security

- **Private key never leaves the browser.** The client signs UserOperation hashes, not raw transactions.
- **Paymaster is verifying.** Only UserOps signed by the sponsor are accepted — prevents abuse.
- **Rate-limited.** Submit endpoint enforces 10-second cooldown per sender address.
- **Balance-gated.** Empty stealth accounts are rejected before submitting to EntryPoint.
