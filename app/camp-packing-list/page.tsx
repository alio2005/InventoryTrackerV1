"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { createNotificationsForUserAndAdmins } from "@/lib/notifications";
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
  created_at: string;
  updated_at: string;
  inventory_items: InventoryItem | null;
  camp_sites: CampSite | null;
  camp_weeks: CampWeek | null;
};

const statusOptions: { value: AllocationStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "packed", label: "Packed" },
  { value: "delivered", label: "Delivered" },
  { value: "in_use", label: "In Use" },
  { value: "returned", label: "Returned" },
  { value: "missing_damaged", label: "Missing / Damaged" },
  { value: "cancelled", label: "Cancelled" },
];

const statusBadgeClass: Record<AllocationStatus, string> = {
  planned: "bg-slate-200 text-slate-800",
  packed: "bg-amber-100 text-amber-800",
  delivered: "bg-blue-100 text-blue-800",
  in_use: "bg-violet-100 text-violet-800",
  returned: "bg-emerald-100 text-emerald-800",
  missing_damaged: "bg-rose-100 text-rose-800",
  cancelled: "bg-zinc-200 text-zinc-700",
};

const nextStatusMap: Partial<Record<AllocationStatus, AllocationStatus>> = {
  planned: "packed",
  packed: "delivered",
  delivered: "in_use",
  in_use: "returned",
};

