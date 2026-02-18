"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useAuth } from "@/contexts/AuthContext";
import { DustLogo } from "@/components/DustLogo";
import { getSupportedChains } from "@/config/chains";
import { ChainIcon as ChainTokenIcon } from "@/components/stealth/icons";
import { MenuIcon, XIcon, ChevronDownIcon, CopyIcon, LogOutIcon, CheckIcon } from "lucide-react";

const chains = getSupportedChains();

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
  const { ownedNames, activeChainId, setActiveChain } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const walletRef = useRef<HTMLDivElement>(null);

  const activeChain = chains.find(c => c.id === activeChainId) || chains[0];

  const displayName = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  // Close wallet dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) {
        setWalletOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#06080F] border-b border-[rgba(255,255,255,0.06)] flex items-center px-4 lg:px-8">

        {/* Left — logo */}
        <div className="flex-1 flex items-center min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <DustLogo size={26} color="#00FF41" />
            <span className="flex items-baseline gap-1.5">
              <span className="text-base font-bold tracking-widest text-white font-mono">DUST</span>
              <span className="hidden sm:inline text-[10px] font-mono tracking-[0.25em] text-[rgba(0,255,65,0.35)] uppercase">PROTOCOL</span>
            </span>
          </Link>
        </div>

        {/* Center — nav links, truly centered, collapses on small screens */}
        <div className="hidden md:flex items-center gap-0.5 shrink-0">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex items-center px-3 py-1.5 text-[11px] font-mono tracking-wider transition-all rounded-sm whitespace-nowrap ${
                pathname === item.href
                  ? 'text-[#00FF41] bg-[rgba(0,255,65,0.06)] border border-[rgba(0,255,65,0.15)]'
                  : 'text-[rgba(255,255,255,0.5)] hover:text-white hover:bg-[rgba(255,255,255,0.04)] border border-transparent'
              }`}
            >
              {item.label.toUpperCase()}
            </Link>
          ))}
        </div>

        {/* Right — wallet button always visible + hamburger for small screens */}
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          <div className="relative shrink-0" ref={walletRef}>
            {displayName ? (
              <>
                <button
                  onClick={() => setWalletOpen(v => !v)}
                  className="flex items-center gap-2 px-3 py-2 rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(0,255,65,0.2)] hover:bg-[rgba(255,255,255,0.04)] transition-all"
                >
                  <ChainTokenIcon size={18} chainId={activeChain.id} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse shrink-0" />
                  <span className="text-xs font-mono text-[rgba(255,255,255,0.85)]">{displayName}</span>
                  <ChevronDownIcon
                    className="w-3.5 h-3.5 text-[rgba(255,255,255,0.4)] transition-transform duration-150"
                    style={{ transform: walletOpen ? "rotate(180deg)" : "none" }}
                  />
                </button>

                {walletOpen && (
                  <div className="absolute top-full mt-2 right-0 bg-[#0a0d14] border border-[rgba(255,255,255,0.1)] rounded-sm min-w-[230px] z-50 overflow-hidden">
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-[11px] font-mono text-[rgba(255,255,255,0.3)] tracking-widest">NETWORK</span>
                    </div>
                    {chains.map(chain => {
                      const isActive = chain.id === activeChainId;
                      return (
                        <button
                          key={chain.id}
                          onClick={() => { setActiveChain(chain.id); setWalletOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-xs font-mono transition-all flex items-center gap-2.5 ${
                            isActive
                              ? 'text-[#00FF41] bg-[rgba(0,255,65,0.05)]'
                              : 'text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white'
                          }`}
                        >
                          <ChainTokenIcon size={16} chainId={chain.id} />
                          <span className="flex-1">{chain.name}</span>
                          {isActive && <span className="text-[#00FF41]">●</span>}
                        </button>
                      );
                    })}
                    <div className="border-t border-[rgba(255,255,255,0.06)] mt-1" />
                    <button
                      onClick={copyAddress}
                      className="w-full text-left px-4 py-3 text-xs font-mono text-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white transition-all flex items-center gap-2.5"
                    >
                      {copied ? <CheckIcon className="w-4 h-4 text-[#00FF41]" /> : <CopyIcon className="w-4 h-4" />}
                      {copied ? "COPIED!" : "COPY ADDRESS"}
                    </button>
                    <button
                      onClick={() => { disconnect(); setWalletOpen(false); }}
                      className="w-full text-left px-4 py-3 mb-1 text-xs font-mono text-[rgba(255,100,100,0.7)] hover:bg-[rgba(255,80,80,0.06)] hover:text-[#ff6b6b] transition-all flex items-center gap-2.5"
                    >
                      <LogOutIcon className="w-4 h-4" />
                      DISCONNECT
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Hamburger — only nav links on small screens */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden shrink-0 text-[rgba(255,255,255,0.6)] hover:text-white transition-colors"
          >
            {mobileOpen ? <XIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile nav drawer — wallet stays in the bar, not here */}
      {mobileOpen && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-[#06080F] border-b border-[rgba(255,255,255,0.06)] flex flex-col py-2">
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
        </div>
      )}
    </>
  );
}
