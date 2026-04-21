"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createNotificationsForUserAndAdmins } from "@/lib/notifications";

type InventoryItem = {
  id: number;
  name: string;
  asset_code: string | null;
  quantity: number;
  photo_url: string | null;
  inventory_categories: { name: string } | null;
};

type InventoryUnitStatus =
  | "available"
  | "borrowed"
  | "camp_allocated"
  | "missing"
  | "damaged"
  | "retired";

type InventoryUnit = {
  id: number;
  inventory_item_id: number;
  unit_code: string;
  phone_number: string | null;
  serial_number: string | null;
  imei: string | null;
  status: InventoryUnitStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const statusOptions: { value: InventoryUnitStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "borrowed", label: "Borrowed" },
  { value: "camp_allocated", label: "Camp Allocated" },
  { value: "missing", label: "Missing" },
  { value: "damaged", label: "Damaged" },
  { value: "retired", label: "Retired" },
];

const statusBadgeClass: Record<InventoryUnitStatus, string> = {
  available: "bg-emerald-100 text-emerald-800",
  borrowed: "bg-blue-100 text-blue-800",
  camp_allocated: "bg-violet-100 text-violet-800",
  missing: "bg-rose-100 text-rose-800",
  damaged: "bg-amber-100 text-amber-800",
  retired: "bg-slate-200 text-slate-700",
};

