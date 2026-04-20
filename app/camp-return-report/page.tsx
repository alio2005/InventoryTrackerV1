"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type InventoryItem = {
  id: number;
  name: string;
  asset_code: string | null;
  quantity: number;
  photo_url?: string | null;
  notes?: string | null;
};

type CampSite = {
  id: number;
  name: string;
  site_leader_name: string | null;
  site_leader_email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
};

type CampWeek = {
  id: number;
  week_number: number;
  label: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

type AllocationStatus =
  | "planned"
  | "packed"
  | "delivered"
  | "in_use"
  | "returned"
  | "missing_damaged"
  | "cancelled";

type CampAllocation = {
  id: number;
  inventory_item_id: number;
  camp_site_id: number;
  camp_week_id: number;
  quantity: number;
  status: AllocationStatus;
  responsible_person: string | null;
  responsible_email: string | null;
  notes: string | null;
  returned_quantity: number;
  missing_quantity: number;
  damaged_quantity: number;
  return_notes: string | null;
  return_checked_at: string | null;
  created_at: string;
  updated_at: string;
  inventory_items: InventoryItem | null;
  camp_sites: CampSite | null;
  camp_weeks: CampWeek | null;
};

const statusOptions: { value: "all" | AllocationStatus; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "planned", label: "Planned" },
  { value: "packed", label: "Packed" },
  { value: "delivered", label: "Delivered" },
  { value: "in_use", label: "In Use" },
  { value: "returned", label: "Returned" },
  { value: "missing_damaged", label: "Missing / Damaged" },
  { value: "cancelled", label: "Cancelled" },
];

const issueOptions = [
  { value: "all", label: "All Records" },
  { value: "issues", label: "Missing / Damaged / Outstanding" },
  { value: "missing", label: "Missing Only" },
  { value: "damaged", label: "Damaged Only" },
  { value: "outstanding", label: "Not Fully Accounted For" },
  { value: "clear", label: "Fully Returned / Clear" },
] as const;

type IssueFilter = (typeof issueOptions)[number]["value"];

