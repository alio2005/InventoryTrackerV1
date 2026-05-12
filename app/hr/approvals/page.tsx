"use client";

import { useEffect, useMemo, useState } from "react";
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

type BreakSession = {
  id: string;
  time_entry_id: string;
  break_start: string;
  break_end: string | null;
  break_minutes: number;
};

type ScheduleInfo = {
  id: string;
  employee_id: string;
  weekday: number;
  work_mode: "in_person" | "wfh" | "off";
  scheduled_start: string | null;
  scheduled_end: string | null;
  grace_minutes: number;
};

type TimeEntry = {
  id: string;
  employee_id: string;
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
  updated_at?: string | null;
  approved_at?: string | null;
  hr_employees: EmployeeInfo | EmployeeInfo[] | null;
  hr_break_sessions?: BreakSession[];
  schedule?: ScheduleInfo | null;
};

type EditForm = {
  clockIn: string;
  breakStart: string;
  breakEnd: string;
  clockOut: string;
  adminNote: string;
};

type EmployeeGroup = {
  employeeId: string;
  employee: EmployeeInfo | null;
  entries: TimeEntry[];
  totalMinutes: number;
  totalHours: number;
  totalShifts: number;
  onTimeCount: number;
  lateCount: number;
  noScheduleCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  editedCount: number;
};

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getEmployee(entry: TimeEntry): EmployeeInfo | null {
  if (!entry.hr_employees) return null;

  if (Array.isArray(entry.hr_employees)) {
    return entry.hr_employees[0] ?? null;
  }

  return entry.hr_employees;
}

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

function toDatetimeLocal(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);

  return localDate.toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function getStatusClass(status: string) {
  if (status === "approved") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  }

  if (status === "edited") {
    return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  }

  return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
}

function getWorkModeLabel(mode: string | null | undefined) {
  if (mode === "in_person") return "In Person";
  if (mode === "wfh") return "WFH";
  if (mode === "off") return "Off";
  return "No schedule";
}

function getMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "long",
  }).format(new Date(year, monthNumber - 1, 1));
}

function getPunctuality(entry: TimeEntry) {
  if (!entry.clock_in) {
    return {
      label: "No clock-in",
      status: "no_clock",
      minutesLate: 0,
    };
  }

  if (
    !entry.schedule ||
    entry.schedule.work_mode === "off" ||
    !entry.schedule.scheduled_start
  ) {
    return {
      label: "No schedule",
      status: "no_schedule",
      minutesLate: 0,
    };
  }

  const scheduledStart = new Date(
    `${entry.work_date}T${entry.schedule.scheduled_start}`
  );

  const actualClockIn = new Date(entry.clock_in);
  const graceMinutes = Number(entry.schedule.grace_minutes ?? 5);
  const allowedLatest = new Date(
    scheduledStart.getTime() + graceMinutes * 60000
  );

  if (actualClockIn.getTime() <= allowedLatest.getTime()) {
    return {
      label: "On time",
      status: "on_time",
      minutesLate: 0,
    };
  }

  const minutesLate = Math.max(
    Math.round((actualClockIn.getTime() - scheduledStart.getTime()) / 60000),
    0
  );

  return {
    label: `${minutesLate} min late`,
    status: "late",
    minutesLate,
  };
}

function punctualityClass(status: string) {
  if (status === "on_time") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }

  if (status === "late") {
    return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  }

  return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
}

