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

type TimeOffRequest = {
  id: string;
  request_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  hr_employees: EmployeeInfo | EmployeeInfo[] | null;
};

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function getEmployee(request: TimeOffRequest): EmployeeInfo | null {
  if (!request.hr_employees) return null;

  if (Array.isArray(request.hr_employees)) {
    return request.hr_employees[0] ?? null;
  }

  return request.hr_employees;
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

export default function TimeOffPage() {
  const router = useRouter();

  const [employeeCode, setEmployeeCode] = useState("");
  const [requestType, setRequestType] = useState("sick");
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [reason, setReason] = useState("");

  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [adminError, setAdminError] = useState("");

  const submitRequest = async () => {
    setMessage("");
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/hr/time-off", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeCode,
          requestType,
          startDate,
          endDate,
          reason,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Unable to submit request.");
        return;
      }

      setMessage(result.message || "Request submitted.");
      setReason("");
      await loadRequests(false);
    } catch {
      setError("Unable to connect to the time-off system.");
    } finally {
      setSubmitting(false);
    }
  };

  const loadRequests = async (showLoading = true) => {
    setAdminError("");

    if (showLoading) {
      setLoadingRequests(true);
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setAdminError("Sign in required to view admin requests.");
        return;
      }

      const response = await fetch("/api/hr/time-off", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        setAdminError(result.error || "Unable to load time-off requests.");
        return;
      }

      setRequests(result.requests || []);
    } catch {
      setAdminError("Unable to connect to the request approval system.");
    } finally {
      setLoadingRequests(false);
    }
  };

  const updateRequest = async (requestId: string, status: string) => {
    setMessage("");
    setError("");
    setAdminError("");
    setUpdatingId(requestId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const response = await fetch("/api/hr/time-off", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          requestId,
          status,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setAdminError(result.error || "Unable to update request.");
        return;
      }

      setMessage(result.message || "Request updated.");
      await loadRequests(false);
    } catch {
      setAdminError("Unable to update this request.");
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    loadRequests();
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

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
              HR Attendance
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight">
              Time-Off Request
            </h1>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Employees can request sick days, vacation, emergency leave, or
              unpaid time off.
            </p>

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

            <div className="mt-8 space-y-5">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Employee Code
                </label>
                <input
                  value={employeeCode}
                  onChange={(event) => setEmployeeCode(event.target.value)}
                  placeholder="Example: 100001"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Request Type
                </label>
                <select
                  value={requestType}
                  onChange={(event) => setRequestType(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                >
                  <option value="sick">Sick Day</option>
                  <option value="vacation">Vacation</option>
                  <option value="unpaid">Unpaid Time Off</option>
                  <option value="emergency">Emergency Leave</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Start Date
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
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Reason
                </label>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Optional note for HR..."
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
                />
              </div>

              <button
                onClick={submitRequest}
                disabled={!employeeCode || submitting}
                className="w-full rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                  HR Review
                </p>

                <h2 className="mt-3 text-2xl font-bold tracking-tight">
                  Request Approvals
                </h2>

                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Admins can approve or deny submitted requests.
                </p>
              </div>

              <button
                onClick={() => loadRequests()}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Refresh
              </button>
            </div>

            {adminError && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                {adminError}
              </div>
            )}

            {loadingRequests ? (
              <p className="mt-8 text-sm text-slate-500">
                Loading requests...
              </p>
            ) : requests.length === 0 ? (
              <p className="mt-8 text-sm text-slate-500">
                No time-off requests found yet.
              </p>
            ) : (
              <div className="mt-8 space-y-4">
                {requests.map((request) => {
                  const employee = getEmployee(request);

                  return (
                    <div
                      key={request.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold">
                              {employee
                                ? `${employee.first_name} ${employee.last_name}`
                                : "Unknown Employee"}
                            </h3>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                request.status === "approved"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                  : request.status === "denied"
                                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              }`}
                            >
                              {request.status}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Code: {employee?.employee_code ?? "—"} ·{" "}
                            {employee?.department ?? "No department"} ·{" "}
                            {employee?.work_location ?? "No location"}
                          </p>

                          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500">
                                Type
                              </p>
                              <p className="mt-1 font-medium capitalize">
                                {request.request_type}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500">
                                Dates
                              </p>
                              <p className="mt-1 font-medium">
                                {formatDate(request.start_date)} →{" "}
                                {formatDate(request.end_date)}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500">
                                Submitted
                              </p>
                              <p className="mt-1 font-medium">
                                {formatDate(
                                  request.created_at?.split("T")[0] ?? null
                                )}
                              </p>
                            </div>
                          </div>

                          {request.reason && (
                            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                              {request.reason}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            disabled={updatingId === request.id}
                            onClick={() =>
                              updateRequest(request.id, "approved")
                            }
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Approve
                          </button>

                          <button
                            disabled={updatingId === request.id}
                            onClick={() => updateRequest(request.id, "denied")}
                            className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                          >
                            Deny
                          </button>

                          <button
                            disabled={updatingId === request.id}
                            onClick={() =>
                              updateRequest(request.id, "pending")
                            }
                            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-700"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}