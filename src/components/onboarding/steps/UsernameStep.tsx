"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { Box, Text, VStack, HStack, Input, Spinner } from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { colors, radius } from "@/lib/design/tokens";
import { NAME_SUFFIX } from "@/lib/stealth";
import { useStealthName } from "@/hooks/stealth";
import { CheckCircleIcon, AlertCircleIcon, TagIcon } from "@/components/stealth/icons";

interface UsernameStepProps {
  onNext: (name: string) => void;
  initialName?: string;
}

export function UsernameStep({ onNext, initialName = "" }: UsernameStepProps) {
  const [nameInput, setNameInput] = useState(initialName);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const { checkAvailability, validateName, formatName, isConfigured } = useStealthName();

  useEffect(() => {
    const check = async () => {
      if (!nameInput || !isConfigured) { setIsAvailable(null); return; }
      if (!validateName(nameInput).valid) { setIsAvailable(null); return; }
      setIsChecking(true);
      const available = await checkAvailability(nameInput);
      setIsAvailable(available);
      setIsChecking(false);
    };
    const t = setTimeout(check, 500);
    return () => clearTimeout(t);
  }, [nameInput, isConfigured, validateName, checkAvailability]);

  const validation = nameInput ? validateName(nameInput) : null;
  const canContinue = isAvailable === true && validation?.valid;

  return (
    <VStack gap="28px" align="stretch">
      <VStack gap="8px" textAlign="center">
        <Box color={colors.accent.indigo} opacity={0.9}>
          <TagIcon size={36} />
        </Box>
        <Text fontSize="22px" fontWeight={700} color={colors.text.primary}>Choose your username</Text>
        <Text fontSize="14px" color={colors.text.muted} maxW="320px" mx="auto" lineHeight="1.6">
          This is how others will find you. Pick something memorable.
        </Text>
      </VStack>

      <VStack gap="14px" align="stretch">
        <Box position="relative">
          <Input
            placeholder="yourname"
            value={nameInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setNameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            h="56px"
            bgColor={colors.bg.input}
            border={`1.5px solid ${colors.border.default}`}
            borderRadius={radius.sm}
            color={colors.text.primary}
            fontSize="18px"
            px="18px"
            pr="65px"
            fontWeight={500}
            _placeholder={{ color: colors.text.muted }}
            _focus={{ borderColor: colors.accent.indigo, boxShadow: colors.glow.indigo }}
          />
          <Text
            position="absolute"
            right="18px"
            top="50%"
            transform="translateY(-50%)"
            fontSize="18px"
            fontWeight={600}
            color={colors.accent.indigo}
          >
            {NAME_SUFFIX}
          </Text>
        </Box>

        <Box h="24px">
          {isChecking && (
            <HStack gap="6px">
              <Spinner size="xs" color={colors.accent.indigo} />
              <Text fontSize="13px" color={colors.text.secondary}>Checking availability...</Text>
            </HStack>
          )}
          {!isChecking && isAvailable === true && nameInput && (
            <HStack gap="6px">
              <CheckCircleIcon size={14} color={colors.accent.greenBright} />
              <Text fontSize="13px" color={colors.accent.greenBright} fontWeight={600}>
                {formatName(nameInput)} is available
              </Text>
            </HStack>
          )}
          {!isChecking && isAvailable === false && nameInput && (
            <HStack gap="6px">
              <AlertCircleIcon size={14} color={colors.accent.red} />
              <Text fontSize="13px" color={colors.accent.red} fontWeight={600}>
                {formatName(nameInput)} is already taken
              </Text>
            </HStack>
          )}
          {!isChecking && validation && !validation.valid && nameInput && (
            <HStack gap="6px">
              <AlertCircleIcon size={14} color={colors.accent.amber} />
              <Text fontSize="13px" color={colors.accent.amber}>{validation.error}</Text>
            </HStack>
          )}
        </Box>
      </VStack>

      <Button
        h="52px"
        bgColor={canContinue ? colors.accent.indigoDark : colors.bg.elevated}
        borderRadius={radius.sm}
        fontWeight={600}
        fontSize="15px"
        color={canContinue ? "#fff" : colors.text.muted}
        _hover={canContinue ? { bgColor: colors.accent.indigo } : {}}
        onClick={() => canContinue && onNext(nameInput)}
        disabled={!canContinue}
      >
        Continue
      </Button>
    </VStack>
  );
}
