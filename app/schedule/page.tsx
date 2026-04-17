"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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
  inventory_items?: {
    name?: string | null;
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

  const loadSchedule = async () => {
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
        inventory_items (
          name
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
    loadSchedule();
  }, [router]);

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

  const selectedDayRows = useMemo(() => {
    return rows.filter((row) => overlapsDate(row, selectedDateKey));
  }, [rows, selectedDateKey]);

  const upcomingRows = useMemo(() => {
    return rows
      .filter((row) => row.end_date >= todayKey)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [rows, todayKey]);

  const getStatusClasses = (status: ScheduleRow["status"]) => {
    if (status === "scheduled") {
      return "bg-amber-100 text-amber-700";
    }
    if (status === "checked_out") {
      return "bg-blue-100 text-blue-700";
    }
    if (status === "returned") {
      return "bg-emerald-100 text-emerald-700";
    }
    return "bg-rose-100 text-rose-700";
  };

  const getEventClasses = (status: ScheduleRow["status"]) => {
    if (status === "scheduled") {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }
    if (status === "checked_out") {
      return "border-blue-200 bg-blue-50 text-blue-700";
    }
    return "border-slate-200 bg-slate-50 text-slate-700";
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Inventory System
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Schedule Calendar
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              View upcoming borrowing in calendar form to catch date conflicts faster.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadSchedule}
              className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Refresh
            </button>

            <button
              onClick={() => router.push("/borrowed")}
              className="rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700"
            >
              Open Borrowed Page
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Total Open Requests
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {rows.length}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Scheduled
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {rows.filter((row) => row.status === "scheduled").length}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Checked Out
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {rows.filter((row) => row.status === "checked_out").length}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Selected Day
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {selectedDayRows.length}
            </p>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
            {message}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Monthly Calendar</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    Prev
                  </button>

                  <button
                    onClick={() => {
                      const now = new Date();
                      setViewMonth(startOfMonth(now));
                      setSelectedDateKey(toDateKey(now));
                    }}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    Today
                  </button>

                  <button
                    onClick={() =>
                      setViewMonth(
                        new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)
                      )
                    }
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="mt-4 text-xl font-bold tracking-tight">
                {formatMonthYear(viewMonth)}
              </div>
            </div>

            {loading ? (
              <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                Loading calendar...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[920px]">
                  <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
                    {WEEK_DAYS.map((day) => (
                      <div
                        key={day}
                        className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7">
                    {calendarDays.map((day) => {
                      const dayKey = toDateKey(day);
                      const dayRows = rows.filter((row) => overlapsDate(row, dayKey));
                      const isCurrentMonth = isSameMonth(day, viewMonth);
                      const isToday = dayKey === todayKey;
                      const isSelected = dayKey === selectedDateKey;

                      return (
                        <button
                          key={dayKey}
                          onClick={() => setSelectedDateKey(dayKey)}
                          className={`min-h-[150px] border-b border-r border-slate-200 p-3 text-left align-top transition dark:border-slate-800 ${
                            isSelected
                              ? "bg-blue-50 dark:bg-slate-800"
                              : "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800"
                          }`}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <span
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                                isToday
                                  ? "bg-blue-600 text-white"
                                  : "bg-transparent text-slate-900 dark:text-slate-100"
                              } ${!isCurrentMonth ? "opacity-40" : ""}`}
                            >
                              {day.getDate()}
                            </span>

                            {dayRows.length > 0 && (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
                                <div className="truncate">
                                  {row.borrower_name} · {row.quantity}
                                </div>
                              </div>
                            ))}

                            {dayRows.length > 3 && (
                              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
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
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                <h2 className="text-lg font-semibold">Selected Day</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {formatDate(selectedDateKey)}
                </p>
              </div>

              <div className="p-4">
                {selectedDayRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    No borrowing scheduled on this date.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDayRows.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800"
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                              {getItemName(row)}
                            </h3>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
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

                        <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
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

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                <h2 className="text-lg font-semibold">Upcoming List</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Quick backup list under the calendar.
                </p>
              </div>

              <div className="max-h-[500px] overflow-y-auto p-4">
                {upcomingRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
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
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-700"
                      >
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                              {getItemName(row)}
                            </h3>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
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

                        <div className="space-y-1 text-sm text-slate-500 dark:text-slate-400">
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