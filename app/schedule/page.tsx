"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ScheduleRow = {
  id: number;
  borrower_name: string;
  borrower_email: string | null;
  quantity: number;
  start_date: string;
  end_date: string;
  status: "scheduled" | "checked_out" | "returned" | "cancelled";
  notes: string | null;
  created_at: string;
  inventory_item_id: number | null;
  inventory_items?: {
    name?: string | null;
    inventory_categories?: { name?: string | null } | null;
  } | null;
};

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function endOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + (6 - copy.getDay()));
  return copy;
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function formatDate(dateKey: string) {
  return fromDateKey(dateKey).toLocaleDateString();
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
}

export default function SchedulePage() {
  const router = useRouter();

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [itemFilter, setItemFilter] = useState<string>("all");

  const loadSchedule = async () => {
    await Promise.resolve();
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { data, error } = await supabase
      .from("borrow_requests")
      .select(`
        id,
        borrower_name,
        borrower_email,
        quantity,
        start_date,
        end_date,
        status,
        notes,
        created_at,
        inventory_item_id,
        inventory_items (
          name,
          inventory_categories ( name )
        )
      `)
      .in("status", ["scheduled", "checked_out"])
      .order("start_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as ScheduleRow[]);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSchedule();
  }, []);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);

    const days: Date[] = [];
    let cursor = new Date(gridStart);

    while (cursor <= gridEnd) {
      days.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }

    return days;
  }, [viewMonth]);

  const getItemName = (row: ScheduleRow) => {
    return row.inventory_items?.name || "Unknown item";
  };

  const overlapsDate = (row: ScheduleRow, dateKey: string) => {
    return row.start_date <= dateKey && row.end_date >= dateKey;
  };

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    rows.forEach((row) => {
      const cat = row.inventory_items?.inventory_categories?.name;
      if (cat) cats.add(cat);
    });
    return Array.from(cats).sort();
  }, [rows]);

  const allItems = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => {
      const name = row.inventory_items?.name;
      if (row.inventory_item_id && name) map.set(String(row.inventory_item_id), name);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (categoryFilter !== "all") {
        const cat = row.inventory_items?.inventory_categories?.name;
        if (cat !== categoryFilter) return false;
      }
      if (itemFilter !== "all" && String(row.inventory_item_id) !== itemFilter) return false;
      return true;
    });
  }, [rows, categoryFilter, itemFilter]);

  const selectedDayRows = useMemo(() => {
    return filteredRows.filter((row) => overlapsDate(row, selectedDateKey));
  }, [filteredRows, selectedDateKey]);

  const upcomingRows = useMemo(() => {
    return filteredRows
      .filter((row) => row.end_date >= todayKey)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [filteredRows, todayKey]);

  const getStatusClasses = (status: ScheduleRow["status"]) => {
    if (status === "scheduled") {
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
    }
    if (status === "checked_out") {
      return "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950";
    }
    if (status === "returned") {
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
    }
    return "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200";
  };

  const getEventClasses = (status: ScheduleRow["status"]) => {
    if (status === "scheduled") {
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100";
    }
    if (status === "checked_out") {
      return "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
    }
    return "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-black dark:text-zinc-200";
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
              Inventory System
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-zinc-100">
              Schedule Calendar
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
              View upcoming borrowing in calendar form to catch date conflicts faster.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadSchedule}
              className="rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              Refresh
            </button>

            <Link
              href="/borrowed"
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              Open Borrowed Page
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
              Total Open Requests
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-zinc-100">
              {rows.length}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
              Scheduled
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-zinc-100">
              {rows.filter((row) => row.status === "scheduled").length}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
              Checked Out
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-zinc-100">
              {rows.filter((row) => row.status === "checked_out").length}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
              Selected Day
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-zinc-100">
              {selectedDayRows.length}
            </p>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
            {message}
          </div>
        )}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setItemFilter("all");
            }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="all">All Categories</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="all">All Items</option>
            {allItems.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>

          {(categoryFilter !== "all" || itemFilter !== "all") && (
            <button
              onClick={() => {
                setCategoryFilter("all");
                setItemFilter("all");
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Clear Filters
            </button>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-zinc-100">
                    Monthly Calendar
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                    Click a day to see all borrowing on that date.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      setViewMonth(
                        new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1)
                      )
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Prev
                  </button>

                  <button
                    onClick={() => {
                      const now = new Date();
                      setViewMonth(startOfMonth(now));
                      setSelectedDateKey(toDateKey(now));
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Today
                  </button>

                  <button
                    onClick={() =>
                      setViewMonth(
                        new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)
                      )
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="mt-4 text-xl font-bold tracking-tight text-slate-950 dark:text-zinc-100">
                {formatMonthYear(viewMonth)}
              </div>
            </div>

            {loading ? (
              <div className="px-6 py-8 text-sm text-slate-600 dark:text-zinc-400">
                Loading calendar...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[920px]">
                  <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950">
                    {WEEK_DAYS.map((day) => (
                      <div
                        key={day}
                        className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7">
                    {calendarDays.map((day) => {
                      const dayKey = toDateKey(day);
                      const dayRows = filteredRows.filter((row) => overlapsDate(row, dayKey));
                      const isCurrentMonth = isSameMonth(day, viewMonth);
                      const isToday = dayKey === todayKey;
                      const isSelected = dayKey === selectedDateKey;

                      return (
                        <button
                          key={dayKey}
                          onClick={() => setSelectedDateKey(dayKey)}
                          className={`min-h-[150px] border-b border-r border-slate-200 p-3 text-left align-top transition dark:border-zinc-800 ${
                            isSelected
                              ? "bg-slate-100 ring-2 ring-inset ring-zinc-300 dark:bg-zinc-900 dark:ring-zinc-700"
                              : "bg-white hover:bg-slate-50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                          }`}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <span
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                                isToday
                                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                                  : "bg-transparent text-slate-700 dark:text-zinc-100"
                              } ${!isCurrentMonth ? "opacity-35" : ""}`}
                            >
                              {day.getDate()}
                            </span>

                            {dayRows.length > 0 && (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:bg-zinc-900 dark:text-zinc-300">
                                {dayRows.length}
                              </span>
                            )}
                          </div>

                          <div className="space-y-2">
                            {dayRows.slice(0, 3).map((row) => (
                              <div
                                key={`${dayKey}-${row.id}`}
                                className={`rounded-xl border px-2 py-1.5 text-xs ${getEventClasses(
                                  row.status
                                )}`}
                              >
                                <div className="truncate font-semibold">
                                  {getItemName(row)}
                                </div>
                                <div className="truncate opacity-80">
                                  {row.borrower_name} · {row.quantity}
                                </div>
                              </div>
                            ))}

                            {dayRows.length > 3 && (
                              <div className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                                +{dayRows.length - 3} more
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-zinc-100">Selected Day</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                  {formatDate(selectedDateKey)}
                </p>
              </div>

              <div className="p-4">
                {selectedDayRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                    No borrowing scheduled on this date.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDayRows.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-slate-950 dark:text-zinc-100">
                              {getItemName(row)}
                            </h3>
                            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                              {row.borrower_name}
                              {row.borrower_email ? ` • ${row.borrower_email}` : ""}
                            </p>
                          </div>

                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                              row.status
                            )}`}
                          >
                            {row.status.replace("_", " ")}
                          </span>
                        </div>

                        <div className="space-y-1 text-sm text-slate-600 dark:text-zinc-300">
                          <p>Quantity: {row.quantity}</p>
                          <p>
                            Range: {formatDate(row.start_date)} to {formatDate(row.end_date)}
                          </p>
                          <p>Notes: {row.notes || "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="border-b border-slate-200 px-6 py-4 dark:border-zinc-800">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-zinc-100">Upcoming List</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                  Quick backup list under the calendar.
                </p>
              </div>

              <div className="max-h-[500px] overflow-y-auto p-4">
                {upcomingRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                    No upcoming borrowing requests.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingRows.map((row) => (
                      <button
                        key={row.id}
                        onClick={() => {
                          setSelectedDateKey(row.start_date);
                          setViewMonth(startOfMonth(fromDateKey(row.start_date)));
                        }}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-slate-950 dark:text-zinc-100">
                              {getItemName(row)}
                            </h3>
                            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                              {row.borrower_name}
                            </p>
                          </div>

                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                              row.status
                            )}`}
                          >
                            {row.status.replace("_", " ")}
                          </span>
                        </div>

                        <div className="space-y-1 text-sm text-slate-600 dark:text-zinc-400">
                          <p>Quantity: {row.quantity}</p>
                          <p>
                            {formatDate(row.start_date)} to {formatDate(row.end_date)}
                          </p>
                          <p>{row.notes || "No notes"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
