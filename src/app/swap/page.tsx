import { docsMetadata } from "@/lib/seo/metadata";
import SwapPageClient from "./SwapPageClient";

export const metadata = docsMetadata(
  "Private Token Swaps — Anonymous DeFi Swaps with ZK Proofs",
  "Swap tokens privately on Ethereum using zero-knowledge proofs and Uniswap V4 hooks. No slippage, no on-chain fingerprinting. Powered by Dust Protocol stealth swap technology.",
  "/swap",
);

export default function SwapPage() {
  return <SwapPageClient />;
}
