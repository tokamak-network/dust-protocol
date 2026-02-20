import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "./providers";
import { AuthLayoutWrapper } from "./auth-layout-wrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dust Protocol - Private Payments",
  description: "Stealth payment infrastructure for Tokamak Network - payments that dissolve into the blockchain",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="bg-[#06080F] text-white font-mono selection:bg-[#00FF41] selection:text-black">
        {/* Background grid effect */}
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />
        {/* Radial green glow */}
        <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,255,65,0.04),transparent_60%)]" />
        <div className="relative z-10">
          <Providers>
            <AuthLayoutWrapper>{children}</AuthLayoutWrapper>
          </Providers>
          <Analytics />
        </div>
      </body>
    </html>
  );
}
