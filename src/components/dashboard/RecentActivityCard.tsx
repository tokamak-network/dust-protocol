"use client";

import { useState } from "react";
import { Box, Text, VStack, HStack } from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { colors, radius, shadows, getExplorerBase } from "@/lib/design/tokens";
import { useAuth } from "@/contexts/AuthContext";
import { getChainConfig } from "@/config/chains";
import type { StealthPayment } from "@/lib/design/types";
import {
  ArrowDownLeftIcon, ChevronRightIcon,
} from "@/components/stealth/icons";

interface RecentActivityCardProps {
  payments: StealthPayment[];
}

type Filter = "all" | "incoming" | "outgoing";

export function RecentActivityCard({ payments }: RecentActivityCardProps) {
  const { activeChainId } = useAuth();
  const explorerBase = getExplorerBase(activeChainId);
  const symbol = getChainConfig(activeChainId).nativeCurrency.symbol;
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = filter === "outgoing" ? [] : payments;
  const recent = filtered.slice(0, 5);

  return (
    <VStack gap="20px" align="stretch">
      {/* Header row with tabs and count */}
      <HStack justify="space-between" align="center" flexWrap="wrap" gap="12px">
        {/* Pill tabs */}
        <HStack gap="8px">
          {(["all", "incoming", "outgoing"] as Filter[]).map((f) => (
            <Box
              key={f}
              as="button"
              px="16px"
              py="8px"
              borderRadius={radius.full}
              bgColor={filter === f ? colors.text.primary : "transparent"}
              border={filter === f ? "none" : `1px solid ${colors.border.default}`}
              cursor="pointer"
              onClick={() => setFilter(f)}
              transition="all 0.15s ease"
              _hover={filter !== f ? { bgColor: colors.bg.input } : {}}
            >
              <Text
                fontSize="13px"
                fontWeight={filter === f ? 500 : 400}
                color={filter === f ? "#fff" : colors.text.muted}
                textTransform="capitalize"
              >
                {f}
              </Text>
            </Box>
          ))}
        </HStack>
        <Text fontSize="14px" fontWeight={500} color={colors.text.muted}>
          {payments.length} transactions total
        </Text>
      </HStack>

      {/* Activity list */}
      {recent.length === 0 ? (
        <Box p="48px" textAlign="center" bgColor={colors.bg.card} borderRadius={radius.lg} border={`2px solid ${colors.border.default}`} boxShadow={shadows.card}>
          <VStack gap="12px">
            <Text fontSize="16px" fontWeight={700} color={colors.text.primary}>No activities yet</Text>
            <Text fontSize="14px" color={colors.text.muted}>
              {filter === "outgoing" ? "Sent payments will appear here" : "Received payments will appear here"}
            </Text>
          </VStack>
        </Box>
      ) : (
        <VStack gap="8px" align="stretch">
          {recent.map((p) => {
            const displayAmount = parseFloat(p.originalAmount || p.balance || "0");
            return (
              <HStack
                key={p.announcement.txHash}
                p="16px 20px"
                bgColor={colors.bg.card}
                borderRadius={radius.md}
                border={`2px solid ${colors.border.default}`}
                justify="space-between"
                cursor="pointer"
                _hover={{ borderColor: colors.border.light }}
                transition="all 0.15s ease"
                onClick={() => window.open(`${explorerBase}/tx/${p.announcement.txHash}`, "_blank")}
              >
                <HStack gap="14px">
                  <Box
                    w="40px" h="40px"
                    borderRadius={radius.full}
                    bgColor="rgba(43, 90, 226, 0.08)"
                    display="flex" alignItems="center" justifyContent="center"
                  >
                    <ArrowDownLeftIcon size={18} color={colors.accent.indigo} />
                  </Box>
                  <VStack align="flex-start" gap="2px">
                    <Text fontSize="15px" fontWeight={600} color={colors.text.primary}>
                      Received from {p.announcement.caller?.slice(0, 6)}...{p.announcement.caller?.slice(-4) || "unknown"}
                    </Text>
                    <Text fontSize="13px" color={colors.text.muted}>
                      {symbol} &middot; Block #{p.announcement.blockNumber.toLocaleString()}
                    </Text>
                  </VStack>
                </HStack>
                <Text
                  fontSize="16px"
                  fontWeight={700}
                  color={colors.accent.indigo}
                >
                  +{displayAmount.toFixed(4)} {symbol}
                </Text>
              </HStack>
            );
          })}
        </VStack>
      )}

      {/* See all link */}
      <Link href="/activities" style={{ textDecoration: "none" }}>
        <Box
          p="14px"
          bgColor={colors.bg.card}
          borderRadius={radius.md}
          border={`2px solid ${colors.border.default}`}
          textAlign="center"
          cursor="pointer"
          _hover={{ borderColor: colors.border.light }}
          transition="all 0.15s ease"
        >
          <Text fontSize="15px" fontWeight={600} color={colors.text.secondary}>See all activities</Text>
        </Box>
      </Link>
    </VStack>
  );
}
