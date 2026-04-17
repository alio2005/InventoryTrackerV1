"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type InventoryItem = {
  id: number;
  name: string;
  quantity: number;
  is_active: boolean;
};

type BorrowRequestStatus = "scheduled" | "checked_out" | "returned" | "cancelled";

type BorrowRequestRow = {
  id: number;
  borrower_name: string;
  borrower_email: string | null;
  quantity: number;
  start_date: string;
  end_date: string;
  status: BorrowRequestStatus;
  notes: string | null;
  created_at: string;
  inventory_items?: { name?: string | null } | { name?: string | null }[] | null;
};

export default function BorrowedPage() {
  const router = useRouter();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rowActionId, setRowActionId] = useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const [email, setEmail] = useState("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [requests, setRequests] = useState<BorrowRequestRow[]>([]);
  const [availableForDates, setAvailableForDates] = useState<number | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [itemId, setItemId] = useState("");
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerEmail, setBorrowerEmail] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [notes, setNotes] = useState("");

  const activeStartDate = mode === "now" ? today : startDate;

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage(text);
    setMessageType(type);
  };

  const clearMessage = () => {
    setMessage("");
  };

  const getItemName = (row: BorrowRequestRow) => {
    if (Array.isArray(row.inventory_items)) {
      return row.inventory_items[0]?.name || "Unknown item";
    }
    return row.inventory_items?.name || "Unknown item";
  };

  const formatDate = (value: string) => {
    return new Date(value + "T00:00:00").toLocaleDateString();
  };

  const getStatusClasses = (status: BorrowRequestStatus) => {
    if (status === "scheduled") return "bg-amber-100 text-amber-700";
    if (status === "checked_out") return "bg-blue-100 text-blue-700";
    if (status === "returned") return "bg-emerald-100 text-emerald-700";
    return "bg-rose-100 text-rose-700";
  };

  const loadPage = async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    clearMessage();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    setEmail(user.email ?? "");

    const { data: inventoryData, error: inventoryError } = await supabase
      .from("inventory_items")
      .select("id, name, quantity, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (inventoryError) {
      showMessage(inventoryError.message, "error");
      setItems([]);
      setRequests([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: requestData, error: requestError } = await supabase
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
      .in("status", ["scheduled", "checked_out"])
      .order("start_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (requestError) {
      showMessage(requestError.message, "error");
      setItems((inventoryData ?? []) as InventoryItem[]);
      setRequests([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const safeItems = (inventoryData ?? []) as InventoryItem[];
    const safeRequests = (requestData ?? []) as BorrowRequestRow[];

    setItems(safeItems);
    setRequests(safeRequests);

    if (!itemId && safeItems.length > 0) {
      setItemId(String(safeItems[0].id));
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadPage();
  }, [router]);

  useEffect(() => {
    const checkAvailability = async () => {
      if (!itemId || !activeStartDate || !endDate) {
        setAvailableForDates(null);
        return;
      }

      setCheckingAvailability(true);

      const { data, error } = await supabase.rpc("get_item_available_for_dates", {
        p_inventory_item_id: Number(itemId),
        p_start_date: activeStartDate,
        p_end_date: endDate,
      });

      if (error) {
        setAvailableForDates(null);
        setCheckingAvailability(false);
        return;
      }

      setAvailableForDates(Number(data ?? 0));
      setCheckingAvailability(false);
    };

    checkAvailability();
  }, [itemId, activeStartDate, endDate]);

  const resetForm = () => {
    setMode("now");
    setBorrowerName("");
    setBorrowerEmail("");
    setQuantity("1");
    setStartDate(today);
    setEndDate(today);
    setNotes("");
    if (items.length > 0) {
      setItemId(String(items[0].id));
    } else {
      setItemId("");
    }
  };

  const handleCreateRequest = async () => {
    clearMessage();
    setSubmitting(true);

    const qty = Number(quantity);

    if (!itemId) {
      showMessage("Please select an item.", "error");
      setSubmitting(false);
      return;
    }

    if (!borrowerName.trim()) {
      showMessage("Please enter the borrower name.", "error");
      setSubmitting(false);
      return;
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      showMessage("Quantity must be a whole number greater than 0.", "error");
      setSubmitting(false);
      return;
    }

    if (!activeStartDate || !endDate) {
      showMessage("Please choose valid dates.", "error");
      setSubmitting(false);
      return;
    }

    if (endDate < activeStartDate) {
      showMessage("End date cannot be earlier than start date.", "error");
      setSubmitting(false);
      return;
    }

    if (mode === "schedule" && activeStartDate < today) {
      showMessage("Scheduled borrowing must start today or later.", "error");
      setSubmitting(false);
      return;
    }

    const { data: available, error: availableError } = await supabase.rpc(
      "get_item_available_for_dates",
      {
        p_inventory_item_id: Number(itemId),
        p_start_date: activeStartDate,
        p_end_date: endDate,
      }
    );

    if (availableError) {
      showMessage(availableError.message, "error");
      setSubmitting(false);
      return;
    }

    const availableCount = Number(available ?? 0);

    if (qty > availableCount) {
      showMessage(`Only ${availableCount} item(s) are available for those dates.`, "error");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.rpc("create_borrow_request", {
      p_inventory_item_id: Number(itemId),
      p_borrower_name: borrowerName.trim(),
      p_borrower_email: borrowerEmail.trim() || null,
      p_quantity: qty,
      p_start_date: activeStartDate,
      p_end_date: endDate,
      p_notes: notes.trim() || null,
    });

    if (error) {
      showMessage(error.message, "error");
      setSubmitting(false);
      return;
    }

    showMessage(
      mode === "now"
        ? "Item checked out successfully."
        : "Borrowing scheduled successfully.",
      "success"
    );

    resetForm();
    await loadPage(true);
    setSubmitting(false);
  };

  const updateRequestStatus = async (
    id: number,
    status: "checked_out" | "returned" | "cancelled"
  ) => {
    clearMessage();
    setRowActionId(id);

    const { error } = await supabase
      .from("borrow_requests")
      .update({ status })
      .eq("id", id);

    if (error) {
      showMessage(error.message, "error");
      setRowActionId(null);
      return;
    }

    if (status === "returned") {
      showMessage("Borrowed item marked as returned.", "success");
    } else if (status === "cancelled") {
      showMessage("Scheduled request cancelled.", "success");
    } else {
      showMessage("Scheduled request checked out.", "success");
    }

    await loadPage(true);
    setRowActionId(null);
  };

  const scheduledCount = requests.filter((row) => row.status === "scheduled").length;
  const checkedOutCount = requests.filter((row) => row.status === "checked_out").length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Inventory System
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Borrowed Items
            </h1>
            <div className="mt-2 flex flex-col gap-1 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:gap-6">
              <span>
                Signed in as:{" "}
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {email}
                </span>
              </span>
              <span>
                Live borrow + future schedule in one page
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => loadPage(true)}
              disabled={refreshing}
              className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={() => router.push("/schedule")}
              className="rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700"
            >
              Open Schedule
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
              Total Open Requests
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {requests.length}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Scheduled
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {scheduledCount}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Checked Out
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {checkedOutCount}
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 rounded-2xl px-4 py-3 text-sm ${
              messageType === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
            }`}
          >
            {message}
          </div>
        )}

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5">
              <h2 className="text-xl font-semibold tracking-tight">
                Create Borrow Request
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Borrow now or reserve for a future date without double-booking inventory.
              </p>
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => {
                  setMode("now");
                  setStartDate(today);
                  if (endDate < today) setEndDate(today);
                }}
                className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  mode === "now"
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                Borrow Now
              </button>

              <button
                onClick={() => {
                  setMode("schedule");
                  if (startDate < today) setStartDate(today);
                  if (endDate < today) setEndDate(today);
                }}
                className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  mode === "schedule"
                    ? "bg-violet-600 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                Schedule for Later
              </button>
            </div>

            <div className="grid gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Item
                </label>
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-800"
                >
                  {items.length === 0 ? (
                    <option value="">No active inventory items</option>
                  ) : (
                    items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — Total stock: {item.quantity}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Borrower Name
                  </label>
                  <input
                    type="text"
                    value={borrowerName}
                    onChange={(e) => setBorrowerName(e.target.value)}
                    placeholder="Enter borrower name"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-800"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Borrower Email
                  </label>
                  <input
                    type="email"
                    value={borrowerEmail}
                    onChange={(e) => setBorrowerEmail(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-800"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {mode === "now" ? "Borrow Date" : "Start Date"}
                  </label>
                  <input
                    type="date"
                    value={activeStartDate}
                    disabled={mode === "now"}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={today}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-800"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Expected Return Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={activeStartDate}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional notes"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-800"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Availability Preview
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {checkingAvailability
                    ? "Checking availability..."
                    : availableForDates === null
                    ? "Choose an item and valid dates to preview."
                    : `${availableForDates} item(s) available for the selected date range.`}
                </p>
              </div>

              <button
                onClick={handleCreateRequest}
                disabled={submitting || items.length === 0}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {submitting
                  ? "Saving..."
                  : mode === "now"
                  ? "Borrow Now"
                  : "Schedule Borrowing"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5">
              <h2 className="text-xl font-semibold tracking-tight">
                How this works
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                This page checks date conflicts before creating a request.
              </p>
            </div>

            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  Borrow Now
                </p>
                <p className="mt-1">
                  Creates a request starting today. The status becomes{" "}
                  <span className="font-medium">checked_out</span>.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  Schedule for Later
                </p>
                <p className="mt-1">
                  Creates a future reservation. The status stays{" "}
                  <span className="font-medium">scheduled</span> until checked out.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  Conflict Protection
                </p>
                <p className="mt-1">
                  The page checks overlapping date ranges before saving, so the same stock
                  cannot be double-booked.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  Return Flow
                </p>
                <p className="mt-1">
                  When an item comes back, mark it as returned in the table below.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h2 className="text-lg font-semibold">Open Borrow Requests</h2>
          </div>

          {loading ? (
            <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
              Loading borrowed items...
            </div>
          ) : requests.length === 0 ? (
            <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
              No open borrow requests found.
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
                      Qty
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
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {requests.map((row) => {
                    const canCheckOut =
                      row.status === "scheduled" && row.start_date <= today;

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-slate-200 last:border-b-0 dark:border-slate-800"
                      >
                        <td className="px-6 py-4 text-sm font-medium">
                          {getItemName(row)}
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
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                              row.status
                            )}`}
                          >
                            {row.status.replace("_", " ")}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {row.notes || "—"}
                        </td>

                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-wrap gap-2">
                            {canCheckOut && (
                              <button
                                onClick={() => updateRequestStatus(row.id, "checked_out")}
                                disabled={rowActionId === row.id}
                                className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {rowActionId === row.id ? "Saving..." : "Check Out"}
                              </button>
                            )}

                            {row.status === "checked_out" && (
                              <button
                                onClick={() => updateRequestStatus(row.id, "returned")}
                                disabled={rowActionId === row.id}
                                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {rowActionId === row.id ? "Saving..." : "Mark Returned"}
                              </button>
                            )}

                            {row.status === "scheduled" && (
                              <button
                                onClick={() => updateRequestStatus(row.id, "cancelled")}
                                disabled={rowActionId === row.id}
                                className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {rowActionId === row.id ? "Saving..." : "Cancel"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}