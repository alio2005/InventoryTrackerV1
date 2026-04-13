"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Transaction = {
  id: number;
  action: string;
  quantity_changed: number;
  note: string | null;
  created_at: string;
  inventory_items: {
    name: string;
  } | null;
};

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [message, setMessage] = useState("");

  const loadTransactions = async () => {
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { data, error } = await supabase
      .from("inventory_transactions")
      .select(
        `
        id,
        action,
        quantity_changed,
        note,
        created_at,
        inventory_items(name)
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    const safeTransactions = (data ?? []) as unknown as Transaction[];
    setTransactions(safeTransactions);
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const getActionStyle = (action: string) => {
    if (action === "check_in") {
      return "bg-emerald-100 text-emerald-700";
    }
    if (action === "check_out") {
      return "bg-blue-100 text-blue-700";
    }
    if (action === "archive") {
      return "bg-rose-100 text-rose-700";
    }
    if (action === "add") {
      return "bg-violet-100 text-violet-700";
    }
    return "bg-slate-100 text-slate-700";
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Inventory System</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Transactions
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Review inventory changes, check-ins, check-outs, additions, and archived items.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => router.push("/inventory")}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Back to Inventory
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center justify-center rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-300"
            >
              Dashboard
            </button>
          </div>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Activity history
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Latest inventory actions appear first.
              </p>
            </div>

            <div className="text-sm text-slate-500">
              Total records:{" "}
              <span className="font-medium text-slate-900">
                {transactions.length}
              </span>
            </div>
          </div>

          {message && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {message}
            </div>
          )}

          {transactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No transactions yet.
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="mb-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getActionStyle(
                            transaction.action
                          )}`}
                        >
                          {transaction.action}
                        </span>
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                          Qty Change: {transaction.quantity_changed}
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-slate-900">
                        {transaction.inventory_items?.name ?? "Unknown Item"}
                      </h3>

                      <p className="mt-2 text-sm text-slate-600">
                        {transaction.note ?? "No note"}
                      </p>
                    </div>

                    <div className="text-sm text-slate-500">
                      {new Date(transaction.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}