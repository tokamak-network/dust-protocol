"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import { XIcon, CopyIcon, CheckIcon } from "@/components/stealth/icons";
import { DustLogo } from "@/components/DustLogo";

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  dustName: string | null;
  payPath: string;
}

export function ReceiveModal({ isOpen, onClose, dustName, payPath }: ReceiveModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [fullUrl, setFullUrl] = useState("");

  useEffect(() => {
    if (!isOpen || !canvasRef.current || !payPath) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}${payPath}`;
    setFullUrl(url);
    QRCode.toCanvas(canvasRef.current, url, {
      width: 260,
      margin: 2,
      color: { dark: "#1A1D2B", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    }, () => {});
  }, [isOpen, payPath]);

  const handleCopy = async () => {
    if (!fullUrl) return;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal container */}
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
                <DustLogo size={16} color="#00FF41" />
                <span className="text-sm font-bold text-white font-mono tracking-wider">
                  [ RECEIVE ]
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-[rgba(255,255,255,0.4)] hover:text-white transition-colors"
              >
                <XIcon size={20} />
              </button>
            </div>

            {dustName ? (
              <div className="flex flex-col gap-6">
                {/* Title */}
                <div className="flex flex-col gap-1.5 text-center">
                  <p className="text-[22px] font-bold text-white">Share Your Link</p>
                  <p className="text-sm text-[rgba(255,255,255,0.4)] font-mono">
                    Anyone can pay you with this link
                  </p>
                </div>

                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="p-4 rounded-sm bg-white border-4 border-[#00FF41] shadow-[0_4px_20px_rgba(0,255,65,0.15)]">
                    <canvas ref={canvasRef} style={{ display: "block", borderRadius: "8px" }} />
                  </div>
                </div>

                {/* .dust name pill */}
                <div className="flex justify-center">
                  <div className="px-5 py-2.5 bg-[rgba(0,255,65,0.06)] border border-[rgba(0,255,65,0.2)] rounded-full">
                    <p className="text-[15px] font-bold text-[#00FF41] font-mono text-center">
                      {dustName}
                    </p>
                  </div>
                </div>

                {/* Full URL row */}
                <div className="flex items-center gap-2.5 w-full p-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-sm">
                  <p className="flex-1 text-[13px] text-[rgba(255,255,255,0.4)] font-mono truncate">
                    {fullUrl}
                  </p>
                  <button
                    onClick={handleCopy}
                    className="flex-shrink-0 p-1.5 rounded-sm hover:text-[#00FF41] text-[rgba(255,255,255,0.4)] transition-colors"
                  >
                    {copied
                      ? <CheckIcon size={16} color="#00FF41" />
                      : <CopyIcon size={16} color="currentColor" />
                    }
                  </button>
                </div>

                {/* Branding */}
                <div className="flex items-center justify-center gap-1.5 opacity-50">
                  <DustLogo size={18} color="rgba(255,255,255,0.6)" />
                  <span className="text-sm font-bold text-[rgba(255,255,255,0.6)] font-mono tracking-tight">
                    Dust
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 py-5">
                <p className="text-lg font-bold text-white text-center">No Username Yet</p>
                <p className="text-sm text-[rgba(255,255,255,0.4)] font-mono text-center leading-relaxed">
                  Register a username to get a shareable payment link.
                </p>
              </div>
            )}

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
