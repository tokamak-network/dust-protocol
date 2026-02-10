"use client";

import { useState, useEffect, useCallback } from "react";
import { Box, Text, VStack, HStack } from "@chakra-ui/react";
import { useAuth } from "@/contexts/AuthContext";
import { useStealthScanner, useUnifiedBalance } from "@/hooks/stealth";
import { colors, radius } from "@/lib/design/tokens";
import { UnifiedBalanceCard } from "@/components/dashboard/UnifiedBalanceCard";
import { AddressBreakdownCard } from "@/components/dashboard/AddressBreakdownCard";
import { PersonalLinkCard } from "@/components/dashboard/PersonalLinkCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { SendModal } from "@/components/send/SendModal";
import { ReceiveModal } from "@/components/dashboard/ReceiveModal";
import { SendIcon, ArrowDownLeftIcon } from "@/components/stealth/icons";

export default function DashboardPage() {
  const { stealthKeys, metaAddress, ownedNames, claimAddresses, refreshClaimBalances, claimAddressesInitialized } = useAuth();
  const { payments, scan, scanInBackground, stopBackgroundScan, isScanning } = useStealthScanner(stealthKeys);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  const tokName = ownedNames.length > 0 ? `${ownedNames[0].name}.tok` : null;
  const payPath = ownedNames.length > 0 ? `/pay/${ownedNames[0].name}` : "";

  const unified = useUnifiedBalance({
    payments,
    claimAddresses,
    refreshClaimBalances,
    claimAddressesInitialized,
  });

  const handleRefresh = useCallback(() => {
    scan();
    refreshClaimBalances();
  }, [scan, refreshClaimBalances]);

  // Auto-refresh: scan every 30s while dashboard is mounted
  useEffect(() => {
    if (stealthKeys) {
      scanInBackground();
      return () => stopBackgroundScan();
    }
  }, [stealthKeys, scanInBackground, stopBackgroundScan]);

  return (
    <Box p={{ base: "16px 14px", md: "28px 24px" }} maxW="640px" mx="auto">
      <VStack gap="18px" align="stretch">
        {/* Page heading */}
        <Text fontSize="22px" fontWeight={800} color={colors.text.primary} textAlign="center" letterSpacing="-0.02em">
          Dashboard
        </Text>

        {/* Unified balance card */}
        <UnifiedBalanceCard
          total={unified.total}
          stealthTotal={unified.stealthTotal}
          claimTotal={unified.claimTotal}
          unclaimedCount={unified.unclaimedCount}
          isScanning={isScanning}
          isLoading={unified.isLoading}
          onRefresh={handleRefresh}
        />

        {/* Address breakdown */}
        <AddressBreakdownCard
          claimAddresses={unified.claimAddresses}
          unclaimedPayments={unified.unclaimedPayments}
        />

        {/* Quick actions */}
        <HStack gap="10px">
          <Box
            as="button"
            flex={1}
            p="12px"
            bgColor={colors.accent.indigo}
            borderRadius={radius.lg}
            cursor="pointer"
            _hover={{ opacity: 0.9 }}
            transition="all 0.15s ease"
            onClick={() => setShowSendModal(true)}
            display="flex" alignItems="center" justifyContent="center" gap="8px"
          >
            <SendIcon size={17} color="#fff" />
            <Text fontSize="14px" fontWeight={700} color="#fff">Send</Text>
          </Box>
          <Box
            as="button"
            flex={1}
            p="12px"
            bgColor={colors.bg.card}
            borderRadius={radius.lg}
            border={`2px solid ${colors.border.default}`}
            cursor="pointer"
            _hover={{ borderColor: colors.accent.indigo }}
            transition="all 0.15s ease"
            onClick={() => setShowReceiveModal(true)}
            display="flex" alignItems="center" justifyContent="center" gap="8px"
          >
            <ArrowDownLeftIcon size={17} color={colors.accent.indigo} />
            <Text fontSize="14px" fontWeight={700} color={colors.text.primary}>Receive</Text>
          </Box>
        </HStack>

        {/* Personal link */}
        <PersonalLinkCard ownedNames={ownedNames} metaAddress={metaAddress} />

        {/* Activity section heading */}
        <RecentActivityCard payments={payments} />

        {/* Send Modal */}
        <SendModal isOpen={showSendModal} onClose={() => { setShowSendModal(false); scan(); }} />
        <ReceiveModal isOpen={showReceiveModal} onClose={() => setShowReceiveModal(false)} tokName={tokName} payPath={payPath} />
      </VStack>
    </Box>
  );
}
