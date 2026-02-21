import { docsMetadata } from "@/lib/seo/metadata";
import PoolsPageClient from "./PoolsPageClient";

export const metadata = docsMetadata(
  "Privacy Pools — ZK-UTXO Shielded Balances & Swap Deposits",
  "Manage shielded balances in Dust Protocol privacy pools. Deposit ETH or USDC with Poseidon commitments, withdraw with ZK proofs, and execute private token swaps via Uniswap V4.",
  "/pools",
);

export default function PoolsPage() {
  return <PoolsPageClient />;
}
