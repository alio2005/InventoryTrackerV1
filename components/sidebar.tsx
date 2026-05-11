"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  adminOnly?: boolean;
};

type SidebarProfile = {
  role: string;
  name: string;
  email: string;
  avatarUrl: string;
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z" />
      </svg>
    ),
  },
  {
    label: "Borrowed",
    href: "/borrowed",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4M4 17H2m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    label: "Closed Bookings",
    href: "/closed-bookings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Schedule",
    href: "/schedule",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    label: "Transactions",
    href: "/transactions",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    label: "Missing / Damaged",
    href: "/missing-damaged",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17H20l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5.143m5.714 0a3 3 0 01-5.714 0m5.714 0H9.143" />
      </svg>
    ),
  },
  {
    label: "Departments",
    href: "/departments",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: "Locations",
    href: "/locations",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

const campItems: NavItem[] = [
  {
    label: "Camp Sites",
    href: "/camp-sites",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1V10" />
      </svg>
    ),
  },
  {
    label: "Allocations",
    href: "/camp-allocations",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
  {
    label: "Packing List",
    href: "/camp-packing-list",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Return Report",
    href: "/camp-return-report",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getInitials(text: string) {
  return (
    text
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "staff") return "Staff";
  return "User";
}

function ProfileAvatar({ profile, compact = false }: { profile: SidebarProfile | null; compact?: boolean }) {
  const label = profile?.name || profile?.email || "User";
  const size = compact ? "h-8 w-8" : "h-10 w-10";

  if (profile?.avatarUrl) {
    return (
      <img
        src={profile.avatarUrl}
        alt={`${label} profile picture`}
        className={`${size} shrink-0 rounded-2xl border border-slate-200 object-cover dark:border-zinc-700`}
      />
    );
  }

  return (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white dark:bg-zinc-800`}>
      {getInitials(label)}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState("");
  const [profile, setProfile] = useState<SidebarProfile | null>(null);
  const [unread, setUnread] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [campOpen, setCampOpen] = useState(false);

  const loadUserProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data: savedProfile } = await supabase
      .from("profiles")
      .select("role, full_name, email, avatar_url")
      .eq("id", user.id)
      .single();

    const metadata = user.user_metadata as Record<string, unknown>;
    const savedRole = savedProfile?.role ?? "";
    const email = savedProfile?.email || user.email || "";
    const name =
      getString(metadata.display_name) ||
      getString(metadata.full_name) ||
      savedProfile?.full_name ||
      email ||
      "Inventory User";

    setRole(savedRole);
    setProfile({
      role: savedRole,
      name,
      email,
      avatarUrl: getString(savedProfile?.avatar_url) || getString(metadata.avatar_url),
    });

    let notificationQuery = supabase.from("notifications").select("id").eq("is_read", false);
    if (savedRole !== "admin") {
      notificationQuery = notificationQuery.eq("user_id", user.id);
    }

    const { data } = await notificationQuery;
    setUnread((data ?? []).length);
  }, []);

  useEffect(() => {
    void loadUserProfile();
  }, [loadUserProfile, pathname]);

  useEffect(() => {
    const reload = () => void loadUserProfile();
    window.addEventListener("inventory-profile-updated", reload);
    return () => window.removeEventListener("inventory-profile-updated", reload);
  }, [loadUserProfile]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (campItems.some((item) => pathname.startsWith(item.href))) {
      setCampOpen(true);
    }
  }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const NavLink = ({ item }: { item: NavItem }) => {
    if (item.adminOnly && role !== "admin") return null;
    const active = isActive(item.href);

    return (
      <Link
        href={item.href}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
          active
            ? "bg-slate-900 text-white dark:bg-zinc-800 dark:text-white"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        }`}
      >
        {item.icon}
        <span>{item.label}</span>
        {item.href === "/notifications" && unread > 0 && (
          <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    );
  };

  const ProfileHeader = ({ compact = false }: { compact?: boolean }) => (
    <Link
      href="/settings"
      className={`flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-900 ${
        compact ? "border-0 bg-transparent p-0 hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent" : ""
      }`}
      title="Open profile settings"
    >
      <ProfileAvatar profile={profile} compact={compact} />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-950 dark:text-white">
          {profile?.name || "Inventory User"}
        </p>
        {!compact && (
          <p className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-zinc-400">
            {roleLabel(profile?.role || role)} · Profile settings
          </p>
        )}
      </div>
    </Link>
  );

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-3 py-4 dark:border-zinc-800">
        <ProfileHeader />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        <div className="pt-2">
          <button
            onClick={() => setCampOpen((previous) => !previous)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
            </svg>
            <span>Camp Planning</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`ml-auto h-4 w-4 transition-transform ${campOpen ? "rotate-180" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {campOpen && (
            <div className="ml-3 mt-1 space-y-1 border-l border-slate-200 pl-3 dark:border-zinc-800">
              {campItems.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="border-t border-slate-200 px-3 py-3 dark:border-zinc-800">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-400 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-56 border-r border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:flex lg:flex-col">
        <SidebarContent />
      </aside>

      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-zinc-800 dark:text-zinc-300"
          aria-label="Open navigation"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <ProfileHeader compact />
        {unread > 0 && (
          <Link href="/notifications" className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white">
            {unread} unread
          </Link>
        )}
      </div>

      {mobileOpen && (
        <>
          <button
            aria-label="Close navigation overlay"
            className="fixed inset-0 z-50 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 z-50 h-screen w-64 border-r border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-zinc-800">
              <ProfileHeader compact />
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-zinc-500 dark:hover:bg-zinc-900" aria-label="Close navigation">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(100%-73px)] overflow-y-auto">
              <SidebarContent />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
