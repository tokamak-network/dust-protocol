"use client";

import { useState } from "react";
import { Box, Text, VStack, HStack } from "@chakra-ui/react";
import { colors, radius, shadows } from "@/lib/design/tokens";
import { TrashIcon, AlertCircleIcon } from "@/components/stealth/icons";

interface DangerZoneSectionProps {
  clearKeys: () => void;
  clearPin: () => void;
}

export function DangerZoneSection({ clearKeys, clearPin }: DangerZoneSectionProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    clearKeys();
    clearPin();
    setConfirmReset(false);
    window.location.href = "/";
  };

  return (
    <Box p="24px" bgColor={colors.bg.card} borderRadius={radius.lg}
      border="2px solid rgba(239, 68, 68, 0.25)">
      <VStack gap="16px" align="stretch">
        <HStack gap="10px">
          <Box w="32px" h="32px" borderRadius={radius.full} bgColor="rgba(239, 68, 68, 0.06)"
            display="flex" alignItems="center" justifyContent="center">
            <TrashIcon size={16} color={colors.accent.red} />
          </Box>
          <Text fontSize="15px" color={colors.accent.red} fontWeight={600}>Danger Zone</Text>
        </HStack>

        {confirmReset && (
          <HStack gap="8px" p="12px 16px" bgColor="rgba(229, 62, 62, 0.04)" borderRadius={radius.sm}>
            <AlertCircleIcon size={14} color={colors.accent.red} />
            <Text fontSize="12px" color={colors.accent.red}>
              Are you sure? This will clear all keys and PIN. Click again to confirm.
            </Text>
          </HStack>
        )}

        <Box
          as="button"
          p="12px"
          bgColor="rgba(239, 68, 68, 0.06)"
          borderRadius={radius.full}
          cursor="pointer"
          _hover={{ bgColor: "rgba(239, 68, 68, 0.1)" }}
          onClick={handleReset}
          textAlign="center"
        >
          <Text fontSize="14px" fontWeight={500} color={colors.accent.red}>
            {confirmReset ? "Confirm Reset" : "Reset Private Wallet"}
          </Text>
        </Box>

        <Text fontSize="12px" color={colors.text.muted} textAlign="center">
          This will clear your keys and PIN. You can recover by signing with the same wallet and PIN.
        </Text>
      </VStack>
    </Box>
  );
}
