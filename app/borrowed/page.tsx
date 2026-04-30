"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type InventoryItem = {
  id: number;
  name: string;
  quantity: number;
  is_active: boolean;
};
type InventoryUnit = {
  id: number;
  inventory_item_id: number;
  unit_code: string;
  phone_number: string | null;
  serial_number: string | null;
  imei: string | null;
  status: string;
};

type BorrowRequestStatus =
  | "pending"
  | "scheduled"
  | "checked_out"
  | "returned"
  | "cancelled"
  | "declined";

type RecurrencePattern = "weekly" | "biweekly" | "monthly";

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
  recurrence_group_id: string | null;
  recurrence_pattern: string | null;
  recurrence_occurrence: number | null;
  recurrence_total: number | null;
  inventory_items?: { name?: string | null } | { name?: string | null }[] | null;
  inventory_unit_id: number | null;
  inventory_units?:
  | {
      unit_code?: string | null;
      serial_number?: string | null;
      imei?: string | null;
      phone_number?: string | null;
    }
  | {
      unit_code?: string | null;
      serial_number?: string | null;
      imei?: string | null;
      phone_number?: string | null;
    }[]
  | null;
};

export default function BorrowedPage() {
  const router = useRouter();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rowActionId, setRowActionId] = useState<number | null>(null);
  const [seriesActionGroupId, setSeriesActionGroupId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [unitId, setUnitId] = useState("");
  const [requests, setRequests] = useState<BorrowRequestRow[]>([]);
  const [availableForDates, setAvailableForDates] = useState<number | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [requestType, setRequestType] = useState<"single" | "recurring">("single");

  const [itemId, setItemId] = useState("");
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerEmail, setBorrowerEmail] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [notes, setNotes] = useState("");

  const [recurrencePattern, setRecurrencePattern] =
    useState<RecurrencePattern>("weekly");
  const [occurrenceCount, setOccurrenceCount] = useState("4");

  const activeStartDate = mode === "now" ? today : startDate;
  const availableUnitsForSelectedItem = units.filter(
  (unit) => String(unit.inventory_item_id) === itemId && unit.status === "available"
);

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
  const getUnitLabel = (row: BorrowRequestRow) => {
  const unit = Array.isArray(row.inventory_units)
    ? row.inventory_units[0]
    : row.inventory_units;

  if (!unit?.unit_code) {
    return "No specific unit";
  }

  return [
    unit.unit_code,
    unit.serial_number ? `Serial: ${unit.serial_number}` : "",
    unit.imei ? `IMEI: ${unit.imei}` : "",
    unit.phone_number ? `Phone: ${unit.phone_number}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
};

  const formatDate = (value: string) => {
    return new Date(value + "T00:00:00").toLocaleDateString();
  };

  const getStatusClasses = (status: BorrowRequestStatus) => {
    if (status === "pending") return "bg-orange-100 text-orange-700";
    if (status === "scheduled") return "bg-amber-100 text-amber-700";
    if (status === "checked_out") return "bg-blue-100 text-blue-700";
    if (status === "returned") return "bg-emerald-100 text-emerald-700";
    if (status === "declined") return "bg-rose-100 text-rose-700";
    return "bg-slate-100 text-slate-700";
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    setRole(profile?.role ?? "");

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
    const { data: unitData, error: unitError } = await supabase
  .from("inventory_units")
  .select("id, inventory_item_id, unit_code, phone_number, serial_number, imei, status")
  .eq("status", "available")
  .order("unit_code", { ascending: true });

if (unitError) {
  showMessage(unitError.message, "error");
  setUnits([]);
} else {
  setUnits((unitData ?? []) as InventoryUnit[]);
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
  recurrence_group_id,
  recurrence_pattern,
  recurrence_occurrence,
  recurrence_total,
  inventory_unit_id,
  inventory_items ( name ),
  inventory_units ( unit_code, serial_number, imei, phone_number )
`)
      .in("status", ["pending", "scheduled", "checked_out"])
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
  }, []);
  
  useEffect(() => {
  setUnitId("");
}, [itemId]);

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
  setRequestType("single");
  setBorrowerName("");
  setBorrowerEmail("");
  setQuantity("1");
  setStartDate(today);
  setEndDate(today);
  setNotes("");
  setRecurrencePattern("weekly");
  setOccurrenceCount("4");
  setUnitId("");

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
    const totalOccurrences = Number(occurrenceCount);

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
    if (unitId && qty !== 1) {
  showMessage("Specific unit borrowing must use quantity 1.", "error");
  setSubmitting(false);
  return;
}

