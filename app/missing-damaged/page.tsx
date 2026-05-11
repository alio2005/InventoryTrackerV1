"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createNotificationsForUserAndAdmins } from "@/lib/notifications";

type IssueStatus = "open" | "resolved" | "written_off";
type ReportType = "missing" | "damaged";
type StatusFilter = "all" | IssueStatus;
type ReportView = "active" | "all" | "completed";

type MissingDamagedReport = {
  id: number;
  inventory_item_id: number;
  inventory_unit_id: number | null;
  report_type: ReportType;
  quantity: number;
  issue_status: IssueStatus;
  notes: string | null;
  reported_by: string | null;
  reported_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  inventory_items: {
    id: number;
    name: string;
    asset_code: string | null;
    quantity: number;
    inventory_categories: { name: string } | null;
  } | null;
  inventory_units: {
    id: number;
    unit_code: string;
    phone_number: string | null;
    serial_number: string | null;
    imei: string | null;
    status: string;
  } | null;
};

type InventoryItem = {
  id: number;
  name: string;
  asset_code: string | null;
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

const formatDateTime = (value: string | null) => {
  if (!value) return "Not resolved";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const statusLabel = (value: IssueStatus) => value.replace("_", " ");

const reportTypeClass = (type: ReportType) =>
  type === "missing"
    ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
    : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";

const issueStatusClass = (status: IssueStatus) => {
  if (status === "open") return "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200";
  if (status === "resolved") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  return "bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200";
};

export default function MissingDamagedPage() {
  const router = useRouter();

  const [reports, setReports] = useState<MissingDamagedReport[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [view, setView] = useState<ReportView>("active");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [typeFilter, setTypeFilter] = useState<"all" | ReportType>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState<Record<number, string>>({});
  const [expandedReportId, setExpandedReportId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingIssue, setSubmittingIssue] = useState(false);

  const [newItemId, setNewItemId] = useState("");
  const [newUnitId, setNewUnitId] = useState("");
  const [newType, setNewType] = useState<ReportType>("missing");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newNotes, setNewNotes] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const [reportResponse, itemResponse, unitResponse] = await Promise.all([
      supabase
        .from("missing_damaged_reports")
        .select(
          `
          id,
          inventory_item_id,
          inventory_unit_id,
          report_type,
          quantity,
          issue_status,
          notes,
          reported_by,
          reported_at,
          resolved_by,
          resolved_at,
          resolution_notes,
          created_at,
          updated_at,
          inventory_items(id, name, asset_code, quantity, inventory_categories(name)),
          inventory_units(id, unit_code, phone_number, serial_number, imei, status)
        `
        )
        .order("reported_at", { ascending: false }),
      supabase
        .from("inventory_items")
        .select("id, name, asset_code, quantity, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase
        .from("inventory_units")
        .select("id, inventory_item_id, unit_code, phone_number, serial_number, imei, status")
        .order("unit_code", { ascending: true }),
    ]);

    if (reportResponse.error) {
      setMessage(reportResponse.error.message);
      setLoading(false);
      return;
    }

    if (itemResponse.error) {
      setMessage(itemResponse.error.message);
      setLoading(false);
      return;
    }

    if (unitResponse.error) {
      setMessage(unitResponse.error.message);
      setLoading(false);
      return;
    }

    setReports((reportResponse.data ?? []) as unknown as MissingDamagedReport[]);
    setItems((itemResponse.data ?? []) as InventoryItem[]);
    setUnits((unitResponse.data ?? []) as InventoryUnit[]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const selectedItem = useMemo(
    () => items.find((item) => String(item.id) === newItemId) ?? null,
    [items, newItemId]
  );

  const unitsForSelectedItem = useMemo(
    () => units.filter((unit) => String(unit.inventory_item_id) === newItemId),
    [newItemId, units]
  );

  const filteredReports = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesView =
        view === "all" ||
        (view === "active" && report.issue_status === "open") ||
        (view === "completed" && report.issue_status !== "open");

      const matchesStatus = statusFilter === "all" || report.issue_status === statusFilter;
      const matchesType = typeFilter === "all" || report.report_type === typeFilter;

      const textBlob = [
        report.inventory_items?.name ?? "",
        report.inventory_items?.asset_code ?? "",
        report.inventory_items?.inventory_categories?.name ?? "",
        report.inventory_units?.unit_code ?? "",
        report.inventory_units?.phone_number ?? "",
        report.inventory_units?.serial_number ?? "",
        report.inventory_units?.imei ?? "",
        report.report_type,
        report.issue_status,
        report.notes ?? "",
        report.resolution_notes ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || textBlob.includes(query);

      return matchesView && matchesStatus && matchesType && matchesSearch;
    });
  }, [reports, searchTerm, statusFilter, typeFilter, view]);

  const summary = useMemo(() => {
    const openReports = reports.filter((report) => report.issue_status === "open");
    const visibleMissing = filteredReports
      .filter((report) => report.report_type === "missing")
      .reduce((sum, report) => sum + report.quantity, 0);
    const visibleDamaged = filteredReports
      .filter((report) => report.report_type === "damaged")
      .reduce((sum, report) => sum + report.quantity, 0);

    return {
      total: reports.length,
      visible: filteredReports.length,
      open: openReports.length,
      completed: reports.filter((report) => report.issue_status !== "open").length,
      missingQty: visibleMissing,
      damagedQty: visibleDamaged,
      unitIssues: reports.filter((report) => report.inventory_unit_id).length,
    };
  }, [filteredReports, reports]);

  const handleCreateReport = async () => {
    setMessage("");

    if (!selectedItem) {
      setMessage("Choose an inventory item before submitting an issue.");
      return;
    }

    const quantity = newUnitId ? 1 : Number(newQuantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setMessage("Quantity must be greater than 0.");
      return;
    }

    if (!newUnitId && quantity > selectedItem.quantity) {
      setMessage("Quantity cannot be greater than the current item quantity.");
      return;
    }

    setSubmittingIssue(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const selectedUnit = units.find((unit) => String(unit.id) === newUnitId) ?? null;

    const { error } = await supabase.from("missing_damaged_reports").insert({
      inventory_item_id: selectedItem.id,
      inventory_unit_id: selectedUnit?.id ?? null,
      report_type: newType,
      quantity,
      notes: newNotes.trim() || null,
      reported_by: user.id,
    });

    if (error) {
      setMessage(error.message);
      setSubmittingIssue(false);
      return;
    }

    if (selectedUnit) {
      await supabase
        .from("inventory_units")
        .update({ status: newType })
        .eq("id", selectedUnit.id);
    }

    await createNotificationsForUserAndAdmins({
      title: newType === "missing" ? "Missing inventory reported" : "Damaged inventory reported",
      message: `${quantity} of ${selectedItem.name}${selectedUnit ? ` (${selectedUnit.unit_code})` : ""} was reported as ${newType}.${
        newNotes.trim() ? ` Notes: ${newNotes.trim()}` : ""
      }`,
      currentUserId: user.id,
    });

    setNewItemId("");
    setNewUnitId("");
    setNewType("missing");
    setNewQuantity("1");
    setNewNotes("");
    setSubmittingIssue(false);
    setView("active");
    setStatusFilter("open");
    setMessage("Issue report submitted.");
    await loadData();
  };

  const handleResolveReport = async (
    report: MissingDamagedReport,
    newStatus: "resolved" | "written_off"
  ) => {
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { error } = await supabase
      .from("missing_damaged_reports")
      .update({
        issue_status: newStatus,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes[report.id]?.trim() || null,
      })
      .eq("id", report.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (report.inventory_unit_id) {
      await supabase
        .from("inventory_units")
        .update({ status: newStatus === "resolved" ? "available" : "retired" })
        .eq("id", report.inventory_unit_id);
    }

    await createNotificationsForUserAndAdmins({
      title: newStatus === "resolved" ? "Inventory issue resolved" : "Inventory issue written off",
      message: `${report.quantity} of ${report.inventory_items?.name ?? "item"} was marked as ${newStatus.replace("_", " ")}.`,
      currentUserId: user.id,
    });

    setResolutionNotes((prev) => ({ ...prev, [report.id]: "" }));
    setMessage("Issue report updated.");
    await loadData();
  };

  const handleDeleteReport = async (reportId: number) => {
    const confirmed = window.confirm("Delete this issue report?");
    if (!confirmed) return;

    setMessage("");

    const { error } = await supabase
      .from("missing_damaged_reports")
      .delete()
      .eq("id", reportId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Issue report deleted.");
    await loadData();
  };

  const clearFilters = () => {
    setView("active");
    setStatusFilter("open");
    setTypeFilter("all");
    setSearchTerm("");
  };

  const viewButtonClass = (target: ReportView) =>
    `rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
      view === target
        ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
    }`;

  const inputClass =
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-zinc-800 dark:bg-black dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-900";

  const selectClass = `${inputClass} appearance-none`;
  const optionClass = "bg-white text-slate-900 dark:bg-zinc-950 dark:text-white";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
                  Inventory Issues
                </p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight">Missing / Damaged</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-zinc-400">
                  Report issues, review what still needs action, and resolve or write off units from one page.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={loadData}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Refresh
                </button>
                <Link
                  href="/inventory"
                  className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
                >
                  Go to Inventory
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-5">
            <button
              type="button"
              onClick={() => {
                setView("active");
                setStatusFilter("open");
              }}
              className="rounded-3xl border border-orange-200 bg-orange-50 p-5 text-left transition hover:bg-orange-100 dark:border-orange-900/60 dark:bg-orange-950/20 dark:hover:bg-orange-950/30"
            >
              <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Needs Action</p>
              <p className="mt-2 text-3xl font-bold text-orange-900 dark:text-orange-100">{summary.open}</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setView("completed");
                setStatusFilter("all");
              }}
              className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-left transition hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
            >
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Completed</p>
              <p className="mt-2 text-3xl font-bold text-emerald-900 dark:text-emerald-100">{summary.completed}</p>
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter("missing")}
              className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-left transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/20 dark:hover:bg-rose-950/30"
            >
              <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Visible Missing Qty</p>
              <p className="mt-2 text-3xl font-bold text-rose-900 dark:text-rose-100">{summary.missingQty}</p>
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter("damaged")}
              className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-left transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
            >
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Visible Damaged Qty</p>
              <p className="mt-2 text-3xl font-bold text-amber-900 dark:text-amber-100">{summary.damagedQty}</p>
            </button>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-black">
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Visible Reports</p>
              <p className="mt-2 text-3xl font-bold">{summary.visible}</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">Total: {summary.total}</p>
            </div>
          </div>
        </section>

        {message && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            {message}
          </div>
        )}

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Report New Issue</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                Use this instead of searching through inventory first when someone tells you something is missing or damaged.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-zinc-300">Item</label>
              <select
                value={newItemId}
                onChange={(event) => {
                  setNewItemId(event.target.value);
                  setNewUnitId("");
                  setNewQuantity("1");
                }}
                className={selectClass}
              >
                <option value="" className={optionClass}>Choose item...</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id} className={optionClass}>
                    {item.name}{item.asset_code ? ` • ${item.asset_code}` : ""} • Qty {item.quantity}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-zinc-300">Exact Unit Optional</label>
              <select
                value={newUnitId}
                onChange={(event) => {
                  setNewUnitId(event.target.value);
                  if (event.target.value) setNewQuantity("1");
                }}
                disabled={!newItemId || unitsForSelectedItem.length === 0}
                className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <option value="" className={optionClass}>
                  {newItemId ? "Bulk item / no unit" : "Choose item first"}
                </option>
                {unitsForSelectedItem.map((unit) => (
                  <option key={unit.id} value={unit.id} className={optionClass}>
                    {unit.unit_code} • {unit.status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-zinc-300">Issue Type</label>
              <select
                value={newType}
                onChange={(event) => setNewType(event.target.value as ReportType)}
                className={selectClass}
              >
                <option value="missing" className={optionClass}>Missing</option>
                <option value="damaged" className={optionClass}>Damaged</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-zinc-300">Quantity</label>
              <input
                type="number"
                min="1"
                value={newQuantity}
                onChange={(event) => setNewQuantity(event.target.value)}
                disabled={Boolean(newUnitId)}
                className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
              />
            </div>

            <div className="lg:col-span-3">
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-zinc-300">Notes</label>
              <input
                type="text"
                value={newNotes}
                onChange={(event) => setNewNotes(event.target.value)}
                placeholder="Example: Missing after Markham Week 2 camp / cracked screen / cable lost..."
                className={inputClass}
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleCreateReport}
                disabled={submittingIssue}
                className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
              >
                {submittingIssue ? "Submitting..." : "Submit Issue"}
              </button>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setView("active"); setStatusFilter("open"); }} className={viewButtonClass("active")}>
                Needs Action
              </button>
              <button type="button" onClick={() => { setView("completed"); setStatusFilter("all"); }} className={viewButtonClass("completed")}>
                Completed
              </button>
              <button type="button" onClick={() => { setView("all"); setStatusFilter("all"); }} className={viewButtonClass("all")}>
                All Reports
              </button>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-3xl">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className={selectClass}
              >
                <option value="all" className={optionClass}>All Statuses</option>
                <option value="open" className={optionClass}>Open</option>
                <option value="resolved" className={optionClass}>Resolved</option>
                <option value="written_off" className={optionClass}>Written Off</option>
              </select>

              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as "all" | ReportType)}
                className={selectClass}
              >
                <option value="all" className={optionClass}>All Types</option>
                <option value="missing" className={optionClass}>Missing</option>
                <option value="damaged" className={optionClass}>Damaged</option>
              </select>

              <button
                type="button"
                onClick={clearFilters}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Reset Filters
              </button>
            </div>
          </div>

          <div className="mt-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search item, asset code, unit code, phone, serial, IMEI, notes, status..."
              className={inputClass}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Issue Queue</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                Open reports show action buttons. Completed reports stay visible under Completed or All Reports.
              </p>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
              Showing {filteredReports.length} report(s)
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-black dark:text-zinc-400">
              Loading reports...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-zinc-800 dark:bg-black">
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">No issue reports found.</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                Try All Reports, clear your search, or submit a new issue above.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => {
                const expanded = expandedReportId === report.id;
                const itemName = report.inventory_items?.name ?? "Unknown Item";
                const itemId = report.inventory_items?.id ?? report.inventory_item_id;

                return (
                  <article
                    key={report.id}
                    className={`rounded-3xl border p-5 transition ${
                      report.issue_status === "open"
                        ? "border-orange-200 bg-orange-50/50 dark:border-orange-900/60 dark:bg-orange-950/10"
                        : "border-slate-200 bg-white dark:border-zinc-800 dark:bg-black"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-950 dark:text-zinc-100">{itemName}</h3>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-zinc-900 dark:text-zinc-300">
                            {report.inventory_items?.asset_code ?? "No Asset Code"}
                          </span>

                          {report.inventory_units && (
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                              Unit: {report.inventory_units.unit_code}
                            </span>
                          )}

                          <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${reportTypeClass(report.report_type)}`}>
                            {report.report_type}
                          </span>

                          <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${issueStatusClass(report.issue_status)}`}>
                            {statusLabel(report.issue_status)}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Quantity</p>
                            <p className="mt-1 font-bold">{report.quantity}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Category</p>
                            <p className="mt-1 font-bold">{report.inventory_items?.inventory_categories?.name ?? "No Category"}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Reported</p>
                            <p className="mt-1 font-bold">{formatDateTime(report.reported_at)}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Resolved</p>
                            <p className="mt-1 font-bold">{formatDateTime(report.resolved_at)}</p>
                          </div>
                        </div>

                        {(report.notes || report.resolution_notes || report.inventory_units) && (
                          <button
                            type="button"
                            onClick={() => setExpandedReportId(expanded ? null : report.id)}
                            className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                          >
                            {expanded ? "Hide Details" : "View Details"}
                          </button>
                        )}

                        {expanded && (
                          <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                            {report.inventory_units && (
                              <div className="grid gap-3 text-sm sm:grid-cols-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Phone</p>
                                  <p className="mt-1 font-medium">{report.inventory_units.phone_number || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Serial</p>
                                  <p className="mt-1 font-medium">{report.inventory_units.serial_number || "N/A"}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">IMEI</p>
                                  <p className="mt-1 font-medium">{report.inventory_units.imei || "N/A"}</p>
                                </div>
                              </div>
                            )}

                            {report.notes && (
                              <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-black dark:text-zinc-300">
                                <span className="font-semibold">Report notes:</span> {report.notes}
                              </div>
                            )}

                            {report.resolution_notes && (
                              <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200">
                                <span className="font-semibold">Resolution:</span> {report.resolution_notes}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="w-full space-y-3 lg:w-[320px]">
                        {report.issue_status === "open" && (
                          <>
                            <textarea
                              value={resolutionNotes[report.id] ?? ""}
                              onChange={(event) =>
                                setResolutionNotes((prev) => ({
                                  ...prev,
                                  [report.id]: event.target.value,
                                }))
                              }
                              rows={3}
                              placeholder="Resolution notes, e.g. found in storage room or replaced by purchase..."
                              className={inputClass}
                            />

                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                              <button
                                type="button"
                                onClick={() => handleResolveReport(report, "resolved")}
                                className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                              >
                                Mark Resolved
                              </button>

                              <button
                                type="button"
                                onClick={() => handleResolveReport(report, "written_off")}
                                className="rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
                              >
                                Write Off
                              </button>
                            </div>
                          </>
                        )}

                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                          <Link
                            href={`/inventory-units/${itemId}`}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                          >
                            View Units
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleDeleteReport(report.id)}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-rose-50 hover:text-rose-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-rose-950/20 dark:hover:text-rose-300"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
