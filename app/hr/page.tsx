"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type AccessState = {
  globalAdmin: boolean;
  inventory: boolean;
  inventoryAdmin: boolean;
  inventoryStaff: boolean;
  hr: boolean;
  hrAdmin: boolean;
  hrStaff: boolean;
  adminSettings: boolean;
};

const emptyAccess: AccessState = {
  globalAdmin: false,
  inventory: false,
  inventoryAdmin: false,
  inventoryStaff: false,
  hr: false,
  hrAdmin: false,
  hrStaff: false,
  adminSettings: false,
};

export default function HRPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<AccessState>(emptyAccess);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAccess = async () => {
      setError("");
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      try {
        const response = await fetch("/api/app-access", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.error || "Unable to load HR access.");
          return;
        }

        setEmail(result.email || session.user.email || "");
        setAccess(result.access || emptyAccess);
      } catch {
        setError("Unable to connect to the app access system.");
      } finally {
        setLoading(false);
      }
    };

    loadAccess();
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <p className="text-sm text-slate-500">Loading HR app...</p>
      </main>
    );
  }

  if (!access.hr && !access.globalAdmin) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={() => router.push("/apps")}
            className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            ← Back to apps
          </button>

          <section className="rounded-3xl border border-red-200 bg-red-50 p-8 shadow-sm dark:border-red-900 dark:bg-red-950">
            <h1 className="text-2xl font-bold text-red-700 dark:text-red-300">
              HR access required
            </h1>

            <p className="mt-3 text-sm text-red-700 dark:text-red-300">
              Your account does not have permission to access the HR Attendance
              app.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const canUseEmployeeTools =
    access.hrStaff || access.hrAdmin || access.globalAdmin;

  const canUseAdminTools = access.hrAdmin || access.globalAdmin;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => router.push("/apps")}
          className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          ← Back to apps
        </button>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
            HR Attendance
          </p>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            HR Attendance App
          </h1>

          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Signed in as {email}
          </p>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {canUseEmployeeTools && (
              <button
                type="button"
                onClick={() => router.push("/hr/time-clock")}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-emerald-700 dark:hover:bg-slate-900"
              >
                <h2 className="text-lg font-semibold">Time Clock</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Employees can clock in, clock out, start breaks, and end
                  breaks here.
                </p>
              </button>
            )}

            {canUseEmployeeTools && (
              <button
                type="button"
                onClick={() => router.push("/hr/my-hours")}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-emerald-700 dark:hover:bg-slate-900"
              >
                <h2 className="text-lg font-semibold">My Hours</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Employees can review their clocked hours and request statuses.
                </p>
              </button>
            )}

            {canUseEmployeeTools && (
              <button
                type="button"
                onClick={() => router.push("/hr/time-off")}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-emerald-700 dark:hover:bg-slate-900"
              >
                <h2 className="text-lg font-semibold">Time-Off Requests</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Employees can request sick days, vacation, emergency leave,
                  and unpaid time off.
                </p>
              </button>
            )}

            {canUseAdminTools && (
              <button
                type="button"
                onClick={() => router.push("/hr/approvals")}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-emerald-700 dark:hover:bg-slate-900"
              >
                <h2 className="text-lg font-semibold">Approvals</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  HR can review, edit, approve, and reject employee time
                  entries before payroll.
                </p>
              </button>
            )}

            {canUseAdminTools && (
              <button
                type="button"
                onClick={() => router.push("/hr/payroll")}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-emerald-700 dark:hover:bg-slate-900"
              >
                <h2 className="text-lg font-semibold">Payroll Export</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  HR can export approved hours for payroll processing.
                </p>
              </button>
            )}

            {canUseAdminTools && (
              <button
                type="button"
                onClick={() => router.push("/hr/employees")}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-emerald-700 dark:hover:bg-slate-900"
              >
                <h2 className="text-lg font-semibold">Employees</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  HR can manage employee codes, PINs, departments, locations,
                  job titles, and employment status.
                </p>
              </button>
            )}

            {canUseAdminTools && (
              <button
                type="button"
                onClick={() => router.push("/hr/audit-logs")}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-emerald-700 dark:hover:bg-slate-900"
              >
                <h2 className="text-lg font-semibold">Audit Logs</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  HR can review edits, approvals, rejections, resets, and
                  payroll-related activity.
                </p>
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}