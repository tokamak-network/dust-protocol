"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text, VStack, HStack } from "@chakra-ui/react";
import QRCode from "qrcode";
import { colors, radius } from "@/lib/design/tokens";
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
    <VStack gap="16px">
      {label && (
        <Text fontSize="13px" color={colors.text.muted} fontWeight={500}>
          {label}
        </Text>
      )}

      {/* QR Code */}
      <Box
        p="12px"
        borderRadius={radius.lg}
        border={`3px solid ${colors.accent.indigo}`}
        boxShadow={`0 4px 20px ${colors.accent.indigo}25`}
        bgColor="#fff"
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", borderRadius: "8px" }}
        />
      </Box>

      {/* Address with copy */}
      <Box
        as="button"
        w="100%"
        p="12px 16px"
        bgColor={colors.bg.input}
        borderRadius={radius.sm}
        border={`1px solid ${colors.border.default}`}
        cursor="pointer"
        _hover={{ borderColor: colors.accent.indigo }}
        onClick={handleCopy}
        transition="border-color 0.15s"
      >
        <HStack justify="space-between" align="center">
          <Text
            fontSize="14px"
            fontWeight={600}
            color={colors.text.primary}
            fontFamily="'JetBrains Mono', monospace"
            letterSpacing="-0.01em"
          >
            {truncated}
          </Text>
          {copied ? (
            <CheckIcon size={16} color={colors.accent.indigo} />
          ) : (
            <CopyIcon size={16} color={colors.text.muted} />
          )}
        </HStack>
      </Box>
    </VStack>
  );
}
