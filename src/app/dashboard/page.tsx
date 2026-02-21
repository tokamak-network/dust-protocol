import { docsMetadata } from "@/lib/seo/metadata";
import DashboardPageClient from "./DashboardPageClient";

export const metadata = docsMetadata(
  "Stealth Wallet Dashboard — Private Asset Management",
  "Manage your private stealth wallet. View stealth address balances, claim payments, deposit to privacy pools, and send private transfers — all powered by zero-knowledge proofs.",
  "/dashboard",
);

export default function DashboardPage() {
  return <DashboardPageClient />;
}
