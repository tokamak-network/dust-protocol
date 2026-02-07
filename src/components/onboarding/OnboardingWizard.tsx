"use client";

import { useState } from "react";
import { Box, Text, HStack } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { colors, radius } from "@/lib/design/tokens";
import { UsernameStep } from "./steps/UsernameStep";
import { PinStep } from "./steps/PinStep";
import { ActivateStep } from "./steps/ActivateStep";

type Step = "username" | "pin" | "activate";

const STEPS: { id: Step; label: string }[] = [
  { id: "username", label: "Username" },
  { id: "pin", label: "PIN" },
  { id: "activate", label: "Activate" },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");

  const currentIndex = STEPS.findIndex(s => s.id === step);

  const handleUsernameNext = (name: string) => {
    setUsername(name);
    setStep("pin");
  };

  const handlePinNext = (p: string) => {
    setPin(p);
    setStep("activate");
  };

  const handleComplete = () => {
    router.replace("/dashboard");
  };

  return (
    <Box w="100%" maxW="440px" mx="auto">
      {/* Progress indicator */}
      <HStack gap="8px" mb="32px" justify="center">
        {STEPS.map((s, i) => (
          <HStack key={s.id} gap="8px" align="center">
            <Box
              w="28px"
              h="28px"
              borderRadius="50%"
              bgColor={i <= currentIndex ? colors.accent.indigo : colors.bg.elevated}
              border={`1.5px solid ${i <= currentIndex ? colors.accent.indigo : colors.border.default}`}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize="12px" fontWeight={700} color={i <= currentIndex ? "#fff" : colors.text.muted}>
                {i + 1}
              </Text>
            </Box>
            <Text
              fontSize="13px"
              fontWeight={i === currentIndex ? 600 : 400}
              color={i === currentIndex ? colors.text.primary : colors.text.muted}
              display={{ base: i === currentIndex ? "block" : "none", md: "block" }}
            >
              {s.label}
            </Text>
            {i < STEPS.length - 1 && (
              <Box w="24px" h="1px" bgColor={i < currentIndex ? colors.accent.indigo : colors.border.default} />
            )}
          </HStack>
        ))}
      </HStack>

      {/* Step content */}
      <Box
        p="32px"
        bgColor={colors.bg.card}
        borderRadius={radius.xl}
        border={`1.5px solid ${colors.border.default}`}
        boxShadow="0 4px 24px rgba(0, 0, 0, 0.08)"
      >
        {step === "username" && <UsernameStep onNext={handleUsernameNext} initialName={username} />}
        {step === "pin" && <PinStep onNext={handlePinNext} />}
        {step === "activate" && <ActivateStep username={username} pin={pin} onComplete={handleComplete} />}
      </Box>
    </Box>
  );
}
