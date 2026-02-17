"use client";

import { useState, useCallback, useEffect } from "react";
import { type Address } from "viem";
import { useAccount, useSwitchChain, useChainId } from "wagmi";
import { useAuth } from "@/contexts/AuthContext";
import { getExplorerBase } from "@/lib/design/tokens";
import {
  SUPPORTED_TOKENS,
  getSwapContracts,
  isSwapSupported,
  getPoolForToken,
  DEPOSIT_DENOMINATIONS,
  type SwapToken,
} from "@/lib/swap/constants";
import { useDustSwapPool } from "@/hooks/swap";
import { useSwapNotes } from "@/hooks/swap";
import {
  ShieldIcon,
  ShieldCheckIcon,
  AlertCircleIcon,
  ExternalLinkIcon,
  PlusIcon,
  XIcon,
  RefreshIcon,
} from "@/components/stealth/icons";

// ─── Inline SVG Icons ────────────────────────────────────────────────────────

const CoinsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6" />
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
    <path d="M7 6h1v4" />
    <path d="m16.71 13.88.7.71-2.82 2.82" />
  </svg>
);

const DropletsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
    <path d="M12.56 14.69c1.46 0 2.64-1.22 2.64-2.7 0-.78-.38-1.51-1.13-2.13C13.32 9.23 12.77 8.6 12.56 7.94c-.19.67-.75 1.3-1.51 1.92-.75.62-1.13 1.35-1.13 2.13 0 1.48 1.18 2.7 2.64 2.7z" />
  </svg>
);

const BarChartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// ─── Pool Info Type ──────────────────────────────────────────────────────────

interface PoolInfo {
  id: string;
  token: SwapToken;
  poolAddress: string | null;
  isPrivacy: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(num: number, decimals: number = 2): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
  if (num < 0.01 && num > 0) return num.toFixed(6);
  return num.toFixed(decimals);
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
}

// ─── Pool Stats Modal ────────────────────────────────────────────────────────

