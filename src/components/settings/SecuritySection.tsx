"use client";

import { useState } from "react";
import { Box, Text, VStack, HStack } from "@chakra-ui/react";
import { colors, radius, shadows } from "@/lib/design/tokens";
import { KeyIcon, CopyIcon, CheckIcon, InfoIcon } from "@/components/stealth/icons";

interface SecuritySectionProps {
  metaAddress: string | null;
  viewingPublicKey?: string;
}

export function SecuritySection({ metaAddress, viewingPublicKey }: SecuritySectionProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Box p="24px" bgColor={colors.bg.card} borderRadius={radius.lg} border={`2px solid ${colors.border.default}`}>
      <VStack gap="16px" align="stretch">
        <HStack gap="10px">
          <Box w="32px" h="32px" borderRadius={radius.full} bgColor={colors.bg.input}
            display="flex" alignItems="center" justifyContent="center">
            <KeyIcon size={16} color={colors.text.muted} />
          </Box>
          <Text fontSize="15px" color={colors.text.primary} fontWeight={600}>Security</Text>
        </HStack>

        {metaAddress && (
          <VStack gap="12px" align="stretch">
            <Text fontSize="13px" color={colors.text.muted} fontWeight={500}>Stealth Meta-Address</Text>
            <Box p="14px 16px" bgColor={colors.bg.input} borderRadius={radius.sm}>
              <Text fontSize="11px" color={colors.text.tertiary} fontFamily="'JetBrains Mono', monospace"
                wordBreak="break-all" lineHeight="1.6">{metaAddress}</Text>
            </Box>
            <Box
              as="button"
              p="10px 16px"
              bgColor={colors.bg.input}
              borderRadius={radius.full}
              cursor="pointer"
              _hover={{ bgColor: colors.bg.elevated }}
              onClick={() => handleCopy(metaAddress, "meta")}
              display="flex" alignItems="center" justifyContent="center" gap="8px"
            >
              {copied === "meta" ? <CheckIcon size={14} color={colors.accent.indigo} /> : <CopyIcon size={14} color={colors.text.muted} />}
              <Text fontSize="13px" fontWeight={500} color={copied === "meta" ? colors.accent.indigo : colors.text.secondary}>
                {copied === "meta" ? "Copied" : "Copy Meta-Address"}
              </Text>
            </Box>
          </VStack>
        )}

        {viewingPublicKey && (
          <VStack gap="12px" align="stretch">
            <Text fontSize="13px" color={colors.text.muted} fontWeight={500}>Viewing Public Key</Text>
            <Box p="14px 16px" bgColor={colors.bg.input} borderRadius={radius.sm}>
              <Text fontSize="11px" color={colors.text.tertiary} fontFamily="'JetBrains Mono', monospace"
                wordBreak="break-all" lineHeight="1.6">{viewingPublicKey}</Text>
            </Box>
            <Box
              as="button"
              p="10px 16px"
              bgColor={colors.bg.input}
              borderRadius={radius.full}
              cursor="pointer"
              _hover={{ bgColor: colors.bg.elevated }}
              onClick={() => handleCopy(viewingPublicKey, "viewing")}
              display="flex" alignItems="center" justifyContent="center" gap="8px"
            >
              {copied === "viewing" ? <CheckIcon size={14} color={colors.accent.indigo} /> : <CopyIcon size={14} color={colors.text.muted} />}
              <Text fontSize="13px" fontWeight={500} color={copied === "viewing" ? colors.accent.indigo : colors.text.secondary}>
                {copied === "viewing" ? "Copied" : "Copy Viewing Key"}
              </Text>
            </Box>
          </VStack>
        )}

        <HStack gap="10px" p="14px" bgColor="rgba(217, 119, 6, 0.04)" borderRadius={radius.sm}>
          <InfoIcon size={14} color={colors.accent.amber} />
          <Text fontSize="12px" color={colors.accent.amber} lineHeight="1.5">
            Changing your PIN will generate different stealth keys. You would lose access to payments sent to your current identity.
          </Text>
        </HStack>
      </VStack>
    </Box>
  );
}