export default function CampReturnReportPage() {
  const router = useRouter();

  const [sites, setSites] = useState<CampSite[]>([]);
  const [weeks, setWeeks] = useState<CampWeek[]>([]);
  const [allocations, setAllocations] = useState<CampAllocation[]>([]);

  const [siteFilterId, setSiteFilterId] = useState("");
  const [weekFilterId, setWeekFilterId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AllocationStatus>("all");
  const [issueFilter, setIssueFilter] = useState<IssueFilter>("issues");
  const [searchTerm, setSearchTerm] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const selectClass =
    "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 [color-scheme:dark]";

  const inputClass =
    "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-blue-400";

  const optionClass = "bg-slate-900 text-white";

  const loadData = async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { data: siteData, error: siteError } = await supabase
      .from("camp_sites")
      .select("id, name, site_leader_name, site_leader_email, address, notes, is_active")
      .order("name");

    if (siteError) {
      setMessage(siteError.message);
      setLoading(false);
      return;
    }

    const { data: weekData, error: weekError } = await supabase
      .from("camp_weeks")
      .select("id, week_number, label, start_date, end_date, is_active")
      .order("week_number");

    if (weekError) {
      setMessage(weekError.message);
      setLoading(false);
      return;
    }

    const { data: allocationData, error: allocationError } = await supabase
      .from("camp_allocations")
      .select(
        `
        id,
        inventory_item_id,
        camp_site_id,
        camp_week_id,
        quantity,
        status,
        responsible_person,
        responsible_email,
        notes,
        returned_quantity,
        missing_quantity,
        damaged_quantity,
        return_notes,
        return_checked_at,
        created_at,
        updated_at,
        inventory_items(id, name, asset_code, quantity, photo_url, notes),
        camp_sites(id, name, site_leader_name, site_leader_email, address, notes, is_active),
        camp_weeks(id, week_number, label, start_date, end_date, is_active)
      `
      )
      .order("camp_week_id", { ascending: true })
      .order("camp_site_id", { ascending: true })
      .order("updated_at", { ascending: false });

    if (allocationError) {
      setMessage(allocationError.message);
      setLoading(false);
      return;
    }

    setSites((siteData ?? []) as CampSite[]);
    setWeeks((weekData ?? []) as CampWeek[]);
    setAllocations((allocationData ?? []) as unknown as CampAllocation[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getOutstandingQuantity = (allocation: CampAllocation) => {
    return Math.max(
      allocation.quantity -
        allocation.returned_quantity -
        allocation.missing_quantity -
        allocation.damaged_quantity,
      0
    );
  };

  const filteredAllocations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return allocations
      .filter((allocation) => {
        const outstanding = getOutstandingQuantity(allocation);
        const hasMissing = allocation.missing_quantity > 0;
        const hasDamaged = allocation.damaged_quantity > 0;
        const isClear =
          allocation.quantity > 0 &&
          allocation.returned_quantity === allocation.quantity &&
          allocation.missing_quantity === 0 &&
          allocation.damaged_quantity === 0 &&
          outstanding === 0;

        const matchesSite =
          !siteFilterId || String(allocation.camp_site_id) === siteFilterId;

        const matchesWeek =
          !weekFilterId || String(allocation.camp_week_id) === weekFilterId;

        const matchesStatus =
          statusFilter === "all" || allocation.status === statusFilter;

        const matchesIssue =
          issueFilter === "all" ||
          (issueFilter === "issues" && (hasMissing || hasDamaged || outstanding > 0)) ||
          (issueFilter === "missing" && hasMissing) ||
          (issueFilter === "damaged" && hasDamaged) ||
          (issueFilter === "outstanding" && outstanding > 0) ||
          (issueFilter === "clear" && isClear);

        const textBlob = [
          allocation.inventory_items?.name ?? "",
          allocation.inventory_items?.asset_code ?? "",
          allocation.camp_sites?.name ?? "",
          allocation.camp_weeks?.label ?? "",
          allocation.responsible_person ?? "",
          allocation.responsible_email ?? "",
          allocation.notes ?? "",
          allocation.return_notes ?? "",
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch = !query || textBlob.includes(query);

        return (
          matchesSite &&
          matchesWeek &&
          matchesStatus &&
          matchesIssue &&
          matchesSearch
        );
      })
      .sort((a, b) => {
        const weekCompare =
          (a.camp_weeks?.week_number ?? 0) - (b.camp_weeks?.week_number ?? 0);

        if (weekCompare !== 0) return weekCompare;

        const siteCompare = (a.camp_sites?.name ?? "").localeCompare(
          b.camp_sites?.name ?? ""
        );

        if (siteCompare !== 0) return siteCompare;

        return (a.inventory_items?.name ?? "").localeCompare(
          b.inventory_items?.name ?? ""
        );
      });
  }, [
    allocations,
    siteFilterId,
    weekFilterId,
    statusFilter,
    issueFilter,
    searchTerm,
  ]);

  const summary = useMemo(() => {
    const totalAllocated = filteredAllocations.reduce(
      (sum, allocation) => sum + allocation.quantity,
      0
    );

    const totalReturned = filteredAllocations.reduce(
      (sum, allocation) => sum + allocation.returned_quantity,
      0
    );

    const totalMissing = filteredAllocations.reduce(
      (sum, allocation) => sum + allocation.missing_quantity,
      0
    );

    const totalDamaged = filteredAllocations.reduce(
      (sum, allocation) => sum + allocation.damaged_quantity,
      0
    );

    const totalOutstanding = filteredAllocations.reduce(
      (sum, allocation) => sum + getOutstandingQuantity(allocation),
      0
    );

    const issueRecords = filteredAllocations.filter(
      (allocation) =>
        allocation.missing_quantity > 0 ||
        allocation.damaged_quantity > 0 ||
        getOutstandingQuantity(allocation) > 0
    ).length;

    return {
      totalAllocated,
      totalReturned,
      totalMissing,
      totalDamaged,
      totalOutstanding,
      issueRecords,
    };
  }, [filteredAllocations]);

  const sanitizeExcelCell = (value: unknown) => {
    if (value === null || value === undefined) return "";

    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    const text = String(value);

    if (/^[=+\-@]/.test(text)) {
      return `'${text}`;
    }

    return text;
  };

  const fitWorksheetColumns = (
    worksheet: XLSX.WorkSheet,
    rows: Record<string, unknown>[]
  ) => {
    const headers = Object.keys(rows[0] ?? {});

    worksheet["!cols"] = headers.map((header) => {
      const maxLength = Math.max(
        header.length,
        ...rows.map((row) => String(row[header] ?? "").length)
      );

      return {
        wch: Math.min(Math.max(maxLength + 2, 12), 50),
      };
    });
  };

  const addWorksheet = (
    workbook: XLSX.WorkBook,
    sheetName: string,
    rows: Record<string, unknown>[]
  ) => {
    const safeRows =
      rows.length > 0
        ? rows
        : [{ Message: `No ${sheetName.toLowerCase()} records found.` }];

    const worksheet = XLSX.utils.json_to_sheet(safeRows);
    fitWorksheetColumns(worksheet, safeRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  };

  const exportReturnReportToExcel = () => {
    const reportRows = filteredAllocations.map((allocation) => ({
      Week: sanitizeExcelCell(allocation.camp_weeks?.label ?? "Unknown"),
      Site: sanitizeExcelCell(allocation.camp_sites?.name ?? "Unknown"),
      "Site Leader": sanitizeExcelCell(
        allocation.camp_sites?.site_leader_name ??
          allocation.responsible_person ??
          "Not assigned"
      ),
      "Site Leader Email": sanitizeExcelCell(
        allocation.camp_sites?.site_leader_email ??
          allocation.responsible_email ??
          ""
      ),
      "Asset Code": sanitizeExcelCell(
        allocation.inventory_items?.asset_code ?? "No Asset Code"
      ),
      "Item Name": sanitizeExcelCell(
        allocation.inventory_items?.name ?? "Unknown Item"
      ),
      "Allocated Quantity": allocation.quantity,
      Returned: allocation.returned_quantity,
      Missing: allocation.missing_quantity,
      Damaged: allocation.damaged_quantity,
      Outstanding: getOutstandingQuantity(allocation),
      Status: sanitizeExcelCell(allocation.status.replace("_", " ")),
      "Allocation Notes": sanitizeExcelCell(allocation.notes ?? ""),
      "Return Notes": sanitizeExcelCell(allocation.return_notes ?? ""),
      "Return Checked At": sanitizeExcelCell(
        allocation.return_checked_at
          ? new Date(allocation.return_checked_at).toLocaleString()
          : ""
      ),
      "Last Updated": sanitizeExcelCell(
        allocation.updated_at
          ? new Date(allocation.updated_at).toLocaleString()
          : ""
      ),
    }));

    const issueRows = reportRows.filter(
      (row) =>
        Number(row.Missing) > 0 ||
        Number(row.Damaged) > 0 ||
        Number(row.Outstanding) > 0
    );

    const siteRows = sites.map((site) => {
      const rows = filteredAllocations.filter(
        (allocation) => allocation.camp_site_id === site.id
      );

      return {
        Site: sanitizeExcelCell(site.name),
        "Site Leader": sanitizeExcelCell(site.site_leader_name ?? ""),
        Email: sanitizeExcelCell(site.site_leader_email ?? ""),
        "Visible Records": rows.length,
        "Allocated Units": rows.reduce((sum, row) => sum + row.quantity, 0),
        Returned: rows.reduce((sum, row) => sum + row.returned_quantity, 0),
        Missing: rows.reduce((sum, row) => sum + row.missing_quantity, 0),
        Damaged: rows.reduce((sum, row) => sum + row.damaged_quantity, 0),
        Outstanding: rows.reduce(
          (sum, row) => sum + getOutstandingQuantity(row),
          0
        ),
      };
    });

    const weekRows = weeks.map((week) => {
      const rows = filteredAllocations.filter(
        (allocation) => allocation.camp_week_id === week.id
      );

      return {
        Week: sanitizeExcelCell(week.label),
        "Visible Records": rows.length,
        "Allocated Units": rows.reduce((sum, row) => sum + row.quantity, 0),
        Returned: rows.reduce((sum, row) => sum + row.returned_quantity, 0),
        Missing: rows.reduce((sum, row) => sum + row.missing_quantity, 0),
        Damaged: rows.reduce((sum, row) => sum + row.damaged_quantity, 0),
        Outstanding: rows.reduce(
          (sum, row) => sum + getOutstandingQuantity(row),
          0
        ),
      };
    });

    const summaryRows = [
      { Metric: "Generated At", Value: new Date().toLocaleString() },
      {
        Metric: "Site Filter",
        Value:
          sites.find((site) => String(site.id) === siteFilterId)?.name ??
          "All Sites",
      },
      {
        Metric: "Week Filter",
        Value:
          weeks.find((week) => String(week.id) === weekFilterId)?.label ??
          "All Weeks",
      },
      {
        Metric: "Status Filter",
        Value: statusFilter === "all" ? "All Statuses" : statusFilter,
      },
      {
        Metric: "Issue Filter",
        Value: issueOptions.find((option) => option.value === issueFilter)?.label,
      },
      { Metric: "Visible Records", Value: filteredAllocations.length },
      { Metric: "Issue Records", Value: summary.issueRecords },
      { Metric: "Allocated Units", Value: summary.totalAllocated },
      { Metric: "Returned Units", Value: summary.totalReturned },
      { Metric: "Missing Units", Value: summary.totalMissing },
      { Metric: "Damaged Units", Value: summary.totalDamaged },
      { Metric: "Outstanding Units", Value: summary.totalOutstanding },
    ];

    const workbook = XLSX.utils.book_new();

    addWorksheet(workbook, "Return Report", reportRows);
    addWorksheet(workbook, "Issues Only", issueRows);
    addWorksheet(workbook, "Summary", summaryRows);
    addWorksheet(workbook, "By Site", siteRows);
    addWorksheet(workbook, "By Week", weekRows);

    const fileDate = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `camp-return-report-${fileDate}.xlsx`);

    setMessage("Camp return report exported to Excel.");
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">Inventory System</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Camp Return Report
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Review returned, missing, damaged, and outstanding camp inventory across all sites and weeks.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportReturnReportToExcel}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Export Excel
            </button>

            <button
              onClick={loadData}
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Refresh
            </button>

            <button
              onClick={() => router.push("/camp-packing-list")}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Packing List
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

        <div className="mb-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Records</p>
            <p className="mt-2 text-2xl font-bold">{filteredAllocations.length}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Allocated</p>
            <p className="mt-2 text-2xl font-bold">{summary.totalAllocated}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Returned</p>
            <p className="mt-2 text-2xl font-bold text-emerald-300">
              {summary.totalReturned}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Missing</p>
            <p className="mt-2 text-2xl font-bold text-rose-300">
              {summary.totalMissing}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Damaged</p>
            <p className="mt-2 text-2xl font-bold text-amber-300">
              {summary.totalDamaged}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Outstanding</p>
            <p className="mt-2 text-2xl font-bold text-blue-300">
              {summary.totalOutstanding}
            </p>
          </div>
        </div>

        <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight">Filters</h2>

          <div className="mt-5 grid gap-4 lg:grid-cols-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Camp Site</label>
              <select
                value={siteFilterId}
                onChange={(e) => setSiteFilterId(e.target.value)}
                className={selectClass}
              >
                <option value="" className={optionClass}>
                  All Sites
                </option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id} className={optionClass}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Week</label>
              <select
                value={weekFilterId}
                onChange={(e) => setWeekFilterId(e.target.value)}
                className={selectClass}
              >
                <option value="" className={optionClass}>
                  All Weeks
                </option>
                {weeks.map((week) => (
                  <option key={week.id} value={week.id} className={optionClass}>
                    {week.label}
                    {week.start_date && week.end_date
                      ? ` (${week.start_date} to ${week.end_date})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Status</label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "all" | AllocationStatus)
                }
                className={selectClass}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value} className={optionClass}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Issue Filter</label>
              <select
                value={issueFilter}
                onChange={(e) => setIssueFilter(e.target.value as IssueFilter)}
                className={selectClass}
              >
                {issueOptions.map((option) => (
                  <option key={option.value} value={option.value} className={optionClass}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Item, site, asset code..."
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight">Return Records</h2>
            <p className="mt-1 text-sm text-slate-400">
              Shows the current return condition for each camp allocation.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-sm text-slate-400">
              Loading return report...
            </div>
          ) : filteredAllocations.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-400">
              No records match your filters.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAllocations.map((allocation) => {
                const outstanding = getOutstandingQuantity(allocation);
                const hasIssue =
                  allocation.missing_quantity > 0 ||
                  allocation.damaged_quantity > 0 ||
                  outstanding > 0;

                return (
                  <div
                    key={allocation.id}
                    className={`rounded-2xl border p-5 ${
                      hasIssue
                        ? "border-rose-900/70 bg-rose-950/20"
                        : "border-slate-800 bg-slate-950"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">
                            {allocation.inventory_items?.name ?? "Unknown Item"}
                          </h3>

                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                            {allocation.inventory_items?.asset_code ?? "No Asset Code"}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              hasIssue
                                ? "bg-rose-100 text-rose-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {hasIssue ? "Needs Attention" : "Clear"}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <span className="text-slate-500">Week:</span>{" "}
                            {allocation.camp_weeks?.label ?? "Unknown"}
                          </div>
                          <div>
                            <span className="text-slate-500">Site:</span>{" "}
                            {allocation.camp_sites?.name ?? "Unknown"}
                          </div>
                          <div>
                            <span className="text-slate-500">Responsible:</span>{" "}
                            {allocation.responsible_person ||
                              allocation.camp_sites?.site_leader_name ||
                              "Not assigned"}
                          </div>
                          <div>
                            <span className="text-slate-500">Status:</span>{" "}
                            {allocation.status.replace("_", " ")}
                          </div>
                        </div>

                        {allocation.return_notes && (
                          <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300">
                            {allocation.return_notes}
                          </div>
                        )}

                        {allocation.return_checked_at && (
                          <p className="mt-2 text-xs text-slate-500">
                            Return checked at:{" "}
                            {new Date(allocation.return_checked_at).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="grid min-w-full grid-cols-2 gap-2 text-center text-sm sm:min-w-[460px] sm:grid-cols-5">
                        <div className="rounded-xl bg-slate-800 px-3 py-3">
                          <div className="text-xs text-slate-400">Allocated</div>
                          <div className="text-lg font-bold">{allocation.quantity}</div>
                        </div>

                        <div className="rounded-xl bg-emerald-950/50 px-3 py-3">
                          <div className="text-xs text-emerald-300">Returned</div>
                          <div className="text-lg font-bold">
                            {allocation.returned_quantity}
                          </div>
                        </div>

                        <div className="rounded-xl bg-rose-950/50 px-3 py-3">
                          <div className="text-xs text-rose-300">Missing</div>
                          <div className="text-lg font-bold">
                            {allocation.missing_quantity}
                          </div>
                        </div>

                        <div className="rounded-xl bg-amber-950/50 px-3 py-3">
                          <div className="text-xs text-amber-300">Damaged</div>
                          <div className="text-lg font-bold">
                            {allocation.damaged_quantity}
                          </div>
                        </div>

                        <div className="rounded-xl bg-blue-950/50 px-3 py-3">
                          <div className="text-xs text-blue-300">Outstanding</div>
                          <div className="text-lg font-bold">{outstanding}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
