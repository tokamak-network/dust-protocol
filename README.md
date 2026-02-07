# Dust Protocol

Private payment infrastructure on Tokamak Network. Send and receive untraceable payments using stealth addresses and `.tok` names.

## Features

- **Stealth Addresses** — Payments go to one-time addresses that can't be linked to your identity
- **`.tok` Names** — Human-readable addresses (`alice.tok`, `coffee.alice.tok`)
- **Payment Links** — Create shareable links for receiving payments
- **Sponsored Gas** — All protocol operations are gasless for users
- **Real-time Scanning** — Automatic detection of incoming payments

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

## How It Works

1. **Connect wallet** and derive stealth keys from a signature
2. **Register a `.tok` name** linked to your stealth meta-address
3. **Share your name** — senders visit `yourname.tok` to pay privately
4. **Scan & claim** — the app detects payments and claims them to your wallet

## Tech Stack

- Next.js 14, React 18, Chakra UI
- ethers.js v5, wagmi, elliptic
- ERC-5564 (Stealth Addresses), ERC-6538 (Meta-Address Registry)

## License

MIT
