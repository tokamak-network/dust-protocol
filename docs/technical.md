# Technical Architecture

Deep technical documentation for Dust Protocol. Covers cryptography, key derivation, contract interactions, scanning, and the no-opt-in payment flow.

## Cryptographic Primitives

Everything is built on **secp256k1** elliptic curve cryptography (same curve as Ethereum/Bitcoin).

### Key Types

| Key | What it is | Who has it |
|-----|-----------|-----------|
| Spending public key | Used to derive stealth addresses | Public (on-chain in meta-address) |
| Spending private key | Needed to spend from stealth addresses | Recipient only |
| Viewing public key | Used in ECDH shared secret | Public (on-chain in meta-address) |
| Viewing private key | Needed to scan/identify incoming payments | Recipient only (can be delegated) |
| Ephemeral key pair | Fresh random key per payment | Sender generates, public key published on-chain |

### Stealth Meta-Address Format

```
st:thanos:0x{spending_pub_key_33_bytes}{viewing_pub_key_33_bytes}
```

Example: `st:thanos:0x02abc...def03xyz...789` (total 132 hex chars after `0x`)

Regex: `/^st:([a-z]+):0x([0-9a-fA-F]{132})$/`

- First 66 hex chars = compressed spending public key (02/03 prefix)
- Last 66 hex chars = compressed viewing public key (02/03 prefix)

On-chain (in ERC-6538 Registry and StealthNameRegistry), the meta-address is stored as raw bytes without the `st:thanos:` prefix.

## Key Derivation

### Legacy Mode (wallet signature only)

```
wallet.signMessage(STEALTH_KEY_DERIVATION_MESSAGE)
    → signature
    → keccak256(signature) = entropy
    → keccak256(entropy + "spending") = spending private key
    → keccak256(entropy + "viewing") = viewing private key
```

### PIN Mode (wallet signature + 6-digit PIN)

```
wallet.signMessage(STEALTH_KEY_DERIVATION_MESSAGE)
    → signature
    → SHA-512(signature + pin + "Dust Spend Authority") → first 32 bytes = spending private key
    → SHA-512(signature + pin + "Dust View Authority") → first 32 bytes = viewing private key
```

PIN is encrypted with AES-256-GCM (key derived via PBKDF2 from signature, 100k iterations) and stored in localStorage.

### Claim Address Derivation

Claim addresses are where swept funds go. Derived deterministically so the user always gets the same set:

```
seed = keccak256(signature)  // or SHA-512 with PIN
for i in 0..n:
    privateKey = keccak256(pack(seed, "stealth/claim/", i))
    claimAddress[i] = ethers.Wallet(privateKey).address
```

These are completely unlinkable to the user's main wallet.

## Stealth Address Generation

When someone wants to pay Alice:

```
1. Look up Alice's meta-address → get spendingPubKey, viewingPubKey
2. Generate random ephemeral key pair (r, R = r*G)
3. Compute shared secret: S = r * viewingPubKey  (ECDH)
4. Hash it: h = keccak256(S)
5. View tag: first byte of h (for fast scanning)
6. Stealth public key: P_stealth = spendingPubKey + h*G
7. Stealth address: last 20 bytes of keccak256(uncompressed P_stealth)
```

The stealth address is a normal Ethereum address. Anyone can send ETH/TON to it.

### Why Only Alice Can Spend

Alice knows her spending private key `s` and viewing private key `v`. Given the ephemeral public key `R`:

```
shared secret: S = v * R  (same as r * viewingPubKey because v*R = v*r*G = r*v*G)
h = keccak256(S)
stealth private key = s + h  (mod curve order)
```

No one else can compute `s + h` because they don't know `s`.

## Announcement & Scanning

### Announcement (ERC-5564)

When a payment is made, the sender (or sponsor relay) calls:

```solidity
announcer.announce(
    1,                    // schemeId (SECP256K1)
    stealthAddress,       // the one-time address
    ephemeralPubKey,      // so receiver can compute shared secret
    metadata              // view tag + optional link slug
)
```

This emits an `Announcement` event:
```solidity
event Announcement(
    uint256 indexed schemeId,
    address indexed stealthAddress,
    address indexed caller,
    bytes ephemeralPubKey,
    bytes metadata
)
```

### Metadata Format

```
0x{viewTag 2 hex}{linkSlug UTF-8 hex encoded}
```

