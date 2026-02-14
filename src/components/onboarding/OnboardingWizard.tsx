"use client";

import { useState, useRef } from "react";
import { Box, HStack, VStack, Text, Spinner } from "@chakra-ui/react";
import { colors, radius, shadows, transitions } from "@/lib/design/tokens";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { UsernameStep } from "./steps/UsernameStep";
import { PinStep } from "./steps/PinStep";
import { AlertCircleIcon } from "../stealth/icons";

type Step = "username" | "pin" | "activating";
const STEPS: Step[] = ["username", "pin"];

export function OnboardingWizard() {
  const router = useRouter();
  const { address, deriveKeysFromWallet, setPin: storePinEncrypted, registerMetaAddress, registerName } = useAuth();
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const activatingRef = useRef(false);

  const currentIndex = step === "activating" ? 2 : STEPS.indexOf(step);

  const handlePinComplete = async (pin: string) => {
    if (activatingRef.current) return;
    activatingRef.current = true;
    setStep("activating");
    setError(null);

    try {
      const result = await deriveKeysFromWallet(pin);
      if (!result) throw new Error("Please approve the signature in your wallet");

      const pinStored = await storePinEncrypted(pin, result.sig);
      if (!pinStored) throw new Error("Failed to store PIN");

      const [nameTx] = await Promise.all([
        registerName(username, result.metaAddress),
        registerMetaAddress().catch(() => null),
      ]);
      if (!nameTx) throw new Error("Failed to register name");

      if (address) {
        localStorage.setItem('dust_onboarded_' + address.toLowerCase(), 'true');
      }

      router.replace("/dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Activation failed";
      setError(msg);
      setStep("pin");
      activatingRef.current = false;
    }
  };

  return (
    <Box w="100%" maxW="420px" mx="auto">
      <Box
        borderRadius={radius.lg}
        bg={colors.bg.cardSolid}
        border={`1px solid ${colors.border.default}`}
        borderTop={`1px solid ${colors.border.light}`}
        boxShadow={shadows.modal}
        overflow="hidden"
      >
        {/* Dots */}
        <HStack gap="6px" justify="center" pt="20px">
          {STEPS.map((_, i) => (
            <Box
              key={i}
              w="6px"
              h="6px"
              borderRadius="full"
              bg={
                i < currentIndex
                  ? "rgba(74,117,240,0.5)"
                  : i === currentIndex
                  ? "rgba(255,255,255,0.8)"
                  : "rgba(255,255,255,0.1)"
              }
              transition={transitions.spring}
            />
          ))}
        </HStack>

        {/* Content */}
        <Box px={{ base: "28px", md: "36px" }} pt="24px" pb="32px">
          {step === "username" && (
            <UsernameStep
              onNext={(name) => { setUsername(name); setStep("pin"); }}
              initialName={username}
            />
          )}
          {step === "pin" && (
            <PinStep onNext={handlePinComplete} />
          )}
          {step === "activating" && (
            <VStack gap="20px" align="stretch">
              <VStack gap="4px" align="flex-start">
                <Text fontSize="20px" fontWeight={600} color={colors.text.primary} letterSpacing="-0.01em">
                  Setting up your wallet
                </Text>
                <Text fontSize="13px" color={colors.text.muted}>
                  {error ? "Activation failed" : "Creating your private identity..."}
                </Text>
              </VStack>

              {!error && (
                <HStack gap="8px" justify="center" py="32px">
                  <Spinner size="sm" color={colors.accent.indigo} />
                  <Text fontSize="13px" color={colors.text.secondary}>
                    Please wait...
                  </Text>
                </HStack>
              )}

              {error && (
                <HStack gap="6px" pl="2px">
                  <AlertCircleIcon size={12} color={colors.accent.red} />
                  <Text fontSize="12px" color={colors.accent.red}>{error}</Text>
                </HStack>
              )}
            </VStack>
          )}
        </Box>
      </Box>
    </Box>
  );
}
