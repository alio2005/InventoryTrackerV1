"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Notification = {
  id: number;
  user_id: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [message, setMessage] = useState("");
  const [role, setRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = async () => {
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    setCurrentUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const userRole = profile?.role ?? "";
    setRole(userRole);

    let query = supabase
      .from("notifications")
      .select("id, user_id, title, message, is_read, created_at")
      .order("created_at", { ascending: false });

    if (userRole !== "admin") {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      setMessage(error.message);
      return;
    }

    setNotifications((data ?? []) as Notification[]);
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const filteredNotifications = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return notifications.filter((notification) => {
      const matchesUnread = !showUnreadOnly || !notification.is_read;

      if (!matchesUnread) return false;
      if (!query) return true;

      return (
        notification.title.toLowerCase().includes(query) ||
        notification.message.toLowerCase().includes(query) ||
        new Date(notification.created_at).toLocaleString().toLowerCase().includes(query)
      );
    });
  }, [notifications, searchTerm, showUnreadOnly]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkRead = async (notificationId: number) => {
    setMessage("");
    setLoadingId(notificationId);

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) {
      setMessage(error.message);
      setLoadingId(null);
      return;
    }

    setLoadingId(null);
    await loadNotifications();
  };

  const handleMarkAllRead = async () => {
    setMessage("");
    setMarkingAll(true);

    let query = supabase.from("notifications").update({ is_read: true }).eq("is_read", false);

    if (role !== "admin") {
      query = query.eq("user_id", currentUserId);
    }

    const { error } = await query;

    if (error) {
      setMessage(error.message);
      setMarkingAll(false);
      return;
    }

    setMarkingAll(false);
    await loadNotifications();
  };

  return (
    <main className="min-h-screen bg-black text-zinc-100 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Inventory System
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Notifications
            </h1>
            <div className="mt-3 flex flex-col gap-1 text-sm text-zinc-400 dark:text-zinc-300 sm:flex-row sm:gap-6">
              <span>
                Role: <span className="font-medium capitalize">{role || "unknown"}</span>
              </span>
              <span>
                Unread: <span className="font-medium">{unreadCount}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="inline-flex items-center justify-center rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {markingAll ? "Marking..." : "Mark All Read"}
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center justify-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300 dark:text-zinc-300">
                  Search notifications
                </label>
                <input
                  type="text"
                  placeholder="Search title, message, date..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-400 focus:bg-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:bg-zinc-900"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={showUnreadOnly}
                    onChange={(e) => setShowUnreadOnly(e.target.checked)}
                  />
                  Show unread only
                </label>
              </div>
            </div>

            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              Showing{" "}
              <span className="font-medium text-zinc-100 dark:text-zinc-100">
                {filteredNotifications.length}
              </span>{" "}
              notification(s)
            </div>
          </div>

          {message && (
            <div className="mb-5 rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {message}
            </div>
          )}

          {filteredNotifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-black p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              No notifications found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-3xl border p-5 transition ${
                    notification.is_read
                      ? "border-zinc-800 bg-black dark:border-zinc-800 dark:bg-zinc-900"
                      : "border-zinc-800 bg-zinc-900/60 dark:border-zinc-700 dark:bg-zinc-900"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="mb-3 flex flex-wrap gap-2">
                        {!notification.is_read && (
                          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-200">
                            Unread
                          </span>
                        )}
                        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 dark:bg-zinc-800 dark:text-zinc-200">
                          {new Date(notification.created_at).toLocaleString()}
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-zinc-100 dark:text-zinc-100">
                        {notification.title}
                      </h3>
                      <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-300">
                        {notification.message}
                      </p>
                    </div>

                    {!notification.is_read && (
                      <button
                        onClick={() => handleMarkRead(notification.id)}
                        disabled={loadingId === notification.id}
                        className="inline-flex items-center justify-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      >
                        {loadingId === notification.id ? "Saving..." : "Mark Read"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}