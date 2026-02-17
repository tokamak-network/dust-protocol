# V2UI Terminal Aesthetic — Full App Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Chakra UI with Tailwind CSS, apply V2UI terminal aesthetic across all pages, migrate sidebar to top navbar, while preserving all hook/contract integrations exactly.

**Architecture:** Restyle-only migration — no business logic changes. Remove Chakra UI, add Tailwind CSS. Port V2UI components (dark terminal: `#06080F`/`#00FF41`/JetBrains Mono) into Next.js with real hook wiring. Replace fixed sidebar with top navbar containing all navigation items.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS 3, Framer Motion, Lucide React, Wagmi v2, existing hooks (useStealthScanner, useUnifiedBalance, useDustPool, usePoolStats, useSwapNotes, useDustSwap)

**V2UI reference files:** All in `/Users/sahil/work/current/thanos-stealth/V2UI/src/`

---

## Task 1: Install Tailwind, Remove Chakra UI

**Files:**
- Modify: `package.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Modify: `src/app/globals.css`
- Modify: `src/app/providers.tsx`

**Step 1: Update package.json — add Tailwind, remove Chakra UI**

Run:
```bash
npm remove @chakra-ui/react @emotion/react @emotion/styled
npm install -D tailwindcss postcss autoprefixer
npm install lucide-react
npx tailwindcss init -p --ts
```

**Step 2: Configure `tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-page': '#06080F',
        'green-neon': '#00FF41',
        'amber-neon': '#FFB000',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}

export default config
```

**Step 3: Update `src/app/globals.css`**

Replace entire file contents with:
```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-mono: 'JetBrains Mono', monospace;
}

html, body {
  background-color: #06080F;
  color: rgba(255, 255, 255, 0.92);
  color-scheme: dark;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Scrollbar */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0,255,65,0.3); }
```

**Step 4: Update `src/app/providers.tsx` — remove ChakraProvider**

```typescript
"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { http, fallback } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getSupportedChains } from "@/config/chains";
import { PRIVY_APP_ID, PRIVY_CONFIG, isPrivyEnabled } from "@/config/privy";

const supportedChains = getSupportedChains();
const viemChains = supportedChains.map(c => c.viemChain);
const transports = Object.fromEntries(
  supportedChains.map(c => [
    c.id,
    c.rpcUrls.length > 1
      ? fallback(c.rpcUrls.map(url => http(url)))
      : http(c.rpcUrls[0])
  ])
);

const config = createConfig({
  chains: viemChains as [typeof viemChains[0], ...typeof viemChains],
  transports,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  if (!isPrivyEnabled) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={PRIVY_CONFIG}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
```

**Step 5: Verify build compiles (TypeScript errors expected — we fix them in later tasks)**

```bash
npm run build 2>&1 | head -30
```

Expected: Chakra UI import errors in components — that's fine, we fix those next.

**Step 6: Commit**

```bash
git add tailwind.config.ts postcss.config.js src/app/globals.css src/app/providers.tsx package.json package-lock.json
git commit -m "feat: add tailwind css, remove chakra ui"
```

---

## Task 2: Update Root Layout + Background Effects

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Update layout.tsx to add background grid + glow (V2UI App.tsx pattern)**

```typescript
import type { Metadata } from "next";
import Script from "next/script";
import { Providers } from "./providers";
import { AuthLayoutWrapper } from "./auth-layout-wrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dust Protocol - Private Payments",
  description: "Stealth payment infrastructure for Tokamak Network - payments that dissolve into the blockchain",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="bg-[#06080F] text-white font-mono selection:bg-[#00FF41] selection:text-black">
        {/* Background grid effect */}
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />
        {/* Radial green glow */}
        <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,255,65,0.04),transparent_60%)]" />
        <div className="relative z-10">
          <Providers>
            <AuthLayoutWrapper>{children}</AuthLayoutWrapper>
          </Providers>
        </div>
      </body>
    </html>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add v2ui terminal background effects to root layout"
