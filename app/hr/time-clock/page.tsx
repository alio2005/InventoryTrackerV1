"use client";

import { useState } from "react";

type TimeAction = "clock_in" | "break_start" | "break_end" | "clock_out";

const actionLabels: Record<TimeAction, string> = {
  clock_in: "Clock In",
  break_start: "Start Break",
  break_end: "End Break",
  clock_out: "Clock Out",
};

export default function TimeClockPage() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
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
          pin,
          action,
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
        setError(result.error || `Request failed with status ${response.status}`);
        return;
      }

      setMessage(result.message || `${actionLabels[action]} saved.`);
      setPin("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the time clock system."
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const isDisabled = !employeeCode || !pin || loadingAction !== null;

  const baseButtonClass =
    "min-h-[72px] rounded-3xl px-5 py-5 text-base font-bold text-white shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <a
          href="/hr"
          className="mb-5 inline-block rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          ← Back to HR
        </a>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
            HR Attendance
          </p>

          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Staff Time Clock
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-base">
            Enter your employee code and PIN, then choose the correct action.
          </p>

          <div className="mt-8 space-y-5">
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Employee Code
              </label>

              <input
                value={employeeCode}
                onChange={(event) => setEmployeeCode(event.target.value)}
                placeholder="Example: 100001"
                inputMode="numeric"
                autoComplete="off"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-5 py-5 text-xl font-bold outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                PIN
              </label>

              <input
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                placeholder="Enter your PIN"
                inputMode="numeric"
                maxLength={6}
                type="password"
                autoComplete="off"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-5 py-5 text-xl font-bold outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
              />
            </div>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => submitAction("clock_in")}
              className={`${baseButtonClass} bg-emerald-600 hover:bg-emerald-700`}
            >
              {loadingAction === "clock_in" ? "Saving..." : "Clock In"}
            </button>

            <button
              type="button"
              disabled={isDisabled}
              onClick={() => submitAction("break_start")}
              className={`${baseButtonClass} bg-amber-600 hover:bg-amber-700`}
            >
              {loadingAction === "break_start" ? "Saving..." : "Start Break"}
            </button>

            <button
              type="button"
              disabled={isDisabled}
              onClick={() => submitAction("break_end")}
              className={`${baseButtonClass} bg-blue-600 hover:bg-blue-700`}
            >
              {loadingAction === "break_end" ? "Saving..." : "End Break"}
            </button>

            <button
              type="button"
              disabled={isDisabled}
              onClick={() => submitAction("clock_out")}
              className={`${baseButtonClass} bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white`}
            >
              {loadingAction === "clock_out" ? "Saving..." : "Clock Out"}
            </button>
          </div>

          <div className="mt-8 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              Reminder
            </p>
            <p className="mt-1">
              Always clock in before starting work, end active breaks before
              clocking out, and contact HR if you forget to clock out.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}