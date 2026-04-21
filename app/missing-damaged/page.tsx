"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createNotificationsForUserAndAdmins } from "@/lib/notifications";
import { useRouter } from "next/navigation";

type IssueStatus = "open" | "resolved" | "written_off";
type ReportType = "missing" | "damaged";

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

export default function MissingDamagedPage() {
  const router = useRouter();

  const [reports, setReports] = useState<MissingDamagedReport[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | IssueStatus>("open");
  const [typeFilter, setTypeFilter] = useState<"all" | ReportType>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const inputClass =
    "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-blue-400";

  const selectClass =
    "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 [color-scheme:dark]";

  const optionClass = "bg-slate-900 text-white";

  const loadReports = async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { data, error } = await supabase
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
      .order("reported_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setReports((data ?? []) as unknown as MissingDamagedReport[]);
    setLoading(false);
  };

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredReports = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesStatus =
        statusFilter === "all" || report.issue_status === statusFilter;

      const matchesType =
        typeFilter === "all" || report.report_type === typeFilter;

      const textBlob = [
        report.inventory_items?.name ?? "",
        report.inventory_items?.asset_code ?? "",
        report.inventory_items?.inventory_categories?.name ?? "",
        report.inventory_units?.unit_code ?? "",
        report.inventory_units?.phone_number ?? "",
        report.inventory_units?.serial_number ?? "",
        report.inventory_units?.imei ?? "",
        report.notes ?? "",
        report.resolution_notes ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || textBlob.includes(query);

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [reports, statusFilter, typeFilter, searchTerm]);

  const summary = useMemo(() => {
    return {
      open: reports.filter((report) => report.issue_status === "open").length,
      missingQty: filteredReports
        .filter((report) => report.report_type === "missing")
        .reduce((sum, report) => sum + report.quantity, 0),
      damagedQty: filteredReports
        .filter((report) => report.report_type === "damaged")
        .reduce((sum, report) => sum + report.quantity, 0),
      unitIssues: filteredReports.filter((report) => report.inventory_unit_id).length,
    };
  }, [reports, filteredReports]);

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

    setMessage("Issue report updated.");
    await loadReports();
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
    await loadReports();
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">Inventory System</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Missing / Damaged
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Track missing or damaged bulk inventory and individual units.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadReports}
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Refresh
            </button>

            <button
              onClick={() => router.push("/inventory")}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Inventory
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200">
            {message}
          </div>
        )}

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Visible Reports</p>
            <p className="mt-2 text-2xl font-bold">{filteredReports.length}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Open Reports</p>
            <p className="mt-2 text-2xl font-bold text-orange-300">{summary.open}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Missing Qty</p>
            <p className="mt-2 text-2xl font-bold text-rose-300">{summary.missingQty}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Damaged Qty</p>
            <p className="mt-2 text-2xl font-bold text-amber-300">{summary.damagedQty}</p>
          </div>
        </div>

        <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight">Filters</h2>

          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | IssueStatus)}
              className={selectClass}
            >
              <option value="all" className={optionClass}>
                All Statuses
              </option>
              <option value="open" className={optionClass}>
                Open
              </option>
              <option value="resolved" className={optionClass}>
                Resolved
              </option>
              <option value="written_off" className={optionClass}>
                Written Off
              </option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "all" | ReportType)}
              className={selectClass}
            >
              <option value="all" className={optionClass}>
                All Types
              </option>
              <option value="missing" className={optionClass}>
                Missing
              </option>
              <option value="damaged" className={optionClass}>
                Damaged
              </option>
            </select>

            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search item, unit, phone, serial, IMEI..."
              className={`${inputClass} lg:col-span-2`}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-semibold tracking-tight">
            Issue Reports
          </h2>

          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-sm text-slate-400">
              Loading reports...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-400">
              No missing or damaged reports found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className={`rounded-2xl border p-5 ${
                    report.issue_status === "open"
                      ? "border-orange-900/70 bg-orange-950/20"
                      : "border-slate-800 bg-slate-950"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">
                          {report.inventory_items?.name ?? "Unknown Item"}
                        </h3>

                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                          {report.inventory_items?.asset_code ?? "No Asset Code"}
                        </span>

                        {report.inventory_units && (
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                            Unit: {report.inventory_units.unit_code}
                          </span>
                        )}

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            report.report_type === "missing"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {report.report_type}
                        </span>

                        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                          {report.issue_status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <span className="text-slate-500">Quantity:</span>{" "}
                          {report.quantity}
                        </div>
                        <div>
                          <span className="text-slate-500">Category:</span>{" "}
                          {report.inventory_items?.inventory_categories?.name ?? "No Category"}
                        </div>
                        <div>
                          <span className="text-slate-500">Reported:</span>{" "}
                          {new Date(report.reported_at).toLocaleString()}
                        </div>
                        <div>
                          <span className="text-slate-500">Resolved:</span>{" "}
                          {report.resolved_at
                            ? new Date(report.resolved_at).toLocaleString()
                            : "Not resolved"}
                        </div>
                      </div>

                      {report.inventory_units && (
                        <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
                          <div>
                            <span className="text-slate-500">Phone:</span>{" "}
                            {report.inventory_units.phone_number || "N/A"}
                          </div>
                          <div>
                            <span className="text-slate-500">Serial:</span>{" "}
                            {report.inventory_units.serial_number || "N/A"}
                          </div>
                          <div>
                            <span className="text-slate-500">IMEI:</span>{" "}
                            {report.inventory_units.imei || "N/A"}
                          </div>
                        </div>
                      )}

                      {report.notes && (
                        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300">
                          {report.notes}
                        </div>
                      )}

                      {report.resolution_notes && (
                        <div className="mt-3 rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-3 text-sm text-emerald-200">
                          Resolution: {report.resolution_notes}
                        </div>
                      )}
                    </div>

                    <div className="min-w-full space-y-3 lg:min-w-[300px]">
                      {report.issue_status === "open" && (
                        <>
                          <textarea
                            value={resolutionNotes[report.id] ?? ""}
                            onChange={(e) =>
                              setResolutionNotes((prev) => ({
                                ...prev,
                                [report.id]: e.target.value,
                              }))
                            }
                            rows={3}
                            placeholder="Resolution notes..."
                            className={inputClass}
                          />

                          <div className="flex flex-wrap gap-3">
                            <button
                              onClick={() => handleResolveReport(report, "resolved")}
                              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                            >
                              Resolve
                            </button>

                            <button
                              onClick={() => handleResolveReport(report, "written_off")}
                              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
                            >
                              Write Off
                            </button>
                          </div>
                        </>
                      )}

                      <button
                        onClick={() => handleDeleteReport(report.id)}
                        className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600"
                      >
                        Delete Report
                      </button>
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
