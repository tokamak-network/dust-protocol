"use client";

import { useEffect } from "react";
import { Box, Text, HStack } from "@chakra-ui/react";
import { PrivateWallet } from "@/components/stealth";
import { ConnectButton } from "@/components/ConnectButton";

// One-time cleanup of corrupted stealth data from previous sessions
function cleanupCorruptedStorage() {
  if (typeof window === "undefined") return;
  const CURRENT_VERSION = 4;
  const flag = "stealth_storage_version";
  const stored = parseInt(localStorage.getItem(flag) || "0", 10);
  if (stored >= CURRENT_VERSION) return;
  // Remove ALL stealth-related data to force a clean start
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith("tokamak_stealth_keys_") ||
      key.startsWith("stealth_last_scanned_") ||
      key.startsWith("stealth_payments_") ||
      key.startsWith("stealth_claim_") ||
      key === "stealth_storage_v2_cleaned"
    )) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  localStorage.setItem(flag, String(CURRENT_VERSION));
  console.log("[Stealth] Cleaned up corrupted storage (v" + CURRENT_VERSION + "), removed", keysToRemove.length, "keys");
}

export default function Home() {
  useEffect(() => { cleanupCorruptedStorage(); }, []);
  return (
    <Box minH="100vh" bg="#07070a" color="white" display="flex" flexDirection="column">
      {/* Header */}
      <Box
        as="header"
        borderBottom="1px solid #2d2d3a"
        bg="rgba(13, 13, 18, 0.95)"
        backdropFilter="blur(10px)"
        position="sticky"
        top={0}
        zIndex={100}
        px="24px"
        py="16px"
      >
        <HStack justify="space-between" align="center" maxW="1200px" mx="auto">
          <HStack gap="10px" align="baseline">
            <Text
              fontSize="22px"
              fontWeight="800"
              color="#9b9eff"
              letterSpacing="-0.02em"
            >
              Dust
            </Text>
            <Text fontSize="14px" fontWeight="500" color="#6b6b7a">
              Protocol
            </Text>
          </HStack>
          <ConnectButton />
        </HStack>
      </Box>

      {/* Main Content */}
      <Box flex="1" display="flex" justifyContent="center" py="40px" px="16px">
        <Box w="100%" maxW="520px">
          <PrivateWallet />
        </Box>
      </Box>

      {/* Footer */}
      <Box
        as="footer"
        borderTop="1px solid #2d2d3a"
        py="24px"
        px="24px"
      >
        <HStack justify="center" gap="24px" maxW="1200px" mx="auto">
          <Text fontSize="12px" color="#6b6b7a">
            Powered by ERC-5564 & ERC-6538
          </Text>
          <Text fontSize="12px" color="#6b6b7a">
            •
          </Text>
          <Text fontSize="12px" color="#6b6b7a">
            Thanos Network
          </Text>
        </HStack>
      </Box>
    </Box>
  );
}
