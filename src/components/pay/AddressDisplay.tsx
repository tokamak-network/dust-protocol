"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { CopyIcon, CheckIcon } from "@/components/stealth/icons";

interface AddressDisplayProps {
  address: string;
  label?: string;
}

export function AddressDisplay({ address, label }: AddressDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !address) return;
    QRCode.toCanvas(canvasRef.current, address, {
      width: 200,
      margin: 2,
      color: { dark: "#1A1D2B", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    });
  }, [address]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = address;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [address]);

  const truncated = address
    ? `${address.slice(0, 8)}...${address.slice(-6)}`
    : "";

  return (
    <div className="flex flex-col items-center gap-4">
      {label && (
        <span className="text-[13px] text-[rgba(255,255,255,0.4)] font-medium">
          {label}
        </span>
      )}

      {/* QR Code */}
      <div
        className="p-3 rounded-[16px] bg-white"
        style={{
          border: "3px solid #7c7fff",
          boxShadow: "0 4px 20px rgba(124,127,255,0.15)",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", borderRadius: "8px" }}
        />
      </div>

      {/* Address with copy */}
      <button
        className="w-full px-4 py-3 bg-[rgba(255,255,255,0.04)] rounded-sm border border-[rgba(255,255,255,0.06)] cursor-pointer hover:border-[#7c7fff] transition-[border-color] duration-150"
        onClick={handleCopy}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-sm font-semibold text-white font-mono tracking-tight"
          >
            {truncated}
          </span>
          {copied ? (
            <CheckIcon size={16} color="#7c7fff" />
          ) : (
            <CopyIcon size={16} color="rgba(255,255,255,0.4)" />
          )}
        </div>
      </button>
    </div>
  );
}