if (unitId && requestType === "recurring") {
  showMessage("Specific units can only be used for one-time requests.", "error");
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

    if (qty > availableCount && activeStartDate <= today) {
      showMessage(`Only ${availableCount} item(s) are available for those dates.`, "error");
      setSubmitting(false);
      return;
    }
    if (unitId && requestType === "single") {
  const selectedUnit = units.find((unit) => String(unit.id) === unitId);

  const { error: requestError } = await supabase.from("borrow_requests").insert({
    inventory_item_id: Number(itemId),
    inventory_unit_id: Number(unitId),
    borrower_name: borrowerName.trim(),
    borrower_email: borrowerEmail.trim() || null,
    quantity: 1,
    start_date: activeStartDate,
    end_date: endDate,
    status: mode === "now" ? "checked_out" : "pending",
    notes: notes.trim() || null,
  });

  if (requestError) {
    showMessage(requestError.message, "error");
    setSubmitting(false);
    return;
  }

  if (mode === "now") {
    const { error: unitUpdateError } = await supabase
  .from("inventory_units")
  .update({ status: "borrowed" })
  .eq("id", Number(unitId));

if (unitUpdateError) {
  showMessage(unitUpdateError.message, "error");
  setSubmitting(false);
  return;
}
  }

  showMessage(
    mode === "now"
      ? `${selectedUnit?.unit_code ?? "Unit"} checked out successfully.`
      : `${selectedUnit?.unit_code ?? "Unit"} borrow request submitted for approval.`,
    "success"
  );

  resetForm();
  await loadPage(true);
  setSubmitting(false);
  return;
}

    if (requestType === "single") {
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
          : "Borrow request submitted for approval.",
        "success"
      );
    } else {
      if (!Number.isInteger(totalOccurrences) || totalOccurrences < 1 || totalOccurrences > 52) {
        showMessage("Occurrences must be a whole number between 1 and 52.", "error");
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.rpc("create_recurring_borrow_requests", {
        p_inventory_item_id: Number(itemId),
        p_borrower_name: borrowerName.trim(),
        p_borrower_email: borrowerEmail.trim() || null,
        p_quantity: qty,
        p_first_start_date: activeStartDate,
        p_first_end_date: endDate,
        p_frequency: recurrencePattern,
        p_occurrence_count: totalOccurrences,
        p_notes: notes.trim() || null,
      });

      if (error) {
        showMessage(error.message, "error");
        setSubmitting(false);
        return;
      }

      showMessage(
        mode === "now"
          ? "Recurring series created. Future occurrences may still require approval."
          : "Recurring borrow request submitted for approval.",
        "success"
      );
    }

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

  const request = requests.find((row) => row.id === id);

  const { error } = await supabase
    .from("borrow_requests")
    .update({ status })
    .eq("id", id);

  if (error) {
    showMessage(error.message, "error");
    setRowActionId(null);
    return;
  }

  if (request?.inventory_unit_id) {
    const nextUnitStatus =
      status === "checked_out" ? "borrowed" : status === "returned" || status === "cancelled" ? "available" : null;

    if (nextUnitStatus) {
      const { error: unitError } = await supabase
        .from("inventory_units")
        .update({ status: nextUnitStatus })
        .eq("id", request.inventory_unit_id);

      if (unitError) {
        showMessage(unitError.message, "error");
        setRowActionId(null);
        return;
      }
    }
  }

  if (status === "returned") {
    showMessage("Borrowed item marked as returned.", "success");
  } else if (status === "cancelled") {
    showMessage("Request cancelled.", "success");
  } else {
    showMessage("Scheduled request checked out.", "success");
  }

  await loadPage(true);
  setRowActionId(null);
};
  const approveRequest = async (id: number) => {
  clearMessage();
  setRowActionId(id);

  const request = requests.find((row) => row.id === id);

  const { error } = await supabase.rpc("approve_borrow_request", {
    p_request_id: id,
    p_decision_note: null,
  });

  if (error) {
    showMessage(error.message, "error");
    setRowActionId(null);
    return;
  }

  if (request?.inventory_unit_id && request.start_date <= today) {
    const { error: unitError } = await supabase
      .from("inventory_units")
      .update({ status: "borrowed" })
      .eq("id", request.inventory_unit_id);

    if (unitError) {
      showMessage(unitError.message, "error");
      setRowActionId(null);
      return;
    }
  }

  showMessage("Request approved successfully.", "success");
  await loadPage(true);
  setRowActionId(null);
};

  const declineRequest = async (id: number) => {
    clearMessage();
    setRowActionId(id);

    const { error } = await supabase.rpc("decline_borrow_request", {
      p_request_id: id,
      p_decision_note: null,
    });

    if (error) {
      showMessage(error.message, "error");
      setRowActionId(null);
      return;
    }

    showMessage("Request declined.", "success");
    await loadPage(true);
    setRowActionId(null);
  };

  const cancelRemainingSeries = async (recurrenceGroupId: string) => {
    clearMessage();
    setSeriesActionGroupId(recurrenceGroupId);

    const { data, error } = await supabase
      .from("borrow_requests")
      .update({ status: "cancelled" })
      .eq("recurrence_group_id", recurrenceGroupId)
      .in("status", ["pending", "scheduled"])
      .select("id");

    if (error) {
      showMessage(error.message, "error");
      setSeriesActionGroupId(null);
      return;
    }

    const cancelledCount = data?.length ?? 0;

    if (cancelledCount === 0) {
      showMessage("No pending or scheduled occurrences were left to cancel in this series.", "error");
      setSeriesActionGroupId(null);
      return;
    }

    showMessage(
      `Cancelled ${cancelledCount} remaining occurrence${cancelledCount === 1 ? "" : "s"} in this series.`,
      "success"
    );

    await loadPage(true);
    setSeriesActionGroupId(null);
  };

  const pendingCount = requests.filter((row) => row.status === "pending").length;
  const scheduledCount = requests.filter((row) => row.status === "scheduled").length;
  const checkedOutCount = requests.filter((row) => row.status === "checked_out").length;
  const recurringCount = requests.filter((row) => !!row.recurrence_group_id).length;

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
                Role:{" "}
                <span className="font-medium capitalize text-slate-900 dark:text-slate-100">
                  {role || "unknown"}
                </span>
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

            <Link
              href="/schedule"
              className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700"
            >
              Open Schedule
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Pending
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {pendingCount}
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

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Recurring Occurrences
            </p>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {recurringCount}
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
                Borrow now or submit a future request for approval.
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

            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setRequestType("single")}
                className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  requestType === "single"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                One-Time Request
              </button>

              <button
                onClick={() => setRequestType("recurring")}
                className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  requestType === "recurring"
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                Recurring Request
              </button>
            </div>

            <div className="grid gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Item
                </label>
                <select
                  value={itemId}
                  onChange={(e) => {
  setItemId(e.target.value);
  setUnitId("");
  setQuantity("1");
}}
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
              <div className="space-y-2">
  <label className="text-sm font-medium">Specific Unit</label>

  <select
    value={unitId}
    onChange={(e) => {
      setUnitId(e.target.value);

      if (e.target.value) {
        setQuantity("1");
      }
    }}
    disabled={!itemId}
    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-800"
  >
    <option value="">
      {itemId ? "No specific unit selected" : "Select an item first"}
    </option>

    {availableUnitsForSelectedItem.map((unit) => (
      <option key={unit.id} value={unit.id}>
        {unit.unit_code}
        {unit.serial_number ? ` — Serial: ${unit.serial_number}` : ""}
        {unit.imei ? ` — IMEI: ${unit.imei}` : ""}
        {unit.phone_number ? ` — Phone: ${unit.phone_number}` : ""}
      </option>
    ))}
  </select>

  {itemId && availableUnitsForSelectedItem.length === 0 && (
    <p className="text-xs text-rose-400">
      No available units found for this item.
    </p>
  )}
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
  <label className="text-sm font-medium">Quantity</label>
  <input
    type="number"
    min="1"
    value={quantity}
    disabled={!!unitId}
    onChange={(e) => setQuantity(e.target.value)}
    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-800"
  />

  {unitId && (
    <p className="text-xs text-slate-500 dark:text-slate-400">
      Quantity is locked to 1 when borrowing a specific unit.
    </p>
  )}
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

              {requestType === "recurring" && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Frequency
                    </label>
                    <select
                      value={recurrencePattern}
                      onChange={(e) => setRecurrencePattern(e.target.value as RecurrencePattern)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-800"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Number of Occurrences
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="52"
                      value={occurrenceCount}
                      onChange={(e) => setOccurrenceCount(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-800"
                    />
                  </div>
                </div>
              )}

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
                    : requestType === "single"
                    ? `${availableForDates} item(s) currently available for the selected date range.`
                    : `${availableForDates} item(s) currently available for the first occurrence. The full recurring series will be checked again when approved.`}
                </p>
              </div>

              <button
                onClick={handleCreateRequest}
                disabled={submitting || items.length === 0}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {submitting
                  ? "Saving..."
                  : requestType === "single"
                  ? mode === "now"
                    ? "Borrow Now"
                    : "Submit for Approval"
                  : "Create Recurring Request"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5">
              <h2 className="text-xl font-semibold tracking-tight">
                How approval works
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Future requests now go through approval before they reserve inventory.
              </p>
            </div>

            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  Borrow Now
                </p>
                <p className="mt-1">
                  Requests starting today are created as checked out immediately.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  Future Requests
                </p>
                <p className="mt-1">
                  Requests starting in the future are created as pending until an admin approves them.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  Approval Check
                </p>
                <p className="mt-1">
                  Inventory conflicts are checked again at approval time so staff cannot overbook the same dates.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  Recurring Series
                </p>
                <p className="mt-1">
                  Recurring requests can still be cancelled as a group, and pending occurrences remain editable by approval actions.
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
                      Recurrence
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

                    const hasRecurringSeries = !!row.recurrence_group_id;
                    const isSeriesBusy =
                      row.recurrence_group_id !== null &&
                      seriesActionGroupId === row.recurrence_group_id;

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-slate-200 last:border-b-0 dark:border-slate-800"
                      >
                        <td className="px-6 py-4 text-sm font-medium">
  <div>{getItemName(row)}</div>
  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
    {getUnitLabel(row)}
  </div>
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
                          {hasRecurringSeries ? (
                            <div>
                              <div className="font-medium capitalize">
                                {row.recurrence_pattern || "Recurring"}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Occurrence {row.recurrence_occurrence ?? "?"} of {row.recurrence_total ?? "?"}
                              </div>
                            </div>
                          ) : (
                            "One-time"
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                          {row.notes || "—"}
                        </td>

                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-wrap gap-2">
                            {role === "admin" && row.status === "pending" && (
                              <>
                                <button
                                  onClick={() => approveRequest(row.id)}
                                  disabled={rowActionId === row.id || isSeriesBusy}
                                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {rowActionId === row.id ? "Saving..." : "Approve"}
                                </button>

                                <button
                                  onClick={() => declineRequest(row.id)}
                                  disabled={rowActionId === row.id || isSeriesBusy}
                                  className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {rowActionId === row.id ? "Saving..." : "Decline"}
                                </button>
                              </>
                            )}

                            {canCheckOut && (
                              <button
                                onClick={() => updateRequestStatus(row.id, "checked_out")}
                                disabled={rowActionId === row.id || isSeriesBusy}
                                className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {rowActionId === row.id ? "Saving..." : "Check Out"}
                              </button>
                            )}

                            {row.status === "checked_out" && (
                              <button
                                onClick={() => updateRequestStatus(row.id, "returned")}
                                disabled={rowActionId === row.id || isSeriesBusy}
                                className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {rowActionId === row.id ? "Saving..." : "Mark Returned"}
                              </button>
                            )}

                            {(row.status === "pending" || row.status === "scheduled") && (
                              <button
                                onClick={() => updateRequestStatus(row.id, "cancelled")}
                                disabled={rowActionId === row.id || isSeriesBusy}
                                className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {rowActionId === row.id ? "Saving..." : "Cancel"}
                              </button>
                            )}

                            {hasRecurringSeries && row.recurrence_group_id && (
                              <button
                                onClick={() => cancelRemainingSeries(row.recurrence_group_id!)}
                                disabled={isSeriesBusy || rowActionId === row.id}
                                className="rounded-xl bg-black px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                              >
                                {isSeriesBusy ? "Cancelling..." : "Cancel Remaining Series"}
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