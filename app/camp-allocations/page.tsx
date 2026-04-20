"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type InventoryItem = {
  id: number;
  name: string;
  asset_code: string | null;
  quantity: number;
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

const activeAllocationStatuses: AllocationStatus[] = [
  "planned",
  "packed",
  "delivered",
  "in_use",
  "missing_damaged",
];

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
  planned: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  packed: "bg-amber-100 text-amber-800",
  delivered: "bg-blue-100 text-blue-800",
  in_use: "bg-violet-100 text-violet-800",
  returned: "bg-emerald-100 text-emerald-800",
  missing_damaged: "bg-rose-100 text-rose-800",
  cancelled: "bg-zinc-200 text-zinc-700",
};

export default function CampAllocationsPage() {
  const router = useRouter();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sites, setSites] = useState<CampSite[]>([]);
  const [weeks, setWeeks] = useState<CampWeek[]>([]);
  const [allocations, setAllocations] = useState<CampAllocation[]>([]);

  const [selectedWeekId, setSelectedWeekId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<AllocationStatus>("planned");
  const [responsiblePerson, setResponsiblePerson] = useState("");
  const [responsibleEmail, setResponsibleEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [siteFilterId, setSiteFilterId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const inputClass =
    "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-blue-400";

  const selectClass =
    "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 [color-scheme:dark]";

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

    const { data: itemData, error: itemError } = await supabase
      .from("inventory_items")
      .select("id, name, asset_code, quantity")
      .eq("is_active", true)
      .order("name");

    if (itemError) {
      setMessage(itemError.message);
      setLoading(false);
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
        inventory_items(id, name, asset_code, quantity),
        camp_sites(id, name, site_leader_name, site_leader_email, address, notes, is_active),
        camp_weeks(id, week_number, label, start_date, end_date, is_active)
      `
      )
      .order("created_at", { ascending: false });

    if (allocationError) {
      setMessage(allocationError.message);
      setLoading(false);
      return;
    }

    const safeWeeks = (weekData ?? []) as CampWeek[];

    setItems((itemData ?? []) as InventoryItem[]);
    setSites((siteData ?? []) as CampSite[]);
    setWeeks(safeWeeks);
    setAllocations((allocationData ?? []) as unknown as CampAllocation[]);

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

  useEffect(() => {
    if (selectedSite) {
      setResponsiblePerson(selectedSite.site_leader_name ?? "");
      setResponsibleEmail(selectedSite.site_leader_email ?? "");
    }
  }, [selectedSite]);

  const selectedItem = useMemo(() => {
    return items.find((item) => String(item.id) === selectedItemId) ?? null;
  }, [items, selectedItemId]);

  const selectedWeek = useMemo(() => {
    return weeks.find((week) => String(week.id) === selectedWeekId) ?? null;
  }, [weeks, selectedWeekId]);

  const getAllocatedQuantity = (itemId: number, weekId: number) => {
    return allocations
      .filter(
        (allocation) =>
          allocation.inventory_item_id === itemId &&
          allocation.camp_week_id === weekId &&
          activeAllocationStatuses.includes(allocation.status)
      )
      .reduce((sum, allocation) => sum + allocation.quantity, 0);
  };

  const selectedItemAllocated =
    selectedItem && selectedWeek
      ? getAllocatedQuantity(selectedItem.id, selectedWeek.id)
      : 0;

  const selectedItemRemaining =
    selectedItem && selectedWeek
      ? selectedItem.quantity - selectedItemAllocated
      : 0;

  const weeklyItemSummary = useMemo(() => {
    if (!selectedWeek) return [];

    return items
      .map((item) => {
        const allocated = getAllocatedQuantity(item.id, selectedWeek.id);
        return {
          ...item,
          allocated,
          remaining: item.quantity - allocated,
        };
      })
      .filter((item) => {
        const query = itemSearch.trim().toLowerCase();
        if (!query) return true;

        return [item.name, item.asset_code ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, allocations, selectedWeek, itemSearch]);

  const filteredAllocations = useMemo(() => {
    return allocations.filter((allocation) => {
      const matchesWeek =
        !selectedWeekId || String(allocation.camp_week_id) === selectedWeekId;

      const matchesSite =
        !siteFilterId || String(allocation.camp_site_id) === siteFilterId;

      const query = itemSearch.trim().toLowerCase();
      const textBlob = [
        allocation.inventory_items?.name ?? "",
        allocation.inventory_items?.asset_code ?? "",
        allocation.camp_sites?.name ?? "",
        allocation.responsible_person ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || textBlob.includes(query);

      return matchesWeek && matchesSite && matchesSearch;
    });
  }, [allocations, selectedWeekId, siteFilterId, itemSearch]);

  const handleCreateAllocation = async () => {
    setMessage("");

    if (!selectedWeekId || !selectedItemId || !selectedSiteId) {
      setMessage("Choose a week, item, and camp site.");
      return;
    }

    if (quantity <= 0) {
      setMessage("Quantity must be greater than 0.");
      return;
    }

    if (activeAllocationStatuses.includes(status) && quantity > selectedItemRemaining) {
      setMessage(
        `Cannot allocate ${quantity}. Only ${selectedItemRemaining} remaining for this item in ${selectedWeek?.label ?? "this week"}.`
      );
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { error } = await supabase.from("camp_allocations").upsert(
      {
        inventory_item_id: Number(selectedItemId),
        camp_site_id: Number(selectedSiteId),
        camp_week_id: Number(selectedWeekId),
        quantity,
        status,
        responsible_person:
          responsiblePerson.trim() || selectedSite?.site_leader_name || null,
        responsible_email:
          responsibleEmail.trim() || selectedSite?.site_leader_email || null,
        notes: notes.trim() || null,
        created_by: user.id,
      },
      {
        onConflict: "inventory_item_id,camp_site_id,camp_week_id",
      }
    );

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessage("Camp allocation saved.");
    setSelectedItemId("");
    setSelectedSiteId("");
    setQuantity(1);
    setStatus("planned");
    setResponsiblePerson("");
    setResponsibleEmail("");
    setNotes("");
    setSaving(false);

    await loadData();
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

    setMessage("Allocation status updated.");
    await loadData();
  };

  const handleDeleteAllocation = async (allocationId: number) => {
    const confirmed = window.confirm("Delete this camp allocation?");
    if (!confirmed) return;

    setMessage("");

    const { error } = await supabase
      .from("camp_allocations")
      .delete()
      .eq("id", allocationId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Camp allocation deleted.");
    await loadData();
  };

  const totalAllocatedThisWeek = selectedWeek
    ? allocations
        .filter(
          (allocation) =>
            allocation.camp_week_id === selectedWeek.id &&
            activeAllocationStatuses.includes(allocation.status)
        )
        .reduce((sum, allocation) => sum + allocation.quantity, 0)
    : 0;

  const itemCountWithAllocationsThisWeek = selectedWeek
    ? new Set(
        allocations
          .filter(
            (allocation) =>
              allocation.camp_week_id === selectedWeek.id &&
              activeAllocationStatuses.includes(allocation.status)
          )
          .map((allocation) => allocation.inventory_item_id)
      ).size
    : 0;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">Inventory System</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Camp Allocations
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Plan how inventory is split across camp sites by week and assigned to each site leader.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadData}
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Refresh
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
            <p className="text-sm text-slate-400">Selected Week</p>
            <p className="mt-2 text-2xl font-bold">
              {selectedWeek?.label ?? "None"}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Camp Sites</p>
            <p className="mt-2 text-2xl font-bold">{sites.length}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Items Allocated This Week</p>
            <p className="mt-2 text-2xl font-bold">
              {itemCountWithAllocationsThisWeek}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Total Units Allocated</p>
            <p className="mt-2 text-2xl font-bold">{totalAllocatedThisWeek}</p>
          </div>
        </div>

        <div className="mb-8 grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight">
              Add / Update Allocation
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              If the same item, site, and week already exists, this will update that allocation.
            </p>

            <div className="mt-6 grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Week</label>
                <select
                  value={selectedWeekId}
                  onChange={(e) => setSelectedWeekId(e.target.value)}
                  className={selectClass}
                >
                  <option value="" className={optionClass}>
                    Select week
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
                <label className="text-sm font-medium text-slate-200">Inventory Item</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className={selectClass}
                >
                  <option value="" className={optionClass}>
                    Select item
                  </option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id} className={optionClass}>
                      {item.asset_code ? `${item.asset_code} - ` : ""}
                      {item.name} ({item.quantity} total)
                    </option>
                  ))}
                </select>

                {selectedItem && selectedWeek && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                    <div>Total: {selectedItem.quantity}</div>
                    <div>Already allocated this week: {selectedItemAllocated}</div>
                    <div>
                      Remaining this week:{" "}
                      <span
                        className={
                          selectedItemRemaining <= 0
                            ? "font-semibold text-rose-300"
                            : "font-semibold text-emerald-300"
                        }
                      >
                        {selectedItemRemaining}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Camp Site</label>
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className={selectClass}
                >
                  <option value="" className={optionClass}>
                    Select site
                  </option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id} className={optionClass}>
                      {site.name}
                    </option>
                  ))}
                </select>

                {selectedSite && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                    <div>Leader: {selectedSite.site_leader_name || "Not assigned"}</div>
                    <div>Email: {selectedSite.site_leader_email || "Not assigned"}</div>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AllocationStatus)}
                    className={selectClass}
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">
                    Responsible Person
                  </label>
                  <input
                    type="text"
                    value={responsiblePerson}
                    onChange={(e) => setResponsiblePerson(e.target.value)}
                    placeholder="Site leader name"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">
                    Responsible Email
                  </label>
                  <input
                    type="email"
                    value={responsibleEmail}
                    onChange={(e) => setResponsibleEmail(e.target.value)}
                    placeholder="siteleader@email.com"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Delivery notes, packing notes, special instructions..."
                  rows={4}
                  className={inputClass}
                />
              </div>

              <button
                onClick={handleCreateAllocation}
                disabled={saving}
                className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Allocation"}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Weekly Inventory Availability
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Shows total, allocated, and remaining quantity for the selected week.
                </p>
              </div>

              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search item or asset code..."
                className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-blue-400 lg:max-w-sm"
              />
            </div>

            <div className="mt-6 max-h-[620px] space-y-3 overflow-y-auto pr-1">
              {loading ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-400">
                  Loading...
                </div>
              ) : weeklyItemSummary.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-400">
                  No inventory items found.
                </div>
              ) : (
                weeklyItemSummary.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-semibold text-white">{item.name}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {item.asset_code || "No asset code"}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-sm sm:min-w-[280px]">
                        <div className="rounded-xl bg-slate-800 px-3 py-2">
                          <div className="text-xs text-slate-400">Total</div>
                          <div className="font-semibold">{item.quantity}</div>
                        </div>

                        <div className="rounded-xl bg-blue-950/50 px-3 py-2">
                          <div className="text-xs text-blue-300">Allocated</div>
                          <div className="font-semibold">{item.allocated}</div>
                        </div>

                        <div
                          className={`rounded-xl px-3 py-2 ${
                            item.remaining < 0
                              ? "bg-rose-950/50"
                              : item.remaining === 0
                              ? "bg-amber-950/50"
                              : "bg-emerald-950/50"
                          }`}
                        >
                          <div className="text-xs text-slate-300">Remaining</div>
                          <div className="font-semibold">{item.remaining}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Allocation List
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                View all saved allocations for the selected filters.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[500px]">
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
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredAllocations.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-400">
                No camp allocations found.
              </div>
            ) : (
              filteredAllocations.map((allocation) => (
                <div
                  key={allocation.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">
                          {allocation.inventory_items?.name ?? "Unknown Item"}
                        </h3>

                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                          {allocation.inventory_items?.asset_code ?? "No Asset Code"}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass[allocation.status]}`}
                        >
                          {allocation.status.replace("_", " ")}
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
                          <span className="text-slate-500">Quantity:</span>{" "}
                          {allocation.quantity}
                        </div>
                        <div>
                          <span className="text-slate-500">Responsible:</span>{" "}
                          {allocation.responsible_person || "Not assigned"}
                        </div>
                      </div>

                      {allocation.responsible_email && (
                        <div className="mt-2 text-sm text-slate-400">
                          {allocation.responsible_email}
                        </div>
                      )}

                      {allocation.notes && (
                        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300">
                          {allocation.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3">
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

                      <button
                        onClick={() => handleDeleteAllocation(allocation.id)}
                        className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
                      >
                        Delete
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
