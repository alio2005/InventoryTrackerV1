"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type InventoryItem = {
  id: number;
  quantity: number;
};

type SimpleRow = {
  id: number;
};

type BorrowRequestRow = {
  id: number;
};

type NotificationRow = {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  const [totalItems, setTotalItems] = useState(0);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [totalDepartments, setTotalDepartments] = useState(0);
  const [totalLocations, setTotalLocations] = useState(0);
  const [totalBorrowed, setTotalBorrowed] = useState(0);

  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<NotificationRow[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const loadDashboard = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    setCurrentUserId(user.id);
    setEmail(user.email ?? "");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const userRole = profile?.role ?? "";
    setRole(userRole);

    const { data: inventoryData } = await supabase
      .from("inventory_items")
      .select("id, quantity")
      .eq("is_active", true);

    const safeInventory = (inventoryData ?? []) as InventoryItem[];
    setTotalItems(safeInventory.length);
    setTotalQuantity(
      safeInventory.reduce((sum, item) => sum + item.quantity, 0)
    );

    const { data: departmentsData } = await supabase
      .from("departments")
      .select("id");

    const { data: locationsData } = await supabase
      .from("locations")
      .select("id");

    const { data: borrowRequestData } = await supabase
      .from("borrow_requests")
      .select("id")
      .in("status", ["scheduled", "checked_out"]);

    setTotalDepartments(((departmentsData ?? []) as SimpleRow[]).length);
    setTotalLocations(((locationsData ?? []) as SimpleRow[]).length);
    setTotalBorrowed(((borrowRequestData ?? []) as BorrowRequestRow[]).length);

    let unreadQuery = supabase
      .from("notifications")
      .select("id, title, message, is_read, created_at")
      .order("created_at", { ascending: false });

    if (userRole !== "admin") {
      unreadQuery = unreadQuery.eq("user_id", user.id);
    }

    const { data: notificationsData } = await unreadQuery;
    const safeNotifications = (notificationsData ?? []) as NotificationRow[];

    setUnreadNotifications(safeNotifications.filter((n) => !n.is_read).length);
    setRecentNotifications(safeNotifications.slice(0, 3));
  };

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };

    if (notificationsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!currentUserId) return;

    const channelName =
      role === "admin"
        ? "dashboard-notifications-admin"
        : `dashboard-notifications-${currentUserId}`;

    const notificationChannel = supabase.channel(channelName);

    if (role === "admin") {
      notificationChannel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        async () => {
          await loadDashboard();
        }
      );
    } else {
      notificationChannel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        async () => {
          await loadDashboard();
        }
      );
    }

    notificationChannel.subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, role]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "/";
  };

  const handleMarkAllRead = async () => {
    setMarkingAllRead(true);

    let query = supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false);

    if (role !== "admin") {
      query = query.eq("user_id", currentUserId);
    }

    const { error } = await query;

    if (!error) {
      await loadDashboard();
    }

    setMarkingAllRead(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Inventory System
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Dashboard
            </h1>
            <div className="mt-3 flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300 sm:flex-row sm:gap-6">
              <span>
                Signed in as:{" "}
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {email}
                </span>
              </span>
              <span>
                Role:{" "}
                <span className="font-medium capitalize text-slate-900 dark:text-slate-100">
                  {role || "unknown"}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                aria-label="Open notifications"
                title="Notifications"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17H20l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5.143m5.714 0a3 3 0 01-5.714 0m5.714 0H9.143"
                  />
                </svg>

                {unreadNotifications > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-14 z-50 w-96 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold">Notifications</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {unreadNotifications} unread
                        </p>
                      </div>

                      <button
                        onClick={handleMarkAllRead}
                        disabled={markingAllRead}
                        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {markingAllRead ? "Marking..." : "Mark all read"}
                      </button>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto p-3">
                    {recentNotifications.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                        No notifications yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recentNotifications.map((notification) => (
                          <button
                            key={notification.id}
                            onClick={() => {
                              setNotificationsOpen(false);
                              router.push("/notifications");
                            }}
                            className={`w-full rounded-2xl border p-4 text-left transition ${
                              notification.is_read
                                ? "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700"
                                : "border-fuchsia-200 bg-fuchsia-50 hover:border-fuchsia-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <h4 className="text-sm font-semibold">
                                {notification.title}
                              </h4>
                              {!notification.is_read && (
                                <span className="rounded-full bg-fuchsia-100 px-2 py-1 text-[10px] font-semibold text-fuchsia-700">
                                  Unread
                                </span>
                              )}
                            </div>

                            <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                              {notification.message}
                            </p>

                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              {new Date(notification.created_at).toLocaleString()}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200 p-3 dark:border-slate-800">
                    <button
                      onClick={() => {
                        setNotificationsOpen(false);
                        router.push("/notifications");
                      }}
                      className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                    >
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Active Items
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">{totalItems}</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Total Quantity
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {totalQuantity}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Departments
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {totalDepartments}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Locations
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {totalLocations}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Open Borrow Requests
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {totalBorrowed}
            </p>
          </div>

          <button
            onClick={() => router.push("/notifications")}
            className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-fuchsia-200 hover:bg-fuchsia-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800"
          >
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Unread Alerts
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {unreadNotifications}
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Click to open notifications
            </p>
          </button>
        </div>

        <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight">
              Camp Inventory Planning
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Plan camp inventory by site, week, and site leader.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <button
              onClick={() => router.push("/camp-sites")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-blue-200 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="mb-3 inline-flex rounded-xl bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                Setup
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Camp Sites
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Rename the 6 sites, assign site leaders, emails, addresses, and notes.
              </p>
            </button>

            <button
              onClick={() => router.push("/camp-allocations")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-violet-200 hover:bg-violet-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="mb-3 inline-flex rounded-xl bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                Planning
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Camp Allocations
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Split inventory across camp sites by week or apply allocations to all 6 weeks.
              </p>
            </button>

            <button
              onClick={() => router.push("/camp-packing-list")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-emerald-200 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="mb-3 inline-flex rounded-xl bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Site Leader View
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Packing List
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                View assigned items by site/week, update packing status, and print site lists.
              </p>
            </button>

            <button
              onClick={() => router.push("/camp-return-report")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-rose-200 hover:bg-rose-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="mb-3 inline-flex rounded-xl bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                Admin Report
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Return Report
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Review returned, missing, damaged, and outstanding items across all sites.
              </p>
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight">Workspace</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage inventory, borrowed products, schedules, alerts, history, departments,
              locations, camp planning, and admin settings.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button
              onClick={() => router.push("/inventory")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-blue-200 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="mb-3 inline-flex rounded-xl bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                Inventory
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Manage inventory
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Add items, sign products in or out, apply filters, and archive stock.
              </p>
            </button>

            <button
              onClick={() => router.push("/borrowed")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-cyan-200 hover:bg-cyan-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="mb-3 inline-flex rounded-xl bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                Borrowed Items
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Track borrowed products
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                See what is currently signed out, create requests, and process returns.
              </p>
            </button>

            <button
              onClick={() => router.push("/schedule")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-purple-200 hover:bg-purple-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="mb-3 inline-flex rounded-xl bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                Schedule
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Upcoming borrowing
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                View calendar bookings and prevent borrowing conflicts before they happen.
              </p>
            </button>

            <button
              onClick={() => router.push("/transactions")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-violet-200 hover:bg-violet-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="mb-3 inline-flex rounded-xl bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                Transactions
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                View transaction history
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Review sign-ins, sign-outs, item creation, and archive activity.
              </p>
            </button>

            <button
              onClick={() => router.push("/notifications")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-fuchsia-200 hover:bg-fuchsia-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="mb-3 inline-flex rounded-xl bg-fuchsia-100 px-3 py-1 text-xs font-semibold text-fuchsia-700">
                Notifications
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                View notifications
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Review unread alerts for inventory updates, sign-outs, returns, and scheduling.
              </p>
            </button>

            <button
              onClick={() => router.push("/departments")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-emerald-200 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="mb-3 inline-flex rounded-xl bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Departments
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Manage departments
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Create and maintain department groups used across the app.
              </p>
            </button>

            <button
              onClick={() => router.push("/locations")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-amber-200 hover:bg-amber-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="mb-3 inline-flex rounded-xl bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                Locations
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Manage locations
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Organize inventory across office locations and branches.
              </p>
            </button>

            {role === "admin" && (
              <button
                onClick={() => router.push("/settings")}
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-rose-200 hover:bg-rose-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800"
              >
                <div className="mb-3 inline-flex rounded-xl bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                  Settings
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Admin settings
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Promote or demote users between staff and admin roles.
                </p>
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
