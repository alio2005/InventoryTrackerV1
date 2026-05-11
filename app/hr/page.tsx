"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function HRPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      }

      setEmail(user.email ?? "");
      setLoading(false);
    };

    loadUser();
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <p className="text-sm text-slate-500">Loading HR app...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl">
        <button
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

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <button
              onClick={() => router.push("/hr/time-clock")}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-emerald-700 dark:hover:bg-slate-900"
            >
              <h2 className="text-lg font-semibold">Time Clock</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Employees can clock in, clock out, start breaks, and end breaks
                here.
              </p>
            </button>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
              <h2 className="text-lg font-semibold">Time-Off Requests</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Employees will request sick days, vacation, and unpaid time off.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
              <h2 className="text-lg font-semibold">My Hours</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Employees will review their worked hours before HR approval.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800">
              <h2 className="text-lg font-semibold">Payroll Export</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                HR will export approved hours for payroll.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}