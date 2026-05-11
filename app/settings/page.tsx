"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/components/theme-provider";

type Role = "admin" | "staff";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
};

type InventoryItemForStats = {
  id: number;
  quantity: number | null;
  min_quantity: number | null;
  is_active: boolean | null;
};

type BorrowRequestForStats = {
  id: number;
  status: string | null;
};

type IssueForStats = {
  id: number;
  issue_status: string | null;
};

type NotificationForStats = {
  id: number;
  is_read: boolean | null;
};

type Message = {
  type: "success" | "error" | "info";
  text: string;
};

type RoleFilter = "all" | Role;

type AppStats = {
  totalItems: number;
  lowStockItems: number;
  activeBookings: number;
  openIssues: number;
  unreadNotifications: number;
};

const defaultStats: AppStats = {
  totalItems: 0,
  lowStockItems: 0,
  activeBookings: 0,
  openIssues: 0,
  unreadNotifications: 0,
};

const activeBorrowStatuses = new Set(["pending", "scheduled", "checked_out"]);

const cardClass =
  "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition dark:border-zinc-800 dark:bg-zinc-950";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 dark:border-zinc-800 dark:bg-black dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-800";

const primaryButtonClass =
  "inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300";

const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-black dark:text-zinc-100 dark:hover:bg-zinc-900";

const subtleButtonClass =
  "inline-flex items-center justify-center rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

function normalizeRole(role: string | null | undefined): Role {
  return role === "admin" ? "admin" : "staff";
}

