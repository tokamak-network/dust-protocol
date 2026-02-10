"use client";

import { useState } from "react";
import { Box, Text, VStack, HStack } from "@chakra-ui/react";
import { colors, radius, shadows } from "@/lib/design/tokens";
import { EXPLORER_BASE } from "@/lib/design/tokens";
import { WalletIcon, ChevronDownIcon, ChevronUpIcon } from "@/components/stealth/icons";
import type { StealthPayment } from "@/lib/design/types";

interface AddressBreakdownCardProps {
  claimAddresses: Array<{ address: string; label?: string; balance?: string }>;
  unclaimedPayments: StealthPayment[];
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
}

const WALLET_TYPE_LABELS: Record<string, string> = {
  account: "4337",
  create2: "CREATE2",
  eoa: "EOA",
};

export function AddressBreakdownCard({ claimAddresses, unclaimedPayments }: AddressBreakdownCardProps) {
  const [expanded, setExpanded] = useState(false);

  const hasClaimAddresses = claimAddresses.length > 0;
  const hasUnclaimed = unclaimedPayments.length > 0;

  if (!hasClaimAddresses && !hasUnclaimed) return null;

  const summaryParts: string[] = [];
  if (hasClaimAddresses) summaryParts.push(`${claimAddresses.length} wallet${claimAddresses.length !== 1 ? "s" : ""}`);
  if (hasUnclaimed) summaryParts.push(`${unclaimedPayments.length} stealth`);

  return (
    <Box
      p="24px"
      bgColor={colors.bg.card}
      borderRadius={radius.lg}
      border={`2px solid ${colors.border.default}`}
      boxShadow={shadows.card}
    >
      <VStack gap="0" align="stretch">
        {/* Header — always visible */}
        <Box
          as="button"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          w="100%"
          cursor="pointer"
          onClick={() => setExpanded(v => !v)}
        >
          <HStack gap="10px">
            <Box
              w="32px" h="32px"
              borderRadius={radius.full}
              bgColor={colors.bg.input}
              display="flex" alignItems="center" justifyContent="center"
            >
              <WalletIcon size={16} color={colors.text.muted} />
            </Box>
            <VStack align="flex-start" gap="0">
              <Text fontSize="15px" color={colors.text.primary} fontWeight={600}>
                Address Breakdown
              </Text>
              {!expanded && (
                <Text fontSize="12px" color={colors.text.muted}>
                  {summaryParts.join(" · ")}
                </Text>
              )}
            </VStack>
          </HStack>
          {expanded
            ? <ChevronUpIcon size={18} color={colors.text.muted} />
            : <ChevronDownIcon size={18} color={colors.text.muted} />
          }
        </Box>

        {/* Expanded content */}
        {expanded && (
          <VStack gap="0" align="stretch" mt="16px">
            {/* Claim wallets section */}
            {hasClaimAddresses && (
              <>
                <Text fontSize="11px" fontWeight={600} color={colors.text.muted} textTransform="uppercase" letterSpacing="0.05em" mb="8px">
                  Claim Wallets
                </Text>
                {claimAddresses.map((addr, idx) => (
                  <HStack
                    key={addr.address}
                    p="12px 0"
                    justify="space-between"
                    borderBottom={idx < claimAddresses.length - 1 || hasUnclaimed ? `1px solid ${colors.border.default}` : "none"}
                  >
                    <VStack align="flex-start" gap="2px">
                      <Text fontSize="14px" fontWeight={500} color={colors.text.primary}>
                        {addr.label || `Wallet ${idx + 1}`}
                      </Text>
                      <a
                        href={`${EXPLORER_BASE}/address/${addr.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "11px", color: colors.text.muted, fontFamily: "'JetBrains Mono', monospace", textDecoration: "none" }}
                      >
                        {truncateAddress(addr.address)}
                      </a>
                    </VStack>
                    <Text fontSize="14px" fontWeight={500} color={colors.accent.indigo} fontFamily="'JetBrains Mono', monospace">
                      {parseFloat(addr.balance || "0").toFixed(4)} TON
                    </Text>
                  </HStack>
                ))}
              </>
            )}

            {/* Unclaimed stealth section */}
            {hasUnclaimed && (
              <>
                <Text fontSize="11px" fontWeight={600} color={colors.text.muted} textTransform="uppercase" letterSpacing="0.05em" mt="12px" mb="8px">
                  Unclaimed Stealth
                </Text>
                {unclaimedPayments.map((p, idx) => (
                  <HStack
                    key={p.announcement.stealthAddress}
                    p="12px 0"
                    justify="space-between"
                    borderBottom={idx < unclaimedPayments.length - 1 ? `1px solid ${colors.border.default}` : "none"}
                  >
                    <HStack gap="8px">
                      <VStack align="flex-start" gap="2px">
                        <a
                          href={`${EXPLORER_BASE}/address/${p.announcement.stealthAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: "13px", fontWeight: 500, color: colors.text.primary, fontFamily: "'JetBrains Mono', monospace", textDecoration: "none" }}
                        >
                          {truncateAddress(p.announcement.stealthAddress)}
                        </a>
                      </VStack>
                      {p.walletType && (
                        <Box
                          px="6px" py="2px"
                          borderRadius={radius.xs}
                          bgColor={colors.bg.input}
                          fontSize="10px"
                          fontWeight={600}
                          color={colors.text.muted}
                          letterSpacing="0.03em"
                        >
                          {WALLET_TYPE_LABELS[p.walletType] || p.walletType}
                        </Box>
                      )}
                    </HStack>
                    <Text fontSize="14px" fontWeight={500} color={colors.accent.indigo} fontFamily="'JetBrains Mono', monospace">
                      {parseFloat(p.balance || "0").toFixed(4)} TON
                    </Text>
                  </HStack>
                ))}
              </>
            )}
          </VStack>
        )}
      </VStack>
    </Box>
  );
}
