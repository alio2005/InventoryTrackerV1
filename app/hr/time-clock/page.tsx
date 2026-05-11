"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TimeAction = "clock_in" | "break_start" | "break_end" | "clock_out";

export default function TimeClockPage() {
  const router = useRouter();

  const [employeeCode, setEmployeeCode] = useState("");
  const [loadingAction, setLoadingAction] = useState<TimeAction | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submitAction = async (action: TimeAction) => {
    setMessage("");
    setError("");
    setLoadingAction(action);

    try {
      const response = await fetch("/api/hr/time-clock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeCode,
          action,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Unable to save time clock action.");
        return;
      }

      setMessage(result.message || "Time clock action saved.");
    } catch {
      setError("Unable to connect to the time clock system.");
    } finally {
      setLoadingAction(null);
    }
  };

  const buttonClass =
    "rounded-2xl px-5 py-4 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => router.push("/hr")}
          className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          ← Back to HR
        </button>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
            HR Attendance
          </p>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            Staff Time Clock
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Enter your employee code, then choose the correct action.
          </p>

          <div className="mt-8">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Employee Code
            </label>

            <input
              value={employeeCode}
              onChange={(event) => setEmployeeCode(event.target.value)}
              placeholder="Example: 100001"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-lg font-semibold outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
            />
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

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <button
              disabled={!employeeCode || loadingAction !== null}
              onClick={() => submitAction("clock_in")}
              className={`${buttonClass} bg-emerald-600 hover:bg-emerald-700`}
            >
              {loadingAction === "clock_in" ? "Saving..." : "Clock In"}
            </button>

            <button
              disabled={!employeeCode || loadingAction !== null}
              onClick={() => submitAction("break_start")}
              className={`${buttonClass} bg-amber-600 hover:bg-amber-700`}
            >
              {loadingAction === "break_start" ? "Saving..." : "Start Break"}
            </button>

            <button
              disabled={!employeeCode || loadingAction !== null}
              onClick={() => submitAction("break_end")}
              className={`${buttonClass} bg-blue-600 hover:bg-blue-700`}
            >
              {loadingAction === "break_end" ? "Saving..." : "End Break"}
            </button>

            <button
              disabled={!employeeCode || loadingAction !== null}
              onClick={() => submitAction("clock_out")}
              className={`${buttonClass} bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white`}
            >
              {loadingAction === "clock_out" ? "Saving..." : "Clock Out"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}