function initialsFor(profile: Profile | null) {
  const label = profile?.full_name || profile?.email || "User";
  return label
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function formatRole(role: Role) {
  return role === "admin" ? "Admin" : "Staff";
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [message, setMessage] = useState<Message | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [stats, setStats] = useState<AppStats>(defaultStats);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  const loadSettings = async () => {
    setLoadingPage(true);
    setMessage(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    setCurrentUserId(user.id);

    const { data: myProfile, error: myProfileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", user.id)
      .single();

    if (myProfileError) {
      setMessage({ type: "error", text: myProfileError.message });
      setLoadingPage(false);
      return;
    }

    const normalizedCurrentProfile: Profile = {
      id: myProfile.id,
      email: myProfile.email,
      full_name: myProfile.full_name,
      role: normalizeRole(myProfile.role),
    };

    if (normalizedCurrentProfile.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    setCurrentProfile(normalizedCurrentProfile);
    setProfileNameDraft(normalizedCurrentProfile.full_name ?? "");

    const [profilesResult, itemsResult, bookingsResult, issuesResult, notificationsResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, full_name, role")
          .order("email", { ascending: true }),
        supabase
          .from("inventory_items")
          .select("id, quantity, min_quantity, is_active"),
        supabase.from("borrow_requests").select("id, status"),
        supabase.from("missing_damaged_reports").select("id, issue_status"),
        supabase.from("notifications").select("id, is_read"),
      ]);

    if (profilesResult.error) {
      setMessage({ type: "error", text: profilesResult.error.message });
      setLoadingPage(false);
      return;
    }

    const profileRows = ((profilesResult.data ?? []) as Array<{
      id: string;
      email: string | null;
      full_name: string | null;
      role: string | null;
    }>).map((profile) => ({
      ...profile,
      role: normalizeRole(profile.role),
    }));

    const itemRows = (itemsResult.data ?? []) as InventoryItemForStats[];
    const bookingRows = (bookingsResult.data ?? []) as BorrowRequestForStats[];
    const issueRows = (issuesResult.data ?? []) as IssueForStats[];
    const notificationRows = (notificationsResult.data ?? []) as NotificationForStats[];

    const activeItems = itemRows.filter((item) => item.is_active !== false);

    setProfiles(profileRows);
    setStats({
      totalItems: activeItems.length,
      lowStockItems: activeItems.filter((item) => {
        const quantity = Number(item.quantity ?? 0);
        const minimum = Number(item.min_quantity ?? 0);
        return minimum > 0 && quantity <= minimum;
      }).length,
      activeBookings: bookingRows.filter((request) =>
        activeBorrowStatuses.has(request.status ?? "")
      ).length,
      openIssues: issueRows.filter((issue) => issue.issue_status === "open").length,
      unreadNotifications: notificationRows.filter((notification) => !notification.is_read).length,
    });

    setLoadingPage(false);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const filteredProfiles = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return profiles.filter((profile) => {
      const matchesRole = roleFilter === "all" || profile.role === roleFilter;
      const label = `${profile.email ?? ""} ${profile.full_name ?? ""}`.toLowerCase();
      const matchesSearch = !query || label.includes(query);
      return matchesRole && matchesSearch;
    });
  }, [profiles, roleFilter, searchTerm]);

  const roleCounts = useMemo(() => {
    const admins = profiles.filter((profile) => profile.role === "admin").length;
    const staff = profiles.filter((profile) => profile.role === "staff").length;
    return { admins, staff };
  }, [profiles]);

  const checklist = useMemo(
    () => [
      {
        title: "Low-stock review",
        value: stats.lowStockItems,
        status: stats.lowStockItems === 0 ? "Good" : "Needs review",
        href: "/inventory",
      },
      {
        title: "Open missing/damaged reports",
        value: stats.openIssues,
        status: stats.openIssues === 0 ? "Good" : "Needs review",
        href: "/missing-damaged",
      },
      {
        title: "Active borrow requests",
        value: stats.activeBookings,
        status: stats.activeBookings === 0 ? "Clear" : "In progress",
        href: "/borrowed",
      },
      {
        title: "Unread notifications",
        value: stats.unreadNotifications,
        status: stats.unreadNotifications === 0 ? "Clear" : "Unread",
        href: "/notifications",
      },
    ],
    [stats]
  );

  const updateRole = async (profileId: string, newRole: Role) => {
    setMessage(null);

    if (profileId === currentUserId) {
      setMessage({ type: "error", text: "You cannot change your own role from this page." });
      return;
    }

    setLoadingId(profileId);

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", profileId);

    if (error) {
      setMessage({ type: "error", text: error.message });
      setLoadingId(null);
      return;
    }

    setProfiles((currentProfiles) =>
      currentProfiles.map((profile) =>
        profile.id === profileId ? { ...profile, role: newRole } : profile
      )
    );
    setMessage({ type: "success", text: `User role updated to ${formatRole(newRole)}.` });
    setLoadingId(null);
  };

  const saveProfileName = async () => {
    setMessage(null);
    setSavingProfile(true);

    const cleanName = profileNameDraft.trim();

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: cleanName || null })
      .eq("id", currentUserId);

    if (error) {
      setMessage({ type: "error", text: error.message });
      setSavingProfile(false);
      return;
    }

    setCurrentProfile((profile) =>
      profile ? { ...profile, full_name: cleanName || null } : profile
    );
    setProfiles((currentProfiles) =>
      currentProfiles.map((profile) =>
        profile.id === currentUserId ? { ...profile, full_name: cleanName || null } : profile
      )
    );
    setMessage({ type: "success", text: "Profile name saved." });
    setSavingProfile(false);
  };

  const sendAnnouncement = async () => {
    setMessage(null);

    const cleanTitle = announcementTitle.trim();
    const cleanMessage = announcementMessage.trim();

    if (!cleanTitle || !cleanMessage) {
      setMessage({ type: "error", text: "Add both a title and message before sending." });
      return;
    }

    if (profiles.length === 0) {
      setMessage({ type: "error", text: "No users found to notify." });
      return;
    }

    setSendingAnnouncement(true);

    const rows = profiles.map((profile) => ({
      user_id: profile.id,
      title: cleanTitle,
      message: cleanMessage,
      is_read: false,
    }));

    const { error } = await supabase.from("notifications").insert(rows);

    if (error) {
      setMessage({ type: "error", text: error.message });
      setSendingAnnouncement(false);
      return;
    }

    setAnnouncementTitle("");
    setAnnouncementMessage("");
    setStats((currentStats) => ({
      ...currentStats,
      unreadNotifications: currentStats.unreadNotifications + rows.length,
    }));
    setMessage({ type: "success", text: `Announcement sent to ${rows.length} user${rows.length === 1 ? "" : "s"}.` });
    setSendingAnnouncement(false);
  };

  const copyInviteMessage = async () => {
    const appUrl = typeof window === "undefined" ? "your inventory app" : window.location.origin;
    const inviteText = `Hi! Please create your Inventory Tracker account here: ${appUrl}\n\nAfter signing up, confirm your email. An admin can then set your account role from Settings.`;

    try {
      await navigator.clipboard.writeText(inviteText);
      setMessage({ type: "success", text: "Invite message copied." });
    } catch {
      setMessage({ type: "info", text: inviteText });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-500">
                Admin Settings
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-zinc-100">
                App Control Center
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-zinc-400">
                Manage users, switch the theme, send announcements, review system health,
                and update your profile from one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={() => router.push("/dashboard")} className={secondaryButtonClass}>
                Back to Dashboard
              </button>
              <button onClick={loadSettings} className={primaryButtonClass} disabled={loadingPage}>
                {loadingPage ? "Refreshing..." : "Refresh Settings"}
              </button>
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
                : message.type === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300"
                  : "border-slate-200 bg-slate-100 text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            }`}
          >
            {message.text}
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className={cardClass}>
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-500">Users</p>
            <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-zinc-100">{profiles.length}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
              {roleCounts.admins} admin · {roleCounts.staff} staff
            </p>
          </div>
          <div className={cardClass}>
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-500">Inventory Items</p>
            <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-zinc-100">{stats.totalItems}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">Active items only</p>
          </div>
          <div className={cardClass}>
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-500">Low Stock</p>
            <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-zinc-100">{stats.lowStockItems}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">Items at or below minimum</p>
          </div>
          <div className={cardClass}>
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-500">Active Bookings</p>
            <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-zinc-100">{stats.activeBookings}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">Pending, scheduled, checked out</p>
          </div>
          <div className={cardClass}>
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-500">Open Issues</p>
            <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-zinc-100">{stats.openIssues}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">Missing or damaged reports</p>
          </div>
        </section>

        <section className="mb-6 grid gap-6 xl:grid-cols-3">
          <div className={cardClass}>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white dark:bg-zinc-100 dark:text-black">
                {initialsFor(currentProfile)}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-zinc-100">My Profile</h2>
                <p className="mt-1 truncate text-sm text-slate-500 dark:text-zinc-500">
                  {currentProfile?.email ?? "No email found"}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">
                Display name
              </label>
              <input
                value={profileNameDraft}
                onChange={(event) => setProfileNameDraft(event.target.value)}
                className={inputClass}
                placeholder="Enter your name"
              />
              <button onClick={saveProfileName} className={primaryButtonClass} disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-zinc-100">Theme Settings</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">
              Keep light mode clean and white, or switch to the black/charcoal dark mode.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setTheme("light")}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  theme === "light"
                    ? "border-slate-950 bg-slate-950 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-black"
                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100 dark:border-zinc-800 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                }`}
              >
                <span className="block text-sm font-semibold">Light Mode</span>
                <span className="mt-1 block text-xs opacity-75">White background</span>
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  theme === "dark"
                    ? "border-slate-950 bg-slate-950 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-black"
                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100 dark:border-zinc-800 dark:bg-black dark:text-zinc-200 dark:hover:bg-zinc-900"
                }`}
              >
                <span className="block text-sm font-semibold">Dark Mode</span>
                <span className="mt-1 block text-xs opacity-75">Black/charcoal style</span>
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-500 dark:text-zinc-500">
              Current theme: <span className="font-semibold capitalize">{theme}</span>
            </p>
          </div>

          <div className={cardClass}>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-zinc-100">Quick Admin Actions</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">
              Shortcuts for setup and admin maintenance.
            </p>

            <div className="mt-5 grid gap-3">
              <button onClick={copyInviteMessage} className={secondaryButtonClass}>
                Copy New User Invite
              </button>
              <button onClick={() => router.push("/notifications")} className={secondaryButtonClass}>
                Open Notifications
              </button>
              <button onClick={() => router.push("/transactions")} className={secondaryButtonClass}>
                View Transaction Log
              </button>
              <button onClick={handleSignOut} className="inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50">
                Sign Out
              </button>
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-6 xl:grid-cols-2">
          <div className={cardClass}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-zinc-100">Admin Announcement</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                  Send a notification to every user in the app.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
                {profiles.length} recipients
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <input
                value={announcementTitle}
                onChange={(event) => setAnnouncementTitle(event.target.value)}
                className={inputClass}
                placeholder="Announcement title"
              />
              <textarea
                value={announcementMessage}
                onChange={(event) => setAnnouncementMessage(event.target.value)}
                className={`${inputClass} min-h-32 resize-y`}
                placeholder="Write the message users should see in Notifications..."
              />
              <button
                onClick={sendAnnouncement}
                className={primaryButtonClass}
                disabled={sendingAnnouncement}
              >
                {sendingAnnouncement ? "Sending..." : "Send Announcement"}
              </button>
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-zinc-100">System Health Checklist</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                  Quick checks that point admins to pages needing attention.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {checklist.map((item) => (
                <button
                  key={item.title}
                  onClick={() => router.push(item.href)}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100 dark:border-zinc-800 dark:bg-black dark:hover:bg-zinc-900"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">{item.status}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100">
                    {item.value}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-zinc-100">
                User Role Management
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                Search users, filter by role, and promote or demote accounts.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_160px] xl:min-w-[460px]">
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className={inputClass}
                placeholder="Search name or email"
              />
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
                className={inputClass}
              >
                <option value="all">All roles</option>
                <option value="admin">Admins</option>
                <option value="staff">Staff</option>
              </select>
            </div>
          </div>

          {loadingPage ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-500">
              Loading settings...
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-500">
              No users match your search.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800">
              <div className="hidden grid-cols-[minmax(260px,1fr)_120px_220px] gap-4 border-b border-slate-200 bg-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-zinc-800 dark:bg-black dark:text-zinc-500 lg:grid">
                <span>User</span>
                <span>Role</span>
                <span className="text-right">Actions</span>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-zinc-800">
                {filteredProfiles.map((profile) => {
                  const isCurrentUser = profile.id === currentUserId;
                  const displayName = profile.full_name || profile.email || "Unknown User";

                  return (
                    <div
                      key={profile.id}
                      className="grid gap-4 bg-white px-5 py-4 transition hover:bg-slate-50 dark:bg-zinc-950 dark:hover:bg-zinc-900 lg:grid-cols-[minmax(260px,1fr)_120px_220px] lg:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-xs font-bold text-slate-700 dark:bg-black dark:text-zinc-300">
                            {initialsFor(profile)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950 dark:text-zinc-100">
                              {displayName}
                              {isCurrentUser && (
                                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
                                  you
                                </span>
                              )}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-500 dark:text-zinc-500">
                              {profile.email ?? "No email saved"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            profile.role === "admin"
                              ? "bg-slate-950 text-white dark:bg-zinc-100 dark:text-black"
                              : "bg-slate-100 text-slate-700 dark:bg-zinc-900 dark:text-zinc-300"
                          }`}
                        >
                          {formatRole(profile.role)}
                        </span>
                      </div>

                      <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                        <button
                          onClick={() => updateRole(profile.id, "staff")}
                          disabled={loadingId === profile.id || isCurrentUser || profile.role === "staff"}
                          className={subtleButtonClass}
                        >
                          Make Staff
                        </button>
                        <button
                          onClick={() => updateRole(profile.id, "admin")}
                          disabled={loadingId === profile.id || isCurrentUser || profile.role === "admin"}
                          className={secondaryButtonClass}
                        >
                          Make Admin
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