```

---

## Task 3: Create Top Navbar (Replace Sidebar)

**Files:**
- Create: `src/components/layout/Navbar.tsx`
- Modify: `src/components/layout/AppLayout.tsx`

**Step 1: Create `src/components/layout/Navbar.tsx`**

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useAuth } from "@/contexts/AuthContext";
import { DustLogo } from "@/components/DustLogo";
import { ChainSelector } from "@/components/ChainSelector";
import { MenuIcon, XIcon } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/swap", label: "Swap" },
  { href: "/pools", label: "Pools" },
  { href: "/wallet", label: "Wallet" },
  { href: "/links", label: "Links" },
  { href: "/activities", label: "Activity" },
  { href: "/settings", label: "Settings" },
];

export function Navbar() {
  const pathname = usePathname();
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { ownedNames } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName = ownedNames.length > 0
    ? `${ownedNames[0].name}.tok`
    : address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-[#06080F] border-b border-[rgba(255,255,255,0.06)] flex items-center px-4 md:px-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 mr-6 shrink-0">
          <DustLogo size={22} color="#00FF41" />
          <span className="text-sm font-bold tracking-widest text-white font-mono hidden sm:block">DUST</span>
        </Link>

        {/* Desktop nav items */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 text-[11px] font-mono tracking-wider transition-all rounded-sm ${
                pathname === item.href
                  ? 'text-[#00FF41] bg-[rgba(0,255,65,0.06)] border border-[rgba(0,255,65,0.15)]'
                  : 'text-[rgba(255,255,255,0.5)] hover:text-white hover:bg-[rgba(255,255,255,0.04)] border border-transparent'
              }`}
            >
              {item.label.toUpperCase()}
            </Link>
          ))}
        </div>

        {/* Right side: chain + address + disconnect */}
        <div className="hidden md:flex items-center gap-2 ml-auto">
          <ChainSelector />
          {displayName && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse" />
              <span className="text-[10px] font-mono text-[rgba(255,255,255,0.7)]">{displayName}</span>
            </div>
          )}
          <button
            onClick={() => disconnect()}
            className="px-2.5 py-1 text-[10px] font-mono text-[rgba(255,255,255,0.4)] border border-[rgba(255,255,255,0.06)] rounded-sm hover:text-white hover:border-[rgba(255,255,255,0.15)] transition-all"
          >
            DISCONNECT
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden ml-auto text-[rgba(255,255,255,0.6)] hover:text-white transition-colors"
        >
          {mobileOpen ? <XIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="fixed top-14 left-0 right-0 z-40 bg-[#06080F] border-b border-[rgba(255,255,255,0.06)] flex flex-col py-2">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`px-6 py-3 text-[11px] font-mono tracking-wider transition-all ${
                pathname === item.href
                  ? 'text-[#00FF41] bg-[rgba(0,255,65,0.04)]'
                  : 'text-[rgba(255,255,255,0.5)] hover:text-white hover:bg-[rgba(255,255,255,0.03)]'
              }`}
            >
              {item.label.toUpperCase()}
            </Link>
          ))}
          <div className="px-6 py-3 flex items-center gap-3">
            <ChainSelector />
            {address && (
              <button
                onClick={() => { disconnect(); setMobileOpen(false); }}
                className="text-[10px] font-mono text-[rgba(255,255,255,0.4)] hover:text-white"
              >
                DISCONNECT
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 2: Update `src/components/layout/AppLayout.tsx` — swap Sidebar for Navbar, remove Chakra Box**

```typescript
"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "./Navbar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isConnected, isOnboarded, isHydrated, address } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/" || pathname.startsWith("/pay/") || pathname === "/onboarding") return;
    if (!isHydrated) return;
    if (!isConnected) { router.replace("/"); return; }
    if (!address) return;
    if (!isOnboarded) { router.replace("/onboarding"); return; }
  }, [isConnected, isOnboarded, isHydrated, address, pathname, router]);

  // No layout for landing/onboarding/pay pages
  if (pathname === "/" || pathname === "/onboarding" || pathname.startsWith("/pay/")) {
    return <>{children}</>;
  }

  // Loading spinner
  if (!isHydrated || !isConnected || !address) {
    return (
      <div className="min-h-screen bg-[#06080F] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#00FF41] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06080F] text-white">
      <Navbar />
      <main className="pt-14">
        {children}
      </main>
    </div>
  );
}
```

**Step 3: Update ChainSelector to use Tailwind (since it uses Chakra UI)**

Read `src/components/ChainSelector.tsx` first, then replace Chakra Box/Text with Tailwind divs. The component should show current chain name with a dropdown to switch. Key props: `activeChainId` from `useAuth()`, `useSwitchChain()` from wagmi.

Minimal Tailwind version pattern:
```typescript
"use client";
import { useAuth } from "@/contexts/AuthContext";
import { useSwitchChain } from "wagmi";
import { getSupportedChains } from "@/config/chains";
import { useState } from "react";

export function ChainSelector() {
  const { activeChainId } = useAuth();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const chains = getSupportedChains();
  const current = chains.find(c => c.id === activeChainId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] text-[10px] font-mono text-[rgba(255,255,255,0.7)] hover:border-[rgba(0,255,65,0.2)] transition-all"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41]" />
        {current?.name ?? 'Unknown'}
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 bg-[#0a0d14] border border-[rgba(255,255,255,0.1)] rounded-sm min-w-[140px] z-50">
          {chains.map(chain => (
            <button
              key={chain.id}
              onClick={() => { switchChain({ chainId: chain.id }); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-[10px] font-mono transition-all hover:bg-[rgba(0,255,65,0.05)] hover:text-[#00FF41] ${
                chain.id === activeChainId ? 'text-[#00FF41]' : 'text-[rgba(255,255,255,0.6)]'
              }`}
            >
              {chain.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Verify**

```bash
npm run dev
```
Navigate to any page — should show top navbar with all items, no sidebar.

**Step 5: Commit**

```bash
git add src/components/layout/Navbar.tsx src/components/layout/AppLayout.tsx src/components/ChainSelector.tsx
git commit -m "feat: replace sidebar with top navbar (terminal style)"
```

---

## Task 4: Dashboard — BalanceCard Component

**Files:**
- Modify: `src/components/dashboard/UnifiedBalanceCard.tsx` (replace Chakra → Tailwind, keep props identical)

**Reference:** `V2UI/src/components/dashboard/BalanceCard.tsx`

**Step 1: Rewrite `UnifiedBalanceCard.tsx` with Tailwind**

```typescript
"use client";

import { motion } from "framer-motion";
import { RefreshCwIcon, EyeOffIcon, CheckIcon } from "lucide-react";
import { getChainConfig } from "@/config/chains";
import { useAuth } from "@/contexts/AuthContext";

interface UnifiedBalanceCardProps {
  total: number;
  stealthTotal: number;
  claimTotal: number;
  unclaimedCount: number;
  isScanning: boolean;
  isLoading: boolean;
  onRefresh: () => void;
}

export function UnifiedBalanceCard({
  total, stealthTotal, claimTotal, unclaimedCount, isScanning, isLoading, onRefresh,
}: UnifiedBalanceCardProps) {
  const { activeChainId } = useAuth();
  const chainConfig = getChainConfig(activeChainId);
  const symbol = chainConfig.nativeCurrency.symbol;
  const loading = isScanning || isLoading;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full p-6 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm relative overflow-hidden group"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-[#00FF41] shadow-[0_0_4px_#00FF41]"
          />
          <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
            BALANCE_OVERVIEW
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="text-[rgba(255,255,255,0.4)] hover:text-[#00FF41] transition-colors"
        >
          <RefreshCwIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Total balance */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white font-mono tracking-tight mb-1">
          {total.toFixed(4)} {symbol}
        </h2>
      </div>

      {/* Sub-totals */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 rounded-sm border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.01)]">
          <div className="flex items-center gap-1.5 mb-1">
            <EyeOffIcon className="w-3 h-3 text-[rgba(255,255,255,0.4)]" />
            <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">Stealth</span>
          </div>
          <span className="text-sm font-bold text-white font-mono">{stealthTotal.toFixed(4)} {symbol}</span>
        </div>
        <div className="p-3 rounded-sm border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.01)]">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckIcon className="w-3 h-3 text-[rgba(255,255,255,0.4)]" />
            <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">Claimed</span>
          </div>
          <span className="text-sm font-bold text-white font-mono">{claimTotal.toFixed(4)} {symbol}</span>
        </div>
      </div>

      {/* Unclaimed pill */}
      {unclaimedCount > 0 && (
        <div className="flex justify-center">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(255,176,0,0.1)] border border-[rgba(255,176,0,0.2)]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FFB000] animate-pulse" />
            <span className="text-[9px] text-[#FFB000] font-mono tracking-wide">
              {unclaimedCount} unclaimed payment{unclaimedCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[rgba(255,255,255,0.1)] rounded-tl-sm" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[rgba(255,255,255,0.1)] rounded-tr-sm" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[rgba(255,255,255,0.1)] rounded-bl-sm" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[rgba(255,255,255,0.1)] rounded-br-sm" />
    </motion.div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/UnifiedBalanceCard.tsx
git commit -m "feat: port UnifiedBalanceCard to tailwind terminal style"
```

---

## Task 5: Dashboard — ActivityCard Component

**Files:**
- Modify: `src/components/dashboard/RecentActivityCard.tsx`

**Reference:** `V2UI/src/components/dashboard/ActivityCard.tsx`

Read current `src/components/dashboard/RecentActivityCard.tsx` to understand existing props (accepts `payments` and `outgoingPayments` arrays), then rewrite with Tailwind styling matching the V2UI ActivityCard design.

**Key props interface to preserve:**
```typescript
interface RecentActivityCardProps {
  payments: PaymentNote[];       // from useStealthScanner
  outgoingPayments: OutgoingPayment[];  // from loadOutgoingPayments
}
```

**Design pattern:**
- Each row: icon (ArrowDownLeftIcon green for in, ArrowUpRightIcon white for out) + amount + address + time + status badge
- Status badges: `claimed`/`completed` → green pill, `unclaimed` → amber pill, `pending` → white/muted pill
- `View All` button → links to `/activities`

```typescript
"use client";

import { motion } from "framer-motion";
import { ArrowUpRightIcon, ArrowDownLeftIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import type { PaymentNote } from "@/lib/design/types";
import type { OutgoingPayment } from "@/lib/design/types";

interface RecentActivityCardProps {
  payments: PaymentNote[];
  outgoingPayments: OutgoingPayment[];
}

type ActivityItem = {
  type: 'in' | 'out';
  amount: string;
  address: string;
  time: string;
  status: 'claimed' | 'unclaimed' | 'pending' | 'completed';
};

function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function RecentActivityCard({ payments, outgoingPayments }: RecentActivityCardProps) {
  const inbound: ActivityItem[] = payments.slice(0, 4).map(p => ({
    type: 'in',
    amount: `${parseFloat(p.balance || p.amount || '0').toFixed(4)} ETH`,
    address: `from ${formatAddress(p.from || p.stealthAddress || '0x')}`,
    time: p.timestamp ? timeAgo(p.timestamp * 1000) : '—',
    status: p.claimed ? 'claimed' : 'unclaimed',
  }));
  const outbound: ActivityItem[] = outgoingPayments.slice(0, 2).map(p => ({
    type: 'out',
    amount: `${parseFloat(p.amount || '0').toFixed(4)} ETH`,
    address: `to ${formatAddress(p.to || '0x')}`,
    time: p.timestamp ? timeAgo(p.timestamp) : '—',
    status: 'completed',
  }));
  const all = [...inbound, ...outbound].slice(0, 6);

  const badgeClass = (status: string) => {
    if (status === 'claimed' || status === 'completed')
      return 'bg-[rgba(0,255,65,0.05)] border-[rgba(0,255,65,0.1)] text-[#00FF41]';
    if (status === 'unclaimed')
      return 'bg-[rgba(255,176,0,0.05)] border-[rgba(255,176,0,0.1)] text-[#FFB000]';
    return 'bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.4)]';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.5 }}
      className="w-full p-6 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm relative overflow-hidden"
    >
      <div className="flex justify-between items-center mb-4">
        <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">RECENT_ACTIVITY</span>
        <Link href="/activities" className="flex items-center gap-1 text-[9px] text-[rgba(255,255,255,0.4)] hover:text-[#00FF41] transition-colors font-mono">
          View All <ExternalLinkIcon className="w-2.5 h-2.5" />
        </Link>
      </div>

      {all.length === 0 && (
        <p className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono text-center py-4">
          No activity yet
        </p>
      )}

      <div className="flex flex-col">
        {all.map((tx, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-[rgba(255,255,255,0.03)] last:border-0 hover:bg-[rgba(255,255,255,0.02)] -mx-2 px-2 rounded-sm transition-colors">
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-full ${tx.type === 'in' ? 'bg-[rgba(0,255,65,0.1)] text-[#00FF41]' : 'bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.6)]'}`}>
                {tx.type === 'in' ? <ArrowDownLeftIcon className="w-3 h-3" /> : <ArrowUpRightIcon className="w-3 h-3" />}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white font-mono">{tx.amount}</span>
                <span className="text-[9px] text-[rgba(255,255,255,0.4)] font-mono">{tx.address}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[9px] text-[rgba(255,255,255,0.3)] font-mono">{tx.time}</span>
              <div className={`px-1.5 py-0.5 rounded-full text-[8px] font-mono uppercase tracking-wide border ${badgeClass(tx.status)}`}>
                {tx.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
```

**Step 2: Check what types PaymentNote and OutgoingPayment look like**

```bash
grep -r "PaymentNote\|OutgoingPayment" src/lib/design/types.ts
```

Adjust field names (`p.from`, `p.stealthAddress`, `p.amount`, `p.balance`, `p.timestamp`, `p.claimed`) to match actual type definitions.

**Step 3: Commit**

```bash
git add src/components/dashboard/RecentActivityCard.tsx
git commit -m "feat: port RecentActivityCard to tailwind terminal style"
```

---

## Task 6: Dashboard — PrivacyPoolCard Component

**Files:**
- Modify: (inline in dashboard page — currently rendered inline in `src/app/dashboard/page.tsx`)

Since the Privacy Pool section is currently inlined in the dashboard page, extract it to a component:

**Create: `src/components/dashboard/PrivacyPoolCard.tsx`**

```typescript
"use client";

import { motion } from "framer-motion";
import { ShieldIcon, ToggleLeftIcon, ToggleRightIcon } from "lucide-react";

interface PrivacyPoolCardProps {
  claimToPool: boolean;
  onToggle: () => void;
  poolBalance: string;
  depositCount: number;
  poolEligibleCount: number;
  isDepositing: boolean;
  depositProgress: { done: number; total: number; message: string };
  onWithdraw: () => void;
  onDepositAll: () => void;
  symbol: string;
}

export function PrivacyPoolCard({
  claimToPool, onToggle, poolBalance, depositCount,
  poolEligibleCount, isDepositing, depositProgress,
  onWithdraw, onDepositAll, symbol,
}: PrivacyPoolCardProps) {
  const hasPoolBalance = parseFloat(poolBalance) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="w-full p-6 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm relative overflow-hidden"
    >
      {/* Header with toggle */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <ShieldIcon className="w-3.5 h-3.5 text-[#00FF41]" />
          <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">PRIVACY_POOL</span>
        </div>
        <button
          onClick={onToggle}
          className={`transition-colors ${claimToPool ? 'text-[#00FF41]' : 'text-[rgba(255,255,255,0.3)]'}`}
        >
          {claimToPool
            ? <ToggleRightIcon className="w-6 h-6" />
            : <ToggleLeftIcon className="w-6 h-6" />
          }
        </button>
      </div>

      {claimToPool && (
        <div className="mb-4 text-[10px] text-[rgba(255,255,255,0.4)] font-mono border-l-2 border-[#00FF41] pl-2">
          Auto-routing enabled — payments held for batch deposit
        </div>
      )}

      {/* Pool balance */}
      {hasPoolBalance && (
        <div className="flex items-baseline gap-3 mb-6">
          <span className="text-2xl font-bold text-white font-mono tracking-tight">
            {parseFloat(poolBalance).toFixed(4)} {symbol}
          </span>
          <span className="text-[10px] text-[#00FF41] font-mono">
            {depositCount} deposit{depositCount !== 1 ? 's' : ''} ready
          </span>
        </div>
      )}

      {/* Progress indicator while depositing */}
      {isDepositing && (
        <div className="mb-4">
          <p className="text-[11px] text-[#00FF41] font-mono mb-2">{depositProgress.message || 'Depositing...'}</p>
          {depositProgress.total > 0 && (
            <div className="h-1 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00FF41] rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, (depositProgress.done / depositProgress.total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className={`grid gap-3 ${hasPoolBalance ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {hasPoolBalance && (
          <button
            onClick={onWithdraw}
            className="py-2 px-3 rounded-sm border border-[rgba(0,255,65,0.2)] hover:border-[#00FF41] hover:bg-[rgba(0,255,65,0.08)] transition-all text-xs font-bold text-[#00FF41] font-mono"
          >
            [ WITHDRAW ]
          </button>
        )}
        {claimToPool && poolEligibleCount > 0 && !isDepositing && (
          <button
            onClick={onDepositAll}
            className="py-2 px-3 rounded-sm border border-[rgba(255,255,255,0.1)] hover:border-[#00FF41] hover:bg-[rgba(0,255,65,0.05)] transition-all text-xs font-bold text-white hover:text-[#00FF41] font-mono"
          >
            [ DEPOSIT {poolEligibleCount} ]
          </button>
        )}
        {claimToPool && poolEligibleCount === 0 && !hasPoolBalance && !isDepositing && (
          <p className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono text-center py-2">
            No eligible payments yet
          </p>
        )}
      </div>

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[rgba(255,255,255,0.1)] rounded-tl-sm" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[rgba(255,255,255,0.1)] rounded-tr-sm" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[rgba(255,255,255,0.1)] rounded-bl-sm" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[rgba(255,255,255,0.1)] rounded-br-sm" />
    </motion.div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/PrivacyPoolCard.tsx
git commit -m "feat: add PrivacyPoolCard component (tailwind terminal style)"
```

---

## Task 7: Dashboard — PersonalLink + AddressBreakdown Components

**Files:**
- Modify: `src/components/dashboard/PersonalLinkCard.tsx`
- Modify: `src/components/dashboard/AddressBreakdownCard.tsx`

**Reference:** `V2UI/src/components/dashboard/PersonalLink.tsx`, `V2UI/src/components/dashboard/AddressBreakdown.tsx`

Read those V2UI files, then rewrite current Chakra components preserving exact props/logic, applying V2UI terminal CSS.

For `PersonalLinkCard`: shows `.tok` name, copy button (uses `navigator.clipboard`), and a QR code link. Props: `ownedNames: OwnedName[]`, `metaAddress: string | null`.

For `AddressBreakdownCard`: shows list of claim addresses with their balances. Props: `claimAddresses: ClaimAddress[]`, `unclaimedPayments: PaymentNote[]`.

Key design patterns to use:
```typescript
// Card wrapper (reuse on all components):
className="w-full p-6 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm relative overflow-hidden"

// Section label:
className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono"

// Copy button:
className="px-2 py-0.5 rounded-sm border border-[rgba(255,255,255,0.1)] hover:border-[#00FF41] hover:text-[#00FF41] text-[10px] font-mono transition-all"
```

**Step 2: Commit**

```bash
git add src/components/dashboard/PersonalLinkCard.tsx src/components/dashboard/AddressBreakdownCard.tsx
git commit -m "feat: port PersonalLinkCard and AddressBreakdownCard to tailwind"
```

---

## Task 8: Dashboard — Modals (Send, Receive, Consolidate)

**Files:**
- Read + modify: `src/components/send/SendModal.tsx`
- Modify: `src/components/dashboard/ReceiveModal.tsx`
- Modify: `src/components/dashboard/ConsolidateModal.tsx`

**Reference:** `V2UI/src/components/dashboard/SendModal.tsx`, `V2UI/src/components/dashboard/ReceiveModal.tsx`, `V2UI/src/components/dashboard/WithdrawModal.tsx`

**Pattern for all modals (from V2UI SendModal):**

```typescript
// Overlay:
className="fixed inset-0 z-50 flex items-center justify-center p-4"

// Backdrop:
className="absolute inset-0 bg-black/80 backdrop-blur-sm"

// Modal container:
className="relative w-full max-w-[440px] p-6 rounded-md border border-[rgba(255,255,255,0.1)] bg-[#06080F] shadow-2xl overflow-hidden"

// Form label:
className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono"

// Input:
className="w-full p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-sm focus:outline-none focus:border-[#00FF41] focus:bg-[rgba(0,255,65,0.02)] transition-all placeholder-[rgba(255,255,255,0.2)]"

// Primary action button:
className="w-full py-3 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] hover:shadow-[0_0_15px_rgba(0,255,65,0.15)] transition-all"
```

For each modal:
1. Read current file fully
2. Keep ALL existing state/hooks/handlers unchanged
3. Replace only Chakra Box/Text/Input/Button with Tailwind divs matching V2UI design
4. Keep AnimatePresence + motion.div from Framer Motion

**Step 2: Commit**

```bash
git add src/components/send/SendModal.tsx src/components/dashboard/ReceiveModal.tsx src/components/dashboard/ConsolidateModal.tsx
git commit -m "feat: port dashboard modals to tailwind terminal style"
```

---

## Task 9: Dashboard Page

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Update dashboard page — replace Chakra Box/VStack/HStack/Text with Tailwind divs**

Keep ALL existing business logic exactly. Replace structural elements only:

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStealthScanner, useUnifiedBalance, useDustPool } from "@/hooks/stealth";
import { getChainConfig } from "@/config/chains";
import { UnifiedBalanceCard } from "@/components/dashboard/UnifiedBalanceCard";
import { AddressBreakdownCard } from "@/components/dashboard/AddressBreakdownCard";
import { PersonalLinkCard } from "@/components/dashboard/PersonalLinkCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { PrivacyPoolCard } from "@/components/dashboard/PrivacyPoolCard";
import { SendModal } from "@/components/send/SendModal";
import { ReceiveModal } from "@/components/dashboard/ReceiveModal";
import { ConsolidateModal } from "@/components/dashboard/ConsolidateModal";
import { loadOutgoingPayments } from '@/hooks/stealth/useStealthSend';
import type { OutgoingPayment } from '@/lib/design/types';

function claimToPoolKey(address: string, chainId: number): string {
  return `dust_claim_to_pool_${chainId}_${address.toLowerCase()}`;
}

export default function DashboardPage() {
  const { stealthKeys, metaAddress, ownedNames, claimAddresses, refreshClaimBalances, claimAddressesInitialized, activeChainId, address } = useAuth();
  const chainConfig = getChainConfig(activeChainId);
  const [claimToPool, setClaimToPool] = useState(() => {
    if (typeof window === 'undefined' || !address) return false;
    return localStorage.getItem(claimToPoolKey(address, activeChainId)) === 'true';
  });
  const { payments, scan, scanInBackground, stopBackgroundScan, isScanning, depositToPool } = useStealthScanner(stealthKeys, { claimToPool, chainId: activeChainId });
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showConsolidateModal, setShowConsolidateModal] = useState(false);
  const [outgoingPayments, setOutgoingPayments] = useState<OutgoingPayment[]>([]);

  useEffect(() => {
    if (address) setOutgoingPayments(loadOutgoingPayments(address, activeChainId));
  }, [address, activeChainId, showSendModal]);

  const dustPool = useDustPool(activeChainId);
  const [depositingToPool, setDepositingToPool] = useState(false);
  const [poolDepositProgress, setPoolDepositProgress] = useState({ done: 0, total: 0, message: '' });
  const depositingRef = useRef(false);

  const tokName = ownedNames.length > 0 ? `${ownedNames[0].name}.tok` : null;
  const payPath = ownedNames.length > 0 ? `/pay/${ownedNames[0].name}` : "";

  const unified = useUnifiedBalance({ payments, claimAddresses, refreshClaimBalances, claimAddressesInitialized });

  const handleRefresh = useCallback(() => {
    scan(); refreshClaimBalances(); dustPool.loadPoolDeposits();
  }, [scan, refreshClaimBalances, dustPool.loadPoolDeposits]);

  useEffect(() => {
    if (typeof window === 'undefined' || !address) return;
    setClaimToPool(localStorage.getItem(claimToPoolKey(address, activeChainId)) === 'true');
  }, [address, activeChainId]);

  useEffect(() => {
    if (stealthKeys) {
      scanInBackground();
      return () => stopBackgroundScan();
    }
  }, [stealthKeys, scanInBackground, stopBackgroundScan]);

  useEffect(() => {
    if (claimToPool && stealthKeys) scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimToPool]);

  const poolEligibleCount = payments.filter(p => {
    if (p.claimed || p.keyMismatch) return false;
    if (p.walletType !== 'create2' && p.walletType !== 'account' && p.walletType !== 'eip7702') return false;
    return parseFloat(p.balance || '0') > 0.0001;
  }).length;

  const handleDepositAll = async () => {
    if (depositingRef.current) return;
    depositingRef.current = true;
    setDepositingToPool(true);
    setPoolDepositProgress({ done: 0, total: poolEligibleCount, message: 'Starting pool deposits...' });
    try {
      stopBackgroundScan();
      const result = await depositToPool((done, total, message) => {
        setPoolDepositProgress({ done, total, message });
      });
      dustPool.loadPoolDeposits();
      if (result.deposited > 0) scan();
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error('[PoolDeposit] Unexpected error:', err);
      setPoolDepositProgress({ done: 0, total: 0, message: 'Deposit failed — check console' });
      await new Promise(r => setTimeout(r, 5000));
    } finally {
      setDepositingToPool(false);
      depositingRef.current = false;
      scanInBackground();
    }
  };

  return (
    <div className="px-4 md:px-6 py-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-widest text-white font-mono mb-1">
          STEALTH_WALLET
        </h1>
        <p className="text-xs text-[rgba(255,255,255,0.4)] font-mono tracking-wide">
          Privacy-first asset management
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <UnifiedBalanceCard
          total={unified.total}
          stealthTotal={unified.stealthTotal}
          claimTotal={unified.claimTotal}
          unclaimedCount={unified.unclaimedCount}
          isScanning={isScanning}
          isLoading={unified.isLoading}
          onRefresh={handleRefresh}
        />

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowSendModal(true)}
            className="py-3 px-4 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] transition-all text-sm font-bold text-[#00FF41] font-mono"
          >
            [ SEND ]
          </button>
          <button
            onClick={() => setShowReceiveModal(true)}
            className="py-3 px-4 rounded-sm border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.3)] hover:bg-[rgba(255,255,255,0.03)] transition-all text-sm font-bold text-white font-mono"
          >
            [ RECEIVE ]
          </button>
        </div>

        <PrivacyPoolCard
          claimToPool={claimToPool}
          onToggle={() => {
            const next = !claimToPool;
            setClaimToPool(next);
            if (address) localStorage.setItem(claimToPoolKey(address, activeChainId), String(next));
          }}
          poolBalance={dustPool.poolBalance}
          depositCount={dustPool.deposits.filter(d => !d.withdrawn).length}
          poolEligibleCount={poolEligibleCount}
          isDepositing={depositingToPool}
          depositProgress={poolDepositProgress}
          onWithdraw={() => setShowConsolidateModal(true)}
          onDepositAll={handleDepositAll}
          symbol={chainConfig.nativeCurrency.symbol}
        />

        <PersonalLinkCard ownedNames={ownedNames} metaAddress={metaAddress} />
        <AddressBreakdownCard claimAddresses={unified.claimAddresses} unclaimedPayments={unified.unclaimedPayments} />
        <RecentActivityCard payments={payments} outgoingPayments={outgoingPayments} />
      </div>

      <SendModal isOpen={showSendModal} onClose={() => { setShowSendModal(false); scan(); }} />
      <ReceiveModal isOpen={showReceiveModal} onClose={() => setShowReceiveModal(false)} tokName={tokName} payPath={payPath} />
      <ConsolidateModal
        isOpen={showConsolidateModal}
        onClose={() => setShowConsolidateModal(false)}
        deposits={dustPool.deposits}
        poolBalance={dustPool.poolBalance}
        progress={dustPool.progress}
        onConsolidate={dustPool.consolidate}
        onReset={dustPool.resetProgress}
        isConsolidating={dustPool.isConsolidating}
      />
    </div>
  );
}
```

**Step 2: Verify dashboard renders**

```bash
npm run dev
```
Navigate to `/dashboard`. Should show terminal-style balance card, quick actions, pool card, activity.

**Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: port dashboard page to tailwind terminal style"
```

---

## Task 10: Swap — NoteSelector + OutputField + SwapButton

**Files:**
- Create: `src/components/swap/NoteSelector.tsx` (port from V2UI)
- Create/Modify: terminal-style TokenInput wrapper

**Reference:** `V2UI/src/components/NoteSelector.tsx`, `V2UI/src/components/OutputField.tsx`, `V2UI/src/components/SwapButton.tsx`

Read V2UI `NoteSelector.tsx` fully, then create Tailwind version that accepts real note type from `useSwapNotes()`:

```typescript
// Real note type from useSwapNotes:
interface SwapNote {
  id: string;
  amount: string;     // "0.1", "0.5", etc.
  token: string;      // "ETH", "USDC"
  commitment?: string;
}
```

Port V2UI `NoteSelector` with dropdown, selecting the note, displaying amount/token. Make it accept real `SwapNote[]` from the hook.

Port V2UI `SwapButton` with animated cursor blink and loading state.

**Step 2: Commit**

```bash
git add src/components/swap/NoteSelector.tsx
git commit -m "feat: add terminal-style NoteSelector for swap"
```

---

## Task 11: Swap — SwapCard Component

**Files:**
- Modify: `src/components/swap/SwapCard.tsx`

**Reference:** `V2UI/src/components/SwapCard.tsx`

Read the current `src/components/swap/SwapCard.tsx` fully (it has complex hook wiring for `useSwapNotes`, `useDustSwap`, `useSwapMerkleTree`, `useDustSwapPool`, `useSwapQuote`). Keep ALL hook calls and state. Replace only Chakra Box/VStack/HStack/Text/Spinner with Tailwind.

Key visual elements to port from V2UI:
- Card container with corner accents
- Header: `PRIVACY_SWAP` label + green ONLINE pill
- `+ Deposit` button top-right
- Note selector (input from hook's `unspentNotes`)
- Arrow divider (ArrowDownIcon)
- Output field (token + amount)
- Exchange rate display
- Swap action button with loading states
- Status footer (notes in pool count)

All swap execution logic (ZK proof, relayer submission, `SwapExecuteModal`) stays identical.

**Step 2: Verify swap card renders**

```bash
npm run dev
```
Navigate to `/swap`. Should show terminal swap card with real pool notes.

**Step 3: Commit**

```bash
git add src/components/swap/SwapCard.tsx
git commit -m "feat: port SwapCard to tailwind terminal style"
```

---

## Task 12: Swap — PoolStats + PoolComposition Components

**Files:**
- Modify: `src/components/swap/PoolStats.tsx`
- Create: `src/components/swap/PoolComposition.tsx`

**Reference:** `V2UI/src/components/PoolStats.tsx`, `V2UI/src/components/PoolComposition.tsx`

**PoolStats** — port V2UI's 3-card vertical stack (TVL, Notes, Oracle) using real data from `usePoolStats()`:

```typescript
interface PoolStatsProps {
  currentPrice: number;    // oracle price (ETH in USDC)
  ethReserve: string;      // ETH notes count or amount
  usdcReserve: string;     // USDC notes count or amount
  totalValueLocked: string;
  isLoading: boolean;
  poolTick?: number;
}
```

**PoolComposition** — vertical bar chart showing ETH vs USDC ratio, matching V2UI `PoolComposition.tsx`. Read that file and port it with real pool data.

**Step 2: Commit**

```bash
git add src/components/swap/PoolStats.tsx src/components/swap/PoolComposition.tsx
git commit -m "feat: port PoolStats and PoolComposition to tailwind terminal style"
```

---

## Task 13: Swap Page

**Files:**
- Modify: `src/app/swap/page.tsx`

```typescript
"use client";

import { SwapCard } from "@/components/swap/SwapCard";
import { PoolStats } from "@/components/swap/PoolStats";
import { PoolComposition } from "@/components/swap/PoolComposition";
import { usePoolStats } from "@/hooks/swap/usePoolStats";

export default function SwapPage() {
  const { currentPrice, ethReserve, usdcReserve, totalValueLocked, isLoading, tick } = usePoolStats();

  return (
    <div className="px-4 md:px-6 py-8 flex flex-col items-center">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-widest text-white font-mono mb-1">
          STEALTH_SWAP
        </h1>
        <p className="text-xs text-[rgba(255,255,255,0.4)] font-mono tracking-wide">
          Private, slippage-free swaps via ZK proofs
        </p>
      </div>

      {/* Main row */}
      <div className="flex items-stretch justify-center gap-4 w-full max-w-[720px]">
        <div className="hidden md:flex">
          <PoolStats
            currentPrice={currentPrice}
            ethReserve={ethReserve}
            usdcReserve={usdcReserve}
            totalValueLocked={totalValueLocked}
            isLoading={isLoading}
            poolTick={tick ?? undefined}
          />
        </div>
        <SwapCard />
        <div className="hidden md:flex">
          <PoolComposition
            ethReserve={ethReserve}
            usdcReserve={usdcReserve}
          />
        </div>
      </div>

      {/* Mobile: stats below */}
      <div className="flex flex-col items-center gap-3 md:hidden w-full mt-4">
        <PoolStats
          currentPrice={currentPrice}
          ethReserve={ethReserve}
          usdcReserve={usdcReserve}
          totalValueLocked={totalValueLocked}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/swap/page.tsx
git commit -m "feat: port swap page to tailwind terminal style"
```

---

## Task 14: Remaining Pages — Activities + Pools

**Files:**
- Read + modify: `src/app/activities/page.tsx`
- Read + modify: `src/app/pools/page.tsx`

Read both files first, then replace Chakra UI with Tailwind using V2UI design tokens.

**Shared card pattern** (create a reusable utility):

```typescript
// Use this class pattern for all cards:
const cardClass = "w-full p-6 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm relative";
const sectionLabel = "text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono";
```

Activities page: full payment list with status badges and filters (same design as `RecentActivityCard` but expanded).

Pools page: deposit/withdraw forms, ZK proof status, pool statistics — style with terminal aesthetic.

**Step 2: Commit**

```bash
git add src/app/activities/page.tsx src/app/pools/page.tsx
git commit -m "feat: port activities and pools pages to tailwind terminal style"
```

---

## Task 15: Remaining Pages — Wallet + Links + Settings

**Files:**
- Read + modify: `src/app/wallet/page.tsx`
- Read + modify: `src/app/links/page.tsx`
- Read + modify: `src/app/settings/page.tsx`

Read each file first, then replace Chakra UI with Tailwind using terminal design.

Wallet: claim addresses list, balance per address, claim actions.
Links: `.tok` name management, QR code display, copy buttons.
Settings: PIN change form, chain config, security options.

**Input fields for settings/forms:**

```typescript
// Standard input:
className="w-full p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-sm focus:outline-none focus:border-[#00FF41] focus:bg-[rgba(0,255,65,0.02)] transition-all placeholder-[rgba(255,255,255,0.2)]"
```

**Step 2: Commit**

```bash
git add src/app/wallet/page.tsx src/app/links/page.tsx src/app/settings/page.tsx
git commit -m "feat: port wallet, links, settings pages to tailwind terminal style"
```

---

## Task 16: Onboarding Page + PinGate

**Files:**
- Read + modify: `src/app/onboarding/page.tsx`
- Read + modify: `src/components/auth/PinGate.tsx`

Read each file first.

PinGate: Full-screen overlay with PIN input grid — terminal style:
```typescript
// PIN digit box:
className="w-12 h-14 rounded-sm border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] text-center text-xl font-bold font-mono text-white focus:border-[#00FF41] focus:outline-none focus:bg-[rgba(0,255,65,0.02)] transition-all"
```

Onboarding: step-by-step setup wizard — terminal step indicators.

**Step 2: Commit**

```bash
git add src/app/onboarding/page.tsx src/components/auth/PinGate.tsx
git commit -m "feat: port onboarding and PinGate to tailwind terminal style"
```

---

## Task 17: Landing Page

**Files:**
- Read + modify: `src/app/page.tsx`

Read current landing page. Apply terminal aesthetic — hero section with `DUST_PROTOCOL` heading, connect wallet CTA. The landing page doesn't use the navbar (excluded in AppLayout).

**Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: port landing page to tailwind terminal style"
```

---

## Task 18: Final Cleanup

**Files:**
- Modify: `src/lib/design/tokens.ts` (keep for any non-UI code that imports it, but can be archived)
- Glob search for remaining Chakra imports

**Step 1: Find any remaining Chakra UI imports**

```bash
grep -r "@chakra-ui" src/ --include="*.tsx" --include="*.ts" -l
```

For each file found: read it, remove all Chakra UI imports, replace with Tailwind.

**Step 2: Verify full build**

```bash
npm run build
```

Expected: 0 errors. If errors exist, fix them before proceeding.

**Step 3: Check for TypeScript errors**

```bash
npx tsc --noEmit
```

Fix any type errors.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete v2ui terminal migration — remove all chakra ui"
```

---

## Success Criteria

- [ ] `npm run build` completes without errors
- [ ] No `@chakra-ui` imports remain in `src/`
- [ ] All pages render with terminal aesthetic (`#06080F` bg, `#00FF41` accents, JetBrains Mono)
- [ ] Top navbar shows all nav items, active state highlighted green
- [ ] Dashboard: balance, activity, pool card, quick actions all working with real data
- [ ] Swap: note selection, ZK proof execution, pool stats working
- [ ] Mobile: navbar collapses to hamburger
- [ ] Background grid + glow visible on all pages
