"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type ClosedBooking = {
  id: number;
  borrower_name: string;
  borrower_email: string | null;
  quantity: number;
  start_date: string;
  end_date: string;
  status: "returned" | "cancelled" | "declined";
  notes: string | null;
  created_at: string;
  inventory_items?: { name?: string | null } | null;
  inventory_units?: { unit_code?: string | null } | null;
};

export default function ClosedBookingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<ClosedBooking[]>([]);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "returned" | "cancelled" | "declined">("all");

  const loadBookings = async () => {
    setLoading(true);
    setMessage("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

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
        inventory_items ( name ),
        inventory_units ( unit_code )
      `)
      .in("status", ["returned", "cancelled", "declined"])
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setBookings((data ?? []) as ClosedBooking[]);
    setLoading(false);
  };

  useEffect(() => { loadBookings(); }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return bookings.filter((b) => {
      const matchStatus = statusFilter === "all" || b.status === statusFilter;
      if (!q) return matchStatus;
      const blob = [
        b.borrower_name,
        b.borrower_email ?? "",
        b.status,
        b.notes ?? "",
        Array.isArray(b.inventory_items) ? b.inventory_items[0]?.name ?? "" : (b.inventory_items as { name?: string | null } | null)?.name ?? "",
      ].join(" ").toLowerCase();
      return matchStatus && blob.includes(q);
    });
  }, [bookings, searchTerm, statusFilter]);

  const getItemName = (b: ClosedBooking) => {
    if (Array.isArray(b.inventory_items)) return b.inventory_items[0]?.name ?? "Unknown";
    return (b.inventory_items as { name?: string | null } | null)?.name ?? "Unknown";
  };

  const getUnitCode = (b: ClosedBooking) => {
    if (Array.isArray(b.inventory_units)) return b.inventory_units[0]?.unit_code ?? null;
    return (b.inventory_units as { unit_code?: string | null } | null)?.unit_code ?? null;
  };

  const formatDate = (v: string) => new Date(v + "T00:00:00").toLocaleDateString();

  const getStatusClasses = (status: string) => {
    if (status === "returned") return "bg-emerald-100 text-emerald-700";
    if (status === "cancelled") return "bg-slate-100 text-slate-700";
    if (status === "declined") return "bg-rose-100 text-rose-700";
    return "bg-slate-100 text-slate-700";
  };

  const returnedCount = bookings.filter((b) => b.status === "returned").length;
  const cancelledCount = bookings.filter((b) => b.status === "cancelled").length;
  const declinedCount = bookings.filter((b) => b.status === "declined").length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Inventory System</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Closed Bookings</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              View all returned, cancelled, and declined borrow requests.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => loadBookings()}
              className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Refresh
            </button>
            <Link
              href="/borrowed"
              className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700"
            >
              Open Bookings
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Returned</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-emerald-600">{returnedCount}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cancelled</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-600">{cancelledCount}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Declined</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-rose-600">{declinedCount}</p>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
            {message}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Search borrower, item, notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="all">All Statuses</option>
            <option value="returned">Returned</option>
            <option value="cancelled">Cancelled</option>
            <option value="declined">Declined</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h2 className="text-lg font-semibold">
              {filtered.length} closed booking{filtered.length !== 1 ? "s" : ""}
            </h2>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">No closed bookings found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    {["Item", "Unit", "Borrower", "Qty", "Borrowed", "Returned", "Status", "Notes", "Closed On"].map((h) => (
                      <th key={h} className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b.id} className="border-b border-slate-200 last:border-b-0 dark:border-slate-800">
                      <td className="px-6 py-4 text-sm font-medium">{getItemName(b)}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{getUnitCode(b) ?? "—"}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-medium">{b.borrower_name}</div>
                        {b.borrower_email && <div className="text-xs text-slate-500">{b.borrower_email}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm">{b.quantity}</td>
                      <td className="px-6 py-4 text-sm">{formatDate(b.start_date)}</td>
                      <td className="px-6 py-4 text-sm">{formatDate(b.end_date)}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(b.status)}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{b.notes ?? "—"}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                        {new Date(b.created_at).toLocaleDateString()}
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
