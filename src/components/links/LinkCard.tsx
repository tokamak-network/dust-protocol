"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Text, VStack, HStack } from "@chakra-ui/react";
import { colors, radius, shadows } from "@/lib/design/tokens";
import type { OwnedName, PaymentLink } from "@/lib/design/types";
import {
  LinkIcon, CopyIcon, CheckIcon, QRIcon, EyeIcon, WalletIcon,
} from "@/components/stealth/icons";
import { QRModal } from "./QRModal";

interface PersonalLinkCardProps {
  name: OwnedName;
  type: "personal";
  accentColor: string;
}

interface CustomLinkCardProps {
  link: PaymentLink;
  username: string;
  type: "custom";
  accentColor: string;
}

type LinkCardProps = PersonalLinkCardProps | CustomLinkCardProps;

export function LinkCard(props: LinkCardProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const isPersonal = props.type === "personal";
  const title = isPersonal ? "Personal" : props.link.name;
  const tokName = isPersonal
    ? `${props.name.name}.tok`
    : `${props.link.slug}.${props.username}.tok`;
  const payPath = isPersonal
    ? `/pay/${props.name.name}`
    : `/pay/${props.username}/${props.link.slug}`;
  const emoji = isPersonal ? undefined : props.link.emoji;
  const emojiBg = isPersonal ? undefined : props.link.emojiBg;
  const views = isPersonal ? undefined : props.link.views;
  const payments = isPersonal ? undefined : props.link.payments;
  const accentColor = props.accentColor;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(tokName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQR = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowQR(true);
  };

  const handleClick = () => {
    if (isPersonal) {
      window.open(payPath, "_blank");
    } else {
      router.push(`/links/${props.link.id}`);
    }
  };

  return (
    <>
      <Box
        p="24px"
        bgColor={colors.bg.card}
        borderRadius={radius.lg}
        border={`2.5px solid ${accentColor}`}
        boxShadow={shadows.card}
        cursor="pointer"
        _hover={{ boxShadow: shadows.cardHover, transform: "translateY(-1px)" }}
        transition="all 0.2s ease"
        onClick={handleClick}
      >
        <VStack gap="20px" align="stretch">
          <HStack justify="space-between" align="flex-start">
            {emoji ? (
              <Box w="44px" h="44px" borderRadius={radius.full} bgColor={emojiBg}
                display="flex" alignItems="center" justifyContent="center" fontSize="22px"
                boxShadow={`0 3px 10px ${accentColor}40`}>
                {emoji}
              </Box>
            ) : (
              <Box w="44px" h="44px" borderRadius={radius.full}
                bg={`linear-gradient(135deg, ${accentColor}1F 0%, ${accentColor}0F 100%)`}
                display="flex" alignItems="center" justifyContent="center"
                border={`1.5px solid ${accentColor}26`}>
                <LinkIcon size={20} color={accentColor} />
              </Box>
            )}
            <VStack align="flex-end" gap="4px">
              <Box px="10px" py="4px" borderRadius={radius.xs} bgColor={colors.bg.input}>
                <Text fontSize="11px" fontWeight={600} color={colors.text.tertiary} letterSpacing="0.02em">Simple Payment</Text>
              </Box>
              {views !== undefined && (
                <HStack gap="10px">
                  <HStack gap="3px">
                    <EyeIcon size={12} color={colors.text.muted} />
                    <Text fontSize="11px" color={colors.text.muted}>{views}</Text>
                  </HStack>
                  <HStack gap="3px">
                    <WalletIcon size={11} color={colors.text.muted} />
                    <Text fontSize="11px" color={colors.text.muted}>{payments}</Text>
                  </HStack>
                </HStack>
              )}
            </VStack>
          </HStack>

          <Text fontSize="16px" fontWeight={600} color={colors.text.primary}>{title}</Text>

          <HStack justify="space-between" align="center">
            <HStack gap="8px" flex={1} overflow="hidden">
              <LinkIcon size={14} color={colors.text.muted} />
              <Text fontSize="13px" color={colors.text.muted} truncate>{tokName}</Text>
            </HStack>
            <HStack gap="2px">
              <Box as="button" p="7px" borderRadius={radius.full}
                _hover={{ bgColor: colors.bg.input }} onClick={handleCopy}>
                {copied
                  ? <CheckIcon size={14} color={accentColor} />
                  : <CopyIcon size={14} color={colors.text.muted} />
                }
              </Box>
              <Box as="button" p="7px" borderRadius={radius.full}
                _hover={{ bgColor: colors.bg.input }} onClick={handleQR}>
                <QRIcon size={14} color={colors.text.muted} />
              </Box>
            </HStack>
          </HStack>
        </VStack>
      </Box>

      <QRModal
        isOpen={showQR}
        onClose={() => setShowQR(false)}
        url={payPath}
        title={title}
        displayName={tokName}
        accentColor={accentColor}
      />
    </>
  );
}
