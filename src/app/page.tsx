"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Box, Text, VStack, HStack, Input } from "@chakra-ui/react";
import { useAuth } from "@/contexts/AuthContext";
import { colors, radius } from "@/lib/design/tokens";
import { ShieldIcon, LockIcon, WalletIcon, UserIcon, ZapIcon, ArrowUpRightIcon } from "@/components/stealth/icons";
import { useConnect } from "wagmi";
import { injected } from "wagmi/connectors";

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
  const { connect } = useConnect();
  const router = useRouter();
  const [searchName, setSearchName] = useState("");

  useEffect(() => { cleanupCorruptedStorage(); }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (isConnected && isOnboarded) {
      router.replace("/dashboard");
    } else if (isConnected && !isOnboarded) {
      router.replace("/onboarding");
    }
  }, [isConnected, isOnboarded, isHydrated, router]);

  const handlePaySearch = () => {
    const name = searchName.trim().toLowerCase().replace(/\.tok$/, "");
    if (!name) return;
    router.push(`/pay/${name}`);
  };

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

  const steps = [
    { icon: WalletIcon, text: "Connect your wallet" },
    { icon: UserIcon, text: "Choose a username and set a PIN" },
    { icon: ZapIcon, text: "Start receiving private payments" },
  ];

  return (
    <Box
      minH="100vh"
      color={colors.text.primary}
      display="flex"
      flexDirection="column"
      position="relative"
      overflow="hidden"
      bg="linear-gradient(180deg, #FFFFFF 0%, #F0F2FA 50%, #E8EBF7 100%)"
    >
      {/* Decorative background elements */}
      <Box
        position="absolute"
        top="-200px"
        right="-150px"
        w="500px"
        h="500px"
        borderRadius="50%"
        bg="radial-gradient(circle, rgba(43,90,226,0.06) 0%, transparent 70%)"
        pointerEvents="none"
      />
      <Box
        position="absolute"
        bottom="-100px"
        left="-100px"
        w="400px"
        h="400px"
        borderRadius="50%"
        bg="radial-gradient(circle, rgba(74,117,240,0.05) 0%, transparent 70%)"
        pointerEvents="none"
      />

      {/* Header */}
      <Box
        as="header"
        position="relative"
        zIndex={10}
        px="24px"
        py="20px"
      >
        <Box maxW="1200px" mx="auto">
          <HStack gap="8px" align="baseline">
            <Text
              fontSize="24px"
              fontWeight="800"
              color={colors.accent.indigo}
              letterSpacing="-0.03em"
            >
              Dust
            </Text>
            <Text fontSize="14px" fontWeight="500" color={colors.text.muted} letterSpacing="0.02em">
              Protocol
            </Text>
          </HStack>
        </Box>
      </Box>

      {/* Hero */}
      <Box
        flex="1"
        display="flex"
        justifyContent="center"
        alignItems="center"
        px="16px"
        pb="40px"
        position="relative"
        zIndex={10}
      >
        <VStack gap="36px" maxW="440px" textAlign="center">
          {/* Shield with glow ring */}
          <Box position="relative">
            <Box
              position="absolute"
              top="50%"
              left="50%"
              transform="translate(-50%, -50%)"
              w="120px"
              h="120px"
              borderRadius="50%"
              bg="radial-gradient(circle, rgba(43,90,226,0.08) 0%, transparent 70%)"
            />
            <Box
              w="72px"
              h="72px"
              borderRadius="50%"
              bg="linear-gradient(135deg, rgba(43,90,226,0.1) 0%, rgba(74,117,240,0.05) 100%)"
              border="1px solid rgba(43,90,226,0.15)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              color={colors.accent.indigo}
            >
              <ShieldIcon size={32} />
            </Box>
          </Box>

          {/* Title */}
          <VStack gap="14px">
            <Text
              fontSize="40px"
              fontWeight={800}
              color={colors.text.primary}
              lineHeight="1.1"
              letterSpacing="-0.03em"
            >
              Private Payments
            </Text>
            <Text
              fontSize="17px"
              color={colors.text.tertiary}
              lineHeight="1.6"
              maxW="340px"
              fontWeight="400"
            >
              Send and receive payments that cannot be traced to your identity. Powered by stealth addresses on Thanos Network.
            </Text>
          </VStack>

          {/* Pay someone search card */}
          <Box w="100%">
            <Box
              p="4px"
              borderRadius={radius.lg}
              bg="linear-gradient(135deg, rgba(43,90,226,0.12) 0%, rgba(43,90,226,0.04) 100%)"
            >
              <Box
                p="20px"
                bgColor="rgba(255,255,255,0.9)"
                backdropFilter="blur(10px)"
                borderRadius="calc(20px - 4px)"
              >
                <VStack gap="14px" align="stretch">
                  <Text fontSize="15px" fontWeight={700} color={colors.text.primary} textAlign="left">
                    Pay someone
                  </Text>
                  <HStack gap="8px">
                    <Input
                      placeholder="username.tok"
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") handlePaySearch(); }}
                      h="48px"
                      flex={1}
                      bgColor={colors.bg.input}
                      border={`1.5px solid ${colors.border.default}`}
                      borderRadius={radius.sm}
                      color={colors.text.primary}
                      fontSize="16px"
                      fontWeight={500}
                      px="14px"
                      _placeholder={{ color: colors.text.muted }}
                      _focus={{ borderColor: colors.accent.indigo, boxShadow: colors.glow.indigo }}
                    />
                    <Box
                      as="button"
                      w="48px"
                      h="48px"
                      flexShrink={0}
                      bg={`linear-gradient(135deg, ${colors.accent.indigo} 0%, ${colors.accent.indigoBright} 100%)`}
                      borderRadius={radius.sm}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      cursor="pointer"
                      _hover={{ opacity: 0.9, transform: "translateY(-1px)" }}
                      transition="all 0.15s ease"
                      onClick={handlePaySearch}
                    >
                      <ArrowUpRightIcon size={20} color="white" />
                    </Box>
                  </HStack>
                </VStack>
              </Box>
            </Box>
          </Box>

          {/* Divider */}
          <HStack w="100%" gap="16px" align="center">
            <Box flex={1} h="1px" bgColor={colors.border.default} />
            <Text fontSize="13px" color={colors.text.muted} fontWeight={500}>or</Text>
            <Box flex={1} h="1px" bgColor={colors.border.default} />
          </HStack>

          {/* Get Paid section */}
          <VStack gap="12px" w="100%">
            <Text fontSize="13px" color={colors.text.muted} fontWeight={500}>
              Want to receive payments?
            </Text>
            <Box
              as="button"
              w="100%"
              py="14px"
              bgColor="#fff"
              border={`2px solid ${colors.accent.indigo}`}
              borderRadius={radius.md}
              cursor="pointer"
              _hover={{ bgColor: "rgba(43,90,226,0.04)", transform: "translateY(-1px)" }}
              transition="all 0.2s ease"
              onClick={() => connect({ connector: injected() })}
            >
              <HStack justify="center" gap="10px">
                <WalletIcon size={18} color={colors.accent.indigo} />
                <Text fontSize="15px" color={colors.accent.indigo} fontWeight="700" letterSpacing="-0.01em">
                  Connect Wallet
                </Text>
              </HStack>
            </Box>
          </VStack>

          {/* Steps */}
          <Box w="100%">
            <Box
              p="4px"
              borderRadius={radius.lg}
              bg="linear-gradient(135deg, rgba(43,90,226,0.12) 0%, rgba(43,90,226,0.04) 100%)"
            >
              <Box
                p="20px"
                bgColor="rgba(255,255,255,0.9)"
                backdropFilter="blur(10px)"
                borderRadius="calc(20px - 4px)"
              >
                <VStack gap="0" align="stretch">
                  {steps.map((item, i) => (
                    <HStack
                      key={i}
                      gap="14px"
                      align="center"
                      py="12px"
                      borderBottom={i < steps.length - 1 ? `1px solid ${colors.border.default}` : "none"}
                    >
                      <Box
                        w="36px"
                        h="36px"
                        borderRadius="10px"
                        bg={`linear-gradient(135deg, ${colors.accent.indigo} 0%, ${colors.accent.indigoBright} 100%)`}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        flexShrink={0}
                        color="white"
                      >
                        <item.icon size={18} />
                      </Box>
                      <VStack gap="2px" align="start">
                        <Text fontSize="14px" fontWeight="600" color={colors.text.primary}>
                          {item.text}
                        </Text>
                      </VStack>
                    </HStack>
                  ))}
                </VStack>
              </Box>
            </Box>
          </Box>

          {/* Privacy badge */}
          <HStack
            gap="10px"
            p="12px 16px"
            bgColor="rgba(255,255,255,0.7)"
            backdropFilter="blur(8px)"
            borderRadius={radius.sm}
            border={`1px solid ${colors.border.default}`}
          >
            <Box color={colors.accent.indigo} opacity={0.6}>
              <LockIcon size={14} />
            </Box>
            <Text fontSize="12px" color={colors.text.muted} lineHeight="1.5">
              Your keys are derived from your wallet. No data leaves your browser.
            </Text>
          </HStack>
        </VStack>
      </Box>

      {/* Footer */}
      <Box
        as="footer"
        py="20px"
        px="24px"
        position="relative"
        zIndex={10}
      >
        <HStack justify="center" gap="8px" maxW="1200px" mx="auto">
          <Text fontSize="11px" color={colors.text.muted} letterSpacing="0.02em">
            Powered by ERC-5564 & ERC-6538
          </Text>
          <Text fontSize="11px" color={colors.border.light}>
            |
          </Text>
          <Text fontSize="11px" color={colors.text.muted} letterSpacing="0.02em">
            Thanos Network
          </Text>
        </HStack>
      </Box>
    </Box>
  );
}
