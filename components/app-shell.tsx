"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobalSearch } from "@/components/global-search";
import { Sidebar } from "@/components/sidebar";

// Pages that should NOT show the sidebar/search shell.
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

      {/* Offset content for sidebar on desktop, top mobile menu on small screens. */}
      <div className="lg:pl-56">
        <div className="pt-14 lg:pt-0">
          <header className="sticky top-14 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-black/90 lg:top-0">
            <div className="mx-auto flex max-w-7xl items-center gap-3">
              <GlobalSearch />

              <div className="hidden shrink-0 items-center gap-2 xl:flex">
                <Link
                  href="/inventory"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Inventory
                </Link>
                <Link
                  href="/borrowed"
                  className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
                >
                  Borrow / Return
                </Link>
              </div>
            </div>
          </header>

          {children}
        </div>
      </div>
    </div>
  );
}
