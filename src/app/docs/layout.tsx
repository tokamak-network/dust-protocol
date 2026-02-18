import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsMobileNav } from "@/components/docs/DocsMobileNav";
import { ReactNode } from "react";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <>
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
