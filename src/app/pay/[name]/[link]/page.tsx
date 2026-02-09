"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { Box, Text, VStack, HStack, Input, Spinner } from "@chakra-ui/react";
import { Button } from "@/components/ui/button";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { colors, radius, EXPLORER_BASE } from "@/lib/design/tokens";
import { useStealthSend, useStealthName } from "@/hooks/stealth";
import { NAME_SUFFIX } from "@/lib/stealth";
import { NoOptInPayment } from "@/components/pay/NoOptInPayment";
import {
  ShieldIcon, CheckCircleIcon, AlertCircleIcon, ArrowUpRightIcon, LockIcon,
  ChevronDownIcon, ChevronUpIcon, WalletIcon,
} from "@/components/stealth/icons";

export default function LinkPayPage({ params }: { params: { name: string; link: string } }) {
  const { name, link } = params;
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const { resolveName, formatName, isConfigured } = useStealthName();
  const { generateAddressFor, sendEthToStealth, lastGeneratedAddress, isLoading, error: sendError } = useStealthSend();

  const [resolvedMeta, setResolvedMeta] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [amount, setAmount] = useState("");
  const [sendStep, setSendStep] = useState<"input" | "confirm" | "success">("input");
  const [sendTxHash, setSendTxHash] = useState<string | null>(null);
  const [walletFlowOpen, setWalletFlowOpen] = useState(false);

  const tokName = `${link}.${name}.tok`;

  useEffect(() => {
    const resolve = async () => {
      if (!isConfigured) return;
      setIsResolving(true);
      // Resolve the username (not the link slug) — the link just identifies which payment link
      const resolved = await resolveName(name + NAME_SUFFIX);
      if (resolved) {
        setResolvedMeta(`st:thanos:${resolved}`);
      } else {
        const resolved2 = await resolveName(name);
        if (resolved2) {
          setResolvedMeta(`st:thanos:${resolved2}`);
        } else {
          setNotFound(true);
        }
      }
      setIsResolving(false);
    };
    resolve();
  }, [name, isConfigured, resolveName]);

  const handlePreview = () => {
    if (!resolvedMeta || !amount) return;
    if (generateAddressFor(resolvedMeta)) setSendStep("confirm");
  };

  const handleSend = async () => {
    if (!resolvedMeta) return;
    const hash = await sendEthToStealth(resolvedMeta, amount, link);
    if (hash) { setSendTxHash(hash); setSendStep("success"); }
  };

  return (
    <Box minH="100vh" bg={colors.bg.page} color={colors.text.primary} display="flex" flexDirection="column">
      {/* Header */}
      <Box as="header" borderBottom={`1px solid ${colors.border.default}`} bg="rgba(255, 255, 255, 0.95)"
        backdropFilter="blur(10px)" px="24px" py="16px">
        <HStack justify="space-between" align="center" maxW="600px" mx="auto">
          <HStack gap="8px" align="baseline">
            <Text fontSize="20px" fontWeight="800" color={colors.text.primary} letterSpacing="-0.03em">Dust Protocol</Text>
          </HStack>
          <Box px="10px" py="4px" bgColor="rgba(43, 90, 226, 0.08)" borderRadius={radius.xs}>
            <Text fontSize="11px" color={colors.accent.indigo} fontWeight={600}>Payment</Text>
          </Box>
        </HStack>
      </Box>

      {/* Content */}
      <Box flex="1" display="flex" justifyContent="center" py="48px" px="16px">
        <Box w="100%" maxW="440px">
          {isResolving ? (
            <VStack gap="20px" py="48px">
              <Spinner size="lg" color={colors.accent.indigo} />
              <Text fontSize="14px" color={colors.text.muted}>Resolving {tokName}...</Text>
            </VStack>
          ) : notFound ? (
            <VStack gap="20px" py="48px" textAlign="center">
              <AlertCircleIcon size={48} color={colors.accent.red} />
              <Text fontSize="18px" fontWeight={600} color={colors.text.primary}>{tokName} not found</Text>
              <Text fontSize="14px" color={colors.text.muted}>This name is not registered on Dust Protocol.</Text>
            </VStack>
          ) : (
            <VStack gap="16px">
              {/* Primary: No-opt-in payment card */}
              <Box bgColor={colors.bg.card} borderRadius={radius.xl} border={`1.5px solid ${colors.border.default}`}
                boxShadow="0 4px 24px rgba(0, 0, 0, 0.08)" overflow="hidden" w="100%">
                {/* Recipient header */}
                <Box p="24px" borderBottom={`1px solid ${colors.border.default}`}
                  bgGradient="linear(180deg, rgba(43, 90, 226, 0.04) 0%, transparent 100%)">
                  <VStack gap="8px">
                    <Box p="12px" bgColor="rgba(43, 90, 226, 0.08)" borderRadius="50%">
                      <ShieldIcon size={24} color={colors.accent.indigo} />
                    </Box>
                    <Text fontSize="20px" fontWeight={700} color={colors.accent.indigoBright}>{tokName}</Text>
                    <Text fontSize="13px" color={colors.text.muted}>Send a private payment</Text>
                  </VStack>
                </Box>

                {/* No-opt-in flow */}
                <Box p="24px">
                  {resolvedMeta && (
                    <NoOptInPayment
                      resolvedMeta={resolvedMeta}
                      recipientName={name}
                      displayName={tokName}
                      linkSlug={link}
                    />
                  )}
                </Box>
              </Box>

              {/* Secondary: Collapsible wallet-connected flow */}
              <Box bgColor={colors.bg.card} borderRadius={radius.xl} border={`1.5px solid ${colors.border.default}`}
                overflow="hidden" w="100%">
                <Box
                  as="button"
                  w="100%"
                  p="16px 24px"
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  cursor="pointer"
                  _hover={{ bgColor: colors.bg.input }}
                  onClick={() => setWalletFlowOpen(!walletFlowOpen)}
                  transition="background-color 0.15s"
                >
                  <HStack gap="10px">
                    <WalletIcon size={16} color={colors.text.muted} />
                    <Text fontSize="13px" color={colors.text.secondary} fontWeight={500}>
                      Or send with connected wallet
                    </Text>
                  </HStack>
                  {walletFlowOpen
                    ? <ChevronUpIcon size={16} color={colors.text.muted} />
                    : <ChevronDownIcon size={16} color={colors.text.muted} />
                  }
                </Box>

                {walletFlowOpen && (
                  <Box p="24px" borderTop={`1px solid ${colors.border.default}`}>
                    {!isConnected ? (
                      <VStack gap="16px">
                        <Text fontSize="14px" color={colors.text.muted} textAlign="center">
                          Connect your wallet to send a payment
                        </Text>
                        <Box
                          as="button"
                          w="100%"
                          p="14px"
                          bg="linear-gradient(135deg, #2B5AE2 0%, #4A75F0 100%)"
                          borderRadius={radius.sm}
                          cursor="pointer"
                          _hover={{ opacity: 0.9 }}
                          onClick={() => connect({ connector: injected() })}
                        >
                          <Text fontSize="14px" color="white" fontWeight={600} textAlign="center">
                            Connect Wallet
                          </Text>
                        </Box>
                      </VStack>
                    ) : sendStep === "input" ? (
                      <VStack gap="16px" align="stretch">
                        <Box>
                          <Text fontSize="12px" color={colors.text.tertiary} mb="8px" fontWeight={500}>Amount</Text>
                          <Input placeholder="0.0" type="number" step="0.001" value={amount}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                            h="56px" bgColor={colors.bg.input} border={`1px solid ${colors.border.default}`}
                            borderRadius={radius.sm} color={colors.text.primary} fontSize="24px" fontWeight={500}
                            fontFamily="'JetBrains Mono', monospace" px="14px"
                            _placeholder={{ color: colors.text.muted }}
                            _focus={{ borderColor: colors.accent.indigo, boxShadow: colors.glow.indigo }} />
                          <Text fontSize="11px" color={colors.text.muted} mt="6px">TON on Thanos</Text>
                        </Box>
                        <Button h="48px" bgColor={colors.accent.indigoDark} borderRadius={radius.sm}
                          fontWeight={500} fontSize="14px" color="#fff" _hover={{ bgColor: colors.accent.indigo }}
                          onClick={handlePreview} disabled={!amount || isLoading}>
                          Preview Payment
                        </Button>
                      </VStack>
                    ) : sendStep === "confirm" ? (
                      <VStack gap="16px" align="stretch">
                        <Box p="20px" bgColor={colors.bg.input} borderRadius={radius.md} border={`1px solid ${colors.border.default}`}>
                          <VStack gap="14px" align="stretch">
                            <HStack justify="space-between">
                              <Text fontSize="13px" color={colors.text.muted}>Amount</Text>
                              <Text fontSize="18px" fontWeight={600} color={colors.text.primary} fontFamily="'JetBrains Mono', monospace">{amount} TON</Text>
                            </HStack>
                            <Box h="1px" bgColor={colors.border.default} />
                            <HStack justify="space-between">
                              <Text fontSize="13px" color={colors.text.muted}>To</Text>
                              <Text fontSize="15px" fontWeight={600} color={colors.accent.indigoBright}>{tokName}</Text>
                            </HStack>
                          </VStack>
                        </Box>
                        <HStack gap="8px" p="12px" bgColor="rgba(43, 90, 226, 0.04)" borderRadius={radius.sm} border="1px solid rgba(43, 90, 226, 0.1)">
                          <LockIcon size={14} color={colors.accent.green} />
                          <Text fontSize="12px" color={colors.text.tertiary}>This payment is private.</Text>
                        </HStack>
                        <HStack gap="10px">
                          <Button flex={1} h="44px" bgColor={colors.bg.elevated} borderRadius={radius.sm}
                            border={`1px solid ${colors.border.default}`} fontWeight={500} fontSize="13px"
                            color={colors.text.primary} onClick={() => setSendStep("input")}>Back</Button>
                          <Button flex={2} h="44px" bgColor={colors.accent.indigoDark} borderRadius={radius.sm}
                            fontWeight={500} fontSize="13px" color="#fff" _hover={{ bgColor: colors.accent.indigo }}
                            onClick={handleSend} disabled={isLoading}>
                            {isLoading ? <Spinner size="sm" /> : "Send Payment"}
                          </Button>
                        </HStack>
                      </VStack>
                    ) : (
                      <VStack gap="24px" py="12px">
                        <Box p="16px" bgColor="rgba(43, 90, 226, 0.08)" borderRadius="50%">
                          <CheckCircleIcon size={32} color={colors.accent.green} />
                        </Box>
                        <VStack gap="6px">
                          <Text fontSize="18px" fontWeight={600} color={colors.text.primary}>Payment Sent</Text>
                          <Text fontSize="13px" color={colors.text.muted} textAlign="center">{amount} TON sent to {tokName}</Text>
                        </VStack>
                        {sendTxHash && (
                          <a href={`${EXPLORER_BASE}/tx/${sendTxHash}`} target="_blank" rel="noopener noreferrer">
                            <HStack gap="6px" px="12px" py="6px" bgColor={colors.bg.elevated} borderRadius={radius.xs}
                              border={`1px solid ${colors.border.light}`}>
                              <ArrowUpRightIcon size={13} color={colors.accent.indigo} />
                              <Text fontSize="12px" color={colors.accent.indigo} fontWeight={500}>View on Explorer</Text>
                            </HStack>
                          </a>
                        )}
                      </VStack>
                    )}

                    {sendError && (
                      <HStack gap="6px" p="12px 14px" bgColor="rgba(229, 62, 62, 0.06)" borderRadius={radius.xs} mt="12px">
                        <AlertCircleIcon size={14} color={colors.accent.red} />
                        <Text fontSize="12px" color={colors.accent.red}>{sendError}</Text>
                      </HStack>
                    )}
                  </Box>
                )}
              </Box>
            </VStack>
          )}
        </Box>
      </Box>
    </Box>
  );
}
