"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Employee = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string | null;
  department: string | null;
  work_location: string | null;
  job_title: string | null;
  status: string;
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
  created_at: string;
};

type TimeOffRequest = {
  id: string;
  request_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

function formatTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatHours(minutes: number) {
  return (minutes / 60).toFixed(2);
}

function statusClass(status: string) {
  if (status === "approved") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }

  if (status === "rejected" || status === "denied") {
    return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  }

  if (status === "cancelled") {
    return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  }

  return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
}

export default function MyHoursPage() {
  const router = useRouter();

  const [employeeCode, setEmployeeCode] = useState("");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const summary = useMemo(() => {
    const totalMinutes = timeEntries.reduce(
      (sum, entry) => sum + (entry.total_paid_minutes || 0),
      0
    );

    const approvedMinutes = timeEntries
      .filter((entry) => entry.status === "approved")
      .reduce((sum, entry) => sum + (entry.total_paid_minutes || 0), 0);

    const pendingMinutes = timeEntries
      .filter((entry) => entry.status === "pending")
      .reduce((sum, entry) => sum + (entry.total_paid_minutes || 0), 0);

    return {
      totalHours: totalMinutes / 60,
      approvedHours: approvedMinutes / 60,
      pendingHours: pendingMinutes / 60,
      entryCount: timeEntries.length,
      requestCount: timeOffRequests.length,
    };
  }, [timeEntries, timeOffRequests]);

  const loadRecords = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const params = new URLSearchParams({
        employeeCode,
      });

      const response = await fetch(`/api/hr/my-hours?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Unable to load employee records.");
        setEmployee(null);
        setTimeEntries([]);
        setTimeOffRequests([]);
        return;
      }

      setEmployee(result.employee);
      setTimeEntries(result.timeEntries || []);
      setTimeOffRequests(result.timeOffRequests || []);
      setMessage("Records loaded.");
    } catch {
      setError("Unable to connect to the My Hours system.");
    } finally {
      setLoading(false);
    }
  };

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
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
            HR Attendance
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">My Hours</h1>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Employees can review their clocked hours, approval status, and
            time-off requests.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto]">
            <input
              value={employeeCode}
              onChange={(event) => setEmployeeCode(event.target.value)}
              placeholder="Enter employee code, example: 100001"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
            />

            <button
              onClick={loadRecords}
              disabled={!employeeCode || loading}
              className="rounded-2xl bg-slate-900 px-6 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              {loading ? "Loading..." : "View Records"}
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

          {employee && (
            <>
              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {employee.first_name} {employee.last_name}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Code: {employee.employee_code} ·{" "}
                      {employee.department || "No department"} ·{" "}
                      {employee.work_location || "No location"}
                    </p>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {employee.job_title || "No job title"} ·{" "}
                      {employee.email || "No email"}
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                      employee.status === "active"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : employee.status === "inactive"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {employee.status}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Entries
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {summary.entryCount}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Total Hours
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {summary.totalHours.toFixed(2)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Approved
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {summary.approvedHours.toFixed(2)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Pending
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {summary.pendingHours.toFixed(2)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Requests
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {summary.requestCount}
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
                  <h2 className="text-xl font-bold">Time Entries</h2>

                  {timeEntries.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">
                      No time entries found.
                    </p>
                  ) : (
                    <div className="mt-5 overflow-x-auto">
                      <table className="w-full min-w-[800px] border-separate border-spacing-y-3 text-left text-sm">
                        <thead>
                          <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            <th className="px-4 py-2">Date</th>
                            <th className="px-4 py-2">Clock In</th>
                            <th className="px-4 py-2">Break</th>
                            <th className="px-4 py-2">Clock Out</th>
                            <th className="px-4 py-2">Hours</th>
                            <th className="px-4 py-2">Status</th>
                          </tr>
                        </thead>

                        <tbody>
                          {timeEntries.map((entry) => (
                            <tr
                              key={entry.id}
                              className="rounded-2xl bg-white shadow-sm dark:bg-slate-900"
                            >
                              <td className="rounded-l-2xl px-4 py-4 font-medium">
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
                                <div className="mt-1 text-xs text-slate-500">
                                  {entry.total_break_minutes} min
                                </div>
                              </td>

                              <td className="px-4 py-4">
                                {formatTime(entry.clock_out)}
                              </td>

                              <td className="px-4 py-4 font-semibold">
                                {formatHours(entry.total_paid_minutes)}
                              </td>

                              <td className="rounded-r-2xl px-4 py-4">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                                    entry.status
                                  )}`}
                                >
                                  {entry.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
                  <h2 className="text-xl font-bold">Time-Off Requests</h2>

                  {timeOffRequests.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">
                      No time-off requests found.
                    </p>
                  ) : (
                    <div className="mt-5 space-y-4">
                      {timeOffRequests.map((request) => (
                        <div
                          key={request.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-semibold capitalize">
                              {request.request_type}
                            </h3>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                                request.status
                              )}`}
                            >
                              {request.status}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            {formatDate(request.start_date)} →{" "}
                            {formatDate(request.end_date)}
                          </p>

                          {request.reason && (
                            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                              {request.reason}
                            </p>
                          )}

                          {request.admin_note && (
                            <p className="mt-3 rounded-xl bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              HR note: {request.admin_note}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}