export default function CampPackingListPage() {
  const router = useRouter();

  const [sites, setSites] = useState<CampSite[]>([]);
  const [weeks, setWeeks] = useState<CampWeek[]>([]);
  const [allocations, setAllocations] = useState<CampAllocation[]>([]);

  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedWeekId, setSelectedWeekId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AllocationStatus>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const selectClass =
    "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 [color-scheme:dark]";

  const inputClass =
    "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-blue-400";

  const optionClass = "bg-slate-900 text-white";


  const sendCampNotification = async ({
    title,
    bodyMessage,
    leaderEmail,
  }: {
    title: string;
    bodyMessage: string;
    leaderEmail?: string | null;
  }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await createNotificationsForUserAndAdmins({
      title,
      message: bodyMessage,
      currentUserId: user.id,
    });

    const cleanLeaderEmail = leaderEmail?.trim();

    if (!cleanLeaderEmail) return;

    const { data: leaderProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", cleanLeaderEmail)
      .maybeSingle();

    if (!leaderProfile?.id || leaderProfile.id === user.id) return;

    await supabase.from("notifications").insert({
      user_id: leaderProfile.id,
      title,
      message: bodyMessage,
      is_read: false,
    });
  };

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
      .eq("is_active", true)
      .order("name");

    if (siteError) {
      setMessage(siteError.message);
      setLoading(false);
      return;
    }

    const { data: weekData, error: weekError } = await supabase
      .from("camp_weeks")
      .select("id, week_number, label, start_date, end_date, is_active")
      .eq("is_active", true)
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
        created_at,
        updated_at,
        inventory_items(id, name, asset_code, quantity, photo_url, notes),
        camp_sites(id, name, site_leader_name, site_leader_email, address, notes, is_active),
        camp_weeks(id, week_number, label, start_date, end_date, is_active)
      `
      )
      .order("camp_week_id", { ascending: true })
      .order("camp_site_id", { ascending: true })
      .order("created_at", { ascending: false });

    if (allocationError) {
      setMessage(allocationError.message);
      setLoading(false);
      return;
    }

    const safeSites = (siteData ?? []) as CampSite[];
    const safeWeeks = (weekData ?? []) as CampWeek[];

    setSites(safeSites);
    setWeeks(safeWeeks);
    setAllocations((allocationData ?? []) as unknown as CampAllocation[]);

    if (!selectedSiteId && safeSites.length > 0) {
      setSelectedSiteId(String(safeSites[0].id));
    }

    if (!selectedWeekId && safeWeeks.length > 0) {
      setSelectedWeekId(String(safeWeeks[0].id));
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSite = useMemo(() => {
    return sites.find((site) => String(site.id) === selectedSiteId) ?? null;
  }, [sites, selectedSiteId]);

  const selectedWeek = useMemo(() => {
    return weeks.find((week) => String(week.id) === selectedWeekId) ?? null;
  }, [weeks, selectedWeekId]);

  const filteredAllocations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return allocations
      .filter((allocation) => {
        const matchesSite =
          !selectedSiteId || String(allocation.camp_site_id) === selectedSiteId;

        const matchesWeek =
          !selectedWeekId || String(allocation.camp_week_id) === selectedWeekId;

        const matchesStatus =
          statusFilter === "all" || allocation.status === statusFilter;

        const textBlob = [
          allocation.inventory_items?.name ?? "",
          allocation.inventory_items?.asset_code ?? "",
          allocation.notes ?? "",
          allocation.responsible_person ?? "",
          allocation.camp_sites?.name ?? "",
          allocation.camp_weeks?.label ?? "",
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch = !query || textBlob.includes(query);

        return matchesSite && matchesWeek && matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        const siteCompare = (a.camp_sites?.name ?? "").localeCompare(
          b.camp_sites?.name ?? ""
        );

        if (siteCompare !== 0) return siteCompare;

        return (a.inventory_items?.name ?? "").localeCompare(
          b.inventory_items?.name ?? ""
        );
      });
  }, [allocations, selectedSiteId, selectedWeekId, statusFilter, searchTerm]);

  const totalUnits = filteredAllocations.reduce(
    (sum, allocation) => sum + allocation.quantity,
    0
  );

  const uniqueItems = new Set(
    filteredAllocations.map((allocation) => allocation.inventory_item_id)
  ).size;

  const statusCounts = statusOptions.reduce((acc, option) => {
    acc[option.value] = filteredAllocations.filter(
      (allocation) => allocation.status === option.value
    ).length;
    return acc;
  }, {} as Record<AllocationStatus, number>);


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
        wch: Math.min(Math.max(maxLength + 2, 12), 45),
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

  const exportPackingListToExcel = () => {
    const exportRows = filteredAllocations.map((allocation) => ({
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
      Quantity: allocation.quantity,
      Status: sanitizeExcelCell(allocation.status.replace("_", " ")),
      Notes: sanitizeExcelCell(allocation.notes ?? ""),
      "Item Notes": sanitizeExcelCell(allocation.inventory_items?.notes ?? ""),
      "Photo URL": sanitizeExcelCell(allocation.inventory_items?.photo_url ?? ""),
    }));

    const summaryRows = [
      {
        Metric: "Generated At",
        Value: new Date().toLocaleString(),
      },
      {
        Metric: "Selected Site",
        Value: selectedSite?.name ?? "All Sites",
      },
      {
        Metric: "Selected Week",
        Value: selectedWeek?.label ?? "All Weeks",
      },
      {
        Metric: "Visible Allocations",
        Value: filteredAllocations.length,
      },
      {
        Metric: "Unique Inventory Items",
        Value: uniqueItems,
      },
      {
        Metric: "Total Units",
        Value: totalUnits,
      },
      {
        Metric: "Planned",
        Value: statusCounts.planned ?? 0,
      },
      {
        Metric: "Packed",
        Value: statusCounts.packed ?? 0,
      },
      {
        Metric: "Delivered",
        Value: statusCounts.delivered ?? 0,
      },
      {
        Metric: "In Use",
        Value: statusCounts.in_use ?? 0,
      },
      {
        Metric: "Returned",
        Value: statusCounts.returned ?? 0,
      },
      {
        Metric: "Missing / Damaged",
        Value: statusCounts.missing_damaged ?? 0,
      },
      {
        Metric: "Cancelled",
        Value: statusCounts.cancelled ?? 0,
      },
    ];

    const bySiteRows = sites.map((site) => {
      const siteRows = filteredAllocations.filter(
        (allocation) => allocation.camp_site_id === site.id
      );

      return {
        Site: sanitizeExcelCell(site.name),
        "Site Leader": sanitizeExcelCell(site.site_leader_name ?? ""),
        Email: sanitizeExcelCell(site.site_leader_email ?? ""),
        "Visible Allocations": siteRows.length,
        "Total Units": siteRows.reduce(
          (sum, allocation) => sum + allocation.quantity,
          0
        ),
      };
    });

    const workbook = XLSX.utils.book_new();

    addWorksheet(workbook, "Packing List", exportRows);
    addWorksheet(workbook, "Summary", summaryRows);
    addWorksheet(workbook, "By Site", bySiteRows);

    const fileDate = new Date().toISOString().slice(0, 10);
    const siteName = (selectedSite?.name ?? "all-sites")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const weekName = (selectedWeek?.label ?? "all-weeks")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    XLSX.writeFile(
      workbook,
      `camp-packing-list-${siteName}-${weekName}-${fileDate}.xlsx`
    );

    setMessage("Camp packing list exported to Excel.");
  };

  const handleUpdateStatus = async (
    allocationId: number,
    newStatus: AllocationStatus
  ) => {
    setMessage("");

    const { error } = await supabase
      .from("camp_allocations")
      .update({ status: newStatus })
      .eq("id", allocationId);

    if (error) {
      setMessage(error.message);
      return;
    }

    const updatedAllocation = allocations.find(
      (allocation) => allocation.id === allocationId
    );

    await sendCampNotification({
      title: "Camp packing status updated",
      bodyMessage: `${updatedAllocation?.inventory_items?.name ?? "An item"} for ${updatedAllocation?.camp_sites?.name ?? "a camp site"} (${updatedAllocation?.camp_weeks?.label ?? "selected week"}) was marked as ${newStatus.replace("_", " ")}.`,
      leaderEmail:
        updatedAllocation?.responsible_email ||
        updatedAllocation?.camp_sites?.site_leader_email ||
        null,
    });

    setMessage("Packing list status updated.");
    await loadData();
  };

  const handleBulkUpdateVisible = async (newStatus: AllocationStatus) => {
    if (filteredAllocations.length === 0) {
      setMessage("No visible items to update.");
      return;
    }

    const confirmed = window.confirm(
      `Update ${filteredAllocations.length} visible allocation(s) to "${newStatus.replace("_", " ")}"?`
    );

    if (!confirmed) return;

    setMessage("");

    const ids = filteredAllocations.map((allocation) => allocation.id);

    const { error } = await supabase
      .from("camp_allocations")
      .update({ status: newStatus })
      .in("id", ids);

    if (error) {
      setMessage(error.message);
      return;
    }

    await sendCampNotification({
      title: "Camp packing list bulk updated",
      bodyMessage: `${filteredAllocations.length} visible allocation(s) were marked as ${newStatus.replace("_", " ")}${selectedSite ? ` for ${selectedSite.name}` : ""}${selectedWeek ? ` during ${selectedWeek.label}` : ""}.`,
      leaderEmail: selectedSite?.site_leader_email || null,
    });

    setMessage("Visible packing list items updated.");
    await loadData();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="print:hidden mb-8 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">Inventory System</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Camp Packing List
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Site leader view for items assigned to a camp site by week.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportPackingListToExcel}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Export Excel
            </button>

            <button
              onClick={handlePrint}
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Print / Save PDF
            </button>

            <button
              onClick={() => router.push("/camp-sites")}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Camp Sites
            </button>

            <button
              onClick={() => router.push("/camp-allocations")}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700"
            >
              Camp Allocations
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="hidden print:block mb-6 text-black">
          <h1 className="text-2xl font-bold">Camp Packing List</h1>
          <p className="mt-1 text-sm">
            Site: {selectedSite?.name ?? "All Sites"} | Week:{" "}
            {selectedWeek?.label ?? "All Weeks"}
          </p>
          <p className="mt-1 text-sm">
            Site Leader: {selectedSite?.site_leader_name ?? "Not assigned"} |{" "}
            {selectedSite?.site_leader_email ?? "No email"}
          </p>
        </div>

        {message && (
          <div className="print:hidden mb-6 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200">
            {message}
          </div>
        )}

        <section className="print:hidden mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight">Filters</h2>

          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Camp Site</label>
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
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
                value={selectedWeekId}
                onChange={(e) => setSelectedWeekId(e.target.value)}
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
                <option value="all" className={optionClass}>
                  All Statuses
                </option>
                {statusOptions.map((option) => (
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
                placeholder="Item, asset code, notes..."
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => handleBulkUpdateVisible("packed")}
              className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700"
            >
              Mark Visible as Packed
            </button>

            <button
              onClick={() => handleBulkUpdateVisible("delivered")}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Mark Visible as Delivered
            </button>

            <button
              onClick={() => handleBulkUpdateVisible("returned")}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Mark Visible as Returned
            </button>
          </div>
        </section>

        <div className="mb-8 grid gap-4 md:grid-cols-4 print:hidden">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Visible Items</p>
            <p className="mt-2 text-2xl font-bold">{filteredAllocations.length}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Unique Inventory Items</p>
            <p className="mt-2 text-2xl font-bold">{uniqueItems}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Total Units</p>
            <p className="mt-2 text-2xl font-bold">{totalUnits}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Returned</p>
            <p className="mt-2 text-2xl font-bold">{statusCounts.returned ?? 0}</p>
          </div>
        </div>

        {selectedSite && (
          <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm print:border print:border-black print:bg-white print:text-black">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-slate-400 print:text-black">Selected Site</p>
                <h2 className="mt-1 text-2xl font-bold">{selectedSite.name}</h2>
                <p className="mt-2 text-sm text-slate-300 print:text-black">
                  Leader: {selectedSite.site_leader_name || "Not assigned"}
                </p>
                <p className="mt-1 text-sm text-slate-300 print:text-black">
                  Email: {selectedSite.site_leader_email || "Not assigned"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-400 print:text-black">Address / Notes</p>
                <p className="mt-1 text-sm text-slate-300 print:text-black">
                  {selectedSite.address || "No address added."}
                </p>
                {selectedSite.notes && (
                  <p className="mt-2 text-sm text-slate-300 print:text-black">
                    {selectedSite.notes}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm print:border-0 print:bg-white print:p-0 print:text-black">
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight">
              Packing List Items
            </h2>
            <p className="mt-1 text-sm text-slate-400 print:text-black">
              {selectedWeek?.label ?? "All Weeks"} ·{" "}
              {selectedSite?.name ?? "All Sites"}
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-sm text-slate-400">
              Loading packing list...
            </div>
          ) : filteredAllocations.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-400 print:border print:border-black print:bg-white print:text-black">
              No assigned items found for the selected filters.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAllocations.map((allocation) => {
                const nextStatus = nextStatusMap[allocation.status];

                return (
                  <div
                    key={allocation.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950 p-5 print:break-inside-avoid print:border print:border-black print:bg-white print:text-black"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex gap-4">
                        {allocation.inventory_items?.photo_url && (
                          <img
                            src={allocation.inventory_items.photo_url}
                            alt={allocation.inventory_items.name}
                            className="h-20 w-20 rounded-2xl border border-slate-800 object-cover print:hidden"
                          />
                        )}

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold">
                              {allocation.inventory_items?.name ?? "Unknown Item"}
                            </h3>

                            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300 print:border print:border-black print:bg-white print:text-black">
                              {allocation.inventory_items?.asset_code ?? "No Asset Code"}
                            </span>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass[allocation.status]} print:border print:border-black print:bg-white print:text-black`}
                            >
                              {allocation.status.replace("_", " ")}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4 print:text-black">
                            <div>
                              <span className="text-slate-500 print:text-black">Quantity:</span>{" "}
                              <span className="font-semibold">{allocation.quantity}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 print:text-black">Week:</span>{" "}
                              {allocation.camp_weeks?.label ?? "Unknown"}
                            </div>
                            <div>
                              <span className="text-slate-500 print:text-black">Site:</span>{" "}
                              {allocation.camp_sites?.name ?? "Unknown"}
                            </div>
                            <div>
                              <span className="text-slate-500 print:text-black">Responsible:</span>{" "}
                              {allocation.responsible_person || "Not assigned"}
                            </div>
                          </div>

                          {allocation.notes && (
                            <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300 print:border print:border-black print:bg-white print:text-black">
                              {allocation.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 print:hidden">
                        {nextStatus && (
                          <button
                            onClick={() => handleUpdateStatus(allocation.id, nextStatus)}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                          >
                            Mark {nextStatus.replace("_", " ")}
                          </button>
                        )}

                        <select
                          value={allocation.status}
                          onChange={(e) =>
                            handleUpdateStatus(
                              allocation.id,
                              e.target.value as AllocationStatus
                            )
                          }
                          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
                        >
                          {statusOptions.map((option) => (
                            <option
                              key={option.value}
                              value={option.value}
                              className={optionClass}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="hidden print:mt-4 print:grid print:grid-cols-3 print:gap-3 print:text-sm">
                      <div className="border border-black p-2">Packed: □</div>
                      <div className="border border-black p-2">Delivered: □</div>
                      <div className="border border-black p-2">Returned: □</div>
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
