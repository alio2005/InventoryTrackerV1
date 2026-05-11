"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/components/workspace-provider";

type NameRelation = { name?: string | null; department_id?: number | null } | { name?: string | null; department_id?: number | null }[] | null;

type UnitRelation =
  | { unit_code?: string | null }
  | { unit_code?: string | null }[]
  | null;

type InventoryItem = {
  id: number;
  name: string;
  asset_code: string | null;
  quantity: number;
  min_quantity: number;
  is_active: boolean;
  department_id: number | null;
  departments?: NameRelation;
  locations?: NameRelation;
  inventory_categories?: NameRelation;
};

type InventoryUnit = {
  id: number;
  inventory_item_id: number;
  unit_code: string | null;
  status: string;
};

type SimpleRow = {
  id: number;
  name?: string | null;
};

type BorrowRequestStatus =
  | "pending"
  | "scheduled"
  | "checked_out"
  | "returned"
  | "cancelled"
  | "declined";

type BorrowRequestRow = {
  id: number;
  borrower_name: string;
  borrower_email: string | null;
  quantity: number;
  start_date: string;
  end_date: string;
  status: BorrowRequestStatus;
  notes: string | null;
  created_at: string;
  inventory_items?: NameRelation;
  inventory_units?: UnitRelation;
};

