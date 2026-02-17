# V2UI Terminal Aesthetic — Full App Migration Design

**Date:** 2026-02-18
**Branch:** feature/privacy-swaps
**Scope:** Full UI overhaul — replace Chakra UI with Tailwind CSS, apply V2UI terminal design, migrate sidebar to top navbar

---

## Overview

Port the V2UI prototype (Vite/React SPA with Tailwind, terminal aesthetic) into the production Next.js 14 App Router project. All existing hooks, backend integrations, contract calls, and API routes remain unchanged — only the UI layer is replaced.

**Design system:** Dark terminal aesthetic (`#06080F` background, `#00FF41` neon green accents, JetBrains Mono monospace font, glassmorphism cards with corner accents, Framer Motion animations)

---

## Phase 1: Config / Dependencies

### Remove
- `@chakra-ui/react`
- `@emotion/react`
- `@emotion/styled`

### Add
- `tailwindcss` + `postcss` + `autoprefixer`
- `lucide-react` (V2UI icon library)
- Keep: `framer-motion` (already installed)

### Files to create/update
- `tailwind.config.ts` — content paths, V2UI design tokens (colors, fonts, custom utilities)
- `postcss.config.js` — tailwind + autoprefixer
- `src/app/globals.css` — replace Chakra CSS vars with `@tailwind` directives + V2UI CSS custom properties
- `package.json` — dep changes
- `.eslintrc.*` or `eslint.config.*` — remove Chakra-specific rules if any
- `tsconfig.json` — no changes expected

### Tailwind design tokens (from V2UI)
```js
colors: {
  bg: '#06080F',
  card: 'rgba(255,255,255,0.02)',
  border: 'rgba(255,255,255,0.06)',
  green: '#00FF41',
  amber: '#FFB000',
  white: '#FFFFFF',
}
fonts: { mono: 'JetBrains Mono' }
```

---

## Phase 2: Layout / Navigation

### Replace sidebar with top navbar (`src/components/layout/Navbar.tsx`)

Layout:
```
[ DUST logo ]  |  Dashboard · Swap · Pools · Wallet · Links · Activities · Settings  |  [Chain] [address] [Disconnect]
```

- Fixed top bar, full width, `bg-[#06080F]`, `border-b border-[rgba(255,255,255,0.06)]`
- Active nav item: `text-[#00FF41] border-b-2 border-[#00FF41]`
- Mobile: hamburger → full-screen dropdown with all nav items
- V2UI background effects on root layout:
  - Subtle grid pattern (fixed, `opacity-[0.03]`)
  - Radial green glow (fixed, `bg-[radial-gradient(...)]`)
- `AppLayout.tsx` updated: no `ml-[240px]`, adds `pt-[topbar-height]`
- `ChainSelector` and wallet address/disconnect moved to navbar right side

### Files changed
- `src/components/layout/Navbar.tsx` (new, replaces Sidebar.tsx)
- `src/components/layout/AppLayout.tsx` (updated)
- `src/app/layout.tsx` (add background effects, font variables)
- `src/app/auth-layout-wrapper.tsx` (swap Sidebar for Navbar)

---

## Phase 3: Dashboard Page (`/dashboard`)

### Components (all new Tailwind implementations, real data wired in)

| Component | File | Data Source |
|-----------|------|-------------|
| `BalanceCard` | `src/components/dashboard/BalanceCard.tsx` | `useUnifiedBalance` → total, stealth, claimed ETH + unclaimed count |
| `ActivityCard` | `src/components/dashboard/ActivityCard.tsx` | `payments` (stealth scanner) + `outgoingPayments` (send hook) |
| `QuickActions` | `src/components/dashboard/QuickActions.tsx` | Triggers SendModal / ReceiveModal |
| `PrivacyPoolCard` | `src/components/dashboard/PrivacyPoolCard.tsx` | `useDustPool` → toggle claimToPool, deposit N payments, pool balance, withdraw |
| `PersonalLink` | `src/components/dashboard/PersonalLink.tsx` | `ownedNames` from AuthContext → `.tok` name, copy, QR |
| `AddressBreakdown` | `src/components/dashboard/AddressBreakdown.tsx` | `claimAddresses` + `unclaimedPayments` |
| `SendModal` | `src/components/send/SendModal.tsx` | Existing send logic (unchanged hook wiring) |
| `ReceiveModal` | `src/components/dashboard/ReceiveModal.tsx` | Existing receive (stealth meta-address, QR, copy) |
| `ConsolidateModal` | `src/components/dashboard/ConsolidateModal.tsx` | `dustPool.consolidate` with progress tracking |

