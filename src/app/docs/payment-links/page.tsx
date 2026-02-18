import { DocsPage } from "@/components/docs/DocsPage";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsStepList } from "@/components/docs/DocsStepList";

export default function PaymentLinksPage() {
  return (
    <DocsPage
      currentHref="/docs/payment-links"
      title="Payment Links"
      subtitle="Create shareable links to your .tok name. Track how much each link has generated, segment income streams, and share with anyone."
      badge="CORE FEATURE"
    >

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">What Are Payment Links?</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          Every <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">.tok</code> name automatically
          gets a public pay page at <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">/pay/yourname</code>.
          Payment links let you create <em>named sub-URLs</em> like{" "}
          <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">/pay/alice/freelance</code> that still
          route payments to your same stealth address — but let you track analytics per link.
        </p>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          You might create one link for a client, another for an invoice, and a third for a tip jar. Each shows
          separate payment counts and total volume while all the actual ETH lands at the same stealth wallet.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-4 uppercase">Creating a Payment Link</h2>
        <DocsStepList steps={[
          {
            title: "Go to the Links page",
            children: <>Navigate to <strong>LINKS</strong> in the navbar. You'll see all your existing links
              and a button to create a new one.</>,
          },
          {
            title: "Set a slug and optional label",
            children: <>A slug is the URL-safe identifier after your name, e.g. <code>freelance</code> in
              <code> /pay/alice/freelance</code>. The label is internal — it appears on your Links page to
              help you identify the link. Labels are not visible to senders.</>,
          },
          {
            title: "Share the link",
            children: <>Copy the full URL and share it anywhere — Twitter, email, invoices.
              Anyone clicking it lands on a clean pay page that lets them send ETH to your stealth address.
              They do not need a Dust account.</>,
          },
          {
            title: "Track analytics",
            children: <>On your Links page, each link shows its <strong>payment count</strong> and{" "}
              <strong>total ETH received</strong>. Analytics are derived from on-chain announcement metadata —
              each payment announcement includes the link slug, so the scanner can attribute it correctly.</>,
          },
        ]} />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">The Pay Page</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          The pay page at <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">/pay/[name]</code>{" "}
          is fully public — no wallet connection required to view it, and senders only need to connect their
          own wallet to send. Senders see:
        </p>
        <ul className="space-y-2">
          {[
            "Your .tok name and a brief description (if set)",
            "An amount field (ETH)",
            "An optional message field (stored in announcement metadata — only you can read it)",
            "A Send button that generates the one-time stealth address client-side and sends ETH",
          ].map((item, i) => (
            <li key={i} className="flex gap-3 text-sm text-[rgba(255,255,255,0.6)]">
              <span className="shrink-0 text-[#00FF41] mt-0.5">—</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <DocsCallout type="info" title="Privacy for senders">
        Senders do not need a Dust account or any prior setup. The pay page handles all the cryptography
        client-side. The sender's privacy is also protected: the only on-chain record is the ETH transfer and
        the announcement event — neither of which reveals the sender's intent or relationship to the recipient.
      </DocsCallout>

      <section className="mt-8">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">No-Opt-In Payments</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          If a recipient has not registered a <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">.tok</code>
          {" "}name but has registered a stealth meta-address on the{" "}
          <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">ERC-6538</code> registry directly,
          Dust can still route private payments to their raw wallet address —  the pay page falls back to looking
          up the ERC-6538 registry. This allows payments to any ERC-5564-compatible stealth address, even without
          a .tok name.
        </p>
      </section>
    </DocsPage>
  );
}
