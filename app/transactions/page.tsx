"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [searchTerm, setSearchTerm] = useState("");

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

  const filteredTransactions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) return transactions;

    return transactions.filter((transaction) => {
      const itemName = transaction.inventory_items?.name?.toLowerCase() ?? "";
      const action = transaction.action.toLowerCase();
      const note = transaction.note?.toLowerCase() ?? "";
      const quantity = String(transaction.quantity_changed);
      const date = new Date(transaction.created_at).toLocaleString().toLowerCase();

      return (
        itemName.includes(query) ||
        action.includes(query) ||
        note.includes(query) ||
        quantity.includes(query) ||
        date.includes(query)
      );
    });
  }, [transactions, searchTerm]);

  const getActionStyle = (action: string) => {
    if (action === "check_in") {
      return "bg-emerald-100 text-emerald-700";
    }
    if (action === "check_out") {
      return "bg-zinc-900 text-zinc-200";
    }
    if (action === "archive") {
      return "bg-rose-100 text-rose-700";
    }
    if (action === "add") {
      return "bg-zinc-900 text-zinc-200";
    }
    return "bg-zinc-900 text-zinc-300";
  };

  return (
    <main className="min-h-screen bg-black text-zinc-100 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Inventory System
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Transactions
            </h1>
            <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-300">
              Review inventory changes, sign-ins, sign-outs, additions, and archived items.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => router.push("/inventory")}
              className="inline-flex items-center justify-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Back to Inventory
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center justify-center rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-slate-300 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Dashboard
            </button>
          </div>
        </div>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Activity history
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Search by item, action, note, quantity, or date.
              </p>
            </div>

            <div className="w-full max-w-md">
              <label className="mb-2 block text-sm font-medium text-zinc-300 dark:text-zinc-300">
                Search transactions
              </label>
              <input
                type="text"
                placeholder="Search item, action, note, date..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-400 focus:bg-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:bg-zinc-900"
              />
            </div>
          </div>

          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              Total records:{" "}
              <span className="font-medium text-zinc-100 dark:text-zinc-100">
                {transactions.length}
              </span>
            </div>

            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              Matching results:{" "}
              <span className="font-medium text-zinc-100 dark:text-zinc-100">
                {filteredTransactions.length}
              </span>
            </div>
          </div>

          {message && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {message}
            </div>
          )}

          {filteredTransactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-black p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              No transactions match your search.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="rounded-3xl border border-zinc-800 bg-black p-5 transition hover:border-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
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
                        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 dark:bg-zinc-800 dark:text-zinc-200">
                          Qty Change: {transaction.quantity_changed}
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-zinc-100 dark:text-zinc-100">
                        {transaction.inventory_items?.name ?? "Unknown Item"}
                      </h3>

                      <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-300">
                        {transaction.note ?? "No note"}
                      </p>
                    </div>

                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
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