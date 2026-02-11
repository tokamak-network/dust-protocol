"use client";

import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defineChain } from "viem";

// Define Thanos Sepolia chain
export const thanosSepolia = defineChain({
  id: 111551119090,
  name: "Thanos Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "TON",
    symbol: "TON",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.thanos-sepolia.tokamak.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Thanos Explorer",
      url: "https://explorer.thanos-sepolia.tokamak.network",
    },
  },
  testnet: true,
});

const config = createConfig({
  chains: [thanosSepolia],
  transports: {
    [thanosSepolia.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={{
        defaultChain: thanosSepolia,
        supportedChains: [thanosSepolia],
        appearance: {
          theme: "dark",
          accentColor: "#4A75F0",
        },
        loginMethods: ["wallet", "google", "discord", "email", "apple"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
