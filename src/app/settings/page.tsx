"use client";

import { Box, Text, VStack } from "@chakra-ui/react";
import { useAuth } from "@/contexts/AuthContext";
import { colors } from "@/lib/design/tokens";
import { AccountSection } from "@/components/settings/AccountSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { ClaimAddressSection } from "@/components/settings/ClaimAddressSection";
import { DangerZoneSection } from "@/components/settings/DangerZoneSection";

export default function SettingsPage() {
  const {
    address, ownedNames, isRegistered, metaAddress, stealthKeys,
    claimAddresses, claimAddressesInitialized,
    clearKeys, clearPin,
  } = useAuth();

  const viewingPublicKey = stealthKeys?.viewingPublicKey
    ? (stealthKeys.viewingPublicKey.startsWith("0x") ? stealthKeys.viewingPublicKey : `0x${stealthKeys.viewingPublicKey}`)
    : undefined;

  return (
    <Box p={{ base: "20px 16px", md: "40px" }} maxW="780px" mx="auto">
      <VStack gap="28px" align="stretch">
        <Text fontSize="24px" fontWeight={700} color={colors.text.primary} textAlign="center">
          Settings
        </Text>

        <AccountSection address={address} ownedNames={ownedNames} isRegistered={isRegistered} />
        <SecuritySection metaAddress={metaAddress} viewingPublicKey={viewingPublicKey} />
        <ClaimAddressSection claimAddresses={claimAddresses} claimAddressesInitialized={claimAddressesInitialized} />
        <DangerZoneSection clearKeys={clearKeys} clearPin={clearPin} />
      </VStack>
    </Box>
  );
}
