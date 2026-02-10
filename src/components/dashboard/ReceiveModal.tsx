"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Text, VStack, HStack } from "@chakra-ui/react";
import QRCode from "qrcode";
import { colors, radius, shadows } from "@/lib/design/tokens";
import { XIcon, CopyIcon, CheckIcon } from "@/components/stealth/icons";

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokName: string | null;
  payPath: string;
}

export function ReceiveModal({ isOpen, onClose, tokName, payPath }: ReceiveModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [fullUrl, setFullUrl] = useState("");

  useEffect(() => {
    if (!isOpen || !canvasRef.current || !payPath) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}${payPath}`;
    setFullUrl(url);
    QRCode.toCanvas(canvasRef.current, url, {
      width: 260,
      margin: 2,
      color: { dark: "#1A1D2B", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    }, () => {});
  }, [isOpen, payPath]);

  const handleCopy = async () => {
    if (!fullUrl) return;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <Box position="fixed" inset="0" bgColor="rgba(0,0,0,0.5)" zIndex={999}
        onClick={onClose} />

      {/* Modal */}
      <Box position="fixed" inset="0" display="flex" alignItems="center" justifyContent="center"
        zIndex={1000} p="16px" onClick={onClose}>
        <Box bgColor={colors.bg.card} borderRadius={radius.xl}
          boxShadow={shadows.modal} maxW="400px" w="100%"
          p="40px 32px" position="relative"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}>

          {/* Close button */}
          <Box as="button" position="absolute" top="16px" right="16px"
            w="36px" h="36px" borderRadius={radius.full}
            border={`2px solid ${colors.border.default}`}
            display="flex" alignItems="center" justifyContent="center"
            cursor="pointer" _hover={{ bgColor: colors.bg.input }}
            onClick={onClose}>
            <XIcon size={16} color={colors.text.secondary} />
          </Box>

          {tokName ? (
            <VStack gap="24px">
              {/* Title */}
              <VStack gap="6px">
                <Text fontSize="22px" fontWeight={700} color={colors.text.primary}>Share Your Link</Text>
                <Text fontSize="14px" color={colors.text.muted}>Anyone can pay you with this link</Text>
              </VStack>

              {/* QR Code */}
              <Box p="16px" borderRadius={radius.lg}
                border={`4px solid ${colors.accent.indigo}`}
                boxShadow={`0 4px 20px ${colors.accent.indigo}25`}
                bgColor="#fff">
                <canvas ref={canvasRef} style={{ display: "block", borderRadius: "12px" }} />
              </Box>

              {/* .tok name pill */}
              <Box px="20px" py="10px" bgColor={colors.bg.input}
                borderRadius={radius.full}>
                <Text fontSize="15px" fontWeight={700} color={colors.text.primary}
                  textAlign="center">
                  {tokName}
                </Text>
              </Box>

              {/* Full URL row */}
              <HStack
                w="100%"
                p="12px 14px"
                bgColor={colors.bg.input}
                borderRadius={radius.sm}
                gap="10px"
              >
                <Text flex={1} fontSize="13px" color={colors.text.muted} truncate>
                  {fullUrl}
                </Text>
                <Box
                  as="button"
                  p="6px"
                  borderRadius={radius.full}
                  cursor="pointer"
                  _hover={{ bgColor: colors.bg.elevated }}
                  onClick={handleCopy}
                  flexShrink={0}
                >
                  {copied
                    ? <CheckIcon size={16} color={colors.accent.indigo} />
                    : <CopyIcon size={16} color={colors.text.muted} />
                  }
                </Box>
              </HStack>

              {/* Branding */}
              <Text fontSize="14px" fontWeight={700} color={colors.text.secondary} opacity={0.6} letterSpacing="-0.02em">
                Dust Protocol
              </Text>
            </VStack>
          ) : (
            <VStack gap="16px" py="20px">
              <Text fontSize="18px" fontWeight={700} color={colors.text.primary} textAlign="center">
                No Username Yet
              </Text>
              <Text fontSize="14px" color={colors.text.muted} textAlign="center" lineHeight="1.6">
                Register a username to get a shareable payment link.
              </Text>
            </VStack>
          )}
        </Box>
      </Box>
    </>
  );
}
