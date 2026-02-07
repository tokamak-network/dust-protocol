"use client";

import { useState, useRef, useEffect, useCallback, KeyboardEvent, ChangeEvent } from "react";
import { Box, Text, VStack, HStack, Input, Spinner } from "@chakra-ui/react";
import { colors, radius, shadows } from "@/lib/design/tokens";
import { AlertCircleIcon, ShieldIcon } from "@/components/stealth/icons";
import { useAuth } from "@/contexts/AuthContext";

interface PinGateProps {
  onUnlocked: () => void;
}

export function PinGate({ onUnlocked }: PinGateProps) {
  const { verifyPin, deriveKeysFromWallet, isPinVerified, verifiedPin, pinError } = useAuth();
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (isPinVerified && verifiedPin) {
      onUnlocked();
    }
  }, [isPinVerified, verifiedPin, onUnlocked]);

  const handleChange = (index: number, digit: string) => {
    if (!/^\d?$/.test(digit)) return;
    const arr = pin.split("");
    arr[index] = digit;
    const newVal = arr.join("").slice(0, 6);
    setPin(newVal);
    if (digit && index < 5) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handleUnlock = useCallback(async () => {
    if (pin.length !== 6 || isVerifying) return;
    setIsVerifying(true);
    setError(null);
    try {
      const ok = await verifyPin(pin);
      if (ok) {
        await deriveKeysFromWallet(pin);
        onUnlocked();
      } else {
        setError("Incorrect PIN");
        setPin("");
        refs.current[0]?.focus();
      }
    } catch {
      setError("Verification failed");
      setPin("");
      refs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  }, [pin, isVerifying, verifyPin, deriveKeysFromWallet, onUnlocked]);

  useEffect(() => {
    if (pin.length === 6) handleUnlock();
  }, [pin, handleUnlock]);

  return (
    <Box
      minH="100vh"
      bg={colors.bg.page}
      display="flex"
      alignItems="center"
      justifyContent="center"
      p="16px"
    >
      <Box
        w="100%"
        maxW="400px"
        p="40px 32px"
        bgColor={colors.bg.card}
        borderRadius={radius.xl}
        boxShadow={shadows.modal}
      >
        <VStack gap="28px">
          <VStack gap="12px" textAlign="center">
            <Box
              w="56px" h="56px"
              borderRadius={radius.full}
              bg="linear-gradient(135deg, rgba(43, 90, 226, 0.1) 0%, rgba(43, 90, 226, 0.05) 100%)"
              display="flex" alignItems="center" justifyContent="center"
            >
              <ShieldIcon size={28} color={colors.accent.indigo} />
            </Box>
            <Text fontSize="20px" fontWeight={700} color={colors.text.primary}>Welcome back</Text>
            <Text fontSize="14px" color={colors.text.muted}>Enter your PIN to unlock</Text>
          </VStack>

          <HStack gap="10px" justify="center">
            {Array.from({ length: 6 }).map((_, i) => (
              <Input
                key={i}
                ref={(el) => { refs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={1}
                value={pin[i] || ""}
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(i, e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => handleKeyDown(i, e)}
                w="48px" h="56px"
                textAlign="center"
                fontSize="24px"
                fontWeight={700}
                bgColor={colors.bg.input}
                border="none"
                borderRadius={radius.sm}
                color={colors.text.primary}
                css={{ WebkitTextSecurity: "disc" }}
                _focus={{ boxShadow: colors.glow.indigo }}
                disabled={isVerifying}
              />
            ))}
          </HStack>

          {isVerifying && (
            <HStack gap="8px">
              <Spinner size="sm" color={colors.accent.indigo} />
              <Text fontSize="13px" color={colors.text.muted}>Verifying...</Text>
            </HStack>
          )}

          {(error || pinError) && (
            <HStack gap="8px" p="12px 16px" bgColor="rgba(229, 62, 62, 0.04)" borderRadius={radius.sm}>
              <AlertCircleIcon size={14} color={colors.accent.red} />
              <Text fontSize="13px" color={colors.accent.red}>{error || pinError}</Text>
            </HStack>
          )}
        </VStack>
      </Box>
    </Box>
  );
}
