"use client";

import { useRouter } from "next/navigation";
import { Box, Text, VStack, HStack, Spinner } from "@chakra-ui/react";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentLinks } from "@/hooks/stealth/usePaymentLinks";
import { useStealthScanner } from "@/hooks/stealth";
import { colors, radius, shadows, EXPLORER_BASE } from "@/lib/design/tokens";
import {
  ArrowLeftIcon, MoreHorizontalIcon, LinkIcon, CopyIcon, CheckIcon,
  QRIcon, ActivityIcon, TrashIcon, EyeIcon, WalletIcon,
  ArrowDownLeftIcon, ArrowUpRightIcon,
} from "@/components/stealth/icons";
import { QRModal } from "@/components/links/QRModal";

export default function LinkDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { ownedNames, stealthKeys } = useAuth();
  const { getLink, deleteLink } = usePaymentLinks();
  const { payments, scanInBackground, stopBackgroundScan, isScanning } = useStealthScanner(stealthKeys);
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const link = getLink(id);
  const username = ownedNames[0]?.name || "";

  // Start scanning when page mounts
  useEffect(() => {
    if (stealthKeys) {
      scanInBackground();
      return () => stopBackgroundScan();
    }
  }, [stealthKeys, scanInBackground, stopBackgroundScan]);

  // Filter payments for this specific link
  const linkPayments = useMemo(() => {
    if (!link) return [];
    return payments.filter(p => p.announcement.linkSlug === link.slug);
  }, [payments, link]);

  if (!link) {
    return (
      <Box p={{ base: "20px 16px", md: "40px" }} maxW="680px" mx="auto">
        <VStack gap="24px" py="60px" textAlign="center">
          <Text fontSize="18px" fontWeight={600} color={colors.text.primary}>Link not found</Text>
          <Box as="button" px="20px" py="10px" bgColor={colors.bg.input} borderRadius={radius.full}
            cursor="pointer" onClick={() => router.push("/links")}>
            <Text fontSize="14px" color={colors.text.secondary}>Back to Links</Text>
          </Box>
        </VStack>
      </Box>
    );
  }

  const tokName = `${link.slug}.${username}.tok`;
  const payPath = `/pay/${username}/${link.slug}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(tokName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    deleteLink(link.id);
    router.push("/links");
  };

  return (
    <Box p={{ base: "20px 16px", md: "40px" }} maxW="680px" mx="auto">
      <VStack gap="28px" align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <Box as="button" p="8px" borderRadius={radius.full} _hover={{ bgColor: colors.bg.input }}
            onClick={() => router.push("/links")}>
            <ArrowLeftIcon size={20} color={colors.text.secondary} />
          </Box>
          <Text fontSize="24px" fontWeight={700} color={colors.text.primary}>{link.name}</Text>
          <Box position="relative">
            <Box as="button" p="8px" borderRadius={radius.full} _hover={{ bgColor: colors.bg.input }}
              onClick={() => setShowMenu(!showMenu)}>
              <MoreHorizontalIcon size={20} color={colors.text.secondary} />
            </Box>
            {showMenu && (
              <Box position="absolute" right="0" top="40px" zIndex={50}
                bgColor={colors.bg.card} borderRadius={radius.md}
                border={`2px solid ${colors.border.default}`}
                boxShadow={shadows.modal} minW="160px" overflow="hidden">
                <Box as="button" w="100%" p="12px 16px" display="flex" gap="10px" alignItems="center"
                  _hover={{ bgColor: "rgba(229, 62, 62, 0.06)" }} cursor="pointer"
                  onClick={handleDelete}>
                  <TrashIcon size={16} color={colors.accent.red} />
                  <Text fontSize="13px" color={colors.accent.red} fontWeight={500}>Delete Link</Text>
                </Box>
              </Box>
            )}
          </Box>
        </HStack>

        {/* Large emoji with gradient bg */}
        <Box display="flex" justifyContent="center" py="8px">
          <Box w="140px" h="140px" borderRadius={radius.full} bgColor={link.emojiBg}
            display="flex" alignItems="center" justifyContent="center" fontSize="60px"
            boxShadow={`0 12px 40px ${link.emojiBg}60`}>
            {link.emoji}
          </Box>
        </Box>

        {/* Stats - colored cards */}
        <HStack gap="12px">
          <Box flex={1} p="20px" textAlign="center" bgColor={colors.bg.card}
            borderRadius={radius.lg} border={`2px solid ${colors.border.default}`}>
            <HStack justify="center" gap="6px" mb="6px">
              <EyeIcon size={16} color="#60A5FA" />
            </HStack>
            <Text fontSize="26px" fontWeight={700} color={colors.text.primary}>{link.views}</Text>
            <Text fontSize="12px" color={colors.text.muted} mt="4px">Views</Text>
          </Box>
          <Box flex={1} p="20px" textAlign="center" bgColor={colors.bg.card}
            borderRadius={radius.lg} border={`2px solid ${colors.border.default}`}>
            <HStack justify="center" gap="6px" mb="6px">
              <WalletIcon size={16} color="#34D399" />
            </HStack>
            <Text fontSize="26px" fontWeight={700} color={colors.text.primary}>{linkPayments.length}</Text>
            <Text fontSize="12px" color={colors.text.muted} mt="4px">Payments</Text>
          </Box>
          <Box flex={1} p="20px" textAlign="center" bgColor={colors.bg.card}
            borderRadius={radius.lg} border={`2px solid ${colors.border.default}`}>
            <HStack justify="center" gap="6px" mb="6px">
              <Text fontSize="16px">💰</Text>
            </HStack>
            <Text fontSize="26px" fontWeight={700} color="#34D399">
              {linkPayments.reduce((sum, p) => sum + parseFloat(p.originalAmount || p.balance || "0"), 0).toFixed(4)} TON
            </Text>
            <Text fontSize="12px" color={colors.text.muted} mt="4px">Total Received</Text>
          </Box>
        </HStack>

        {/* URL bar with blue accent */}
        <Box overflow="hidden" borderRadius={radius.lg}
          border={`2px solid rgba(43, 90, 226, 0.25)`}
          bgColor={colors.bg.card}>
          <HStack p="14px 20px" justify="space-between">
            <HStack gap="10px" flex={1} overflow="hidden">
              <Box w="32px" h="32px" borderRadius={radius.full}
                bg="linear-gradient(135deg, #93C5FD 0%, #60A5FA 100%)"
                display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
                <LinkIcon size={14} color="#fff" />
              </Box>
              <Text fontSize="14px" fontWeight={500} color={colors.text.primary} truncate>{tokName}</Text>
            </HStack>
            <HStack gap="4px">
              <Box as="button" p="8px" borderRadius={radius.full}
                bgColor={copied ? "rgba(43, 90, 226, 0.08)" : "transparent"}
                _hover={{ bgColor: colors.bg.input }}
                cursor="pointer" onClick={handleCopy} transition="all 0.15s ease">
                {copied
                  ? <CheckIcon size={16} color={colors.accent.indigo} />
                  : <CopyIcon size={16} color={colors.text.muted} />
                }
              </Box>
              <Box as="button" p="8px" borderRadius={radius.full} _hover={{ bgColor: colors.bg.input }}
                cursor="pointer" onClick={() => setShowQR(true)}>
                <QRIcon size={16} color={colors.text.muted} />
              </Box>
            </HStack>
          </HStack>
        </Box>

        <QRModal
          isOpen={showQR}
          onClose={() => setShowQR(false)}
          url={payPath}
          title={link.name}
          displayName={tokName}
          accentColor={link.emojiBg}
        />

        {/* Type + Description */}
        <Box p="24px" bgColor={colors.bg.card} borderRadius={radius.lg}
          border={`2px solid ${colors.border.default}`}>
          <VStack gap="16px" align="stretch">
            <Box display="inline-flex" alignSelf="flex-start"
              px="14px" py="6px" borderRadius={radius.full}
              bgColor="rgba(52, 211, 153, 0.1)" border="1.5px solid rgba(52, 211, 153, 0.3)">
              <HStack gap="6px">
                <Box w="8px" h="8px" borderRadius={radius.full} bgColor="#34D399" />
                <Text fontSize="12px" fontWeight={600} color="#059669">Simple Payment</Text>
              </HStack>
            </Box>
            <Text fontSize="14px" color={colors.text.muted} lineHeight="1.6">
              {link.description || "No description for this link"}
            </Text>
          </VStack>
        </Box>

        {/* Recent Activities */}
        <VStack gap="16px" align="stretch">
          <HStack justify="space-between" align="center">
            <Text fontSize="18px" fontWeight={600} color={colors.text.primary}>Recent Activities</Text>
            {isScanning && <Spinner size="xs" color={colors.text.muted} />}
          </HStack>
          {linkPayments.length === 0 ? (
            <Box p="48px 24px" bgColor={colors.bg.card} borderRadius={radius.lg}
              border={`2px solid ${colors.border.default}`} textAlign="center">
              <VStack gap="16px">
                <Box w="56px" h="56px" borderRadius={radius.full}
                  bgColor={colors.bg.input}
                  display="flex" alignItems="center" justifyContent="center">
                  <ActivityIcon size={24} color={colors.text.muted} />
                </Box>
                <VStack gap="4px">
                  <Text fontSize="15px" fontWeight={600} color={colors.text.primary}>No activities yet</Text>
                  <Text fontSize="13px" color={colors.text.muted}>Payments sent via this link will appear here.</Text>
                </VStack>
              </VStack>
            </Box>
          ) : (
            <VStack gap="8px" align="stretch">
              {linkPayments.map((payment) => {
                const displayAmount = parseFloat(payment.originalAmount || payment.balance || "0");
                return (
                  <HStack
                    key={payment.announcement.txHash}
                    p="16px 20px"
                    bgColor={colors.bg.card}
                    borderRadius={radius.md}
                    border={`2px solid ${colors.border.default}`}
                    justify="space-between"
                    opacity={1}
                  >
                    <HStack gap="14px">
                      <Box
                        w="42px" h="42px"
                        borderRadius={radius.full}
                        bgColor="rgba(43, 90, 226, 0.08)"
                        display="flex" alignItems="center" justifyContent="center"
                        flexShrink={0}
                      >
                        <ArrowDownLeftIcon size={20} color={colors.accent.indigo} />
                      </Box>
                      <VStack align="flex-start" gap="2px">
                        <Text fontSize="14px" fontWeight={500} color={colors.text.primary}>
                          Received from {payment.announcement.caller?.slice(0, 6)}...{payment.announcement.caller?.slice(-4) || "unknown"}
                        </Text>
                        <Text fontSize="12px" color={colors.text.muted}>
                          Block #{payment.announcement.blockNumber.toLocaleString()}
                        </Text>
                      </VStack>
                    </HStack>
                    <HStack gap="10px">
                      <Text fontSize="15px" fontWeight={600} color={colors.accent.indigo}>
                        +{displayAmount.toFixed(4)} TON
                      </Text>
                      <a href={`${EXPLORER_BASE}/tx/${payment.announcement.txHash}`} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}>
                        <Box p="6px" borderRadius={radius.full} _hover={{ bgColor: colors.bg.input }}>
                          <ArrowUpRightIcon size={14} color={colors.text.muted} />
                        </Box>
                      </a>
                    </HStack>
                  </HStack>
                );
              })}
            </VStack>
          )}
        </VStack>
      </VStack>
    </Box>
  );
}
