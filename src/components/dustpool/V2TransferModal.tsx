"use client";

import { useState, useEffect, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { parseEther, formatEther } from "viem";
import { useV2Transfer } from "@/hooks/dustpool/v2";
import {
  ShieldCheckIcon,
  AlertCircleIcon,
  XIcon,
  SendIcon,
} from "@/components/stealth/icons";
import type { V2Keys } from "@/lib/dustpool/v2/types";

interface V2TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  keysRef: RefObject<V2Keys | null>;
  chainId?: number;
  shieldedBalance: bigint;
}

export function V2TransferModal({
  isOpen,
  onClose,
  keysRef,
  chainId,
  shieldedBalance,
}: V2TransferModalProps) {
  const { transfer, isPending, error } = useV2Transfer(keysRef, chainId);

  const [amount, setAmount] = useState("");
  const [recipientPubKey, setRecipientPubKey] = useState("");
  const [hasAttempted, setHasAttempted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setRecipientPubKey("");
      setHasAttempted(false);
    }
  }, [isOpen]);

  const parsedAmount = (() => {
    try {
      const num = parseFloat(amount);
      if (isNaN(num) || num <= 0) return null;
      return parseEther(amount);
    } catch {
      return null;
    }
  })();

  const parsedPubKey = (() => {
    try {
      if (!recipientPubKey) return null;
      const cleaned = recipientPubKey.startsWith("0x") ? recipientPubKey.slice(2) : recipientPubKey;
      if (!/^[0-9a-fA-F]+$/.test(cleaned) || cleaned.length === 0) return null;
      return BigInt(`0x${cleaned}`);
    } catch {
      return null;
    }
  })();

  const exceedsBalance = parsedAmount !== null && parsedAmount > shieldedBalance;
  const canTransfer = parsedAmount !== null && !exceedsBalance && parsedPubKey !== null && !isPending;

  const handleTransfer = async () => {
    if (!parsedAmount || !parsedPubKey) return;
    setHasAttempted(true);
    await transfer(parsedAmount, parsedPubKey);
  };

  const handleClose = () => {
    if (!isPending) onClose();
  };

  const formattedMax = parseFloat(formatEther(shieldedBalance)).toFixed(4);
  const isSuccess = hasAttempted && !isPending && !error;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="relative w-full max-w-[440px] p-6 rounded-md border border-[rgba(255,255,255,0.1)] bg-[#06080F] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <SendIcon size={16} color="#00FF41" />
                <span className="text-sm font-bold text-white font-mono tracking-wider">
                  [ TRANSFER_V2 ]
                </span>
              </div>
              {!isPending && (
                <button onClick={handleClose} className="text-[rgba(255,255,255,0.4)] hover:text-white transition-colors">
                  <XIcon size={20} />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4">
              {/* Input state */}
              {!isPending && !error && !isSuccess && (
                <>
                  {/* Info */}
                  <div className="p-3 rounded-sm bg-[rgba(0,255,65,0.04)] border border-[rgba(0,255,65,0.15)]">
                    <p className="text-xs text-[rgba(255,255,255,0.4)] leading-relaxed font-mono">
                      Transfer shielded funds to another user&apos;s V2 public key. Both input and output remain private within the pool.
                    </p>
                  </div>

                  {/* Amount input */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
                        Transfer Amount (ETH)
                      </label>
                      <span className="text-[10px] text-[rgba(255,255,255,0.4)] font-mono">
                        Available: {formattedMax} ETH
                      </span>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setAmount(e.target.value.replace(/[^0-9.]/g, ""));
                      }}
                      placeholder="0.0"
                      className="w-full p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-sm focus:outline-none focus:border-[#00FF41] focus:bg-[rgba(0,255,65,0.02)] transition-all placeholder-[rgba(255,255,255,0.2)]"
                    />
                    {exceedsBalance && (
                      <p className="text-[11px] text-red-400 font-mono">Amount exceeds shielded balance</p>
                    )}
                  </div>

                  {/* Recipient public key */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
                      Recipient Public Key
                    </label>
                    <input
                      type="text"
                      placeholder="0x... (recipient's V2 owner key)"
                      value={recipientPubKey}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipientPubKey(e.target.value)}
                      className="w-full p-3 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-xs focus:outline-none focus:border-[#00FF41] focus:bg-[rgba(0,255,65,0.02)] transition-all placeholder-[rgba(255,255,255,0.2)]"
                    />
                    {recipientPubKey && !parsedPubKey && (
                      <p className="text-[11px] text-red-400 font-mono">Invalid public key (hex format expected)</p>
                    )}
                    <p className="text-[11px] text-[rgba(255,255,255,0.3)] font-mono">
                      The recipient&apos;s V2 spending public key (Poseidon hash of their spending key)
                    </p>
                  </div>

                  {/* Transfer button */}
                  <button
                    onClick={handleTransfer}
                    disabled={!canTransfer}
                    className="w-full py-3 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] hover:shadow-[0_0_15px_rgba(0,255,65,0.15)] transition-all text-sm font-bold text-[#00FF41] font-mono tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {parsedAmount ? `Transfer ${amount} ETH` : "Enter Amount"}
                  </button>
                </>
              )}

              {/* Processing */}
              {isPending && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-8 h-8 border-2 border-[#00FF41] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-white font-mono">Generating ZK proof...</p>
                  <p className="text-xs text-[rgba(255,255,255,0.4)] text-center font-mono">Building proof and submitting to relayer</p>
                </div>
              )}

              {/* Success */}
              {isSuccess && (
                <div className="flex flex-col gap-4">
                  <div className="text-center py-2">
                    <div className="inline-flex mb-3">
                      <ShieldCheckIcon size={40} color="#00FF41" />
                    </div>
                    <p className="text-base font-bold text-white mb-1 font-mono">Transfer Successful</p>
                    <p className="text-[13px] text-[rgba(255,255,255,0.5)] font-mono">{amount} ETH transferred privately</p>
                  </div>

                  <button
                    onClick={handleClose}
                    className="w-full py-3 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] transition-all text-sm font-bold text-[#00FF41] font-mono tracking-wider"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Error */}
              {error && !isPending && (
                <div className="flex flex-col gap-4">
                  <div className="text-center py-2">
                    <div className="inline-flex mb-3">
                      <AlertCircleIcon size={40} color="#ef4444" />
                    </div>
                    <p className="text-base font-bold text-white mb-1 font-mono">Transfer Failed</p>
                    <p className="text-[13px] text-[rgba(255,255,255,0.5)] font-mono">{error}</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleClose}
                      className="flex-1 py-3 rounded-sm bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.07)] text-sm font-semibold text-white font-mono transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { setAmount(""); setRecipientPubKey(""); }}
                      className="flex-1 py-3 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] text-sm font-bold text-[#00FF41] font-mono tracking-wider transition-all"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[rgba(255,255,255,0.1)]" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[rgba(255,255,255,0.1)]" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[rgba(255,255,255,0.1)]" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[rgba(255,255,255,0.1)]" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
