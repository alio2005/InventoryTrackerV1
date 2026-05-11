"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type EmployeeInfo = {
  first_name: string;
  last_name: string;
  employee_code: string;
  department: string | null;
  work_location: string | null;
  job_title: string | null;
};

type TimeEntry = {
  id: string;
  work_date: string;
  clock_in: string | null;
  break_start: string | null;
  break_end: string | null;
  clock_out: string | null;
  total_break_minutes: number;
  total_paid_minutes: number;
  status: string;
  admin_note: string | null;
  hr_employees: EmployeeInfo | EmployeeInfo[] | null;
};

function formatTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatHours(minutes: number) {
  return (minutes / 60).toFixed(2);
}

function getEmployee(entry: TimeEntry): EmployeeInfo | null {
  if (!entry.hr_employees) return null;

  if (Array.isArray(entry.hr_employees)) {
    return entry.hr_employees[0] ?? null;
  }

  return entry.hr_employees;
}

export default function HRApprovalsPage() {
  const router = useRouter();

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadEntries = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const response = await fetch("/api/hr/time-entries", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Unable to load time entries.");
        return;
      }

      setEntries(result.entries || []);
    } catch {
      setError("Unable to connect to the approvals system.");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (entryId: string, status: string) => {
    setError("");
    setMessage("");
    setUpdatingId(entryId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const response = await fetch("/api/hr/time-entries", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          entryId,
          status,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Unable to update time entry.");
        return;
      }

      setMessage(result.message || "Time entry updated.");
      await loadEntries();
    } catch {
      setError("Unable to update this time entry.");
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={() => router.push("/hr")}
          className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          ← Back to HR
        </button>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                HR Attendance
              </p>

              <h1 className="mt-3 text-3xl font-bold tracking-tight">
                Time Entry Approvals
              </h1>

              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Review employee hours before payroll.
              </p>
            </div>

            <button
              onClick={loadEntries}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Refresh
            </button>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <p className="mt-8 text-sm text-slate-500">Loading entries...</p>
          ) : entries.length === 0 ? (
            <p className="mt-8 text-sm text-slate-500">
              No time entries found yet.
            </p>
          ) : (
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[1000px] border-separate border-spacing-y-3 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-2">Employee</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Clock In</th>
                    <th className="px-4 py-2">Break</th>
                    <th className="px-4 py-2">Clock Out</th>
                    <th className="px-4 py-2">Paid Hours</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {entries.map((entry) => {
                    const employee = getEmployee(entry);

                    return (
                      <tr
                        key={entry.id}
                        className="rounded-2xl bg-slate-50 shadow-sm dark:bg-slate-800"
                      >
                        <td className="rounded-l-2xl px-4 py-4">
                          <div className="font-semibold">
                            {employee
                              ? `${employee.first_name} ${employee.last_name}`
                              : "Unknown Employee"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Code: {employee?.employee_code ?? "—"}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {employee?.department ?? "No department"} ·{" "}
                            {employee?.work_location ?? "No location"}
                          </div>
                        </td>

                        <td className="px-4 py-4 font-medium">
                          {entry.work_date}
                        </td>

                        <td className="px-4 py-4">
                          {formatTime(entry.clock_in)}
                        </td>

                        <td className="px-4 py-4">
                          <div>
                            {formatTime(entry.break_start)} →{" "}
                            {formatTime(entry.break_end)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {entry.total_break_minutes} min
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          {formatTime(entry.clock_out)}
                        </td>

                        <td className="px-4 py-4 font-semibold">
                          {formatHours(entry.total_paid_minutes)}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              entry.status === "approved"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : entry.status === "rejected"
                                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {entry.status}
                          </span>
                        </td>

                        <td className="rounded-r-2xl px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              disabled={updatingId === entry.id}
                              onClick={() =>
                                updateStatus(entry.id, "approved")
                              }
                              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Approve
                            </button>

                            <button
                              disabled={updatingId === entry.id}
                              onClick={() =>
                                updateStatus(entry.id, "rejected")
                              }
                              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                            >
                              Reject
                            </button>

                            <button
                              disabled={updatingId === entry.id}
                              onClick={() =>
                                updateStatus(entry.id, "pending")
                              }
                              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-700"
                            >
                              Reset
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}