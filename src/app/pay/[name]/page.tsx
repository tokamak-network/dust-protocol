import type { Metadata } from "next";
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from "@/lib/seo/metadata";
import PayPageClient from "./PayPageClient";

interface PayPageProps {
  params: { name: string };
}

export async function generateMetadata({ params }: PayPageProps): Promise<Metadata> {
  const { name } = params;
  const displayName = `${name}.dust`;

  return {
    title: `Pay ${displayName} — Private Payment via Stealth Address`,
    description: `Send a private ETH payment to ${displayName} using a one-time stealth address. No account required — connect your wallet and pay privately with Dust Protocol.`,
    alternates: { canonical: `/pay/${name}` },
    openGraph: {
      title: `Pay ${displayName} | ${SITE_NAME}`,
      description: `Send private crypto to ${displayName}. Each payment creates a unique stealth address — unlinkable, non-custodial, gasless claims.`,
      url: `/pay/${name}`,
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: `Pay ${displayName} privately with Dust Protocol` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Pay ${displayName} privately`,
      description: `Send ETH to ${displayName} via stealth address. No on-chain link between sender and recipient.`,
    },
    robots: { index: false, follow: true },
  };
}

export default function PayPage({ params }: PayPageProps) {
  return <PayPageClient name={params.name} />;
}