function PoolStatsModal({
  isOpen,
  onClose,
  pool,
  depositCount,
  notesCount,
  notesBalance,
}: {
  isOpen: boolean;
  onClose: () => void;
  pool: PoolInfo | null;
  depositCount: number;
  notesCount: number;
  notesBalance: number;
}) {
  if (!isOpen || !pool) return null;

  const explorerBase = getExplorerBase();

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[480px] mx-4 bg-[rgba(10,10,15,0.95)] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <ShieldIcon size={18} color="#fff" />
            </div>
            <div>
              <p className="text-base font-bold text-white">{pool.token.symbol} Privacy Pool</p>
              <p className="text-[11px] text-[rgba(255,255,255,0.4)]">Poseidon commitment-based pool</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[rgba(255,255,255,0.06)] transition-all cursor-pointer"
          >
            <XIcon size={15} color="rgba(255,255,255,0.4)" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          {/* Pool Type Badge */}
          <div className="p-3 rounded-sm bg-gradient-to-br from-[rgba(74,117,240,0.08)] to-[rgba(99,60,255,0.08)] border border-[rgba(74,117,240,0.15)]">
            <div className="flex items-center gap-2 mb-1">
              <LockIcon />
              <span className="text-[11px] text-indigo-400 font-semibold">Privacy Pool</span>
            </div>
            <p className="text-xs text-[rgba(255,255,255,0.4)] leading-relaxed">
              Deposits are hidden using Poseidon hash commitments. Withdrawals require ZK-SNARK proofs, ensuring complete sender-receiver unlinkability.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-1.5 mb-1 text-cyan-400">
                <BarChartIcon />
                <span className="text-[11px] text-[rgba(255,255,255,0.4)] font-medium">Total Deposits</span>
              </div>
              <p className="text-[13px] font-mono text-white font-medium">{depositCount}</p>
              <p className="text-[10px] text-[rgba(255,255,255,0.3)] mt-0.5">On-chain commitments</p>
            </div>

            <div className="p-3 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-1.5 mb-1 text-green-400">
                <CoinsIcon />
                <span className="text-[11px] text-[rgba(255,255,255,0.4)] font-medium">Your Notes</span>
              </div>
              <p className="text-[13px] font-mono text-white font-medium">{notesCount}</p>
              <p className="text-[10px] text-[rgba(255,255,255,0.3)] mt-0.5">Unspent deposit notes</p>
            </div>
          </div>

          {/* Your Balance */}
          {notesCount > 0 && (
            <div className="p-3 rounded-sm bg-gradient-to-br from-[rgba(255,255,255,0.03)] to-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.08)]">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[11px] text-[rgba(255,255,255,0.4)]">Your Balance</p>
                  <p className="text-base font-mono text-indigo-400 font-semibold">
                    {formatNumber(notesBalance, pool.token.decimals > 6 ? 4 : 2)} {pool.token.symbol}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-[rgba(255,255,255,0.4)]">Status</p>
                  <div className="flex items-center gap-1 justify-end">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-xs text-green-400 font-semibold">Ready</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Contract Address */}
          {pool.poolAddress && (
            <div className="p-3 rounded-sm bg-[rgba(34,197,94,0.04)] border border-[rgba(34,197,94,0.12)]">
              <p className="text-[11px] text-[rgba(255,255,255,0.4)] mb-1">Pool Contract</p>
              <a
                href={`${explorerBase}/address/${pool.poolAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 no-underline"
              >
                <span className="text-xs font-mono text-indigo-400">{shortenAddress(pool.poolAddress)}</span>
                <ExternalLinkIcon size={12} color="#818cf8" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pool Row Component ──────────────────────────────────────────────────────

function PoolRow({
  pool,
  depositCount,
  isLoading,
  notesCount,
  notesBalance,
  onDeposit,
  onViewStats,
}: {
  pool: PoolInfo;
  depositCount: number;
  isLoading: boolean;
  notesCount: number;
  notesBalance: number;
  onDeposit: (pool: PoolInfo) => void;
  onViewStats: (pool: PoolInfo) => void;
}) {
  const isActive = pool.poolAddress !== null;

  return (
    <button
      className="w-full text-left cursor-pointer"
      onClick={() => onViewStats(pool)}
    >
      <div className="p-[3px] rounded-lg bg-gradient-to-br from-[rgba(49,78,160,0.2)] to-[rgba(74,117,240,0.13)] hover:from-[rgba(49,78,160,0.35)] hover:to-[rgba(74,117,240,0.27)] transition-all">
        <div className="bg-[rgba(10,10,18,0.95)] rounded-[13px] p-4">
          <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-center">
            {/* Pool Name */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.06)] flex items-center justify-center shrink-0">
                <span className="text-[13px] font-bold text-white">
                  {pool.token.symbol === "ETH" ? "E" : "$"}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-white">{pool.token.symbol}</span>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-[rgba(74,117,240,0.1)]">
                    <ShieldIcon size={10} color="#818cf8" />
                    <span className="text-[10px] text-indigo-400 font-semibold">Privacy</span>
                  </div>
                </div>
                <p className="text-[11px] text-[rgba(255,255,255,0.4)]">{pool.token.name} Privacy Pool</p>
              </div>
            </div>

            {/* Deposits (hidden on mobile) */}
            <div className="hidden sm:block">
              {isLoading ? (
                <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <div>
                  <p className="text-[13px] font-mono text-white">{depositCount}</p>
                  <p className="text-[10px] text-[rgba(255,255,255,0.4)]">Deposits</p>
                </div>
              )}
            </div>

            {/* Your Notes (hidden on mobile) */}
            <div className="hidden sm:block">
              <p className={`text-[13px] font-mono ${notesCount > 0 ? "text-green-400" : "text-white"}`}>{notesCount}</p>
              <p className="text-[10px] text-[rgba(255,255,255,0.4)]">Your Notes</p>
            </div>

            {/* Status (hidden on mobile) */}
            <div className="hidden sm:block">
              {isActive ? (
                <div className="flex items-center gap-1 px-2 py-1 rounded-sm bg-[rgba(34,197,94,0.1)] w-fit">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-[11px] text-green-400 font-semibold">Active</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2 py-1 rounded-sm bg-[rgba(239,68,68,0.1)] w-fit">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <span className="text-[11px] text-red-400 font-semibold">Unavailable</span>
                </div>
              )}
            </div>

            {/* Action */}
            <button
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-sm border transition-all text-xs font-semibold text-white font-mono
                ${isActive
                  ? "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.08)] cursor-pointer"
                  : "bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.06)] cursor-not-allowed opacity-50"}`}
              onClick={(e) => {
                e.stopPropagation();
                if (isActive) onDeposit(pool);
              }}
            >
              <DropletsIcon />
              Deposit
            </button>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Deposit Modal ───────────────────────────────────────────────────────────

function PoolDepositModal({
  isOpen,
  onClose,
  pool,
  onDeposit,
  depositState,
  depositError,
  onReset,
  depositNote,
}: {
  isOpen: boolean;
  onClose: () => void;
  pool: PoolInfo | null;
  onDeposit: (amount: string) => void;
  depositState: string;
  depositError: string | null;
  onReset: () => void;
  depositNote: any;
}) {
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      onReset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen || !pool) return null;

  const isProcessing = ["generating", "approving", "depositing", "confirming"].includes(depositState);
  const isSuccess = depositState === "success";
  const isError = depositState === "error";

  const denominations = DEPOSIT_DENOMINATIONS[pool.token.symbol] || DEPOSIT_DENOMINATIONS.ETH;

  const handleClose = () => {
    if (!isProcessing) {
      setAmount("");
      onReset();
      onClose();
    }
  };

  const stepLabel = (() => {
    switch (depositState) {
      case "generating": return "Generating commitment...";
      case "approving": return "Approving token...";
      case "depositing": return "Depositing to pool...";
      case "confirming": return "Confirming on-chain...";
      default: return "";
    }
  })();

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]"
      onClick={(e) => { if (e.target === e.currentTarget && !isProcessing) handleClose(); }}
    >
      <div className="w-full max-w-[440px] mx-4 bg-[rgba(10,10,15,0.95)] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <ShieldIcon size={18} color="#fff" />
            </div>
            <div>
              <p className="text-base font-bold text-white">Deposit {pool.token.symbol}</p>
              <p className="text-[11px] text-[rgba(255,255,255,0.4)]">Add to the {pool.token.symbol} privacy pool</p>
            </div>
          </div>
          {!isProcessing && (
            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-[rgba(255,255,255,0.06)] transition-all cursor-pointer"
            >
              <XIcon size={15} color="rgba(255,255,255,0.4)" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {/* Input state */}
          {!isProcessing && !isSuccess && !isError && (
            <div className="flex flex-col gap-5">
              {/* Info */}
              <div className="p-3 rounded-sm bg-[rgba(74,117,240,0.06)] border border-[rgba(74,117,240,0.15)]">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0"><ShieldIcon size={14} color="#818cf8" /></div>
                  <p className="text-xs text-[rgba(255,255,255,0.4)] leading-relaxed">
                    Deposits are hidden using Poseidon commitments. Your deposit note is stored locally for swap execution.
                  </p>
                </div>
              </div>

              {/* Quick select */}
              <div className="flex flex-col gap-2">
                <p className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">Quick Select</p>
                <div className="flex gap-2">
                  {denominations.map((denom) => (
                    <button
                      key={denom}
                      className={`flex-1 py-2.5 rounded-sm border cursor-pointer transition-all text-center font-mono text-[13px] font-semibold
                        ${amount === denom
                          ? "bg-[rgba(74,117,240,0.12)] border-[rgba(74,117,240,0.3)] text-indigo-400"
                          : "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.08)] text-white hover:bg-[rgba(255,255,255,0.07)]"}`}
                      onClick={() => setAmount(denom)}
                    >
                      {denom}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom amount */}
              <div className="flex flex-col gap-2">
                <p className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">Or Enter Custom Amount</p>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setAmount(e.target.value.replace(/[^0-9.]/g, ""));
                  }}
                  placeholder={`0.0 ${pool.token.symbol}`}
                  className="w-full p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-sm focus:outline-none focus:border-[#00FF41] focus:bg-[rgba(0,255,65,0.02)] transition-all placeholder-[rgba(255,255,255,0.2)]"
                />
              </div>

              {/* Deposit button */}
              <button
                className={`w-full py-3.5 rounded-full text-[15px] font-bold text-white text-center transition-all
                  ${amount && parseFloat(amount) > 0
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 cursor-pointer hover:-translate-y-0.5"
                    : "bg-[rgba(255,255,255,0.04)] cursor-not-allowed opacity-50"}`}
                onClick={() => {
                  console.log('[PoolDepositModal] Deposit button clicked, amount:', amount);
                  if (amount && parseFloat(amount) > 0) {
                    console.log('[PoolDepositModal] Amount valid, calling onDeposit');
                    onDeposit(amount);
                  } else {
                    console.log('[PoolDepositModal] Amount invalid or empty');
                  }
                }}
              >
                {amount && parseFloat(amount) > 0 ? `Deposit ${amount} ${pool.token.symbol}` : "Enter Amount"}
              </button>
            </div>
          )}

          {/* Processing */}
          {isProcessing && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-white">{stepLabel}</p>
              <p className="text-xs text-[rgba(255,255,255,0.4)] text-center">Please confirm the transaction in your wallet</p>
            </div>
          )}

          {/* Success */}
          {isSuccess && (
            <div className="flex flex-col gap-4">
              <div className="text-center py-2">
                <div className="inline-flex mb-3">
                  <ShieldCheckIcon size={40} color="#22c55e" />
                </div>
                <p className="text-base font-bold text-white mb-1">Deposit Successful</p>
                <p className="text-[13px] text-[rgba(255,255,255,0.5)]">{amount} {pool.token.symbol} deposited to privacy pool</p>
              </div>

              {/* Note Details */}
              {depositNote && (
                <div className="p-3 rounded-sm bg-[rgba(74,117,240,0.06)] border border-[rgba(74,117,240,0.15)]">
                  <p className="text-xs text-indigo-400 font-semibold mb-2">Deposit Note Details</p>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between">
                      <span className="text-[11px] text-[rgba(255,255,255,0.4)]">Leaf Index</span>
                      <span className="text-[11px] font-mono text-white">#{depositNote.leafIndex ?? 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[11px] text-[rgba(255,255,255,0.4)]">Commitment</span>
                      <span className="text-[11px] font-mono text-white">
                        {depositNote.commitment ? (() => {
                          const hex = `0x${depositNote.commitment.toString(16).padStart(64, '0')}`;
                          return `${hex.slice(0, 10)}...${hex.slice(-8)}`;
                        })() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[11px] text-[rgba(255,255,255,0.4)]">Secret</span>
                      <span className="text-[11px] font-mono text-white">
                        {depositNote.secret ? (() => {
                          const hex = `0x${depositNote.secret.toString(16).padStart(64, '0')}`;
                          return `${hex.slice(0, 10)}...${hex.slice(-8)}`;
                        })() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-sm bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)]">
                <p className="text-xs text-amber-400 font-semibold mb-1">Save Your Deposit Note</p>
                <p className="text-[11px] text-[rgba(255,255,255,0.4)] leading-relaxed">
                  Your deposit note has been saved to this browser. If you clear browser data, you will lose access to this deposit.
                </p>
              </div>

              <button
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-[15px] font-bold text-white text-center cursor-pointer hover:-translate-y-0.5 transition-all"
                onClick={handleClose}
              >
                Done
              </button>
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="flex flex-col gap-4">
              <div className="text-center py-2">
                <div className="inline-flex mb-3">
                  <AlertCircleIcon size={40} color="#ef4444" />
                </div>
                <p className="text-base font-bold text-white mb-1">Deposit Failed</p>
                <p className="text-[13px] text-[rgba(255,255,255,0.5)]">{depositError}</p>
              </div>

              <div className="flex gap-3">
                <button
                  className="flex-1 py-3.5 rounded-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.07)] text-sm font-semibold text-white text-center cursor-pointer transition-all"
                  onClick={handleClose}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 py-3.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-bold text-white text-center cursor-pointer hover:-translate-y-0.5 transition-all"
                  onClick={onReset}
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Pools Page ─────────────────────────────────────────────────────────

export default function PoolsPage() {
  const { isConnected, activeChainId } = useAuth();
  const walletChainId = useChainId(); // Actual wallet chain
  const swapSupported = isSwapSupported(activeChainId);
  const contracts = getSwapContracts(activeChainId);
  const explorerBase = getExplorerBase(activeChainId);
  const { switchChain } = useSwitchChain();

  // Check if wallet is on correct chain
  const isWalletOnCorrectChain = walletChainId === 11155111;

  // Pool definitions
  const pools: PoolInfo[] = [
    {
      id: "eth-privacy",
      token: SUPPORTED_TOKENS.ETH,
      poolAddress: contracts.dustSwapPoolETH,
      isPrivacy: true,
    },
    {
      id: "usdc-privacy",
      token: SUPPORTED_TOKENS.USDC,
      poolAddress: contracts.dustSwapPoolUSDC,
      isPrivacy: true,
    },
  ];

  // Hooks
  const { deposit, state: depositState, error: depositError, reset: resetDeposit, getDepositCount, currentNote } = useDustSwapPool(activeChainId);
  const { unspentNotes, loading: notesLoading } = useSwapNotes();

  // State
  const [selectedPool, setSelectedPool] = useState<PoolInfo | null>(null);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [statsPool, setStatsPool] = useState<PoolInfo | null>(null);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [ethDepositCount, setEthDepositCount] = useState(0);
  const [usdcDepositCount, setUsdcDepositCount] = useState(0);
  const [countsLoading, setCountsLoading] = useState(true);

  // Fetch deposit counts
  const fetchCounts = useCallback(async () => {
    setCountsLoading(true);
    const [ethCount, usdcCount] = await Promise.all([
      getDepositCount(SUPPORTED_TOKENS.ETH.address as Address),
      getDepositCount(SUPPORTED_TOKENS.USDC.address as Address),
    ]);
    setEthDepositCount(ethCount);
    setUsdcDepositCount(usdcCount);
    setCountsLoading(false);
  }, [getDepositCount]);

  useEffect(() => {
    if (isConnected && swapSupported) {
      fetchCounts();
    }
  }, [isConnected, swapSupported, fetchCounts]);

  // Derive notes per token
  const ethNotes = unspentNotes.filter(
    (n) => n.tokenAddress.toLowerCase() === SUPPORTED_TOKENS.ETH.address.toLowerCase()
  );
  const usdcNotes = unspentNotes.filter(
    (n) => n.tokenAddress.toLowerCase() === SUPPORTED_TOKENS.USDC.address.toLowerCase()
  );
  const ethNotesBalance = ethNotes.reduce((acc, n) => acc + Number(n.amount) / 1e18, 0);
  const usdcNotesBalance = usdcNotes.reduce((acc, n) => acc + Number(n.amount) / 1e6, 0);

  const getPoolDepositCount = (pool: PoolInfo) =>
    pool.token.symbol === "ETH" ? ethDepositCount : usdcDepositCount;
  const getPoolNotes = (pool: PoolInfo) =>
    pool.token.symbol === "ETH" ? ethNotes : usdcNotes;
  const getPoolNotesBalance = (pool: PoolInfo) =>
    pool.token.symbol === "ETH" ? ethNotesBalance : usdcNotesBalance;

  // Summary stats
  const totalDeposits = ethDepositCount + usdcDepositCount;
  const activePools = pools.filter((p) => p.poolAddress !== null).length;
  const totalNotes = ethNotes.length + usdcNotes.length;

  // Auto-switch to Ethereum Sepolia if on wrong chain
  useEffect(() => {
    if (isConnected && !swapSupported && switchChain) {
      const timer = setTimeout(() => {
        switchChain({ chainId: 11155111 });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, swapSupported, switchChain]);

  // Handlers
  const handleDeposit = (pool: PoolInfo) => {
    setSelectedPool(pool);
    setIsDepositOpen(true);
  };

  const handleViewStats = (pool: PoolInfo) => {
    setStatsPool(pool);
    setIsStatsOpen(true);
  };

  const handleExecuteDeposit = useCallback(
    async (amount: string) => {
      console.log('[PoolsPage] handleExecuteDeposit called with amount:', amount);
      console.log('[PoolsPage] selectedPool:', selectedPool);
      console.log('[PoolsPage] deposit function:', deposit);
      console.log('[PoolsPage] isConnected:', isConnected);
      console.log('[PoolsPage] walletChainId:', walletChainId);
      console.log('[PoolsPage] isWalletOnCorrectChain:', isWalletOnCorrectChain);

      if (!selectedPool) {
        console.log('[PoolsPage] No selected pool, returning');
        return;
      }

      if (!isConnected) {
        console.error('[PoolsPage] Wallet not connected!');
        return;
      }

      // Force switch to Ethereum Sepolia if on wrong chain
      if (!isWalletOnCorrectChain && switchChain) {
        console.log('[PoolsPage] Wallet on wrong chain, switching to Ethereum Sepolia...');
        try {
          await switchChain({ chainId: 11155111 });
          // Wait a bit for the switch to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          console.error('[PoolsPage] Failed to switch chain:', err);
          return;
        }
      }

      const decimals = selectedPool.token.decimals;
      const amountBigInt = BigInt(
        Math.floor(parseFloat(amount) * Math.pow(10, decimals))
      );

      console.log('[PoolsPage] Calling deposit with:', {
        tokenAddress: selectedPool.token.address,
        tokenSymbol: selectedPool.token.symbol,
        amount: amountBigInt.toString(),
      });

      const result = await deposit(
        selectedPool.token.address as Address,
        selectedPool.token.symbol,
        amountBigInt
      );

      console.log('[PoolsPage] Deposit result:', result);
      console.log('[PoolsPage] Deposit error:', depositError);
      console.log('[PoolsPage] Deposit state:', depositState);

      if (result) {
        fetchCounts();
      } else {
        console.error('[PoolsPage] Deposit failed - check depositError state');
      }
    },
    [selectedPool, deposit, fetchCounts, walletChainId, isWalletOnCorrectChain, switchChain]
  );

  return (
    <div className="min-h-screen p-4 md:p-8 relative">
      <div className="max-w-[900px] mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-bold text-white tracking-tight mb-1">Privacy Pools</h1>
            <p className="text-sm text-[rgba(255,255,255,0.5)]">Deposit to privacy pools and manage your deposit notes</p>
          </div>
          {swapSupported && (
            <button
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-bold text-white cursor-pointer hover:-translate-y-0.5 transition-all shrink-0"
              onClick={() => handleDeposit(pools[0])}
            >
              <PlusIcon size={16} color="#fff" />
              New Deposit
            </button>
          )}
        </div>

        {/* Info Banner */}
        <div className="p-4 rounded-lg bg-[rgba(74,117,240,0.06)] border border-[rgba(74,117,240,0.15)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0"><ShieldIcon size={18} color="#818cf8" /></div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">DustSwap Privacy Pools</p>
              <p className="text-[13px] text-[rgba(255,255,255,0.4)] leading-relaxed">
                Privacy pools use Poseidon hash commitments and ZK-SNARK proofs to enable
                private token swaps. Deposits are anonymized in the pool, and withdrawals
                produce unlinkable outputs to stealth addresses.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Total Deposits */}
          <div className="p-[3px] rounded-lg bg-gradient-to-br from-indigo-900 via-indigo-500 to-indigo-900">
            <div className="bg-[rgba(10,10,18,0.95)] rounded-[13px] p-4 text-center">
              <p className="text-xs text-[rgba(255,255,255,0.4)] mb-1">Total Deposits</p>
              <p className="text-[22px] font-mono font-bold text-white">
                {countsLoading
                  ? <span className="inline-block w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin align-middle" />
                  : totalDeposits}
              </p>
            </div>
          </div>

          {/* Active Pools */}
          <div className="p-[3px] rounded-lg bg-gradient-to-br from-green-900/30 via-green-500/50 to-green-900/30">
            <div className="bg-[rgba(10,10,18,0.95)] rounded-[13px] p-4 text-center">
              <p className="text-xs text-[rgba(255,255,255,0.4)] mb-1">Active Pools</p>
              <p className="text-[22px] font-mono font-bold text-white">{activePools}</p>
            </div>
          </div>

          {/* Your Notes */}
          <div className="p-[3px] rounded-lg bg-gradient-to-br from-violet-900/30 via-violet-500/50 to-violet-900/30">
            <div className="bg-[rgba(10,10,18,0.95)] rounded-[13px] p-4 text-center">
              <p className="text-xs text-[rgba(255,255,255,0.4)] mb-1">Your Notes</p>
              <p className="text-[22px] font-mono font-bold text-white">
                {notesLoading
                  ? <span className="inline-block w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin align-middle" />
                  : totalNotes}
              </p>
            </div>
          </div>
        </div>

        {/* Pool List */}
        <div className="flex flex-col gap-3">
          <h2 className="text-[18px] font-bold text-white tracking-tight">Available Pools</h2>

          {/* Table Header (desktop) */}
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2">
            <p className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">Pool</p>
            <p className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">Deposits</p>
            <p className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">Your Notes</p>
            <p className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">Status</p>
            <div className="w-[90px]" />
          </div>

          {/* Pool Rows */}
          {pools.map((pool) => (
            <PoolRow
              key={pool.id}
              pool={pool}
              depositCount={getPoolDepositCount(pool)}
              isLoading={countsLoading}
              notesCount={getPoolNotes(pool).length}
              notesBalance={getPoolNotesBalance(pool)}
              onDeposit={handleDeposit}
              onViewStats={handleViewStats}
            />
          ))}

          {/* Swap Not Supported */}
          {!swapSupported && isConnected && (
            <div className="p-4 rounded-lg bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)]">
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5"><AlertCircleIcon size={16} color="#f59e0b" /></div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <p className="text-[13px] font-semibold text-amber-400">
                      Privacy Pools Only Available on Ethereum Sepolia
                    </p>
                    <p className="text-xs text-[rgba(255,255,255,0.4)] leading-relaxed">
                      DustSwap is currently deployed on Ethereum Sepolia testnet. More chains coming soon!
                    </p>
                  </div>
                </div>
                <button
                  className="w-full py-2.5 rounded-sm bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.3)] hover:bg-[rgba(245,158,11,0.18)] hover:border-[rgba(245,158,11,0.4)] text-[13px] font-semibold text-amber-400 cursor-pointer transition-all"
                  onClick={() => switchChain?.({ chainId: 11155111 })}
                >
                  Switch to Ethereum Sepolia
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Contract Addresses */}
        {swapSupported && (
          <div className="p-4 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
            <p className="text-sm font-semibold text-white mb-3">Contract Addresses</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {contracts.dustSwapPoolETH && (
                <div>
                  <p className="text-[11px] text-[rgba(255,255,255,0.4)] mb-1">ETH Privacy Pool</p>
                  <a
                    href={`${explorerBase}/address/${contracts.dustSwapPoolETH}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 no-underline"
                  >
                    <span className="text-xs font-mono text-indigo-400">{shortenAddress(contracts.dustSwapPoolETH)}</span>
                    <ExternalLinkIcon size={11} color="#818cf8" />
                  </a>
                </div>
              )}
              {contracts.dustSwapPoolUSDC && (
                <div>
                  <p className="text-[11px] text-[rgba(255,255,255,0.4)] mb-1">USDC Privacy Pool</p>
                  <a
                    href={`${explorerBase}/address/${contracts.dustSwapPoolUSDC}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 no-underline"
                  >
                    <span className="text-xs font-mono text-indigo-400">{shortenAddress(contracts.dustSwapPoolUSDC)}</span>
                    <ExternalLinkIcon size={11} color="#818cf8" />
                  </a>
                </div>
              )}
              {contracts.dustSwapHook && (
                <div>
                  <p className="text-[11px] text-[rgba(255,255,255,0.4)] mb-1">DustSwap Hook</p>
                  <a
                    href={`${explorerBase}/address/${contracts.dustSwapHook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 no-underline"
                  >
                    <span className="text-xs font-mono text-indigo-400">{shortenAddress(contracts.dustSwapHook)}</span>
                    <ExternalLinkIcon size={11} color="#818cf8" />
                  </a>
                </div>
              )}
              {contracts.dustSwapVerifier && (
                <div>
                  <p className="text-[11px] text-[rgba(255,255,255,0.4)] mb-1">ZK Verifier</p>
                  <a
                    href={`${explorerBase}/address/${contracts.dustSwapVerifier}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 no-underline"
                  >
                    <span className="text-xs font-mono text-indigo-400">{shortenAddress(contracts.dustSwapVerifier)}</span>
                    <ExternalLinkIcon size={11} color="#818cf8" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Deposit Modal */}
      <PoolDepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        pool={selectedPool}
        onDeposit={handleExecuteDeposit}
        depositState={depositState}
        depositError={depositError}
        onReset={resetDeposit}
        depositNote={currentNote}
      />

      {/* Stats Modal */}
      <PoolStatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        pool={statsPool}
        depositCount={statsPool ? getPoolDepositCount(statsPool) : 0}
        notesCount={statsPool ? getPoolNotes(statsPool).length : 0}
        notesBalance={statsPool ? getPoolNotesBalance(statsPool) : 0}
      />
    </div>
  );
}
