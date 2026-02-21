import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsMobileNav } from "@/components/docs/DocsMobileNav";
import { ReactNode } from "react";
import { breadcrumbJsonLd } from "@/lib/seo/jsonLd";

const docsBreadcrumb = breadcrumbJsonLd([
  { name: "Home", href: "/" },
  { name: "Documentation", href: "/docs/overview" },
]);

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* All values are hardcoded string literals — safeJsonLd escapes < as \u003c */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: docsBreadcrumb }} />
      <DocsMobileNav />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <div className="hidden lg:block w-60 shrink-0">
          <DocsSidebar />
        </div>
        <div className="flex-1 min-w-0 lg:pl-12">
          {children}
        </div>
      </div>
    </>
  );
}
