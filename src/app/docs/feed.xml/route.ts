import { SITE_URL, SITE_NAME } from "@/lib/seo/metadata";

const docs = [
  { slug: "overview", title: "Overview — Privacy Protocol for Ethereum", updated: "2026-02-22" },
  { slug: "how-it-works", title: "How Dust Protocol Works — Private Payments End to End", updated: "2026-02-22" },
  { slug: "stealth-transfers", title: "Stealth Transfers — Private Payments with ERC-5564", updated: "2026-02-22" },
  { slug: "privacy-pool", title: "Privacy Pool — ZK Proof Withdrawals", updated: "2026-02-22" },
  { slug: "privacy-swaps", title: "Privacy Swaps — Anonymous Token Exchange via Uniswap V4", updated: "2026-02-22" },
  { slug: "key-management", title: "Key Management — Stealth Key Derivation & Security", updated: "2026-02-22" },
  { slug: "payment-links", title: "Payment Links — Pay Anyone by .dust Username", updated: "2026-02-22" },
  { slug: "eip-7702", title: "Account Types & EIP-7702 — Gasless Stealth Claims", updated: "2026-02-22" },
  { slug: "contracts", title: "Smart Contracts — Deployed Addresses & Standards", updated: "2026-02-22" },
  { slug: "faq", title: "FAQ — Stealth Addresses, Privacy Pools & ZK Proofs", updated: "2026-02-22" },
];

export async function GET() {
  const items = docs
    .map(
      (doc) => `    <item>
      <title>${escapeXml(doc.title)}</title>
      <link>${SITE_URL}/docs/${doc.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/docs/${doc.slug}</guid>
      <pubDate>${new Date(doc.updated).toUTCString()}</pubDate>
      <description>${escapeXml(doc.title)} — ${SITE_NAME} Documentation</description>
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME} Documentation</title>
    <link>${SITE_URL}/docs/overview</link>
    <description>Technical documentation for Dust Protocol — stealth addresses, privacy pools, private swaps, and zero-knowledge proofs on Ethereum.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/docs/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
