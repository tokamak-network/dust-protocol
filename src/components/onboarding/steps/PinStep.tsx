"use client";

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from "react";
import { Box, Text, VStack, HStack, Input } from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { colors, radius } from "@/lib/design/tokens";
import { LockIcon, AlertCircleIcon, InfoIcon } from "@/components/stealth/icons";

interface PinStepProps {
  onNext: (pin: string) => void;
}

function PinInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (value === "") refs.current[0]?.focus();
  }, [value]);

  const handleChange = (index: number, digit: string) => {
    if (!/^\d?$/.test(digit)) return;
    const arr = value.split("");
    arr[index] = digit;
    const newVal = arr.join("").slice(0, 6);
    onChange(newVal);
    if (digit && index < 5) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <VStack gap="10px" align="stretch">
      <Text fontSize="12px" color={colors.text.tertiary} fontWeight={500}>{label}</Text>
      <HStack gap="8px" justify="center">
        {Array.from({ length: 6 }).map((_, i) => (
          <Input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={1}
            value={value[i] || ""}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(i, e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => handleKeyDown(i, e)}
            w="48px"
            h="56px"
            textAlign="center"
            fontSize="24px"
            fontWeight={700}
            bgColor={colors.bg.input}
            border={`1.5px solid ${value[i] ? colors.accent.indigo : colors.border.default}`}
            borderRadius={radius.sm}
            color={colors.text.primary}
            css={{ WebkitTextSecurity: "disc" }}
            _focus={{ borderColor: colors.accent.indigo, boxShadow: colors.glow.indigo }}
          />
        ))}
      </HStack>
    </VStack>
  );
}

export function PinStep({ onNext }: PinStepProps) {
  const [step, setStep] = useState<"create" | "confirm">("create");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleCreateNext = () => {
    if (pin.length !== 6) { setError("PIN must be 6 digits"); return; }
    setError(null);
    setStep("confirm");
    setConfirmPin("");
  };

  const handleConfirm = () => {
    if (confirmPin !== pin) {
      setError("PINs do not match");
      setConfirmPin("");
      return;
    }
    setError(null);
    onNext(pin);
  };

  return (
    <VStack gap="28px" align="stretch">
      <VStack gap="8px" textAlign="center">
        <Box color={colors.accent.indigo} opacity={0.9}>
          <LockIcon size={36} />
        </Box>
        <Text fontSize="22px" fontWeight={700} color={colors.text.primary}>
          {step === "create" ? "Set your PIN" : "Confirm your PIN"}
        </Text>
        <Text fontSize="14px" color={colors.text.muted} maxW="320px" mx="auto" lineHeight="1.6">
          {step === "create"
            ? "This PIN + your wallet creates your stealth identity"
            : "Enter the same PIN again to confirm"
          }
        </Text>
      </VStack>

      {step === "create" ? (
        <PinInput value={pin} onChange={setPin} label="Create PIN" />
      ) : (
        <PinInput value={confirmPin} onChange={setConfirmPin} label="Confirm PIN" />
      )}

      {error && (
        <HStack gap="8px" p="12px 16px" bgColor="rgba(229, 62, 62, 0.06)" borderRadius={radius.xs}>
          <AlertCircleIcon size={14} color={colors.accent.red} />
          <Text fontSize="13px" color={colors.accent.red}>{error}</Text>
        </HStack>
      )}

      <HStack gap="10px">
        {step === "confirm" && (
          <Button
            flex={1}
            h="52px"
            bgColor={colors.bg.elevated}
            borderRadius={radius.sm}
            border={`1px solid ${colors.border.default}`}
            fontWeight={500}
            fontSize="14px"
            color={colors.text.primary}
            _hover={{ bgColor: colors.bg.hover }}
            onClick={() => { setStep("create"); setPin(""); setConfirmPin(""); setError(null); }}
          >
            Back
          </Button>
        )}
        <Button
          flex={2}
          h="52px"
          bgColor={(step === "create" ? pin.length === 6 : confirmPin.length === 6) ? colors.accent.indigoDark : colors.bg.elevated}
          borderRadius={radius.sm}
          fontWeight={600}
          fontSize="15px"
          color={(step === "create" ? pin.length === 6 : confirmPin.length === 6) ? "#fff" : colors.text.muted}
          _hover={(step === "create" ? pin.length === 6 : confirmPin.length === 6) ? { bgColor: colors.accent.indigo } : {}}
          onClick={step === "create" ? handleCreateNext : handleConfirm}
          disabled={step === "create" ? pin.length !== 6 : confirmPin.length !== 6}
        >
          {step === "create" ? "Continue" : "Confirm PIN"}
        </Button>
      </HStack>

      <HStack gap="10px" p="14px 16px" bgColor="rgba(217, 119, 6, 0.06)" borderRadius={radius.sm} border="1px solid rgba(217, 119, 6, 0.12)">
        <InfoIcon size={16} color={colors.accent.amber} />
        <Text fontSize="12px" color={colors.accent.amber} lineHeight="1.5">
          This PIN cannot be recovered if forgotten. You would need to create a new identity.
        </Text>
      </HStack>
    </VStack>
  );
}
