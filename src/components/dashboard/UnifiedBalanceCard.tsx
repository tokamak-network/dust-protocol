"use client";

import { Box, Text, VStack, HStack, Spinner } from "@chakra-ui/react";
import { colors, radius, shadows } from "@/lib/design/tokens";
import { RefreshIcon, TONIcon } from "@/components/stealth/icons";

interface UnifiedBalanceCardProps {
  total: number;
  stealthTotal: number;
  claimTotal: number;
  unclaimedCount: number;
  isScanning: boolean;
  isLoading: boolean;
  onRefresh: () => void;
}

export function UnifiedBalanceCard({
  total,
  stealthTotal,
  claimTotal,
  unclaimedCount,
  isScanning,
  isLoading,
  onRefresh,
}: UnifiedBalanceCardProps) {
  const loading = isScanning || isLoading;
  const hasBalance = total > 0;
  const stealthPct = hasBalance ? (stealthTotal / total) * 100 : 0;
  const claimPct = hasBalance ? (claimTotal / total) * 100 : 0;

  return (
    <Box
      p="3px"
      borderRadius={radius.lg}
      bg="linear-gradient(135deg, #2B5AE2 0%, #4A75F0 50%, #2B5AE2 100%)"
      boxShadow={shadows.card}
    >
      <Box p="28px" bgColor={colors.bg.card} borderRadius="17px">
        <VStack gap="24px" align="stretch">
          {/* Header */}
          <HStack justify="space-between" align="center">
            <Text fontSize="17px" fontWeight={700} color={colors.text.primary}>
              Total Balance
            </Text>
            <Box
              as="button"
              p="8px"
              borderRadius={radius.full}
              cursor="pointer"
              _hover={{ bgColor: colors.bg.input }}
              onClick={onRefresh}
              transition="all 0.15s ease"
            >
              {loading
                ? <Spinner size="sm" color={colors.accent.indigo} />
                : <RefreshIcon size={18} color={colors.text.muted} />
              }
            </Box>
          </HStack>

          {/* Big balance */}
          <HStack align="baseline" gap="8px">
            <Text
              fontSize="42px"
              fontWeight={800}
              color={colors.text.primary}
              lineHeight="1"
              letterSpacing="-0.03em"
            >
              {total.toFixed(4)}
            </Text>
            <Text fontSize="18px" fontWeight={500} color={colors.text.muted}>TON</Text>
          </HStack>

          {/* Breakdown bar + labels */}
          {hasBalance && (
            <VStack gap="10px" align="stretch">
              {/* Segmented bar */}
              <Box
                h="8px"
                borderRadius={radius.full}
                bg={colors.bg.input}
                overflow="hidden"
                display="flex"
              >
                {stealthPct > 0 && (
                  <Box
                    h="100%"
                    w={`${stealthPct}%`}
                    bg={colors.accent.indigo}
                    transition="width 0.3s ease"
                  />
                )}
                {claimPct > 0 && (
                  <Box
                    h="100%"
                    w={`${claimPct}%`}
                    bg={colors.accent.indigoBright}
                    transition="width 0.3s ease"
                  />
                )}
              </Box>

              {/* Legend */}
              <HStack gap="16px">
                {stealthTotal > 0 && (
                  <HStack gap="6px">
                    <Box w="8px" h="8px" borderRadius={radius.full} bg={colors.accent.indigo} />
                    <Text fontSize="13px" color={colors.text.muted}>
                      {stealthTotal.toFixed(4)} unclaimed
                    </Text>
                  </HStack>
                )}
                {claimTotal > 0 && (
                  <HStack gap="6px">
                    <Box w="8px" h="8px" borderRadius={radius.full} bg={colors.accent.indigoBright} />
                    <Text fontSize="13px" color={colors.text.muted}>
                      {claimTotal.toFixed(4)} in wallets
                    </Text>
                  </HStack>
                )}
              </HStack>
            </VStack>
          )}

          {/* Token row */}
          <Box borderTop={`1px solid ${colors.border.default}`} pt="16px">
            <HStack justify="space-between" align="center">
              <HStack gap="14px">
                <Box
                  w="44px" h="44px"
                  borderRadius={radius.full}
                  bg="linear-gradient(135deg, rgba(42, 114, 229, 0.08) 0%, rgba(42, 114, 229, 0.15) 100%)"
                  border="1.5px solid rgba(42, 114, 229, 0.2)"
                  display="flex" alignItems="center" justifyContent="center"
                >
                  <TONIcon size={28} />
                </Box>
                <VStack align="flex-start" gap="2px">
                  <Text fontSize="16px" fontWeight={700} color={colors.text.primary}>TON</Text>
                  <Text fontSize="13px" color={colors.text.muted}>Thanos Network</Text>
                </VStack>
              </HStack>
              <VStack align="flex-end" gap="2px">
                <Text fontSize="17px" fontWeight={700} color={colors.text.primary}>
                  {total.toFixed(4)}
                </Text>
                <Text fontSize="12px" color={colors.text.muted}>
                  {unclaimedCount > 0
                    ? `${unclaimedCount} unclaimed payment${unclaimedCount !== 1 ? "s" : ""}`
                    : "All funds claimed"
                  }
                </Text>
              </VStack>
            </HStack>
          </Box>
        </VStack>
      </Box>
    </Box>
  );
}
