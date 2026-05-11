"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

// Pages that should NOT show the sidebar (auth pages)
const PUBLIC_PATHS = ["/", "/forgot-password", "/reset-password"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-black dark:text-zinc-100">
      <Sidebar />
      {/* Offset content for sidebar on desktop, top bar on mobile */}
      <div className="lg:pl-56">
        <div className="pt-14 lg:pt-0">{children}</div>
      </div>
    </div>
  );
}
