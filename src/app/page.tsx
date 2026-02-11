"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Box, Text, VStack, HStack, Input } from "@chakra-ui/react";
import { useAuth } from "@/contexts/AuthContext";
import { colors } from "@/lib/design/tokens";
import { ShieldIcon, LockIcon, WalletIcon, UserIcon, ZapIcon, ArrowUpRightIcon } from "@/components/stealth/icons";
import { usePrivy } from "@privy-io/react-auth";
import { Instrument_Serif } from "next/font/google";

const heroFont = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

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

// Dust particle positions and timings (static to avoid hydration mismatch)
const particles = [
  { left: "8%", dur: "14s", delay: "0s" },
  { left: "18%", dur: "11s", delay: "2s" },
  { left: "32%", dur: "16s", delay: "1s" },
  { left: "48%", dur: "12s", delay: "3.5s" },
  { left: "62%", dur: "15s", delay: "0.5s" },
  { left: "76%", dur: "13s", delay: "2.5s" },
  { left: "88%", dur: "17s", delay: "1.5s" },
];

export default function Home() {
  const { isConnected, isOnboarded, isHydrated } = useAuth();
  const { login } = usePrivy();
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
      <Box minH="100vh" bg="#06080F" display="flex" alignItems="center" justifyContent="center">
        <VStack gap="16px">
          <Box color={colors.accent.indigoBright} opacity={0.6}>
            <ShieldIcon size={40} />
          </Box>
          <Text fontSize="14px" color="rgba(255,255,255,0.35)">Loading...</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <>
      <style>{`
        @keyframes dust-rise {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          8% { opacity: 0.6; }
          85% { opacity: 0.6; }
          100% { transform: translateY(-100vh) translateX(30px); opacity: 0; }
        }
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 40px rgba(43,90,226,0.12), 0 0 80px rgba(43,90,226,0.04); }
          50% { box-shadow: 0 0 60px rgba(43,90,226,0.2), 0 0 120px rgba(43,90,226,0.06); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fade-up 0.7s cubic-bezier(0.16,1,0.3,1) forwards; opacity: 0; }
        .d1 { animation-delay: 0.05s; }
        .d2 { animation-delay: 0.15s; }
        .d3 { animation-delay: 0.25s; }
        .d4 { animation-delay: 0.4s; }
        .d5 { animation-delay: 0.55s; }
        .d6 { animation-delay: 0.7s; }
      `}</style>

      <Box
        minH="100vh"
        bg="#06080F"
        display="flex"
        flexDirection="column"
        position="relative"
        overflow="hidden"
      >
        {/* Grid overlay */}
        <Box
          position="absolute"
          inset="0"
          backgroundImage="linear-gradient(rgba(43,90,226,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(43,90,226,0.025) 1px, transparent 1px)"
          backgroundSize="64px 64px"
          pointerEvents="none"
        />

        {/* Central radial glow */}
        <Box
          position="absolute"
          top="25%"
          left="50%"
          transform="translate(-50%, -50%)"
          w="900px"
          h="900px"
          borderRadius="50%"
          bg="radial-gradient(circle, rgba(43,90,226,0.07) 0%, rgba(43,90,226,0.02) 35%, transparent 65%)"
          pointerEvents="none"
        />

        {/* Bottom edge glow */}
        <Box
          position="absolute"
          bottom="-200px"
          left="50%"
          transform="translateX(-50%)"
          w="600px"
          h="400px"
          borderRadius="50%"
          bg="radial-gradient(circle, rgba(43,90,226,0.04) 0%, transparent 60%)"
          pointerEvents="none"
        />

        {/* Dust particles */}
        {particles.map((p, i) => (
          <Box
            key={i}
            position="absolute"
            bottom="-4px"
            left={p.left}
            w="2px"
            h="2px"
            bg="rgba(74,117,240,0.5)"
            borderRadius="50%"
            pointerEvents="none"
            style={{
              animation: `dust-rise ${p.dur} linear ${p.delay} infinite`,
            }}
          />
        ))}

        {/* Header */}
        <Box as="header" position="relative" zIndex={10} px="24px" py="24px">
          <Box maxW="1200px" mx="auto">
            <HStack gap="10px" align="baseline">
              <Text fontSize="22px" fontWeight="800" color="white" letterSpacing="-0.03em">
                Dust
              </Text>
              <Text
                fontSize="11px"
                fontWeight="500"
                color="rgba(255,255,255,0.3)"
                letterSpacing="0.1em"
                textTransform="uppercase"
              >
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
          pb="60px"
          position="relative"
          zIndex={10}
        >
          <VStack gap="40px" maxW="500px" textAlign="center">
            {/* Shield with pulse glow */}
            <Box className="fade-up d1" position="relative">
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                w="140px"
                h="140px"
                borderRadius="50%"
                bg="radial-gradient(circle, rgba(43,90,226,0.1) 0%, transparent 70%)"
              />
              <Box
                w="80px"
                h="80px"
                borderRadius="50%"
                bg="rgba(43,90,226,0.06)"
                border="1px solid rgba(43,90,226,0.12)"
                display="flex"
                alignItems="center"
                justifyContent="center"
                color="#4A75F0"
                style={{ animation: "pulse-ring 4s ease infinite" }}
              >
                <ShieldIcon size={34} />
              </Box>
            </Box>

            {/* Title + subtitle */}
            <VStack gap="16px" className="fade-up d2">
              <Text
                fontFamily={heroFont.style.fontFamily}
                fontSize={{ base: "44px", md: "56px" }}
                fontWeight={400}
                color="white"
                lineHeight="1.05"
                letterSpacing="-0.02em"
              >
                Private Payments
              </Text>
              <Text
                fontSize="16px"
                color="rgba(255,255,255,0.4)"
                lineHeight="1.7"
                maxW="360px"
                fontWeight="400"
              >
                Send and receive payments that dissolve into the blockchain.
                Untraceable. Powered by stealth addresses on Thanos.
              </Text>
            </VStack>

            {/* Connect Wallet CTA */}
            <Box className="fade-up d3" w="100%" display="flex" justifyContent="center">
              <Box
                as="button"
                w="100%"
                maxW="300px"
                py="16px"
                px="32px"
                bg={`linear-gradient(135deg, ${colors.accent.indigo} 0%, ${colors.accent.indigoBright} 100%)`}
                borderRadius="14px"
                cursor="pointer"
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap="10px"
                transition="all 0.25s ease"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "0 8px 32px rgba(43,90,226,0.35), 0 0 0 1px rgba(74,117,240,0.2)",
                }}
                _active={{ transform: "translateY(0)" }}
                onClick={() => login()}
              >
                <WalletIcon size={20} color="white" />
                <Text fontSize="16px" color="white" fontWeight="600" letterSpacing="-0.01em">
                  Get Started
                </Text>
              </Box>
            </Box>

            {/* Divider */}
            <HStack w="100%" gap="16px" align="center" className="fade-up d4">
              <Box flex={1} h="1px" bg="rgba(255,255,255,0.06)" />
              <Text
                fontSize="11px"
                color="rgba(255,255,255,0.2)"
                fontWeight="500"
                textTransform="uppercase"
                letterSpacing="0.1em"
                whiteSpace="nowrap"
              >
                or pay someone
              </Text>
              <Box flex={1} h="1px" bg="rgba(255,255,255,0.06)" />
            </HStack>

            {/* Pay someone search */}
            <HStack gap="8px" w="100%" maxW="360px" className="fade-up d4">
              <Input
                placeholder="username.tok"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") handlePaySearch(); }}
                h="48px"
                flex={1}
                bgColor="rgba(255,255,255,0.03)"
                border="1px solid rgba(255,255,255,0.07)"
                borderRadius="12px"
                color="white"
                fontSize="15px"
                fontWeight={500}
                px="16px"
                _placeholder={{ color: "rgba(255,255,255,0.2)" }}
                _focus={{
                  borderColor: "rgba(43,90,226,0.4)",
                  boxShadow: "0 0 0 3px rgba(43,90,226,0.08)",
                  bgColor: "rgba(255,255,255,0.04)",
                }}
                transition="all 0.2s ease"
              />
              <Box
                as="button"
                w="48px"
                h="48px"
                flexShrink={0}
                bg="rgba(43,90,226,0.1)"
                border="1px solid rgba(43,90,226,0.15)"
                borderRadius="12px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                transition="all 0.15s ease"
                _hover={{
                  bg: "rgba(43,90,226,0.2)",
                  borderColor: "rgba(43,90,226,0.3)",
                }}
                onClick={handlePaySearch}
              >
                <ArrowUpRightIcon size={18} color="#4A75F0" />
              </Box>
            </HStack>

            {/* 3-step explainer */}
            <HStack
              gap={{ base: "8px", md: "12px" }}
              w="100%"
              className="fade-up d5"
              flexDirection={{ base: "column", md: "row" }}
            >
              {[
                { icon: WalletIcon, label: "Sign In", desc: "Wallet or social login" },
                { icon: UserIcon, label: "Setup", desc: "Choose name & PIN" },
                { icon: ZapIcon, label: "Receive", desc: "Get paid privately" },
              ].map((step, i) => (
                <Box
                  key={i}
                  flex={1}
                  w={{ base: "100%", md: "auto" }}
                  py={{ base: "14px", md: "20px" }}
                  px="16px"
                  bg="rgba(255,255,255,0.02)"
                  border="1px solid rgba(255,255,255,0.05)"
                  borderRadius="14px"
                  textAlign="center"
                  transition="all 0.2s ease"
                  _hover={{
                    bg: "rgba(255,255,255,0.03)",
                    borderColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  <VStack gap="6px">
                    <Box color="rgba(74,117,240,0.7)">
                      <step.icon size={20} />
                    </Box>
                    <Text fontSize="14px" fontWeight="600" color="rgba(255,255,255,0.8)">
                      {step.label}
                    </Text>
                    <Text fontSize="12px" color="rgba(255,255,255,0.25)">
                      {step.desc}
                    </Text>
                  </VStack>
                </Box>
              ))}
            </HStack>

            {/* Privacy notice */}
            <HStack gap="8px" className="fade-up d6" py="4px">
              <Box color="rgba(255,255,255,0.2)" flexShrink={0}>
                <LockIcon size={12} />
              </Box>
              <Text fontSize="12px" color="rgba(255,255,255,0.2)" lineHeight="1.5">
                Your keys are derived locally. No data leaves your browser.
              </Text>
            </HStack>
          </VStack>
        </Box>

        {/* Footer */}
        <Box as="footer" py="20px" px="24px" position="relative" zIndex={10}>
          <HStack justify="center" gap="8px" maxW="1200px" mx="auto">
            <Text fontSize="11px" color="rgba(255,255,255,0.15)" letterSpacing="0.02em">
              ERC-5564 & ERC-6538
            </Text>
            <Text fontSize="11px" color="rgba(255,255,255,0.08)">|</Text>
            <Text fontSize="11px" color="rgba(255,255,255,0.15)" letterSpacing="0.02em">
              Thanos Network
            </Text>
          </HStack>
        </Box>
      </Box>
    </>
  );
}
