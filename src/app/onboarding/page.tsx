"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, Text, HStack } from "@chakra-ui/react";
import { useAuth } from "@/contexts/AuthContext";
import { ConnectButton } from "@/components/ConnectButton";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { colors } from "@/lib/design/tokens";

export default function OnboardingPage() {
  const { isConnected, isOnboarded, isHydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isHydrated) return; // Wait for localStorage before redirecting
    if (!isConnected) router.replace("/");
    if (isOnboarded) router.replace("/dashboard");
  }, [isConnected, isOnboarded, isHydrated, router]);

  if (!isConnected || !isHydrated) return null;

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
            <Text fontSize="13px" fontWeight="500" color={colors.text.muted}>
              Protocol
            </Text>
          </HStack>
          <ConnectButton />
        </HStack>
      </Box>

      {/* Wizard */}
      <Box flex="1" display="flex" justifyContent="center" py="48px" px="16px">
        <OnboardingWizard />
      </Box>
    </Box>
  );
}
