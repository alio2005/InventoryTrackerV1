"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type EmployeeInfo = {
  first_name: string;
  last_name: string;
  employee_code: string;
  department: string | null;
  work_location: string | null;
  job_title: string | null;
  hourly_rate: number | null;
};

type PayrollEntry = {
  id: string;
  work_date: string;
  clock_in: string | null;
  break_start: string | null;
  break_end: string | null;
  clock_out: string | null;
  total_break_minutes: number;
  total_paid_minutes: number;
  status: string;
  hr_employees: EmployeeInfo | EmployeeInfo[] | null;
};

type PayrollSummary = {
  employeeCode: string;
  employeeName: string;
  department: string;
  location: string;
  jobTitle: string;
  hourlyRate: number;
  totalMinutes: number;
  totalHours: number;
  estimatedPay: number;
  entryCount: number;
};

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function getMonthStartDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
}

function getEmployee(entry: PayrollEntry): EmployeeInfo | null {
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

function formatHours(minutes: number) {
  return (minutes / 60).toFixed(2);
}

function csvEscape(value: string | number) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export default function PayrollPage() {
  const router = useRouter();

  const [startDate, setStartDate] = useState(getMonthStartDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const payrollSummary = useMemo(() => {
    const map = new Map<string, PayrollSummary>();

    entries.forEach((entry) => {
      const employee = getEmployee(entry);
      const employeeCode = employee?.employee_code ?? "Unknown";
      const employeeName = employee
        ? `${employee.first_name} ${employee.last_name}`
        : "Unknown Employee";

      const existing = map.get(employeeCode);

      if (existing) {
        existing.totalMinutes += entry.total_paid_minutes || 0;
        existing.totalHours = existing.totalMinutes / 60;
        existing.estimatedPay = existing.totalHours * existing.hourlyRate;
        existing.entryCount += 1;
      } else {
        const hourlyRate = Number(employee?.hourly_rate ?? 0);
        const totalMinutes = entry.total_paid_minutes || 0;
        const totalHours = totalMinutes / 60;

        map.set(employeeCode, {
          employeeCode,
          employeeName,
          department: employee?.department ?? "—",
          location: employee?.work_location ?? "—",
          jobTitle: employee?.job_title ?? "—",
          hourlyRate,
          totalMinutes,
          totalHours,
          estimatedPay: totalHours * hourlyRate,
          entryCount: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.employeeName.localeCompare(b.employeeName)
    );
  }, [entries]);

  const totalApprovedHours = payrollSummary.reduce(
    (sum, employee) => sum + employee.totalHours,
    0
  );

  const totalEstimatedPay = payrollSummary.reduce(
    (sum, employee) => sum + employee.estimatedPay,
    0
  );

  const loadPayroll = async () => {
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
        startDate,
        endDate,
      });

      const response = await fetch(`/api/hr/payroll?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Unable to load payroll records.");
        return;
      }

      setEntries(result.entries || []);
      setMessage("Payroll records loaded.");
    } catch {
      setError("Unable to connect to the payroll system.");
    } finally {
      setLoading(false);
    }
  };

  const exportSummaryCsv = () => {
    if (payrollSummary.length === 0) {
      setError("No approved payroll records to export.");
      return;
    }

    const headers = [
      "Employee Name",
      "Employee Code",
      "Department",
      "Location",
      "Job Title",
      "Approved Entries",
      "Total Hours",
      "Hourly Rate",
      "Estimated Pay",
      "Pay Period Start",
      "Pay Period End",
    ];

    const rows = payrollSummary.map((employee) => [
      employee.employeeName,
      employee.employeeCode,
      employee.department,
      employee.location,
      employee.jobTitle,
      employee.entryCount,
      employee.totalHours.toFixed(2),
      employee.hourlyRate.toFixed(2),
      employee.estimatedPay.toFixed(2),
      startDate,
      endDate,
    ]);

    const csvContent = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `payroll-summary-${startDate}-to-${endDate}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const exportDetailedCsv = () => {
    if (entries.length === 0) {
      setError("No detailed payroll records to export.");
      return;
    }

    const headers = [
      "Employee Name",
      "Employee Code",
      "Department",
      "Location",
      "Job Title",
      "Work Date",
      "Clock In",
      "Break Start",
      "Break End",
      "Clock Out",
      "Break Minutes",
      "Paid Hours",
      "Status",
    ];

    const rows = entries.map((entry) => {
      const employee = getEmployee(entry);

      return [
        employee ? `${employee.first_name} ${employee.last_name}` : "Unknown",
        employee?.employee_code ?? "—",
        employee?.department ?? "—",
        employee?.work_location ?? "—",
        employee?.job_title ?? "—",
        entry.work_date,
        formatTime(entry.clock_in),
        formatTime(entry.break_start),
        formatTime(entry.break_end),
        formatTime(entry.clock_out),
        entry.total_break_minutes,
        formatHours(entry.total_paid_minutes),
        entry.status,
      ];
    });

    const csvContent = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `payroll-details-${startDate}-to-${endDate}.csv`;
    link.click();

    URL.revokeObjectURL(url);
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                HR Attendance
              </p>

              <h1 className="mt-3 text-3xl font-bold tracking-tight">
                Payroll Export
              </h1>

              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Export approved employee hours for payroll processing.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={loadPayroll}
                disabled={loading}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                {loading ? "Loading..." : "Load Records"}
              </button>

              <button
                onClick={exportSummaryCsv}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Export Summary CSV
              </button>

              <button
                onClick={exportDetailedCsv}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Export Detailed CSV
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Pay Period Start
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Pay Period End
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
              />
            </div>
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

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Employees
              </p>
              <p className="mt-2 text-2xl font-bold">{payrollSummary.length}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Approved Hours
              </p>
              <p className="mt-2 text-2xl font-bold">
                {totalApprovedHours.toFixed(2)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Estimated Pay
              </p>
              <p className="mt-2 text-2xl font-bold">
                ${totalEstimatedPay.toFixed(2)}
              </p>
            </div>
          </div>

          {payrollSummary.length === 0 ? (
            <p className="mt-8 text-sm text-slate-500">
              No approved payroll records found for this date range.
            </p>
          ) : (
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[1000px] border-separate border-spacing-y-3 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-2">Employee</th>
                    <th className="px-4 py-2">Department</th>
                    <th className="px-4 py-2">Location</th>
                    <th className="px-4 py-2">Job Title</th>
                    <th className="px-4 py-2">Entries</th>
                    <th className="px-4 py-2">Hours</th>
                    <th className="px-4 py-2">Hourly Rate</th>
                    <th className="px-4 py-2">Estimated Pay</th>
                  </tr>
                </thead>

                <tbody>
                  {payrollSummary.map((employee) => (
                    <tr
                      key={employee.employeeCode}
                      className="rounded-2xl bg-slate-50 shadow-sm dark:bg-slate-800"
                    >
                      <td className="rounded-l-2xl px-4 py-4">
                        <div className="font-semibold">
                          {employee.employeeName}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Code: {employee.employeeCode}
                        </div>
                      </td>

                      <td className="px-4 py-4">{employee.department}</td>
                      <td className="px-4 py-4">{employee.location}</td>
                      <td className="px-4 py-4">{employee.jobTitle}</td>
                      <td className="px-4 py-4">{employee.entryCount}</td>
                      <td className="px-4 py-4 font-semibold">
                        {employee.totalHours.toFixed(2)}
                      </td>
                      <td className="px-4 py-4">
                        ${employee.hourlyRate.toFixed(2)}
                      </td>
                      <td className="rounded-r-2xl px-4 py-4 font-semibold">
                        ${employee.estimatedPay.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}