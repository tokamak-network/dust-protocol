"use client";

import { useState } from "react";
import { Box, Text, VStack, HStack, Spinner } from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { colors, radius } from "@/lib/design/tokens";
import { useAuth } from "@/contexts/AuthContext";
import { useStealthName } from "@/hooks/stealth";
import {
  KeyIcon, CheckCircleIcon, AlertCircleIcon, ZapIcon,
} from "@/components/stealth/icons";

interface ActivateStepProps {
  username: string;
  pin: string;
  onComplete: () => void;
}

type ActivationStatus = "idle" | "signing" | "activating" | "done" | "error";

export function ActivateStep({ username, pin, onComplete }: ActivateStepProps) {
  const { deriveKeysFromWallet, setPin: storePinEncrypted, registerMetaAddress } = useAuth();
  const { registerName, formatName } = useStealthName();
  const [status, setStatus] = useState<ActivationStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async () => {
    setStatus("signing");
    setError(null);

    try {
      // Single wallet signature → derives keys AND returns the signature
      const sig = await deriveKeysFromWallet(pin);
      if (!sig) throw new Error("Please approve the signature in your wallet");

      setStatus("activating");

      // Reuse the same signature for PIN encryption — no second popup
      const pinStored = await storePinEncrypted(pin, sig);
      if (!pinStored) throw new Error("Failed to store PIN");

      // Derive meta address from the same signature
      const { deriveStealthKeyPairFromSignatureAndPin, formatStealthMetaAddress } = await import("@/lib/stealth");
      const keys = deriveStealthKeyPairFromSignatureAndPin(sig, pin);
      const freshMetaAddress = formatStealthMetaAddress(keys, "thanos");

      // Register username + on-chain in parallel
      const [nameTx] = await Promise.all([
        registerName(username, freshMetaAddress),
        registerMetaAddress().catch(() => null), // non-critical
      ]);
      if (!nameTx) throw new Error("Failed to register name");

      setStatus("done");
      onComplete();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Activation failed";
      setError(msg);
      setStatus("error");
    }
  };

  return (
    <VStack gap="28px" align="stretch">
      <VStack gap="8px" textAlign="center">
        <Box color={colors.accent.indigo} opacity={0.9}>
          <ZapIcon size={36} />
        </Box>
        <Text fontSize="22px" fontWeight={700} color={colors.text.primary}>Activate your identity</Text>
        <Text fontSize="14px" color={colors.text.muted} maxW="320px" mx="auto" lineHeight="1.6">
          Review your choices and activate your private wallet.
        </Text>
      </VStack>

      {/* Summary */}
      <Box p="20px" bgColor={colors.bg.input} borderRadius={radius.md} border={`1px solid ${colors.border.default}`}>
        <VStack gap="14px" align="stretch">
          <HStack justify="space-between">
            <Text fontSize="13px" color={colors.text.muted}>Username</Text>
            <Text fontSize="15px" fontWeight={600} color={colors.accent.indigoBright}>{formatName(username)}</Text>
          </HStack>
          <Box h="1px" bgColor={colors.border.default} />
          <HStack justify="space-between">
            <Text fontSize="13px" color={colors.text.muted}>PIN</Text>
            <Text fontSize="15px" fontWeight={600} color={colors.text.primary}>••••••</Text>
          </HStack>
        </VStack>
      </Box>

      {/* Status feedback */}
      {status === "signing" && (
        <HStack gap="10px" justify="center" p="16px" bgColor={colors.bg.input} borderRadius={radius.sm}>
          <Spinner size="sm" color={colors.accent.indigo} />
          <Text fontSize="14px" color={colors.text.primary} fontWeight={500}>Approve in your wallet...</Text>
        </HStack>
      )}

      {status === "activating" && (
        <HStack gap="10px" justify="center" p="16px" bgColor={colors.bg.input} borderRadius={radius.sm}>
          <Spinner size="sm" color={colors.accent.indigo} />
          <Text fontSize="14px" color={colors.text.primary} fontWeight={500}>Setting up your identity...</Text>
        </HStack>
      )}

      {status === "done" && (
        <HStack gap="10px" justify="center" p="16px" bgColor="rgba(43, 90, 226, 0.08)" borderRadius={radius.sm}>
          <CheckCircleIcon size={18} color={colors.accent.greenBright} />
          <Text fontSize="14px" color={colors.accent.greenBright} fontWeight={500}>Activated!</Text>
        </HStack>
      )}

      {error && (
        <HStack gap="8px" p="12px 16px" bgColor="rgba(229, 62, 62, 0.06)" borderRadius={radius.xs}>
          <AlertCircleIcon size={14} color={colors.accent.red} />
          <Text fontSize="13px" color={colors.accent.red}>{error}</Text>
        </HStack>
      )}

      {(status === "idle" || status === "error") && (
        <Button
          h="52px"
          bgColor={colors.accent.indigoDark}
          borderRadius={radius.sm}
          fontWeight={600}
          fontSize="15px"
          color="#fff"
          _hover={{ bgColor: colors.accent.indigo }}
          onClick={handleActivate}
        >
          <HStack gap="8px">
            <KeyIcon size={18} />
            <Text>Activate Private Wallet</Text>
          </HStack>
        </Button>
      )}
    </VStack>
  );
}
