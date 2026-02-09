"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text, VStack, HStack, Spinner } from "@chakra-ui/react";
import { colors, radius } from "@/lib/design/tokens";
import {
  generateStealthAddress,
  parseStealthMetaAddress,
  type GeneratedStealthAddress,
} from "@/lib/stealth";
import { useBalancePoller } from "@/hooks/stealth/useBalancePoller";
import { AddressDisplay } from "./AddressDisplay";
import {
  CheckCircleIcon,
  AlertCircleIcon,
  ShieldIcon,
} from "@/components/stealth/icons";

type Status = "generating" | "waiting" | "announcing" | "confirmed" | "error";

interface NoOptInPaymentProps {
  resolvedMeta: string;
  recipientName: string;
  displayName: string;
  linkSlug?: string;
}

interface PendingSession {
  stealthAddress: string;
  ephemeralPublicKey: string;
  viewTag: string;
  timestamp: number;
}

function getPendingKey(recipientName: string, linkSlug?: string): string {
  return `dust_pending_${recipientName}_${linkSlug || "personal"}`;
}

function savePendingSession(
  recipientName: string,
  linkSlug: string | undefined,
  generated: GeneratedStealthAddress
): void {
  try {
    const session: PendingSession = {
      stealthAddress: generated.stealthAddress,
      ephemeralPublicKey: generated.ephemeralPublicKey,
      viewTag: generated.viewTag,
      timestamp: Date.now(),
    };
    localStorage.setItem(getPendingKey(recipientName, linkSlug), JSON.stringify(session));
  } catch {}
}