### Design details
- All cards: `bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-sm backdrop-blur-sm`
- Corner accent overlays (4 corners, 2×2px border segments)
- Pulsing green dot for live status indicators
- Labels: `text-[9px] uppercase tracking-wider font-mono text-[rgba(255,255,255,0.5)]`
- Balances: `font-bold font-mono text-white text-3xl`
- Unclaimed pill: amber `bg-[rgba(255,176,0,0.1)] border-[rgba(255,176,0,0.2)] text-[#FFB000]`

### Page file: `src/app/dashboard/page.tsx`
All existing hook calls, `useEffect`s, `useCallback`s, and business logic preserved verbatim. Only Chakra `Box`/`Text`/`VStack`/`HStack` replaced with Tailwind `div`/`span`.

---

## Phase 4: Swap Page (`/swap`)

### Components

| Component | File | Data Source |
|-----------|------|-------------|
| `SwapCard` | `src/components/swap/SwapCard.tsx` | Existing swap hooks (note selection, output calc, execute) |
| `NoteSelector` | `src/components/swap/NoteSelector.tsx` | Real pool deposits / privacy notes |
| `OutputField` | `src/components/swap/OutputField.tsx` | Calculated output amount + stealth token |
| `SwapButton` | `src/components/swap/SwapButton.tsx` | Execute swap with loading state |
| `PoolStats` | `src/components/swap/PoolStats.tsx` | `usePoolStats` → TVL, ETH/USDC reserves, oracle price |
| `PoolComposition` | `src/components/swap/PoolComposition.tsx` | ETH/USDC ratio vertical bar chart |
| `DepositModal` | `src/components/swap/DepositModal.tsx` | Pool deposit flow |

### Layout
- Desktop: `[PoolStats] [SwapCard] [PoolComposition]` centered row
- Mobile: SwapCard full-width, stats below
- `PRIVACY_SWAP` header with animated online status dot

### Page file: `src/app/swap/page.tsx`
Existing `usePoolStats` hook preserved, swap execution logic unchanged.

---

## Phase 5: Remaining Pages

All pages converted from Chakra UI to Tailwind with V2UI terminal theme:

| Page | Key Features |
|------|-------------|
| `/pools` | Pool deposit/withdraw, note list, ZK proof status |
| `/activities` | Full transaction history, status badges (claimed/unclaimed/pending/completed) |
| `/wallet` | Wallet details, claim addresses list, balance per address |
| `/links` | `.tok` name management, QR codes, copy links |
| `/settings` | PIN change, chain config, claim address management, security |
| `/onboarding` | Step-by-step setup flow |

### Shared utility components (also migrated)
- `src/components/auth/PinGate.tsx` — PIN entry overlay in terminal style
- `src/components/ChainSelector.tsx` — Chain dropdown in terminal style
- `src/components/DustLogo.tsx` — Keep as-is (SVG component)

---

## Data Flow (unchanged)

```
AuthContext (address, stealthKeys, claimAddresses, ownedNames, activeChainId)
    ↓
useStealthScanner → payments[]
useUnifiedBalance → { total, stealthTotal, claimTotal, unclaimedCount }
useDustPool       → { poolBalance, deposits, consolidate, loadPoolDeposits }
usePoolStats      → { currentPrice, ethReserve, usdcReserve, totalValueLocked }
useStealthSend    → loadOutgoingPayments
    ↓
UI components (Tailwind) — display only, no business logic changes
```

---

## Implementation Order

1. Config setup (tailwind, package.json, globals.css)
2. Layout/Navbar
3. Dashboard components + page
4. Swap components + page
5. Remaining pages (pools, activities, wallet, links, settings, onboarding)
6. Shared components (PinGate, ChainSelector)
7. Remove all remaining Chakra UI imports

---

## Success Criteria

- [ ] All pages render with V2UI terminal aesthetic
- [ ] No Chakra UI imports remain
- [ ] All existing hook integrations work (scanner, send, pool, swap)
- [ ] `next build` completes without errors
- [ ] Responsive: mobile navbar collapses to hamburger
