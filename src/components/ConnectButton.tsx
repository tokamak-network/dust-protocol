"use client";

import { Box, Text, HStack } from "@chakra-ui/react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

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
          bg="#12121a"
          borderRadius="8px"
          border="1px solid #2d2d3a"
        >
          <Text fontSize="13px" color="#a0a0b0" fontFamily="'JetBrains Mono', monospace">
            {address.slice(0, 6)}...{address.slice(-4)}
          </Text>
        </Box>
        <Box
          as="button"
          px="16px"
          py="8px"
          bg="#1a1a24"
          borderRadius="8px"
          border="1px solid #3d3d4a"
          cursor="pointer"
          _hover={{ bg: "#22222e", borderColor: "#ff6b6b" }}
          onClick={() => disconnect()}
        >
          <Text fontSize="13px" color="#ff6b6b" fontWeight="500">
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
      bg="linear-gradient(135deg, #5b5edd 0%, #7c7fff 100%)"
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
