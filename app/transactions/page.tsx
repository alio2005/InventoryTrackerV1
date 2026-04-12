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

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", padding: "24px", color: "black" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h1 style={{ fontSize: "30px", fontWeight: "bold", margin: 0 }}>
              Transactions
            </h1>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                onClick={() => router.push("/inventory")}
                style={{
                  backgroundColor: "black",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
              >
                Back to Inventory
              </button>

              <button
                onClick={() => router.push("/dashboard")}
                style={{
                  backgroundColor: "#374151",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
              >
                Dashboard
              </button>
            </div>
          </div>

          {message && <p style={{ marginBottom: "12px" }}>{message}</p>}

          {transactions.length === 0 ? (
            <p>No transactions yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: "12px",
                    padding: "16px",
                    backgroundColor: "white",
                  }}
                >
                  <p style={{ margin: "4px 0", fontWeight: "bold" }}>
                    Item: {transaction.inventory_items?.name ?? "Unknown Item"}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    Action: {transaction.action}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    Quantity Changed: {transaction.quantity_changed}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    Note: {transaction.note ?? "No note"}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    Date: {new Date(transaction.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}