type NotificationRow = {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type IssueRow = {
  id: number;
  report_type: "missing" | "damaged" | string;
  issue_status: "open" | "resolved" | "written_off" | string;
  quantity: number;
  reported_at: string;
  notes: string | null;
  inventory_items?: NameRelation;
  inventory_units?: UnitRelation;
};

type TransactionRow = {
  id: number;
  action: string;
  quantity_changed: number;
  note: string | null;
  created_at: string;
  inventory_items?: NameRelation;
};

const activeBorrowStatuses: BorrowRequestStatus[] = [
  "pending",
  "scheduled",
  "checked_out",
];

const unitStatusLabels: Record<string, string> = {
  available: "Available",
  borrowed: "Borrowed",
  camp_allocated: "Camp Allocated",
  missing: "Missing",
  damaged: "Damaged",
  retired: "Retired",
};

const quickActions = [
  {
    title: "Add or edit inventory",
    description: "Create items, adjust quantities, archive old stock, and open unit management.",
    href: "/inventory",
    tag: "Inventory",
  },
  {
    title: "Create a borrow request",
    description: "Sign out a specific unit, schedule future borrowing, or manage active borrowers.",
    href: "/borrowed",
    tag: "Borrowing",
  },
  {
    title: "Check the schedule",
    description: "See upcoming bookings before approving equipment use.",
    href: "/schedule",
    tag: "Planning",
  },
  {
    title: "Resolve issues",
    description: "Review missing, damaged, and write-off reports.",
    href: "/missing-damaged",
    tag: "Issues",
  },
];

const firstRelatedName = (value?: NameRelation) => {
  if (Array.isArray(value)) return value[0]?.name ?? "Unassigned";
  return value?.name ?? "Unassigned";
};

const firstUnitCode = (value?: UnitRelation) => {
  if (Array.isArray(value)) return value[0]?.unit_code ?? null;
  return value?.unit_code ?? null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "No date";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "No date";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const statusClass = (status: string) => {
  if (status === "pending") return "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300";
  if (status === "scheduled") return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  if (status === "checked_out") return "bg-zinc-900 text-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-300";
  if (status === "available") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (status === "missing" || status === "damaged") return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
  if (status === "camp_allocated") return "bg-zinc-900 text-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-300";
  return "bg-zinc-900 text-zinc-300 dark:bg-zinc-900 dark:text-zinc-300";
};

export default function DashboardPage() {
  const router = useRouter();
  const { selectedDepartmentId, selectedDepartment, isWorkspaceActive } = useWorkspace();
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [departments, setDepartments] = useState<SimpleRow[]>([]);
  const [locations, setLocations] = useState<SimpleRow[]>([]);
  const [borrowRequests, setBorrowRequests] = useState<BorrowRequestRow[]>([]);
  const [openIssues, setOpenIssues] = useState<IssueRow[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionRow[]>([]);

  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<NotificationRow[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const loadDashboard = async () => {
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
    setEmail(user.email ?? "");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const userRole = profile?.role ?? "";
    setRole(userRole);

    const [
      inventoryResult,
      unitsResult,
      departmentsResult,
      locationsResult,
      borrowResult,
      issuesResult,
      transactionsResult,
    ] = await Promise.all([
      supabase
        .from("inventory_items")
        .select(
          "id, name, asset_code, quantity, min_quantity, is_active, department_id, departments(name), locations(name), inventory_categories(name)"
        )
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("inventory_units")
        .select("id, inventory_item_id, unit_code, status")
        .order("unit_code", { ascending: true }),
      supabase.from("departments").select("id, name").order("name"),
      supabase.from("locations").select("id, name").order("name"),
      supabase
        .from("borrow_requests")
        .select(
          `
          id,
          borrower_name,
          borrower_email,
          quantity,
          start_date,
          end_date,
          status,
          notes,
          created_at,
          inventory_items(name, department_id),
          inventory_units(unit_code)
        `
        )
        .in("status", activeBorrowStatuses)
        .order("start_date", { ascending: true })
        .limit(8),
      supabase
        .from("missing_damaged_reports")
        .select(
          `
          id,
          report_type,
          issue_status,
          quantity,
          reported_at,
          notes,
          inventory_items(name, department_id),
          inventory_units(unit_code)
        `
        )
        .eq("issue_status", "open")
        .order("reported_at", { ascending: false })
        .limit(8),
      supabase
        .from("inventory_transactions")
        .select("id, action, quantity_changed, note, created_at, inventory_items(name, department_id)")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    if (inventoryResult.error) setMessage(inventoryResult.error.message);
    if (unitsResult.error) setMessage(unitsResult.error.message);
    if (borrowResult.error) setMessage(borrowResult.error.message);

    setInventoryItems((inventoryResult.data ?? []) as unknown as InventoryItem[]);
    setUnits((unitsResult.data ?? []) as InventoryUnit[]);
    setDepartments((departmentsResult.data ?? []) as SimpleRow[]);
    setLocations((locationsResult.data ?? []) as SimpleRow[]);
    setBorrowRequests((borrowResult.data ?? []) as unknown as BorrowRequestRow[]);
    setOpenIssues((issuesResult.data ?? []) as unknown as IssueRow[]);
    setRecentTransactions((transactionsResult.data ?? []) as unknown as TransactionRow[]);

    let notificationsQuery = supabase
      .from("notifications")
      .select("id, title, message, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (userRole !== "admin") {
      notificationsQuery = notificationsQuery.eq("user_id", user.id);
    }

    const { data: notificationsData } = await notificationsQuery;
    const safeNotifications = (notificationsData ?? []) as NotificationRow[];

    setUnreadNotifications(safeNotifications.filter((n) => !n.is_read).length);
    setRecentNotifications(safeNotifications.slice(0, 4));
    setLoading(false);
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

    notificationChannel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        ...(role === "admin" ? {} : { filter: `user_id=eq.${currentUserId}` }),
      },
      async () => {
        await loadDashboard();
      }
    );

    notificationChannel.subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, role]);

  const workspaceInventoryItems = useMemo(() => {
    if (!selectedDepartmentId) return inventoryItems;
    return inventoryItems.filter((item) => String(item.department_id ?? "") === selectedDepartmentId);
  }, [inventoryItems, selectedDepartmentId]);

  const workspaceItemIds = useMemo(
    () => new Set(workspaceInventoryItems.map((item) => item.id)),
    [workspaceInventoryItems]
  );

  const workspaceUnits = useMemo(() => {
    if (!selectedDepartmentId) return units;
    return units.filter((unit) => workspaceItemIds.has(unit.inventory_item_id));
  }, [selectedDepartmentId, units, workspaceItemIds]);

  const relationDepartmentId = (value?: NameRelation) => {
    const relation = Array.isArray(value) ? value[0] : value;
    return relation?.department_id ?? null;
  };

  const workspaceBorrowRequests = useMemo(() => {
    if (!selectedDepartmentId) return borrowRequests;
    return borrowRequests.filter((request) => String(relationDepartmentId(request.inventory_items) ?? "") === selectedDepartmentId);
  }, [borrowRequests, selectedDepartmentId]);

  const workspaceOpenIssues = useMemo(() => {
    if (!selectedDepartmentId) return openIssues;
    return openIssues.filter((issue) => String(relationDepartmentId(issue.inventory_items) ?? "") === selectedDepartmentId);
  }, [openIssues, selectedDepartmentId]);

  const workspaceRecentTransactions = useMemo(() => {
    if (!selectedDepartmentId) return recentTransactions;
    return recentTransactions.filter((transaction) => String(relationDepartmentId(transaction.inventory_items) ?? "") === selectedDepartmentId);
  }, [recentTransactions, selectedDepartmentId]);

  const stats = useMemo(() => {
    const totalQuantity = workspaceInventoryItems.reduce((sum, item) => sum + item.quantity, 0);
    const lowStockItems = workspaceInventoryItems.filter(
      (item) => item.min_quantity > 0 && item.quantity <= item.min_quantity
    );
    const availableUnits = workspaceUnits.filter((unit) => unit.status === "available").length;
    const borrowedUnits = workspaceUnits.filter((unit) => unit.status === "borrowed").length;
    const campAllocatedUnits = workspaceUnits.filter((unit) => unit.status === "camp_allocated").length;
    const issueUnits = workspaceUnits.filter(
      (unit) => unit.status === "missing" || unit.status === "damaged"
    ).length;

    const today = new Date().toISOString().slice(0, 10);
    const nextSevenDays = new Date();
    nextSevenDays.setDate(nextSevenDays.getDate() + 7);
    const nextSevenDaysIso = nextSevenDays.toISOString().slice(0, 10);

    const overdueRequests = workspaceBorrowRequests.filter(
      (request) => request.status === "checked_out" && request.end_date < today
    ).length;

    const dueSoonRequests = workspaceBorrowRequests.filter(
      (request) => request.start_date >= today && request.start_date <= nextSevenDaysIso
    ).length;

    const departmentCounts = workspaceInventoryItems.reduce<Record<string, number>>((acc, item) => {
      const department = firstRelatedName(item.departments);
      acc[department] = (acc[department] ?? 0) + 1;
      return acc;
    }, {});

    const topDepartments = Object.entries(departmentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const readinessDeductions =
      lowStockItems.length * 6 +
      workspaceOpenIssues.length * 8 +
      overdueRequests * 10 +
      unreadNotifications * 2;

    const readinessScore = Math.max(0, Math.min(100, 100 - readinessDeductions));

    return {
      totalQuantity,
      lowStockItems,
      availableUnits,
      borrowedUnits,
      campAllocatedUnits,
      issueUnits,
      overdueRequests,
      dueSoonRequests,
      topDepartments,
      readinessScore,
    };
  }, [workspaceBorrowRequests, workspaceInventoryItems, workspaceOpenIssues.length, unreadNotifications, workspaceUnits]);

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
    } else {
      setMessage(error.message);
    }

    setMarkingAllRead(false);
  };

  const userName = email.split("@")[0] || "there";

  return (
    <main className="min-h-screen bg-black text-zinc-100 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {isWorkspaceActive && (
          <div className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
            <span className="font-bold">Workspace active:</span> showing dashboard numbers for {selectedDepartment?.name || "selected department"}. Clear it from the top-right workspace dropdown to see the full app.
          </div>
        )}
        <div className="mb-6 overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-zinc-900/60 dark:bg-zinc-900/30" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-300 dark:text-zinc-400">
                  Inventory Command Centre
                </p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  What needs attention today?
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 dark:text-zinc-300">
                  Signed in as <span className="font-semibold text-zinc-100 dark:text-white">{userName}</span>. This dashboard now focuses on inventory health, active borrowing, issues, and recent activity. Camp tools stay in the sidebar.
                </p>

                {message && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                    {message}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm dark:border-zinc-800 dark:bg-black">
                  <span className="text-zinc-500 dark:text-zinc-400">Role</span>
                  <span className="ml-2 font-semibold capitalize text-zinc-100 dark:text-white">
                    {role || "unknown"}
                  </span>
                </div>

                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setNotificationsOpen((prev) => !prev)}
                    className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-black text-zinc-300 transition hover:bg-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
                    <div className="absolute right-0 top-14 z-50 w-[22rem] overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 sm:w-96">
                      <div className="border-b border-zinc-800 px-5 py-4 dark:border-zinc-800">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold">Notifications</h3>
                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                              {unreadNotifications} unread
                            </p>
                          </div>

                          <button
                            onClick={handleMarkAllRead}
                            disabled={markingAllRead || unreadNotifications === 0}
                            className="rounded-xl bg-zinc-800 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {markingAllRead ? "Marking..." : "Mark all read"}
                          </button>
                        </div>
                      </div>

                      <div className="max-h-96 overflow-y-auto p-3">
                        {recentNotifications.length === 0 ? (
                          <EmptyState text="No notifications yet." />
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
                                    ? "border-zinc-800 bg-black hover:border-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                                    : "border-fuchsia-200 bg-fuchsia-50 hover:border-fuchsia-300 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/20 dark:hover:border-fuchsia-800"
                                }`}
                              >
                                <div className="mb-2 flex items-center justify-between gap-3">
                                  <h4 className="text-sm font-semibold">{notification.title}</h4>
                                  {!notification.is_read && <Pill label="Unread" tone="pink" />}
                                </div>
                                <p className="line-clamp-2 text-sm text-zinc-400 dark:text-zinc-300">
                                  {notification.message}
                                </p>
                                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                  {formatDateTime(notification.created_at)}
                                </p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border-t border-zinc-800 p-3 dark:border-zinc-800">
                        <button
                          onClick={() => {
                            setNotificationsOpen(false);
                            router.push("/notifications");
                          }}
                          className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        >
                          View all notifications
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active items" value={workspaceInventoryItems.length} detail={`${stats.totalQuantity} total quantity`} loading={loading} />
          <MetricCard label="Tracked units" value={workspaceUnits.length} detail={`${stats.availableUnits} available units`} loading={loading} />
          <MetricCard label="Open borrowing" value={workspaceBorrowRequests.length} detail={`${stats.dueSoonRequests} starting in 7 days`} loading={loading} />
          <MetricCard label="Needs attention" value={stats.lowStockItems.length + workspaceOpenIssues.length + stats.overdueRequests} detail={`${workspaceOpenIssues.length} open issues`} loading={loading} emphasis />
        </section>

        <section className="mb-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Active Borrowing</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Current pending, scheduled, and checked-out requests.
                </p>
              </div>
              <button
                onClick={() => router.push("/borrowed")}
                className="rounded-2xl bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
              >
                Open borrowed page
              </button>
            </div>

            {workspaceBorrowRequests.length === 0 ? (
              <EmptyState text="No active borrowing requests right now." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-zinc-800 dark:border-zinc-800">
                <div className="hidden grid-cols-[1.3fr_1fr_1fr_0.8fr] gap-4 bg-black px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-black dark:text-zinc-400 md:grid">
                  <span>Borrower</span>
                  <span>Item / unit</span>
                  <span>Date</span>
                  <span>Status</span>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {workspaceBorrowRequests.slice(0, 5).map((request) => (
                    <button
                      key={request.id}
                      onClick={() => router.push("/borrowed")}
                      className="grid w-full gap-2 px-4 py-4 text-left transition hover:bg-zinc-900 dark:hover:bg-zinc-900 md:grid-cols-[1.3fr_1fr_1fr_0.8fr] md:items-center md:gap-4"
                    >
                      <div>
                        <p className="font-semibold text-zinc-100 dark:text-white">{request.borrower_name}</p>
                        {request.borrower_email && (
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{request.borrower_email}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200 dark:text-zinc-100">
                          {firstRelatedName(request.inventory_items)}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {firstUnitCode(request.inventory_units) ?? `${request.quantity} item(s)`}
                        </p>
                      </div>
                      <p className="text-sm text-zinc-400 dark:text-zinc-300">
                        {formatDate(request.start_date)} → {formatDate(request.end_date)}
                      </p>
                      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(request.status)}`}>
                        {request.status.replace("_", " ")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-xl font-semibold tracking-tight">Inventory Health</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              A quick score based on low stock, open issues, overdue borrowing, and unread alerts.
            </p>

            <div className="mt-6 rounded-3xl bg-black p-5 dark:bg-black">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Readiness score</p>
                  <p className="mt-2 text-4xl font-bold tracking-tight">{stats.readinessScore}%</p>
                </div>
                <Pill label={stats.readinessScore >= 80 ? "Good" : stats.readinessScore >= 55 ? "Watch" : "Urgent"} tone={stats.readinessScore >= 80 ? "green" : stats.readinessScore >= 55 ? "amber" : "rose"} />
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-zinc-800 dark:bg-zinc-900">
                <div
                  className="h-full rounded-full bg-zinc-800 transition-all"
                  style={{ width: `${stats.readinessScore}%` }}
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <SmallStat label="Low stock" value={stats.lowStockItems.length} />
              <SmallStat label="Overdue" value={stats.overdueRequests} />
              <SmallStat label="Issues" value={workspaceOpenIssues.length} />
              <SmallStat label="Unread alerts" value={unreadNotifications} />
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-6 xl:grid-cols-3">
          <Panel title="Stock Attention" description="Items at or below their minimum quantity.">
            {stats.lowStockItems.length === 0 ? (
              <EmptyState text="No low-stock items right now." compact />
            ) : (
              <div className="space-y-3">
                {stats.lowStockItems.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => router.push("/inventory")}
                    className="w-full rounded-2xl border border-zinc-800 bg-black p-4 text-left transition hover:border-zinc-800 hover:bg-zinc-900 dark:border-zinc-800 dark:bg-black dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-zinc-100 dark:text-white">{item.name}</p>
                      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                        {item.quantity}/{item.min_quantity}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {firstRelatedName(item.departments)} • {firstRelatedName(item.locations)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Open Issues" description="Missing or damaged reports not resolved yet.">
            {workspaceOpenIssues.length === 0 ? (
              <EmptyState text="No open missing or damaged reports." compact />
            ) : (
              <div className="space-y-3">
                {workspaceOpenIssues.slice(0, 5).map((issue) => (
                  <button
                    key={issue.id}
                    onClick={() => router.push("/missing-damaged")}
                    className="w-full rounded-2xl border border-zinc-800 bg-black p-4 text-left transition hover:border-orange-200 hover:bg-orange-50 dark:border-zinc-800 dark:bg-black dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-zinc-100 dark:text-white">{firstRelatedName(issue.inventory_items)}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(issue.report_type)}`}>
                        {issue.report_type}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {firstUnitCode(issue.inventory_units) ?? `${issue.quantity} item(s)`} • Reported {formatDate(issue.reported_at)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Unit Breakdown" description="Status of all individually tracked units.">
            <div className="space-y-3">
              {Object.entries(unitStatusLabels).map(([status, label]) => {
                const count = workspaceUnits.filter((unit) => unit.status === status).length;
                return (
                  <div key={status} className="flex items-center justify-between rounded-2xl bg-black px-4 py-3 dark:bg-black">
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${status === "available" ? "bg-emerald-500" : status === "borrowed" ? "bg-zinc-700" : status === "camp_allocated" ? "bg-zinc-900/600" : status === "missing" || status === "damaged" ? "bg-rose-500" : "bg-slate-400"}`} />
                      <span className="text-sm font-medium text-zinc-300 dark:text-zinc-200">{label}</span>
                    </div>
                    <span className="font-semibold text-zinc-100 dark:text-white">{count}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </section>

        <section className="mb-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel title="Quick Actions" description="No duplicate Camp cards here. Use the sidebar for Camp Planning.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {quickActions.map((action) => (
                <button
                  key={action.href}
                  onClick={() => router.push(action.href)}
                  className="rounded-2xl border border-zinc-800 bg-black p-4 text-left transition hover:border-zinc-800 hover:bg-zinc-900 dark:border-zinc-800 dark:bg-black dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  <div className="mb-2 inline-flex rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-300">
                    {action.tag}
                  </div>
                  <h3 className="font-semibold text-zinc-100 dark:text-white">{action.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-zinc-400 dark:text-zinc-300">{action.description}</p>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Recent Activity" description="Latest inventory transactions.">
            {workspaceRecentTransactions.length === 0 ? (
              <EmptyState text="No transaction history yet." compact />
            ) : (
              <div className="space-y-3">
                {workspaceRecentTransactions.map((transaction) => (
                  <button
                    key={transaction.id}
                    onClick={() => router.push("/transactions")}
                    className="flex w-full items-start justify-between gap-4 rounded-2xl border border-zinc-800 bg-black p-4 text-left transition hover:border-zinc-800 hover:bg-zinc-900/60 dark:border-zinc-800 dark:bg-black dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    <div>
                      <p className="font-semibold text-zinc-100 dark:text-white">
                        {firstRelatedName(transaction.inventory_items)}
                      </p>
                      <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-300">
                        {transaction.action.replace("_", " ")} • Quantity {transaction.quantity_changed}
                      </p>
                      {transaction.note && (
                        <p className="mt-1 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">{transaction.note}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDateTime(transaction.created_at)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Panel title="Department Snapshot" description="Largest inventory groups by department.">
            {stats.topDepartments.length === 0 ? (
              <EmptyState text="No department data yet." compact />
            ) : (
              <div className="space-y-3">
                {stats.topDepartments.map(([department, count]) => (
                  <div key={department} className="rounded-2xl bg-black p-4 dark:bg-black">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-zinc-100 dark:text-white">{department}</span>
                      <span className="text-sm font-bold text-zinc-300 dark:text-zinc-400">{count}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800 dark:bg-zinc-900">
                      <div
                        className="h-full rounded-full bg-zinc-800"
                        style={{ width: `${Math.min(100, (count / Math.max(1, workspaceInventoryItems.length)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="System Setup" description="Base organization records in the app.">
            <div className="grid grid-cols-2 gap-3">
              <SmallStat label="Departments" value={departments.length} />
              <SmallStat label="Locations" value={locations.length} />
              <SmallStat label="Available units" value={stats.availableUnits} />
              <SmallStat label="Borrowed units" value={stats.borrowedUnits} />
              <SmallStat label="Camp allocated" value={stats.campAllocatedUnits} />
              <SmallStat label="Issue units" value={stats.issueUnits} />
            </div>
          </Panel>

          <Panel title="Recommended Next Step" description="Best move based on the current dashboard.">
            <div className="rounded-3xl bg-black p-5 dark:bg-black">
              <p className="text-lg font-semibold text-zinc-100 dark:text-white">
                {stats.overdueRequests > 0
                  ? "Follow up on overdue borrowed items."
                  : workspaceOpenIssues.length > 0
                    ? "Resolve open missing/damaged reports."
                    : stats.lowStockItems.length > 0
                      ? "Restock low inventory items."
                      : unreadNotifications > 0
                        ? "Clear unread notifications."
                        : "Inventory looks stable."}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-400 dark:text-zinc-300">
                {stats.overdueRequests > 0
                  ? "Go to Borrowed to check return dates and process returned units."
                  : workspaceOpenIssues.length > 0
                    ? "Open Missing / Damaged to update issue status and unit condition."
                    : stats.lowStockItems.length > 0
                      ? "Open Inventory to increase quantities or update minimum stock levels."
                      : unreadNotifications > 0
                        ? "Review alerts so the dashboard score reflects the newest status."
                        : "No urgent action is showing right now."}
              </p>
              <button
                onClick={() => {
                  if (stats.overdueRequests > 0) router.push("/borrowed");
                  else if (workspaceOpenIssues.length > 0) router.push("/missing-damaged");
                  else if (stats.lowStockItems.length > 0) router.push("/inventory");
                  else if (unreadNotifications > 0) router.push("/notifications");
                  else router.push("/inventory");
                }}
                className="mt-5 rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-800"
              >
                Go there
              </button>
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
  loading,
  emphasis,
}: {
  label: string;
  value: number;
  detail: string;
  loading: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${emphasis ? "border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20" : "border-zinc-800 bg-zinc-950 dark:border-zinc-800 dark:bg-zinc-950"}`}>
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-zinc-100 dark:text-white">
        {loading ? "—" : value}
      </p>
      <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-300">{detail}</p>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      {children}
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black p-4 dark:border-zinc-800 dark:bg-black">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-zinc-100 dark:text-white">{value}</p>
    </div>
  );
}

function Pill({ label, tone }: { label: string; tone: "pink" | "green" | "amber" | "rose" }) {
  const classes = {
    pink: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  };

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>{label}</span>;
}

function EmptyState({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-dashed border-zinc-700 bg-black text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 ${compact ? "p-4" : "p-6"}`}>
      {text}
    </div>
  );
}
