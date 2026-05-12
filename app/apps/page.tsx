"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type AccessState = {
  globalAdmin: boolean;
  inventory: boolean;
  hr: boolean;
  adminSettings: boolean;
};

const emptyAccess: AccessState = {
  globalAdmin: false,
  inventory: false,
  hr: false,
  adminSettings: false,
};

export default function AppsPage() {
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
          setError(result.error || "Unable to load app access.");
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

  const hasAnyApp =
    access.inventory || access.hr || access.adminSettings || access.globalAdmin;

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
              Only apps you have permission to access are shown.
            </p>
          </div>

          <button
            onClick={handleSignOut}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Sign Out
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {!hasAnyApp ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-bold">No app access assigned</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Your account is signed in, but no app permissions have been
              assigned yet. Ask an admin to add your app role.
            </p>
          </section>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {access.inventory && (
              <button
                onClick={() => router.push("/dashboard")}
                className="rounded-3xl border border-slate-200 bg-white p-7 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-slate-800"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                  Inventory
                </p>
                <h2 className="mt-4 text-2xl font-bold">
                  Inventory Management
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Manage inventory, units, borrowed items, departments,
                  locations, and item reports.
                </p>
              </button>
            )}

            {access.hr && (
              <button
                onClick={() => router.push("/hr")}
                className="rounded-3xl border border-slate-200 bg-white p-7 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700 dark:hover:bg-slate-800"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                  HR
                </p>
                <h2 className="mt-4 text-2xl font-bold">HR Attendance</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Clock in, clock out, track breaks, request time off, review
                  approvals, and prepare payroll hours.
                </p>
              </button>
            )}

            {access.adminSettings && (
              <button
                onClick={() => router.push("/settings/access")}
                className="rounded-3xl border border-slate-200 bg-white p-7 text-left shadow-sm transition hover:border-rose-300 hover:bg-rose-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-rose-700 dark:hover:bg-slate-800"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-600 dark:text-rose-400">
                  Admin
                </p>
                <h2 className="mt-4 text-2xl font-bold">Admin Settings</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Manage sign-ups, app access, roles, and platform permissions.
                </p>
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}