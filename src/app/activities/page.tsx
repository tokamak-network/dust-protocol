"use client";

import { useState, useEffect } from "react";
import { Box } from "@chakra-ui/react";
import { useAuth } from "@/contexts/AuthContext";
import { useStealthScanner } from "@/hooks/stealth";
import { ActivityList } from "@/components/activities/ActivityList";
import type { StealthPayment } from "@/lib/design/types";

export default function ActivitiesPage() {
  const {
    stealthKeys, claimAddressesInitialized, claimAddresses,
    selectedClaimIndex, selectClaimAddress, selectedClaimAddress, address,
  } = useAuth();

  // Determine auto-claim recipient
  const autoClaimRecipient = claimAddressesInitialized && selectedClaimAddress
    ? selectedClaimAddress.address
    : address;

  const { payments, scan, scanInBackground, stopBackgroundScan, isScanning, claimPayment, error: scanError } = useStealthScanner(
    stealthKeys,
    { autoClaimRecipient }
  );

  // Auto-refresh: scan every 30s while activities page is mounted
  useEffect(() => {
    if (stealthKeys) {
      scanInBackground();
      return () => stopBackgroundScan();
    }
  }, [stealthKeys, scanInBackground, stopBackgroundScan]);

  const [claimingIndex, setClaimingIndex] = useState<number | null>(null);
  const [claimedTx, setClaimedTx] = useState<string | null>(null);

  const handleClaim = async (index: number) => {
    setClaimingIndex(index);
    try {
      const payment = payments[index] as StealthPayment;
      const claimTo = claimAddressesInitialized && selectedClaimAddress ? selectedClaimAddress.address : address;
      if (!claimTo) return;

      // Always use sponsored claim — gas is covered by the platform
      const txHash = await claimPayment(payment, claimTo);
      if (txHash) {
        setClaimedTx(txHash);
        setTimeout(() => scan(), 1000);
      }
    } finally {
      setClaimingIndex(null);
    }
  };

  return (
    <Box p={{ base: "20px 16px", md: "40px" }} maxW="780px" mx="auto">
      <ActivityList
        payments={payments}
        isScanning={isScanning}
        scan={scan}
        claimAddressesInitialized={claimAddressesInitialized}
        claimAddresses={claimAddresses}
        selectedIndex={selectedClaimIndex}
        selectAddress={selectClaimAddress}
        handleClaim={handleClaim}
        claimingIndex={claimingIndex}
        claimedTx={claimedTx}
        scanError={scanError}
      />
    </Box>
  );
}
