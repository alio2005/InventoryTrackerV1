"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type ScheduleRow = {
  id: number;
  borrower_name: string;
  borrower_email: string | null;
  quantity: number;
  start_date: string;
  end_date: string;
  status: "scheduled" | "checked_out" | "returned" | "cancelled";
  notes: string | null;
  created_at: string;
  inventory_items?: {
    name?: string | null;
  } | null;
};

export default function SchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<ScheduleRow[]>([]);

  const loadSchedule = async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("borrow_requests")
      .select(`
        id,
        borrower_name,
        borrower_email,
        quantity,
        start_date,
        end_date,
        status,
        notes,
        created_at,
        inventory_items (
          name
        )
      `)
      .gte("end_date", today)
      .in("status", ["scheduled", "checked_out"])
      .order("start_date", { ascending: true });

    if (error) {
      setMessage(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as ScheduleRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadSchedule();
  }, [router]);

  const formatDate = (value: string) => {
    return new Date(value + "T00:00:00").toLocaleDateString();
  };

  const getStatusClasses = (status: ScheduleRow["status"]) => {
    if (status === "scheduled") {
      return "bg-amber-100 text-amber-700";
    }

    if (status === "checked_out") {
      return "bg-blue-100 text-blue-700";
    }

    if (status === "returned") {
      return "bg-emerald-100 text-emerald-700";
    }

    return "bg-rose-100 text-rose-700";
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Inventory System
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Schedule
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              View upcoming and active borrowing requests without inventory conflicts.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadSchedule}
              className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Refresh
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Total Upcoming
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {rows.length}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Scheduled
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {rows.filter((row) => row.status === "scheduled").length}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Checked Out
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {rows.filter((row) => row.status === "checked_out").length}
            </p>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
            {message}
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Upcoming Borrowing</h2>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
              Loading schedule...
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
              No upcoming borrowing requests found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Item
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Borrower
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Quantity
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Start
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      End
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Notes
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-200 last:border-b-0 dark:border-slate-800"
                    >
                      <td className="px-6 py-4 text-sm font-medium">
                        {row.inventory_items?.name || "Unknown item"}
                      </td>

                      <td className="px-6 py-4 text-sm">
                        <div>{row.borrower_name}</div>
                        {row.borrower_email && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {row.borrower_email}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm">{row.quantity}</td>
                      <td className="px-6 py-4 text-sm">{formatDate(row.start_date)}</td>
                      <td className="px-6 py-4 text-sm">{formatDate(row.end_date)}</td>

                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(row.status)}`}
                        >
                          {row.status.replace("_", " ")}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {row.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}