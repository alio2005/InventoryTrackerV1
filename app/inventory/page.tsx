"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type InventoryItem = {
  id: number;
  name: string;
  quantity: number;
  is_active: boolean;
  department_id?: number;
  location_id?: number;
  departments: { name: string } | null;
  locations: { name: string } | null;
};

type Department = {
  id: number;
  name: string;
};

type Location = {
  id: number;
  name: string;
};

export default function InventoryPage() {
  const router = useRouter();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [departmentId, setDepartmentId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [message, setMessage] = useState("");

  const [filterDepartmentId, setFilterDepartmentId] = useState("");
  const [filterLocationId, setFilterLocationId] = useState("");

  const [adjustments, setAdjustments] = useState<Record<number, number>>({});
  const [role, setRole] = useState("");

  const loadData = async () => {
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

    const { data: deptData, error: deptError } = await supabase
      .from("departments")
      .select("id, name")
      .order("name");

    if (deptError) {
      setMessage(deptError.message);
      return;
    }

    const { data: locationData, error: locationError } = await supabase
      .from("locations")
      .select("id, name")
      .order("name");

    if (locationError) {
      setMessage(locationError.message);
      return;
    }

    const { data: itemData, error: itemError } = await supabase
      .from("inventory_items")
      .select(
        `
        id,
        name,
        quantity,
        is_active,
        department_id,
        location_id,
        departments(name),
        locations(name)
      `
      )
      .eq("is_active", true)
      .order("id", { ascending: false });

    if (itemError) {
      setMessage(itemError.message);
      return;
    }

    const safeItems = (itemData ?? []) as unknown as InventoryItem[];

    setDepartments(deptData || []);
    setLocations(locationData || []);
    setItems(safeItems);

    const newAdjustments: Record<number, number> = {};
    safeItems.forEach((item) => {
      newAdjustments[item.id] = adjustments[item.id] ?? 1;
    });
    setAdjustments(newAdjustments);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesDepartment =
        !filterDepartmentId ||
        String(item.department_id ?? "") === filterDepartmentId;

      const matchesLocation =
        !filterLocationId ||
        String(item.location_id ?? "") === filterLocationId;

      return matchesDepartment && matchesLocation;
    });
  }, [items, filterDepartmentId, filterLocationId]);

  const handleAddItem = async () => {
    setMessage("");

    if (!name.trim() || !departmentId || !locationId) {
      setMessage("Please fill in all fields.");
      return;
    }

    if (quantity < 0) {
      setMessage("Quantity cannot be negative.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { data: insertedItem, error: insertError } = await supabase
      .from("inventory_items")
      .insert({
        name: name.trim(),
        quantity,
        department_id: Number(departmentId),
        location_id: Number(locationId),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertError) {
      setMessage(insertError.message);
      return;
    }

    const { error: transactionError } = await supabase
      .from("inventory_transactions")
      .insert({
        item_id: insertedItem.id,
        user_id: user.id,
        action: "add",
        quantity_changed: quantity,
        note: `Added item: ${name.trim()}`,
      });

    if (transactionError) {
      setMessage(transactionError.message);
      return;
    }

    setName("");
    setQuantity(0);
    setDepartmentId("");
    setLocationId("");
    setMessage("Item added.");

    await loadData();
  };

  const handleArchive = async (id: number, itemName: string) => {
    if (role !== "admin") {
      setMessage("Only admins can archive items.");
      return;
    }

    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { error: updateError } = await supabase
      .from("inventory_items")
      .update({ is_active: false })
      .eq("id", id);

    if (updateError) {
      setMessage(updateError.message);
      return;
    }

    const { error: transactionError } = await supabase
      .from("inventory_transactions")
      .insert({
        item_id: id,
        user_id: user.id,
        action: "archive",
        quantity_changed: 0,
        note: `Archived item: ${itemName}`,
      });

    if (transactionError) {
      setMessage(transactionError.message);
      return;
    }

    setMessage("Item archived.");
    await loadData();
  };

  const handleCheckIn = async (itemId: number, currentQuantity: number) => {
    setMessage("");

    const amount = Number(adjustments[itemId] ?? 0);

    if (amount <= 0) {
      setMessage("Enter a number greater than 0.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const newQuantity = currentQuantity + amount;

    const { error: updateError } = await supabase
      .from("inventory_items")
      .update({ quantity: newQuantity })
      .eq("id", itemId);

    if (updateError) {
      setMessage(updateError.message);
      return;
    }

    const { error: transactionError } = await supabase
      .from("inventory_transactions")
      .insert({
        item_id: itemId,
        user_id: user.id,
        action: "check_in",
        quantity_changed: amount,
        note: "Inventory checked in",
      });

    if (transactionError) {
      setMessage(transactionError.message);
      return;
    }

    setMessage("Inventory checked in.");
    await loadData();
  };

  const handleCheckOut = async (itemId: number, currentQuantity: number) => {
    setMessage("");

    const amount = Number(adjustments[itemId] ?? 0);

    if (amount <= 0) {
      setMessage("Enter a number greater than 0.");
      return;
    }

    if (amount > currentQuantity) {
      setMessage("Cannot check out more than available quantity.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const newQuantity = currentQuantity - amount;

    const { error: updateError } = await supabase
      .from("inventory_items")
      .update({ quantity: newQuantity })
      .eq("id", itemId);

    if (updateError) {
      setMessage(updateError.message);
      return;
    }

    const { error: transactionError } = await supabase
      .from("inventory_transactions")
      .insert({
        item_id: itemId,
        user_id: user.id,
        action: "check_out",
        quantity_changed: amount,
        note: "Inventory checked out",
      });

    if (transactionError) {
      setMessage(transactionError.message);
      return;
    }

    setMessage("Inventory checked out.");
    await loadData();
  };

  const clearFilters = () => {
    setFilterDepartmentId("");
    setFilterLocationId("");
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Inventory System</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Inventory</h1>
            <div className="mt-3 flex flex-col gap-1 text-sm text-slate-600 sm:flex-row sm:gap-6">
              <span>
                Role:{" "}
                <span className="font-medium capitalize text-slate-900">
                  {role || "unknown"}
                </span>
              </span>
              <span>
                Active Items:{" "}
                <span className="font-medium text-slate-900">{items.length}</span>
              </span>
            </div>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="mb-8 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-semibold tracking-tight">Add inventory item</h2>
              <p className="mt-1 text-sm text-slate-500">
                Create a new item and assign it to a department and location.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Item name</label>
                <input
                  type="text"
                  placeholder="Enter item name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Quantity</label>
                <input
                  type="number"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Department</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                >
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Location</label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                >
                  <option value="">Select location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={handleAddItem}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Add Item
              </button>

              {message && (
                <span className="text-sm text-slate-600">{message}</span>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-semibold tracking-tight">Filters</h2>
              <p className="mt-1 text-sm text-slate-500">
                Narrow inventory by department or office location.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Department filter
                </label>
                <select
                  value={filterDepartmentId}
                  onChange={(e) => setFilterDepartmentId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                >
                  <option value="">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Location filter
                </label>
                <select
                  value={filterLocationId}
                  onChange={(e) => setFilterLocationId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                >
                  <option value="">All Locations</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={clearFilters}
                className="inline-flex items-center justify-center rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-300"
              >
                Clear Filters
              </button>
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Current inventory</h2>
              <p className="mt-1 text-sm text-slate-500">
                Review inventory, adjust quantity, and manage item status.
              </p>
            </div>
            <div className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-900">{filteredItems.length}</span> item(s)
            </div>
          </div>

          <div className="space-y-5">
            {filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No inventory matches the selected filters.
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300"
                >
                  <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                        {item.name}
                      </h3>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                          Quantity: {item.quantity}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                          {item.departments?.name ?? "No Department"}
                        </span>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                          {item.locations?.name ?? "No Location"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">
                        Adjustment amount
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={adjustments[item.id] ?? 1}
                        onChange={(e) =>
                          setAdjustments((prev) => ({
                            ...prev,
                            [item.id]: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                      />
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                      <button
                        onClick={() => handleCheckIn(item.id, item.quantity)}
                        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                      >
                        Check In
                      </button>

                      <button
                        onClick={() => handleCheckOut(item.id, item.quantity)}
                        className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                      >
                        Check Out
                      </button>

                      {role === "admin" && (
                        <button
                          onClick={() => handleArchive(item.id, item.name)}
                          className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700"
                        >
                          Archive
                        </button>
                      )}
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