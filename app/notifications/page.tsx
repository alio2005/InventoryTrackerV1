"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Notification = {
  id: number;
  user_id: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type NotificationFilter = "all" | "unread" | "read";

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function NotificationsPage() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [message, setMessage] = useState("");
  const [role, setRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
      return;
    }

    setNotifications((data ?? []) as Notification[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotifications();
  }, [loadNotifications]);

  const counts = useMemo(() => {
    const unread = notifications.filter((notification) => !notification.is_read).length;
    return {
      all: notifications.length,
      unread,
      read: notifications.length - unread,
    };
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return notifications.filter((notification) => {
      const matchesStatus =
        filter === "all" ||
        (filter === "unread" && !notification.is_read) ||
        (filter === "read" && notification.is_read);

      if (!matchesStatus) return false;
      if (!query) return true;

      return [
        notification.title,
        notification.message,
        formatDateTime(notification.created_at),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [filter, notifications, searchTerm]);

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

  const handleMarkUnread = async (notificationId: number) => {
    setMessage("");
    setLoadingId(notificationId);

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: false })
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

  const filterButtonClass = (target: NotificationFilter) =>
    `rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
      filter === target
        ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
    }`;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
                  Inventory System
                </p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight">Notifications</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-zinc-400">
                  View system alerts, issue updates, borrowing reminders, and admin messages.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={loadNotifications}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAll || counts.unread === 0}
                  className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
                >
                  {markingAll ? "Marking..." : "Mark All Read"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-3xl border p-5 text-left transition ${
                filter === "all"
                  ? "border-slate-900 bg-slate-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                  : "border-slate-200 bg-white hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              }`}
            >
              <p className="text-sm opacity-70">Total</p>
              <p className="mt-2 text-3xl font-bold">{counts.all}</p>
            </button>

            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`rounded-3xl border p-5 text-left transition ${
                filter === "unread"
                  ? "border-rose-700 bg-rose-600 text-white"
                  : "border-slate-200 bg-white hover:bg-rose-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-rose-950/20"
              }`}
            >
              <p className="text-sm opacity-70">Unread</p>
              <p className="mt-2 text-3xl font-bold">{counts.unread}</p>
            </button>

            <button
              type="button"
              onClick={() => setFilter("read")}
              className={`rounded-3xl border p-5 text-left transition ${
                filter === "read"
                  ? "border-emerald-700 bg-emerald-600 text-white"
                  : "border-slate-200 bg-white hover:bg-emerald-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-emerald-950/20"
              }`}
            >
              <p className="text-sm opacity-70">Read</p>
              <p className="mt-2 text-3xl font-bold">{counts.read}</p>
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full lg:max-w-xl">
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-zinc-300">
                Search notifications
              </label>
              <input
                type="text"
                placeholder="Search title, message, or date..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-zinc-800 dark:bg-black dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-900"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setFilter("all")} className={filterButtonClass("all")}>
                All
              </button>
              <button type="button" onClick={() => setFilter("unread")} className={filterButtonClass("unread")}>
                Unread
              </button>
              <button type="button" onClick={() => setFilter("read")} className={filterButtonClass("read")}>
                Read
              </button>
            </div>
          </div>

          {message && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              {message}
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-black dark:text-zinc-400">
              Loading notifications...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-zinc-800 dark:bg-black">
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">No notifications found.</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                Try changing the filter or clearing your search.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`rounded-3xl border p-5 transition ${
                    notification.is_read
                      ? "border-slate-200 bg-white dark:border-zinc-800 dark:bg-black"
                      : "border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/20"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            notification.is_read
                              ? "bg-slate-100 text-slate-600 dark:bg-zinc-900 dark:text-zinc-300"
                              : "bg-rose-600 text-white"
                          }`}
                        >
                          {notification.is_read ? "Read" : "Unread"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-zinc-900 dark:text-zinc-300">
                          {formatDateTime(notification.created_at)}
                        </span>
                      </div>

                      <h2 className="text-lg font-bold text-slate-950 dark:text-zinc-100">{notification.title}</h2>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-zinc-300">
                        {notification.message}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {notification.is_read ? (
                        <button
                          type="button"
                          onClick={() => handleMarkUnread(notification.id)}
                          disabled={loadingId === notification.id}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                        >
                          {loadingId === notification.id ? "Saving..." : "Mark Unread"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(notification.id)}
                          disabled={loadingId === notification.id}
                          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
                        >
                          {loadingId === notification.id ? "Saving..." : "Mark Read"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="mt-6 flex justify-end">
          <Link
            href="/dashboard"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
