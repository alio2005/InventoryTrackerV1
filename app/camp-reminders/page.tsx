"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createNotificationsForUserAndAdmins } from "@/lib/notifications";
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

type ReminderFilter = "all_issues" | "missing" | "damaged" | "outstanding";

export default function CampRemindersPage() {
  const router = useRouter();

  const [allocations, setAllocations] = useState<CampAllocation[]>([]);
  const [sites, setSites] = useState<CampSite[]>([]);
  const [weeks, setWeeks] = useState<CampWeek[]>([]);

  const [siteFilterId, setSiteFilterId] = useState("");
  const [weekFilterId, setWeekFilterId] = useState("");
  const [reminderFilter, setReminderFilter] =
    useState<ReminderFilter>("all_issues");
  const [searchTerm, setSearchTerm] = useState("");
  const [customMessage, setCustomMessage] = useState(
    "Please review and update the return status for the camp inventory items assigned to your site."
  );

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [sendingBulk, setSendingBulk] = useState(false);

  const selectClass =
    "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 [color-scheme:dark]";

  const inputClass =
    "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-blue-400";

  const optionClass = "bg-slate-900 text-white";

  const getOutstandingQuantity = (allocation: CampAllocation) => {
    return Math.max(
      allocation.quantity -
        allocation.returned_quantity -
        allocation.missing_quantity -
        allocation.damaged_quantity,
      0
    );
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
        inventory_items(id, name, asset_code, quantity),
        camp_sites(id, name, site_leader_name, site_leader_email, address, notes, is_active),
        camp_weeks(id, week_number, label, start_date, end_date, is_active)
      `
      )
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

  const filteredAllocations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return allocations
      .filter((allocation) => {
        const outstanding = getOutstandingQuantity(allocation);
        const hasMissing = allocation.missing_quantity > 0;
        const hasDamaged = allocation.damaged_quantity > 0;
        const hasIssue = hasMissing || hasDamaged || outstanding > 0;

        const matchesSite =
          !siteFilterId || String(allocation.camp_site_id) === siteFilterId;

        const matchesWeek =
          !weekFilterId || String(allocation.camp_week_id) === weekFilterId;

        const matchesReminderFilter =
          (reminderFilter === "all_issues" && hasIssue) ||
          (reminderFilter === "missing" && hasMissing) ||
          (reminderFilter === "damaged" && hasDamaged) ||
          (reminderFilter === "outstanding" && outstanding > 0);

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
          matchesSite && matchesWeek && matchesReminderFilter && matchesSearch
        );
      })
      .sort((a, b) => {
        const siteCompare = (a.camp_sites?.name ?? "").localeCompare(
          b.camp_sites?.name ?? ""
        );

        if (siteCompare !== 0) return siteCompare;

        const weekCompare =
          (a.camp_weeks?.week_number ?? 0) - (b.camp_weeks?.week_number ?? 0);

        if (weekCompare !== 0) return weekCompare;

        return (a.inventory_items?.name ?? "").localeCompare(
          b.inventory_items?.name ?? ""
        );
      });
  }, [
    allocations,
    siteFilterId,
    weekFilterId,
    reminderFilter,
    searchTerm,
  ]);

  const sendReminderForAllocation = async (allocation: CampAllocation) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const itemName = allocation.inventory_items?.name ?? "Unknown item";
    const assetCode = allocation.inventory_items?.asset_code ?? "No Asset Code";
    const siteName = allocation.camp_sites?.name ?? "Unknown site";
    const weekLabel = allocation.camp_weeks?.label ?? "Unknown week";
    const responsibleEmail =
      allocation.responsible_email || allocation.camp_sites?.site_leader_email || "";

    const outstanding = getOutstandingQuantity(allocation);

    const title = "Camp inventory return reminder";
    const bodyMessage = `${customMessage}

Item: ${itemName} (${assetCode})
Site: ${siteName}
Week: ${weekLabel}
Allocated: ${allocation.quantity}
Returned: ${allocation.returned_quantity}
Missing: ${allocation.missing_quantity}
Damaged: ${allocation.damaged_quantity}
Outstanding: ${outstanding}`;

    await createNotificationsForUserAndAdmins({
      title,
      message: bodyMessage,
      currentUserId: user.id,
    });

    if (responsibleEmail.trim()) {
      const { data: leaderProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", responsibleEmail.trim())
        .maybeSingle();

      if (leaderProfile?.id && leaderProfile.id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: leaderProfile.id,
          title,
          message: bodyMessage,
          is_read: false,
        });
      }
    }
  };

  const handleSendSingleReminder = async (allocation: CampAllocation) => {
    setMessage("");
    setSendingId(allocation.id);

    try {
      await sendReminderForAllocation(allocation);
      setMessage("Reminder sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to send reminder.");
    }

    setSendingId(null);
  };

  const handleSendBulkReminders = async () => {
    if (filteredAllocations.length === 0) {
      setMessage("No visible issue records to remind.");
      return;
    }

    const confirmed = window.confirm(
      `Send reminders for ${filteredAllocations.length} visible issue record(s)?`
    );

    if (!confirmed) return;

    setMessage("");
    setSendingBulk(true);

    try {
      for (const allocation of filteredAllocations) {
        await sendReminderForAllocation(allocation);
      }

      setMessage(`Sent ${filteredAllocations.length} reminder notification(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to send reminders.");
    }

    setSendingBulk(false);
  };

  const summary = useMemo(() => {
    const missing = filteredAllocations.reduce(
      (sum, allocation) => sum + allocation.missing_quantity,
      0
    );

    const damaged = filteredAllocations.reduce(
      (sum, allocation) => sum + allocation.damaged_quantity,
      0
    );

    const outstanding = filteredAllocations.reduce(
      (sum, allocation) => sum + getOutstandingQuantity(allocation),
      0
    );

    return {
      records: filteredAllocations.length,
      missing,
      damaged,
      outstanding,
    };
  }, [filteredAllocations]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">Inventory System</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Camp Return Reminders
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Send in-app reminders to admins and matched site leader accounts for missing, damaged, or outstanding camp inventory.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSendBulkReminders}
              disabled={sendingBulk || filteredAllocations.length === 0}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sendingBulk ? "Sending..." : "Send Visible Reminders"}
            </button>

            <button
              onClick={() => router.push("/camp-return-report")}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Return Report
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
            <p className="text-sm text-slate-400">Issue Records</p>
            <p className="mt-2 text-2xl font-bold">{summary.records}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Missing Units</p>
            <p className="mt-2 text-2xl font-bold text-rose-300">
              {summary.missing}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Damaged Units</p>
            <p className="mt-2 text-2xl font-bold text-amber-300">
              {summary.damaged}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Outstanding Units</p>
            <p className="mt-2 text-2xl font-bold text-blue-300">
              {summary.outstanding}
            </p>
          </div>
        </div>

        <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight">Reminder Message</h2>
          <p className="mt-1 text-sm text-slate-400">
            This message will be included above the item details in each reminder.
          </p>

          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={4}
            className={`${inputClass} mt-5`}
          />
        </section>

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
              <label className="text-sm font-medium text-slate-200">Reminder Type</label>
              <select
                value={reminderFilter}
                onChange={(e) => setReminderFilter(e.target.value as ReminderFilter)}
                className={selectClass}
              >
                <option value="all_issues" className={optionClass}>
                  All Issues
                </option>
                <option value="missing" className={optionClass}>
                  Missing Only
                </option>
                <option value="damaged" className={optionClass}>
                  Damaged Only
                </option>
                <option value="outstanding" className={optionClass}>
                  Outstanding Only
                </option>
              </select>
            </div>

            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium text-slate-200">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Item, site, week, asset code, leader..."
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight">
              Reminder Queue
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Only unresolved records are shown here.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-sm text-slate-400">
              Loading reminders...
            </div>
          ) : filteredAllocations.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-400">
              No unresolved camp return records match your filters.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAllocations.map((allocation) => {
                const outstanding = getOutstandingQuantity(allocation);
                const leaderEmail =
                  allocation.responsible_email ||
                  allocation.camp_sites?.site_leader_email ||
                  "";

                return (
                  <div
                    key={allocation.id}
                    className="rounded-2xl border border-rose-900/70 bg-rose-950/20 p-5"
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

                          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-800">
                            Needs Reminder
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
                            <span className="text-slate-500">Leader Email:</span>{" "}
                            {leaderEmail || "No matching email"}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 text-center text-sm sm:grid-cols-5">
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

                        {allocation.return_notes && (
                          <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300">
                            {allocation.return_notes}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleSendSingleReminder(allocation)}
                        disabled={sendingId === allocation.id}
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sendingId === allocation.id ? "Sending..." : "Send Reminder"}
                      </button>
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
