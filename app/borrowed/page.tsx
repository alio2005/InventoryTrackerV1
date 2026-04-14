"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createNotificationsForUserAndAdmins } from "@/lib/notifications";
import { useRouter } from "next/navigation";

type BorrowedItem = {
  id: number;
  item_id: number;
  borrower_email: string;
  borrower_name: string | null;
  quantity: number;
  comment: string | null;
  expected_return_date: string | null;
  returned: boolean;
  returned_at: string | null;
  created_at: string;
  inventory_items: {
    name: string;
    quantity?: number;
  } | null;
};

export default function BorrowedPage() {
  const router = useRouter();

  const [borrowedItems, setBorrowedItems] = useState<BorrowedItem[]>([]);
  const [message, setMessage] = useState("");
  const [role, setRole] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  const loadBorrowedItems = async () => {
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    setRole(profile?.role ?? "");

    const { data, error } = await supabase
      .from("borrowed_items")
      .select(
        `
        id,
        item_id,
        borrower_email,
        borrower_name,
        quantity,
        comment,
        expected_return_date,
        returned,
        returned_at,
        created_at,
        inventory_items(name)
      `
      )
      .eq("returned", false)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    const safeBorrowedItems = (data ?? []) as unknown as BorrowedItem[];
    setBorrowedItems(safeBorrowedItems);
  };

  useEffect(() => {
    loadBorrowedItems();
  }, []);

  const handleReturn = async (borrowedItem: BorrowedItem) => {
    setMessage("");

    if (role !== "admin") {
      setMessage("Only admins can process returns.");
      return;
    }

    setProcessingId(borrowedItem.id);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      setProcessingId(null);
      return;
    }

    const { data: currentItem, error: itemFetchError } = await supabase
      .from("inventory_items")
      .select("id, quantity")
      .eq("id", borrowedItem.item_id)
      .single();

    if (itemFetchError || !currentItem) {
      setMessage(itemFetchError?.message || "Could not find inventory item.");
      setProcessingId(null);
      return;
    }

    const newQuantity =
      Number(currentItem.quantity) + Number(borrowedItem.quantity);

    const { error: updateInventoryError } = await supabase
      .from("inventory_items")
      .update({ quantity: newQuantity })
      .eq("id", borrowedItem.item_id);

    if (updateInventoryError) {
      setMessage(updateInventoryError.message);
      setProcessingId(null);
      return;
    }

    const { error: returnUpdateError } = await supabase
      .from("borrowed_items")
      .update({
        returned: true,
        returned_at: new Date().toISOString(),
      })
      .eq("id", borrowedItem.id);

    if (returnUpdateError) {
      setMessage(returnUpdateError.message);
      setProcessingId(null);
      return;
    }

    const returnNote = `Returned by ${
      borrowedItem.borrower_name || borrowedItem.borrower_email
    }`;

    const { error: transactionError } = await supabase
      .from("inventory_transactions")
      .insert({
        item_id: borrowedItem.item_id,
        user_id: user.id,
        action: "check_in",
        quantity_changed: borrowedItem.quantity,
        note: returnNote,
      });

    if (transactionError) {
      setMessage(transactionError.message);
      setProcessingId(null);
      return;
    }

    await createNotificationsForUserAndAdmins({
      title: "Borrowed item returned",
      message: `${
        borrowedItem.inventory_items?.name ?? "Item"
      } was returned by ${
        borrowedItem.borrower_name || borrowedItem.borrower_email
      } with quantity ${borrowedItem.quantity}.`,
      currentUserId: user.id,
    });

    setMessage(
      `${borrowedItem.inventory_items?.name ?? "Item"} returned successfully.`
    );
    setProcessingId(null);
    await loadBorrowedItems();
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Inventory System
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Borrowed Items
            </h1>
            <div className="mt-3 flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300 sm:flex-row sm:gap-6">
              <span>
                Role:{" "}
                <span className="font-medium capitalize">
                  {role || "unknown"}
                </span>
              </span>
              <span>
                Open Borrow Records:{" "}
                <span className="font-medium">{borrowedItems.length}</span>
              </span>
            </div>
          </div>

          <button
            onClick={() => router.push("/inventory")}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Back to Inventory
          </button>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Current borrowed items
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Review active sign-outs and return borrowed products.
              </p>
            </div>
          </div>

          {message && (
            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {message}
            </div>
          )}

          <div className="space-y-5">
            {borrowedItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                No borrowed items right now.
              </div>
            ) : (
              borrowedItems.map((borrowedItem) => (
                <div
                  key={borrowedItem.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight">
                        {borrowedItem.inventory_items?.name ?? "Unknown Item"}
                      </h3>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                          Qty: {borrowedItem.quantity}
                        </span>
                        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                          {borrowedItem.borrower_name || "Unknown Borrower"}
                        </span>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                          Due: {borrowedItem.expected_return_date || "No date"}
                        </span>
                      </div>

                      <div className="mt-4 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                        <p>
                          Borrower Email:{" "}
                          <span className="font-medium">
                            {borrowedItem.borrower_email}
                          </span>
                        </p>
                        <p>
                          Comment:{" "}
                          <span className="font-medium">
                            {borrowedItem.comment || "No comment"}
                          </span>
                        </p>
                        <p>
                          Signed Out On:{" "}
                          <span className="font-medium">
                            {new Date(borrowedItem.created_at).toLocaleString()}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-start gap-3">
                      <button
                        onClick={() => handleReturn(borrowedItem)}
                        disabled={processingId === borrowedItem.id}
                        className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-white transition ${
                          processingId === borrowedItem.id
                            ? "cursor-not-allowed bg-slate-400"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                      >
                        {processingId === borrowedItem.id
                          ? "Returning..."
                          : "Return Item"}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}