function loadPendingSession(
  recipientName: string,
  linkSlug?: string
): PendingSession | null {
  try {
    const raw = localStorage.getItem(getPendingKey(recipientName, linkSlug));
    if (!raw) return null;
    const session: PendingSession = JSON.parse(raw);
    // Expire after 24 hours (long window so shared QR codes remain valid)
    if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(getPendingKey(recipientName, linkSlug));
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function clearPendingSession(recipientName: string, linkSlug?: string): void {
  try {
    localStorage.removeItem(getPendingKey(recipientName, linkSlug));
  } catch {}
}

export function NoOptInPayment({
  resolvedMeta,
  recipientName,
  displayName,
  linkSlug,
}: NoOptInPaymentProps) {
  const [status, setStatus] = useState<Status>("generating");
  const [stealthAddress, setStealthAddress] = useState<string | null>(null);
  const [ephemeralPublicKey, setEphemeralPublicKey] = useState<string>("");
  const [viewTag, setViewTag] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const announcingRef = useRef(false);

  const { hasDeposit, depositAmount, isPolling } = useBalancePoller(
    status === "waiting" ? stealthAddress : null
  );

  // Generate or recover stealth address on mount
  useEffect(() => {
    try {
      // Check for pending session recovery
      const pending = loadPendingSession(recipientName, linkSlug);
      if (pending) {
        setStealthAddress(pending.stealthAddress);
        setEphemeralPublicKey(pending.ephemeralPublicKey);
        setViewTag(pending.viewTag);
        setStatus("waiting");
        return;
      }

      // Generate new stealth address
      const meta = parseStealthMetaAddress(resolvedMeta);
      const generated = generateStealthAddress(meta);

      setStealthAddress(generated.stealthAddress);
      setEphemeralPublicKey(generated.ephemeralPublicKey);
      setViewTag(generated.viewTag);

      savePendingSession(recipientName, linkSlug, generated);
      setStatus("waiting");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate address");
      setStatus("error");
    }
  }, [resolvedMeta, recipientName, linkSlug]);

  // Auto-announce when deposit detected
  useEffect(() => {
    if (!hasDeposit || !stealthAddress || announcingRef.current) return;
    announcingRef.current = true;
    let cancelled = false;
    setStatus("announcing");

    const announce = async () => {
      try {
        const ephPubKey = "0x" + ephemeralPublicKey.replace(/^0x/, "");
        let metadata = "0x" + viewTag;
        if (linkSlug) {
          const slugBytes = new TextEncoder().encode(linkSlug);
          const slugHex = Array.from(slugBytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          metadata += slugHex;
        }

        const res = await fetch("/api/sponsor-announce", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stealthAddress, ephemeralPubKey: ephPubKey, metadata }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Announcement failed");

        if (cancelled) return;
        clearPendingSession(recipientName, linkSlug);
        setStatus("confirmed");
      } catch (e) {
        if (cancelled) return;
        console.warn("[NoOptInPayment] Announce failed:", e);
        // Still show confirmed since funds were received
        clearPendingSession(recipientName, linkSlug);
        setStatus("confirmed");
        setError("Payment received but announcement failed. Recipient may need to scan manually.");
      }
    };

    announce();

    return () => {
      cancelled = true;
      announcingRef.current = false;
    };
  }, [hasDeposit, stealthAddress, ephemeralPublicKey, viewTag, linkSlug, recipientName]);

  // Warn on page close while waiting
  useEffect(() => {
    if (status !== "waiting") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  if (status === "generating") {
    return (
      <VStack gap="16px" py="24px">
        <Spinner size="md" color={colors.accent.indigo} />
        <Text fontSize="14px" color={colors.text.muted}>
          Generating stealth address...
        </Text>
      </VStack>
    );
  }

  if (status === "error" && !stealthAddress) {
    return (
      <VStack gap="12px" py="24px">
        <AlertCircleIcon size={32} color={colors.accent.red} />
        <Text fontSize="14px" color={colors.accent.red}>
          {error || "Something went wrong"}
        </Text>
      </VStack>
    );
  }

  if (status === "confirmed") {
    return (
      <VStack gap="20px" py="24px">
        <Box p="16px" bgColor="rgba(43, 90, 226, 0.08)" borderRadius="50%">
          <CheckCircleIcon size={36} color={colors.accent.indigo} />
        </Box>
        <VStack gap="6px">
          <Text fontSize="20px" fontWeight={700} color={colors.text.primary}>
            Payment Received!
          </Text>
          <Text fontSize="15px" color={colors.text.secondary} fontFamily="'JetBrains Mono', monospace">
            {depositAmount} TON
          </Text>
          <Text fontSize="13px" color={colors.text.muted}>
            Sent to {displayName}
          </Text>
        </VStack>
        {error && (
          <HStack
            gap="6px"
            p="10px 14px"
            bgColor="rgba(217, 119, 6, 0.06)"
            borderRadius={radius.xs}
          >
            <AlertCircleIcon size={14} color={colors.accent.amber} />
            <Text fontSize="12px" color={colors.accent.amber}>
              {error}
            </Text>
          </HStack>
        )}
      </VStack>
    );
  }

  if (status === "announcing") {
    return (
      <VStack gap="16px" py="24px">
        <Spinner size="md" color={colors.accent.indigo} />
        <VStack gap="4px">
          <Text fontSize="15px" fontWeight={600} color={colors.text.primary}>
            Payment detected!
          </Text>
          <Text fontSize="13px" color={colors.text.muted}>
            Registering on-chain...
          </Text>
        </VStack>
      </VStack>
    );
  }

  // status === "waiting"
  return (
    <VStack gap="20px">
      <style>{`@keyframes dust-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      {/* Status pill */}
      <HStack
        gap="8px"
        px="14px"
        py="8px"
        bgColor="rgba(43, 90, 226, 0.06)"
        borderRadius={radius.full}
        border="1px solid rgba(43, 90, 226, 0.12)"
      >
        <Box
          w="8px"
          h="8px"
          borderRadius="50%"
          bgColor={colors.accent.indigo}
          animation="dust-pulse 2s ease-in-out infinite"
        />
        <Text fontSize="13px" color={colors.accent.indigo} fontWeight={600}>
          Waiting for payment...
        </Text>
      </HStack>

      {/* Address + QR */}
      {stealthAddress && (
        <AddressDisplay
          address={stealthAddress}
          label="Send TON to this address"
        />
      )}

      {/* Instructions */}
      <VStack gap="8px" w="100%">
        <HStack
          gap="8px"
          p="12px"
          bgColor="rgba(43, 90, 226, 0.04)"
          borderRadius={radius.sm}
          border="1px solid rgba(43, 90, 226, 0.1)"
          w="100%"
        >
          <Box flexShrink={0}>
            <ShieldIcon size={14} color={colors.accent.indigo} />
          </Box>
          <Text fontSize="12px" color={colors.text.tertiary}>
            This is a one-time stealth address. Send any amount of TON from any wallet.
          </Text>
        </HStack>

        <Text fontSize="11px" color={colors.text.muted} textAlign="center">
          Keep this page open until payment is confirmed
        </Text>
      </VStack>
    </VStack>
  );
}
