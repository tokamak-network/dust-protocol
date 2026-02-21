import { DocsPage } from "@/components/docs/DocsPage";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { docsMetadata } from "@/lib/seo/metadata";
import { faqPageJsonLd } from "@/lib/seo/jsonLd";

const faqs = [
  {
    q: "Is Dust Protocol fully private?",
    a: "Dust gives you strong on-chain privacy for payments and swaps, but it is not a silver bullet. Privacy depends on correct usage: using the Privacy Pool with a large anonymity set, waiting the recommended time before withdrawing, and not reusing claim addresses. Network-level metadata (IP address, timing) is outside what Dust can protect.",
  },
  {
    q: "Do I need ETH to use Dust?",
    a: "To receive and claim payments: no. Stealth claims are gasless — the DustPaymaster sponsors all claim transactions. To send a payment, you need a small amount of ETH in your regular wallet to cover the send transaction gas (~21,000–50,000 gas).",
  },
  {
    q: "What does a .dust name cost?",
    a: "During the testnet phase, .dust name registration is free. Mainnet pricing has not been announced yet.",
  },
  {
    q: "What happens to funds if I lose my PIN?",
    a: "Funds already claimed to your regular wallet are not affected — they are in your standard wallet, controlled by your seed phrase. Unclaimed stealth payments (sitting at stealth addresses) require your PIN to claim. Private pool and swap deposits require their locally-stored deposit notes to withdraw — neither the PIN nor the stealth keys alone are sufficient for ZK withdrawals.",
  },
  {
    q: "Can two people send to the same .dust name?",
    a: "Yes, and this is expected. Each payment produces a completely different one-time stealth address — the sender picks a fresh random ephemeral key every time. Two people paying alice.dust at the same time produce two entirely unrelated stealth addresses with no on-chain link.",
  },
  {
    q: "How long does ZK proof generation take?",
    a: "DustPool and DustSwap proofs are Groth16 (BN254) and take approximately 1–2 seconds in a modern browser using snarkjs + WASM. The large proving key file (~50MB) is downloaded once and cached by the browser.",
  },
  {
    q: "Is the ZK proof generated on my device?",
    a: "Yes. All proof generation happens entirely in your browser using WebAssembly. The proving key and circuit WASM are public files hosted alongside the app. No private inputs (nullifier, secret, stealth key) are ever sent to any server.",
  },
  {
    q: "What is the anonymity set for DustPool withdrawals?",
    a: "The anonymity set is the number of deposits in the Merkle tree at the time you generate your withdrawal proof. A proof references a specific root — the set is everyone who deposited before that root was valid. The dashboard shows the current tree size. Waiting for more deposits before withdrawing increases your privacy.",
  },
  {
    q: "Can I use Dust on mobile?",
    a: "Yes. The app is fully responsive. ZK proof generation works on mobile browsers (Chrome/Safari on iOS and Android). Proof generation may take 3–5 seconds on lower-end devices due to the WASM computation.",
  },
  {
    q: "Why are privacy swaps only available on Ethereum Sepolia?",
    a: "DustSwap requires Uniswap V4, which is currently only deployed on Ethereum Sepolia in our configuration. Thanos Sepolia has stealth transfers and the Privacy Pool. DustSwap support for Thanos will be added when a V4 deployment is available.",
  },
  {
    q: "What is ERC-5564?",
    a: "ERC-5564 is an Ethereum standard that defines the format for announcing stealth address payments on-chain. It specifies how the ephemeral public key and the stealth address are published so any recipient scanner can try to detect payments meant for them.",
  },
  {
    q: "What is ERC-6538?",
    a: "ERC-6538 is a registry standard that maps wallet addresses to stealth meta-addresses. It allows anyone to look up whether a given wallet address has a registered stealth meta-address, enabling payments without requiring a .dust name.",
  },
  {
    q: "Are there audits?",
    a: "Dust Protocol is in active testnet development. The contracts have not been audited. Do not use mainnet funds. Audit engagements will be announced before any mainnet deployment.",
  },
  {
    q: "Is the code open source?",
    a: "The contract code is available in the project repository. The full source for the circuits, contracts, and app is accessible for review. See the Smart Contracts page for source file paths.",
  },
  {
    q: "How do I back up my deposit notes?",
    a: "Go to Wallet in the navbar. There is an export option for your DustPool and DustSwap deposit notes. Store the exported JSON in a password manager or encrypted storage. Do not share it — these notes are bearer instruments: anyone who has them can generate a withdrawal proof.",
  },
];

export const metadata = docsMetadata("FAQ — Stealth Addresses, Privacy Pools & ZK Proofs", "Frequently asked questions about Dust Protocol privacy, gas costs, ZK proof generation, supported tokens, .dust names, and security.", "/docs/faq");

export default function FaqPage() {
  const faqJsonLd = faqPageJsonLd(faqs.map(f => ({ question: f.q, answer: f.a })));

  return (
    <>
      {/* All values are hardcoded string literals from jsonLd.ts — safeJsonLd escapes < as \u003c */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      <DocsPage
        currentHref="/docs/faq"
        title="FAQ"
        subtitle="Frequently asked questions about privacy, gas, supported tokens, and how Dust Protocol works."
        badge="TECHNICAL REFERENCE"
      >
        <DocsCallout type="info" title="Can't find your answer?">
          If your question isn't covered here, check the other docs pages or reach out via the community channels.
        </DocsCallout>

        <div className="mt-8 space-y-1">
          {faqs.map((item, i) => (
            <details
              key={i}
              className="group border border-[rgba(255,255,255,0.06)] rounded-sm overflow-hidden open:border-[rgba(0,255,65,0.1)]"
            >
              <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                <span className="text-[13px] font-mono text-white">{item.q}</span>
                <span className="shrink-0 text-[rgba(255,255,255,0.3)] group-open:text-[#00FF41] font-mono text-lg leading-none transition-colors select-none">
                  +
                </span>
              </summary>
              <div className="px-5 pb-5 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </DocsPage>
    </>
  );
}
