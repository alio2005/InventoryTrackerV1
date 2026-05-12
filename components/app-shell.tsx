"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { GlobalSearch } from "@/components/global-search";
import { Sidebar } from "@/components/sidebar";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { supabase } from "@/lib/supabase";

// Pages that should NOT show the sidebar/search shell.
const PUBLIC_PATHS = ["/", "/forgot-password", "/reset-password"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUnreadCount(0);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    let query = supabase.from("notifications").select("id").eq("is_read", false);

    if (profile?.role !== "admin") {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      setUnreadCount(0);
      return;
    }

    setUnreadCount((data ?? []).length);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isPublic) void loadUnreadCount();
  }, [isPublic, loadUnreadCount, pathname]);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <WorkspaceProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-black dark:text-zinc-100">
        <Sidebar />

        {/* Offset content for sidebar on desktop, top mobile menu on small screens. */}
        <div className="lg:pl-56">
          <div className="pt-14 lg:pt-0">
            <header className="sticky top-14 z-30 overflow-visible border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-black/90 lg:top-0">
              <div className="mx-auto flex max-w-7xl items-center gap-3">
                <GlobalSearch />
                <WorkspaceSwitcher />

                <Link
                href="/notifications"
                aria-label={`Open notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
                className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17H20l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5.143m5.714 0a3 3 0 01-5.714 0m5.714 0H9.143"
                  />
                </svg>

                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white ring-2 ring-white dark:ring-black">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>

              <div className="hidden shrink-0 items-center gap-2 xl:flex">
                <a
  href="/apps"
  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
>
  Switch Apps
</a>
              </div>
            </div>
          </header>

            {children}
          </div>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