Examples:
- Personal payment: `0xab` (just the view tag "ab")
- Link payment for "coffee": `0xab636f66666565` (view tag "ab" + "coffee" in hex)

### Scanner Flow

The receiver's app scans all Announcement events from the deployment block:

```
1. Query Announcement events with schemeId=1 from ERC5564Announcer
2. For each event:
   a. Extract view tag from metadata (first byte)
   b. Compute expected view tag: keccak256(viewingPrivKey * ephemeralPubKey).slice(0,1)
   c. If tags don't match → skip (filters out ~99.6% of events)
   d. Full ECDH verification: derive stealth address and compare
   e. If match → derive stealth private key → verify it controls the address
   f. Store as found payment
```

View tags make scanning fast: only 1/256 events need full verification.

## No-Opt-In Payment Flow

Based on [Interactive No-Opt-In Stealth Addresses](https://ethresear.ch/t/interactive-no-opt-in-stealth-addresses/23274).

### How It Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Pay Page     │     │  Any Wallet   │     │  Sponsor API  │
│  (Browser)    │     │  (MetaMask)   │     │  (Server)     │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                     │                     │
       │ 1. Resolve .tok name                      │
       │ 2. Generate stealth address               │
       │ 3. Show address + QR                      │
       │                     │                     │
       │    4. User copies   │                     │
       │    address and      │                     │
       │    sends TON        │                     │
       │<────────────────────│                     │
       │                     │                     │
       │ 5. Poll balance every 3s                  │
       │ 6. Deposit detected!                      │
       │                     │                     │
       │ 7. POST /api/sponsor-announce ───────────>│
       │                     │                     │ 8. Call announcer.announce()
       │<──────────────────── 9. Success ──────────│
       │                     │                     │
       │ 10. "Payment Received!"                   │
       │ 11. Clear pending session                 │
       └─────────────────────┘                     │
```

### State Machine

```
generating → waiting → announcing → confirmed
                ↓           ↓
              error    announce_failed → (retry) → announcing
```

- **generating**: Generating stealth address from meta-address (instant)
- **waiting**: Address shown, polling balance every 3s
- **announcing**: Deposit detected, calling sponsor-announce API (retries 3x with 6s/12s/18s backoff)
- **confirmed**: Announcement on-chain, payment visible to receiver
- **announce_failed**: All retries failed — shows retry button, keeps session in localStorage

### Session Recovery

The pending session (stealth address, ephemeral key, view tag) is saved to localStorage:
- Key: `dust_pending_{recipientName}_{linkSlug || "personal"}`
- Expires after 24 hours
- On page refresh, if a pending session exists and isn't expired, the same address is shown
- Only cleared after successful announcement

### Balance Polling

`useBalancePoller` hook:
- Uses read-only `JsonRpcProvider` (no wallet connection needed)
- Polls `provider.getBalance(address)` every 3 seconds
- Stops polling when balance > 0
- Protected against state updates after unmount (stoppedRef checked before AND after async getBalance)

## Contract Interactions

### ERC-5564 Announcer

```
announce(schemeId, stealthAddress, ephemeralPubKey, metadata)
```
- schemeId = 1 (SECP256K1)
- Called by sponsor relay, not the sender
- Emits Announcement event that the scanner picks up

### ERC-6538 Registry

```
registerKeys(schemeId, stealthMetaAddress)        // direct registration
registerKeysOnBehalf(registrant, schemeId, sig, meta)  // sponsored
stealthMetaAddressOf(registrant, schemeId)         // lookup
```

Stores the mapping: wallet address → stealth meta-address.

Supports EIP-712 signed registration so a sponsor can register on behalf of a user.

### StealthNameRegistry

```
registerName(name, stealthMetaAddress)    // register alice → meta-address
resolveName(name) → bytes                 // lookup alice → raw hex bytes
transferName(name, newOwner)              // change ownership
updateMetaAddress(name, newMeta)          // update keys
isNameAvailable(name) → bool
getOwner(name) → address
getNamesOwnedBy(address) → string[]
```

## Code Structure

```
src/
├── app/                          # Next.js 14 App Router pages
│   ├── pay/[name]/page.tsx       # Personal payment page
│   ├── pay/[name]/[link]/page.tsx # Link payment page
│   ├── dashboard/page.tsx        # Balance + recent payments
│   ├── activities/page.tsx       # Full payment history
│   ├── links/page.tsx            # Payment link management
│   ├── onboarding/page.tsx       # New user setup
│   ├── settings/page.tsx         # Account settings
│   └── api/                      # Sponsored gas API routes
│       ├── sponsor-announce/     # Payment announcement
│       ├── sponsor-claim/        # Fund claiming
│       ├── sponsor-register-keys/ # Meta-address registration
│       ├── sponsor-name-register/ # Name registration
│       └── sponsor-name-transfer/ # Name transfer
│
├── lib/
│   ├── stealth/                  # Core cryptographic library
│   │   ├── address.ts            # Stealth address math (generate, verify, compute private key)
│   │   ├── keys.ts               # Key derivation (from signature, from signature+PIN)
│   │   ├── scanner.ts            # Scan Announcement events, filter by view tag, ECDH verify
│   │   ├── registry.ts           # ERC-6538 Registry interactions
│   │   ├── names.ts              # StealthNameRegistry interactions (.tok names)
│   │   ├── hdWallet.ts           # Claim address derivation (deterministic, unlinkable)
│   │   ├── pin.ts                # PIN validation, AES-256-GCM encryption, SHA-512 key derivation
│   │   ├── relayer.ts            # Relayer for sender privacy (future)
│   │   ├── types.ts              # TypeScript types, constants, contract addresses
│   │   └── index.ts              # Re-exports everything
│   └── design/
│       ├── tokens.ts             # Color, radius, and design tokens
│       └── types.ts              # UI type definitions
│
├── hooks/stealth/                # React hooks
│   ├── useBalancePoller.ts       # Poll stealth address balance (no-opt-in flow)
│   ├── useStealthAddress.ts      # Key derivation + registration state
│   ├── useStealthSend.ts         # Generate address + send payment (wallet flow)
│   ├── useStealthScanner.ts      # Scan + claim incoming payments
│   ├── useStealthName.ts         # Name resolution + registration
│   ├── usePaymentLinks.ts        # Payment link CRUD
│   ├── useClaimAddresses.ts      # Claim address management
│   ├── usePin.ts                 # PIN verification state
│   ├── useRelayer.ts             # Relayer interactions (future)
│   └── index.ts                  # Re-exports
│
├── components/
│   ├── pay/                      # Payment page components
│   │   ├── NoOptInPayment.tsx    # No-wallet payment flow (address + QR + polling + announce)
│   │   └── AddressDisplay.tsx    # Address card with copy button + inline QR code
│   ├── stealth/
│   │   └── icons.tsx             # SVG icon components
│   ├── dashboard/                # Dashboard components
│   ├── activities/               # Activity list components
│   ├── links/                    # Payment link components
│   ├── onboarding/               # Onboarding step components
│   ├── settings/                 # Settings components
│   ├── layout/                   # Sidebar, navigation
│   └── ui/                       # Shared UI primitives
│
└── contexts/
    └── AuthContext.tsx            # Centralized auth state (wallet, keys, PIN, names)
```

## Security Model

### What's Private

- Recipient identity: stealth addresses are unlinkable to the receiver's wallet
- Payment amounts: each payment goes to a separate address
- Link between payments: no on-chain connection between multiple payments to the same person

### What's NOT Private

- Sender identity: the sender's address is visible on-chain (they sent from their wallet)
- Payment timing: transaction timestamps are public
- The fact that it's a stealth payment: Announcement events are public

### Key Security

- Private keys never leave the browser
- Derived from wallet signature (something you have) + PIN (something you know)
- PIN encrypted with AES-256-GCM, stored in localStorage
- Claim addresses are deterministic — same signature always produces same addresses

### Sponsor Relay Trust Model

The sponsor relay (`/api/sponsor-*`) is a trusted service that pays gas. It can:
- See which stealth addresses are being announced (public anyway)
- Rate limit or refuse to sponsor

It cannot:
- Spend from stealth addresses (doesn't know private keys)
- Link payments to recipients (same limitation as any on-chain observer)
- Modify payment destinations (stealth address is already funded)

## Standards Implemented

| Standard | What we use it for |
|----------|--------------------|
| [ERC-5564](https://eips.ethereum.org/EIPS/eip-5564) | Stealth address generation, Announcement events, view tags |
| [ERC-6538](https://ethereum-magicians.org/t/stealth-meta-address-registry/12888) | Stealth meta-address registry (spending + viewing key publication) |
| ECDH (secp256k1) | Shared secret computation between sender and receiver |
| EIP-712 | Typed signatures for sponsored key registration |