export default function HRApprovalsPage() {
  const router = useRouter();

  const [month, setMonth] = useState(getCurrentMonth());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    clockIn: "",
    breakStart: "",
    breakEnd: "",
    clockOut: "",
    adminNote: "",
  });

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const employeeGroups = useMemo<EmployeeGroup[]>(() => {
    const map = new Map<string, EmployeeGroup>();

    entries.forEach((entry) => {
      const employee = getEmployee(entry);
      const employeeKey = entry.employee_id || "unknown";
      const punctuality = getPunctuality(entry);

      if (!map.has(employeeKey)) {
        map.set(employeeKey, {
          employeeId: employeeKey,
          employee,
          entries: [],
          totalMinutes: 0,
          totalHours: 0,
          totalShifts: 0,
          onTimeCount: 0,
          lateCount: 0,
          noScheduleCount: 0,
          pendingCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          editedCount: 0,
        });
      }

      const group = map.get(employeeKey);
      if (!group) return;

      group.entries.push(entry);
      group.totalMinutes += Number(entry.total_paid_minutes ?? 0);
      group.totalHours = group.totalMinutes / 60;
      group.totalShifts += entry.clock_in ? 1 : 0;

      if (punctuality.status === "on_time") group.onTimeCount += 1;
      if (punctuality.status === "late") group.lateCount += 1;
      if (punctuality.status === "no_schedule") group.noScheduleCount += 1;

      if (entry.status === "pending") group.pendingCount += 1;
      if (entry.status === "approved") group.approvedCount += 1;
      if (entry.status === "rejected") group.rejectedCount += 1;
      if (entry.status === "edited") group.editedCount += 1;
    });

    return Array.from(map.values()).sort((a, b) => {
      const nameA = a.employee
        ? `${a.employee.first_name} ${a.employee.last_name}`
        : "Unknown";
      const nameB = b.employee
        ? `${b.employee.first_name} ${b.employee.last_name}`
        : "Unknown";

      return nameA.localeCompare(nameB);
    });
  }, [entries]);

  const monthTotals = useMemo(() => {
    return employeeGroups.reduce(
      (totals, group) => {
        totals.employees += 1;
        totals.shifts += group.totalShifts;
        totals.minutes += group.totalMinutes;
        totals.onTime += group.onTimeCount;
        totals.late += group.lateCount;
        totals.pending += group.pendingCount;
        totals.approved += group.approvedCount;
        totals.rejected += group.rejectedCount;
        totals.edited += group.editedCount;

        return totals;
      },
      {
        employees: 0,
        shifts: 0,
        minutes: 0,
        onTime: 0,
        late: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        edited: 0,
      }
    );
  }, [employeeGroups]);

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

      const params = new URLSearchParams({
        month,
      });

      const response = await fetch(`/api/hr/time-entries?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const text = await response.text();

      let result: any = {};
      try {
        result = JSON.parse(text);
      } catch {
        result = { error: text };
      }

      if (!response.ok) {
        setError(result.error || "Unable to load time entries.");
        return;
      }

      setEntries(result.entries || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the approvals system."
      );
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

      const text = await response.text();

      let result: any = {};
      try {
        result = JSON.parse(text);
      } catch {
        result = { error: text };
      }

      if (!response.ok) {
        setError(result.error || "Unable to update time entry.");
        return;
      }

      setMessage(result.message || "Time entry updated.");
      await loadEntries();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update this time entry."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const openEdit = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditForm({
      clockIn: toDatetimeLocal(entry.clock_in),
      breakStart: toDatetimeLocal(entry.break_start),
      breakEnd: toDatetimeLocal(entry.break_end),
      clockOut: toDatetimeLocal(entry.clock_out),
      adminNote: entry.admin_note ?? "",
    });
    setError("");
    setMessage("");
  };

  const closeEdit = () => {
    setEditingEntry(null);
    setEditForm({
      clockIn: "",
      breakStart: "",
      breakEnd: "",
      clockOut: "",
      adminNote: "",
    });
  };

  const saveEdit = async () => {
    if (!editingEntry) return;

    setError("");
    setMessage("");
    setUpdatingId(editingEntry.id);

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
          mode: "edit",
          entryId: editingEntry.id,
          clockIn: fromDatetimeLocal(editForm.clockIn),
          breakStart: fromDatetimeLocal(editForm.breakStart),
          breakEnd: fromDatetimeLocal(editForm.breakEnd),
          clockOut: fromDatetimeLocal(editForm.clockOut),
          adminNote: editForm.adminNote,
        }),
      });

      const text = await response.text();

      let result: any = {};
      try {
        result = JSON.parse(text);
      } catch {
        result = { error: text };
      }

      if (!response.ok) {
        setError(result.error || "Unable to edit time entry.");
        return;
      }

      setMessage(result.message || "Time entry edited.");
      closeEdit();
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save edit.");
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [month]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl">
        <a
          href="/hr"
          className="mb-6 inline-block rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          ← Back to HR
        </a>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                HR Attendance
              </p>

              <h1 className="mt-3 text-3xl font-bold tracking-tight">
                Monthly Approvals
              </h1>

              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Review employee folders by month, track total hours, late
                arrivals, and approve entries for payroll.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
              />

              <button
                type="button"
                onClick={loadEntries}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Viewing: {getMonthLabel(month)}
            </p>
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

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Employees
              </p>
              <p className="mt-2 text-2xl font-bold">
                {monthTotals.employees}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Monthly Hours
              </p>
              <p className="mt-2 text-2xl font-bold">
                {formatHours(monthTotals.minutes)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                On Time
              </p>
              <p className="mt-2 text-2xl font-bold">{monthTotals.onTime}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Late
              </p>
              <p className="mt-2 text-2xl font-bold">{monthTotals.late}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Total Shifts
              </p>
              <p className="mt-2 text-2xl font-bold">{monthTotals.shifts}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Pending
              </p>
              <p className="mt-2 text-2xl font-bold">{monthTotals.pending}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Approved
              </p>
              <p className="mt-2 text-2xl font-bold">{monthTotals.approved}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Edited
              </p>
              <p className="mt-2 text-2xl font-bold">{monthTotals.edited}</p>
            </div>
          </div>

          {editingEntry && (
            <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold">Edit Time Entry</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Editing resets approval and marks this entry as edited.
                    Multiple-break editing will be added separately.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Clock In</label>
                  <input
                    type="datetime-local"
                    value={editForm.clockIn}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        clockIn: event.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Clock Out</label>
                  <input
                    type="datetime-local"
                    value={editForm.clockOut}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        clockOut: event.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Break Start</label>
                  <input
                    type="datetime-local"
                    value={editForm.breakStart}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        breakStart: event.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Break End</label>
                  <input
                    type="datetime-local"
                    value={editForm.breakEnd}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        breakEnd: event.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="text-sm font-medium">Admin Note</label>
                <textarea
                  value={editForm.adminNote}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      adminNote: event.target.value,
                    })
                  }
                  rows={3}
                  placeholder="Example: Employee forgot to clock out. Corrected based on supervisor confirmation."
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                />
              </div>

              <button
                type="button"
                onClick={saveEdit}
                disabled={updatingId === editingEntry.id}
                className="mt-5 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {updatingId === editingEntry.id ? "Saving..." : "Save Edit"}
              </button>
            </div>
          )}

          {loading ? (
            <p className="mt-8 text-sm text-slate-500">Loading entries...</p>
          ) : employeeGroups.length === 0 ? (
            <p className="mt-8 text-sm text-slate-500">
              No time entries found for this month.
            </p>
          ) : (
            <div className="mt-8 space-y-5">
              {employeeGroups.map((group) => {
                const isExpanded = expandedEmployeeId === group.employeeId;
                const employeeName = group.employee
                  ? `${group.employee.first_name} ${group.employee.last_name}`
                  : "Unknown Employee";

                return (
                  <div
                    key={group.employeeId}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedEmployeeId(
                          isExpanded ? null : group.employeeId
                        )
                      }
                      className="w-full text-left"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <h2 className="text-xl font-bold">{employeeName}</h2>

                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Code: {group.employee?.employee_code ?? "—"} ·{" "}
                            {group.employee?.department ?? "No department"} ·{" "}
                            {group.employee?.work_location ?? "No location"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {group.employee?.job_title ?? "No job title"}
                          </p>
                        </div>

                        <div className="grid gap-3 text-sm sm:grid-cols-4 xl:min-w-[620px]">
                          <div className="rounded-2xl bg-white p-3 dark:bg-slate-900">
                            <p className="text-xs text-slate-500">
                              Monthly Hours
                            </p>
                            <p className="mt-1 text-lg font-bold">
                              {group.totalHours.toFixed(2)}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-white p-3 dark:bg-slate-900">
                            <p className="text-xs text-slate-500">
                              Total Shifts
                            </p>
                            <p className="mt-1 text-lg font-bold">
                              {group.totalShifts}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-white p-3 dark:bg-slate-900">
                            <p className="text-xs text-slate-500">On Time</p>
                            <p className="mt-1 text-lg font-bold">
                              {group.onTimeCount}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-white p-3 dark:bg-slate-900">
                            <p className="text-xs text-slate-500">Late</p>
                            <p className="mt-1 text-lg font-bold">
                              {group.lateCount}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          Pending: {group.pendingCount}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          Approved: {group.approvedCount}
                        </span>
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                          Rejected: {group.rejectedCount}
                        </span>
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          Edited: {group.editedCount}
                        </span>
                        <span className="ml-auto rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          {isExpanded ? "Hide entries" : "View entries"}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-6 overflow-x-auto">
                        <table className="w-full min-w-[1200px] border-separate border-spacing-y-3 text-left text-sm">
                          <thead>
                            <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              <th className="px-4 py-2">Date</th>
                              <th className="px-4 py-2">Schedule</th>
                              <th className="px-4 py-2">Clock In</th>
                              <th className="px-4 py-2">Punctuality</th>
                              <th className="px-4 py-2">Breaks</th>
                              <th className="px-4 py-2">Clock Out</th>
                              <th className="px-4 py-2">Hours</th>
                              <th className="px-4 py-2">Status</th>
                              <th className="px-4 py-2">Actions</th>
                            </tr>
                          </thead>

                          <tbody>
                            {group.entries.map((entry) => {
                              const punctuality = getPunctuality(entry);

                              return (
                                <tr
                                  key={entry.id}
                                  className="rounded-2xl bg-white shadow-sm dark:bg-slate-900"
                                >
                                  <td className="rounded-l-2xl px-4 py-4 font-medium">
                                    {formatDate(entry.work_date)}
                                  </td>

                                  <td className="px-4 py-4">
                                    <div className="font-medium">
                                      {getWorkModeLabel(
                                        entry.schedule?.work_mode
                                      )}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      {entry.schedule?.scheduled_start
                                        ? entry.schedule.scheduled_start.slice(
                                            0,
                                            5
                                          )
                                        : "—"}{" "}
                                      →{" "}
                                      {entry.schedule?.scheduled_end
                                        ? entry.schedule.scheduled_end.slice(
                                            0,
                                            5
                                          )
                                        : "—"}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      Grace:{" "}
                                      {entry.schedule?.grace_minutes ?? "—"} min
                                    </div>
                                  </td>

                                  <td className="px-4 py-4">
                                    {formatTime(entry.clock_in)}
                                  </td>

                                  <td className="px-4 py-4">
                                    <span
                                      className={`rounded-full px-3 py-1 text-xs font-semibold ${punctualityClass(
                                        punctuality.status
                                      )}`}
                                    >
                                      {punctuality.label}
                                    </span>
                                  </td>

                                  <td className="px-4 py-4">
                                    {entry.hr_break_sessions &&
                                    entry.hr_break_sessions.length > 0 ? (
                                      <div className="space-y-1">
                                        {entry.hr_break_sessions.map(
                                          (breakSession, index) => (
                                            <div
                                              key={breakSession.id}
                                              className="text-xs"
                                            >
                                              Break {index + 1}:{" "}
                                              {formatTime(
                                                breakSession.break_start
                                              )}{" "}
                                              →{" "}
                                              {formatTime(
                                                breakSession.break_end
                                              )}
                                              <span className="ml-1 text-slate-500">
                                                (
                                                {breakSession.break_minutes ||
                                                  0}{" "}
                                                min)
                                              </span>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-xs">No breaks</div>
                                    )}

                                    <div className="mt-2 text-xs font-semibold text-slate-500">
                                      Total: {entry.total_break_minutes} min
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
                                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                                        entry.status
                                      )}`}
                                    >
                                      {entry.status}
                                    </span>
                                  </td>

                                  <td className="rounded-r-2xl px-4 py-4">
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={updatingId === entry.id}
                                        onClick={() => openEdit(entry)}
                                        className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                                      >
                                        Edit
                                      </button>

                                      <button
                                        type="button"
                                        disabled={updatingId === entry.id}
                                        onClick={() =>
                                          updateStatus(entry.id, "approved")
                                        }
                                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                      >
                                        Approve
                                      </button>

                                      <button
                                        type="button"
                                        disabled={updatingId === entry.id}
                                        onClick={() =>
                                          updateStatus(entry.id, "rejected")
                                        }
                                        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                                      >
                                        Reject
                                      </button>

                                      <button
                                        type="button"
                                        disabled={updatingId === entry.id}
                                        onClick={() =>
                                          updateStatus(entry.id, "pending")
                                        }
                                        className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
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
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
