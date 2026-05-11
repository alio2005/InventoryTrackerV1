"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AppsPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setRole(profile?.role ?? "staff");
      setLoading(false);
    };

    loadUser();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <p className="text-sm text-slate-500">Loading apps...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Signed in as {email}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Choose an app
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Open the system you want to work in.
            </p>
          </div>

          <button
            onClick={handleSignOut}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Sign Out
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-3xl border border-slate-200 bg-white p-7 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-slate-800"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              Inventory
            </p>
            <h2 className="mt-4 text-2xl font-bold">Inventory Management</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Manage inventory, units, borrowed items, camp allocations,
              departments, locations, and item reports.
            </p>
          </button>

          <button
            onClick={() => router.push("/hr")}
            className="rounded-3xl border border-slate-200 bg-white p-7 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700 dark:hover:bg-slate-800"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
              HR
            </p>
            <h2 className="mt-4 text-2xl font-bold">HR Attendance</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Clock in, clock out, track breaks, request time off, report sick
              days, and prepare approved payroll hours.
            </p>
          </button>

          {role === "admin" && (
            <button
              onClick={() => router.push("/settings")}
              className="rounded-3xl border border-slate-200 bg-white p-7 text-left shadow-sm transition hover:border-rose-300 hover:bg-rose-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-rose-700 dark:hover:bg-slate-800"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-600 dark:text-rose-400">
                Admin
              </p>
              <h2 className="mt-4 text-2xl font-bold">Admin Settings</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Manage users, roles, permissions, and platform settings.
              </p>
            </button>
          )}
        </div>
      </div>
    </main>
  );
}