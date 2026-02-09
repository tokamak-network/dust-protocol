# Dust Protocol

Private payment infrastructure on Tokamak Network. Send and receive untraceable payments using stealth addresses and `.tok` names.

## Features

- **Stealth Addresses** — Payments go to one-time addresses that can't be linked to your identity
- **CREATE2 Stealth Wallets** — Each stealth address is a smart contract wallet deployed via CREATE2, so the recipient's private key never leaves the browser
- **`.tok` Names** — Human-readable addresses (`alice.tok`, `coffee.alice.tok`)
- **Payment Links** — Create shareable links for receiving payments
- **No-Opt-In Payments** — Anyone can send to a `.tok` name from any wallet, no special software needed
- **Sponsored Gas** — All protocol operations are gasless for users
- **Real-time Scanning** — Automatic detection of incoming payments (supports both legacy EOA and CREATE2 announcements)

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

### Environment Variables

```
NEXT_PUBLIC_STEALTH_ANNOUNCER_ADDRESS=0x2C2a59E9e71F2D1A8A2D447E73813B9F89CBb125
NEXT_PUBLIC_STEALTH_REGISTRY_ADDRESS=0x9C527Cc8CB3F7C73346EFd48179e564358847296
NEXT_PUBLIC_STEALTH_NAME_REGISTRY_ADDRESS=0x0129DE641192920AB78eBca2eF4591E2Ac48BA59
RELAYER_PRIVATE_KEY=<deployer-private-key>
```

## Smart Contracts

| Contract | Address (Thanos Sepolia) |
|----------|--------------------------|
| ERC5564Announcer | `0x2C2a59E9e71F2D1A8A2D447E73813B9F89CBb125` |
| ERC6538Registry | `0x9C527Cc8CB3F7C73346EFd48179e564358847296` |
| StealthNameRegistry | `0x0129DE641192920AB78eBca2eF4591E2Ac48BA59` |
| StealthWalletFactory | `0x85e7Fe33F594AC819213e63EEEc928Cb53A166Cd` |

## How It Works

1. **Connect wallet** and derive stealth keys from a signature + PIN
2. **Register a `.tok` name** linked to your stealth meta-address
3. **Share your name** — senders visit `yourname.tok` to pay privately
4. **Scan & claim** — the app detects payments and claims them via CREATE2 `deployAndDrain`

### No-Opt-In Stealth Payments

From [Interactive No-Opt-In Stealth Addresses](https://ethresear.ch/t/interactive-no-opt-in-stealth-addresses/23274) — the receiver's pay page pre-generates a one-time stealth address and shows it as a plain address + QR code. Any wallet (MetaMask, exchange, hardware wallet) can send to it without stealth-aware software.

**Current flow:**
```
Page loads → resolve .tok name → generate stealth address → show address + QR
Sender copies address → sends from any wallet
Page polls balance → deposit detected → auto-announce via sponsor relay
Receiver's dashboard picks up the payment
```

**How it preserves privacy:** Each payment page visit generates a fresh ephemeral key pair. The stealth address is a CREATE2 smart contract wallet derived from the receiver's public spending key + the ephemeral key via ECDH. Only the receiver (with their viewing key) can identify the payment. To claim, the receiver signs a drain message in the browser — the private key never leaves the client. A sponsor relayer calls `deployAndDrain()` on-chain to atomically deploy the wallet and send the funds to the recipient.

## Architecture: CREATE2 Stealth Wallets

Each stealth payment address is a CREATE2 smart contract wallet rather than a raw EOA.

```
Sender pays to CREATE2 address (no contract deployed yet — just an address with funds)
    ↓
Receiver's browser derives stealth private key via ECDH
    ↓
Browser signs a drain message (key never sent to server)
    ↓
Sponsor relayer calls factory.deployAndDrain(owner, recipient, sig)
    ↓
Factory deploys the wallet + drains funds to recipient in one atomic tx
```

**Why CREATE2 over EOA?** The stealth private key never leaves the browser. In the old EOA model, the key had to be sent to the server to construct the claim transaction. With CREATE2, the client signs a message locally and only the signature is sent to the relayer.

The scanner supports both legacy EOA announcements and new CREATE2 announcements for backward compatibility.

## Roadmap

### Done
- **CREATE2 Stealth Wallets** — Smart contract wallets deployed at stealth addresses via `StealthWalletFactory`. Signature-based drain, replay protection, atomic `deployAndDrain`. Backward-compatible scanner for legacy EOA payments.

### Next Up

#### 1. Fresh Address per Name Query
Every time someone queries a `.tok` name, resolve to a new stealth address. No two lookups return the same address — eliminates address reuse and removes the "keep page open" requirement.

**Reference:** [Fluidkey](https://docs.fluidkey.com/readme/receiving-funds) does this with an off-chain resolver that generates addresses server-side from the receiver's meta-address.

#### 2. ERC-4337 Paymaster for Gas
Replace the current API-based gas sponsoring (`/api/sponsor-claim`, `/api/sponsor-announce`) with an on-chain ERC-4337 Paymaster. Removes the central relayer and makes gas sponsoring trustless.

**Reference:** [Vitalik's stealth address guide](https://vitalik.eth.limo/general/2023/01/20/stealth.html) identifies paymasters as the practical solution to the "stealth address gas problem."

#### 3. Privacy Pool Integration
Auto-forward funds from stealth addresses into a privacy pool for forward secrecy — even if the stealth address is traced to the sender, the pool withdrawal breaks the link.

**Reference:** [Privacy Pools](https://hackmd.io/@pcaversaccio/ethereum-privacy-the-road-to-self-sovereignty) and the Ethereum Foundation's Kohaku effort.

#### 4. Unified Multi-Address Dashboard
Single wallet view aggregating all stealth addresses. The user sees one balance, but each payment lives at its own address.

**Reference:** [Fluidkey](https://docs.fluidkey.com/readme/frequently-asked-questions) does this — separate smart accounts per payment, unified dashboard on top.

## Research Links

- [Interactive No-Opt-In Stealth Addresses](https://ethresear.ch/t/interactive-no-opt-in-stealth-addresses/23274) — zemse's original proposal
- [An Incomplete Guide to Stealth Addresses](https://vitalik.eth.limo/general/2023/01/20/stealth.html) — Vitalik's technical overview
- [ERC-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564) — the standard we implement
- [ERC-6538: Stealth Meta-Address Registry](https://ethereum-magicians.org/t/stealth-meta-address-registry/12888) — registry standard
- [Fluidkey Docs](https://docs.fluidkey.com/readme/receiving-funds) — stealth address wallet with ENS integration
- [Umbra Protocol](https://github.com/ScopeLift/umbra-protocol) — reference ERC-5564 implementation by ScopeLift
- [Ethereum Privacy Roadmap](https://hackmd.io/@pcaversaccio/ethereum-privacy-the-road-to-self-sovereignty) — comprehensive privacy analysis
- [Kohaku: Ethereum Wallet Privacy](https://blog.quicknode.com/ethereum-kohaku-wallet-privacy-roadmap/) — Ethereum Foundation's privacy effort
- [Post-Quantum Stealth Addresses](https://eprint.iacr.org/2025/112.pdf) — future-proofing research

## Tech Stack

- Next.js 14, React 18, Chakra UI
- ethers.js v5, wagmi, elliptic
- ERC-5564 (Stealth Addresses), ERC-6538 (Meta-Address Registry)

## License

MIT
