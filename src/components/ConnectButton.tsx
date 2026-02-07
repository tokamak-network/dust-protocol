"use client";

import { Box, Text, HStack } from "@chakra-ui/react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { colors, radius } from "@/lib/design/tokens";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <HStack gap="12px">
        <Box
          px="14px"
          py="8px"
          bgColor={colors.bg.input}
          borderRadius="8px"
          border={`1px solid ${colors.border.default}`}
        >
          <Text fontSize="13px" color={colors.text.tertiary} fontFamily="'JetBrains Mono', monospace">
            {address.slice(0, 6)}...{address.slice(-4)}
          </Text>
        </Box>
        <Box
          as="button"
          px="16px"
          py="8px"
          bgColor={colors.bg.elevated}
          borderRadius="8px"
          border={`1px solid ${colors.border.default}`}
          cursor="pointer"
          _hover={{ bgColor: colors.bg.hover, borderColor: colors.accent.red }}
          onClick={() => disconnect()}
        >
          <Text fontSize="13px" color={colors.accent.red} fontWeight="500">
            Disconnect
          </Text>
        </Box>
      </HStack>
    );
  }

  return (
    <Box
      as="button"
      px="20px"
      py="10px"
      bg="linear-gradient(135deg, #2B5AE2 0%, #4A75F0 100%)"
      borderRadius="10px"
      cursor="pointer"
      _hover={{ opacity: 0.9 }}
      onClick={() => connect({ connector: injected() })}
    >
      <Text fontSize="14px" color="white" fontWeight="600">
        Connect Wallet
      </Text>
    </Box>
  );
}
