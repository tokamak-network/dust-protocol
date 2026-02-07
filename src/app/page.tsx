"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, Text, VStack, HStack } from "@chakra-ui/react";
import { useAuth } from "@/contexts/AuthContext";
import { ConnectButton } from "@/components/ConnectButton";
import { colors, radius } from "@/lib/design/tokens";
import { ShieldIcon, LockIcon } from "@/components/stealth/icons";

// One-time cleanup of corrupted stealth data from previous sessions
function cleanupCorruptedStorage() {
  if (typeof window === "undefined") return;
  const CURRENT_VERSION = 5;
  const flag = "stealth_storage_version";
  const stored = parseInt(localStorage.getItem(flag) || "0", 10);
  if (stored >= CURRENT_VERSION) return;
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
}

export default function Home() {
  const { isConnected, isOnboarded, isHydrated } = useAuth();
  const router = useRouter();

  useEffect(() => { cleanupCorruptedStorage(); }, []);

  useEffect(() => {
    if (!isHydrated) return; // Wait for localStorage to load before redirecting
    if (isConnected && isOnboarded) {
      router.replace("/dashboard");
    } else if (isConnected && !isOnboarded) {
      router.replace("/onboarding");
    }
  }, [isConnected, isOnboarded, isHydrated, router]);

  // Show loading while hydrating or while connected user is about to be redirected
  if (!isHydrated || (isConnected && isOnboarded)) {
    return (
      <Box minH="100vh" bg={colors.bg.page} display="flex" alignItems="center" justifyContent="center">
        <VStack gap="16px">
          <Box color={colors.accent.indigo} opacity={0.6}>
            <ShieldIcon size={40} />
          </Box>
          <Text fontSize="14px" color={colors.text.muted}>Loading...</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg={colors.bg.page} color={colors.text.primary} display="flex" flexDirection="column">
      {/* Header */}
      <Box
        as="header"
        borderBottom={`1px solid ${colors.border.default}`}
        bg="rgba(255, 255, 255, 0.95)"
        backdropFilter="blur(10px)"
        position="sticky"
        top={0}
        zIndex={100}
        px="24px"
        py="16px"
      >
        <HStack justify="space-between" align="center" maxW="1200px" mx="auto">
          <HStack gap="10px" align="baseline">
            <Text fontSize="22px" fontWeight="800" color={colors.accent.indigoBright} letterSpacing="-0.02em">
              Dust
            </Text>
            <Text fontSize="14px" fontWeight="500" color={colors.text.muted}>
              Protocol
            </Text>
          </HStack>
          <ConnectButton />
        </HStack>
      </Box>

      {/* Hero */}
      <Box flex="1" display="flex" justifyContent="center" alignItems="center" py="60px" px="16px">
        <VStack gap="40px" maxW="480px" textAlign="center">
          <Box color={colors.accent.indigo} opacity={0.9}>
            <ShieldIcon size={56} />
          </Box>
          <VStack gap="16px">
            <Text fontSize="32px" fontWeight={800} color={colors.text.primary} lineHeight="1.2">
              Private Payments
            </Text>
            <Text fontSize="16px" color={colors.text.tertiary} lineHeight="1.6" maxW="360px">
              Send and receive payments that cannot be traced to your identity. Powered by stealth addresses on Thanos Network.
            </Text>
          </VStack>

          <VStack gap="16px" w="100%">
            <Box
              p="20px"
              bgColor={colors.bg.card}
              borderRadius={radius.lg}
              border={`1px solid ${colors.border.default}`}
              w="100%"
            >
              <VStack gap="14px" align="stretch">
                {[
                  { step: "1", text: "Connect your wallet" },
                  { step: "2", text: "Choose a username and set a PIN" },
                  { step: "3", text: "Start receiving private payments" },
                ].map((item) => (
                  <HStack key={item.step} gap="12px" align="center">
                    <Box
                      w="28px" h="28px"
                      borderRadius="50%"
                      bgColor={colors.bg.elevated}
                      border={`1px solid ${colors.border.light}`}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      flexShrink={0}
                    >
                      <Text fontSize="12px" fontWeight={700} color={colors.accent.indigo}>{item.step}</Text>
                    </Box>
                    <Text fontSize="14px" color={colors.text.secondary}>{item.text}</Text>
                  </HStack>
                ))}
              </VStack>
            </Box>
          </VStack>

          <HStack gap="12px" p="14px 18px" bgColor={colors.bg.input} borderRadius={radius.sm} border={`1px solid ${colors.border.default}`}>
            <LockIcon size={16} color={colors.text.muted} />
            <Text fontSize="12px" color={colors.text.muted} lineHeight="1.5">
              Your keys are derived from your wallet. No data leaves your browser.
            </Text>
          </HStack>
        </VStack>
      </Box>

      {/* Footer */}
      <Box as="footer" borderTop={`1px solid ${colors.border.default}`} py="24px" px="24px">
        <HStack justify="center" gap="24px" maxW="1200px" mx="auto">
          <Text fontSize="12px" color={colors.text.muted}>Powered by ERC-5564 & ERC-6538</Text>
          <Text fontSize="12px" color={colors.text.muted}>•</Text>
          <Text fontSize="12px" color={colors.text.muted}>Thanos Network</Text>
        </HStack>
      </Box>
    </Box>
  );
}