export default function InventoryUnitsPage() {
  const router = useRouter();
  const params = useParams();

  const itemIdParam = Array.isArray(params.itemId)
    ? params.itemId[0]
    : params.itemId;

  const itemId = Number(itemIdParam);

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [units, setUnits] = useState<InventoryUnit[]>([]);

  const [unitCode, setUnitCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [imei, setImei] = useState("");
  const [unitStatus, setUnitStatus] = useState<InventoryUnitStatus>("available");
  const [notes, setNotes] = useState("");

  const [bulkPrefix, setBulkPrefix] = useState("IPH");
  const [bulkStart, setBulkStart] = useState(1);
  const [bulkCount, setBulkCount] = useState(10);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InventoryUnitStatus>("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const inputClass =
    "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-blue-400";

  const selectClass =
    "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 [color-scheme:dark]";

  const optionClass = "bg-slate-900 text-white";

  const normalizeUnitCode = (value: string) =>
    value.trim().toUpperCase().replace(/\s+/g, "-");

  const loadData = async () => {
    setLoading(true);
    setMessage("");

    if (!itemId || Number.isNaN(itemId)) {
      setMessage("Invalid inventory item ID.");
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { data: itemData, error: itemError } = await supabase
      .from("inventory_items")
      .select("id, name, asset_code, quantity, photo_url, inventory_categories(name)")
      .eq("id", itemId)
      .single();

    if (itemError) {
      setMessage(itemError.message);
      setLoading(false);
      return;
    }

    const { data: unitData, error: unitError } = await supabase
      .from("inventory_units")
      .select("id, inventory_item_id, unit_code, phone_number, serial_number, imei, status, notes, created_at, updated_at")
      .eq("inventory_item_id", itemId)
      .order("unit_code");

    if (unitError) {
      setMessage(unitError.message);
      setLoading(false);
      return;
    }

    setItem(itemData as unknown as InventoryItem);
    setUnits((unitData ?? []) as InventoryUnit[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const filteredUnits = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return units.filter((unit) => {
      const matchesStatus = statusFilter === "all" || unit.status === statusFilter;

      const textBlob = [
        unit.unit_code,
        unit.phone_number ?? "",
        unit.serial_number ?? "",
        unit.imei ?? "",
        unit.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || textBlob.includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [units, statusFilter, searchTerm]);

  const statusCounts = statusOptions.reduce((acc, option) => {
    acc[option.value] = units.filter((unit) => unit.status === option.value).length;
    return acc;
  }, {} as Record<InventoryUnitStatus, number>);

  const handleAddUnit = async () => {
    setMessage("");

    if (!item) return;

    const normalizedCode = normalizeUnitCode(unitCode);

    if (!normalizedCode) {
      setMessage("Unit code is required.");
      return;
    }

    const { error } = await supabase.from("inventory_units").insert({
      inventory_item_id: item.id,
      unit_code: normalizedCode,
      phone_number: phoneNumber.trim() || null,
      serial_number: serialNumber.trim() || null,
      imei: imei.trim() || null,
      status: unitStatus,
      notes: notes.trim() || null,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setUnitCode("");
    setPhoneNumber("");
    setSerialNumber("");
    setImei("");
    setUnitStatus("available");
    setNotes("");
    setMessage("Unit added.");
    await loadData();
  };

  const handleGenerateUnits = async () => {
    setMessage("");

    if (!item) return;

    if (!bulkPrefix.trim()) {
      setMessage("Prefix is required.");
      return;
    }

    if (bulkCount <= 0 || bulkCount > 500) {
      setMessage("Bulk count must be between 1 and 500.");
      return;
    }

    const rows = Array.from({ length: bulkCount }, (_, index) => {
      const number = bulkStart + index;
      return {
        inventory_item_id: item.id,
        unit_code: `${bulkPrefix.trim().toUpperCase()}-${String(number).padStart(3, "0")}`,
        status: "available" as InventoryUnitStatus,
      };
    });

    const { error } = await supabase.from("inventory_units").insert(rows);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`${bulkCount} unit(s) generated.`);
    await loadData();
  };

  const handleUpdateUnitStatus = async (
    unit: InventoryUnit,
    status: InventoryUnitStatus
  ) => {
    setMessage("");

    const { error } = await supabase
      .from("inventory_units")
      .update({ status })
      .eq("id", unit.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`${unit.unit_code} updated.`);
    await loadData();
  };

  const handleReportUnitIssue = async (
    unit: InventoryUnit,
    reportType: "missing" | "damaged"
  ) => {
    setMessage("");

    if (!item) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { error } = await supabase.from("missing_damaged_reports").insert({
      inventory_item_id: item.id,
      inventory_unit_id: unit.id,
      report_type: reportType,
      quantity: 1,
      notes: `${unit.unit_code} was reported as ${reportType}.`,
      reported_by: user.id,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    await createNotificationsForUserAndAdmins({
      title: reportType === "missing" ? "Unit reported missing" : "Unit reported damaged",
      message: `${unit.unit_code} from ${item.name} was reported as ${reportType}.`,
      currentUserId: user.id,
    });

    setMessage(`${unit.unit_code} reported as ${reportType}.`);
    await loadData();
  };

  const handleDeleteUnit = async (unit: InventoryUnit) => {
    const confirmed = window.confirm(`Delete unit ${unit.unit_code}?`);
    if (!confirmed) return;

    setMessage("");

    const { error } = await supabase
      .from("inventory_units")
      .delete()
      .eq("id", unit.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`${unit.unit_code} deleted.`);
    await loadData();
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">Inventory System</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Manage Units
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Track individual sub-items such as phones, tablets, cameras, and devices.
            </p>

            {item && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                  {item.asset_code ?? "No Asset Code"}
                </span>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                  {item.name}
                </span>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                  Parent Qty: {item.quantity}
                </span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                  Units: {units.length}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => router.push("/missing-damaged")}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-700"
            >
              Missing / Damaged
            </button>

            <button
              onClick={() => router.push("/inventory")}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
            >
              Back to Inventory
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200">
            {message}
          </div>
        )}

        <div className="mb-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {statusOptions.map((option) => (
            <div
              key={option.value}
              className="rounded-3xl border border-slate-800 bg-slate-900 p-5"
            >
              <p className="text-sm text-slate-400">{option.label}</p>
              <p className="mt-2 text-2xl font-bold">
                {statusCounts[option.value] ?? 0}
              </p>
            </div>
          ))}
        </div>

        <div className="mb-8 grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight">Add Single Unit</h2>
            <p className="mt-1 text-sm text-slate-400">
              Use this when you need to enter a specific phone number, serial number, or IMEI.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Unit Code</label>
                <input
                  type="text"
                  value={unitCode}
                  onChange={(e) => setUnitCode(normalizeUnitCode(e.target.value))}
                  placeholder="IPH-001"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Phone Number</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Serial Number</label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">IMEI</label>
                <input
                  type="text"
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Status</label>
                <select
                  value={unitStatus}
                  onChange={(e) => setUnitStatus(e.target.value as InventoryUnitStatus)}
                  className={selectClass}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value} className={optionClass}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-200">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Condition, assigned SIM, accessories, etc."
                  className={inputClass}
                />
              </div>
            </div>

            <button
              onClick={handleAddUnit}
              className="mt-5 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Add Unit
            </button>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight">Bulk Generate Units</h2>
            <p className="mt-1 text-sm text-slate-400">
              Example: prefix IPH, start 1, count 100 creates IPH-001 to IPH-100.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Prefix</label>
                <input
                  type="text"
                  value={bulkPrefix}
                  onChange={(e) => setBulkPrefix(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Start Number</label>
                <input
                  type="number"
                  min="1"
                  value={bulkStart}
                  onChange={(e) => setBulkStart(Number(e.target.value))}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Count</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={bulkCount}
                  onChange={(e) => setBulkCount(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>

            <button
              onClick={handleGenerateUnits}
              className="mt-5 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              Generate Units
            </button>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
              For 100 phones, create the parent item as “iPhone” with quantity 100, then generate units IPH-001 to IPH-100 here.
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Unit List</h2>
              <p className="mt-1 text-sm text-slate-400">
                Search and update individual units.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | InventoryUnitStatus)}
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

              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search unit, phone, serial, IMEI..."
                className={inputClass}
              />
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-sm text-slate-400">
              Loading units...
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-400">
              No units found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUnits.map((unit) => (
                <div
                  key={unit.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{unit.unit_code}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass[unit.status]}`}>
                          {unit.status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <span className="text-slate-500">Phone:</span>{" "}
                          {unit.phone_number || "N/A"}
                        </div>
                        <div>
                          <span className="text-slate-500">Serial:</span>{" "}
                          {unit.serial_number || "N/A"}
                        </div>
                        <div>
                          <span className="text-slate-500">IMEI:</span>{" "}
                          {unit.imei || "N/A"}
                        </div>
                        <div>
                          <span className="text-slate-500">Updated:</span>{" "}
                          {new Date(unit.updated_at).toLocaleString()}
                        </div>
                      </div>

                      {unit.notes && (
                        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300">
                          {unit.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <select
                        value={unit.status}
                        onChange={(e) =>
                          handleUpdateUnitStatus(unit, e.target.value as InventoryUnitStatus)
                        }
                        className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value} className={optionClass}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleReportUnitIssue(unit, "missing")}
                        className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
                      >
                        Report Missing
                      </button>

                      <button
                        onClick={() => handleReportUnitIssue(unit, "damaged")}
                        className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
                      >
                        Report Damaged
                      </button>

                      <button
                        onClick={() => handleDeleteUnit(unit)}
                        className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600"
                      >
                        Delete
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
