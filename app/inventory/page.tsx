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
    <main style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", padding: "24px", color: "black" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h1 style={{ fontSize: "30px", fontWeight: "bold", margin: 0 }}>Inventory</h1>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <span>Role: {role || "unknown"}</span>
              <button
                onClick={() => router.push("/dashboard")}
                style={{
                  backgroundColor: "black",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
              >
                Back to Dashboard
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <input
              type="text"
              placeholder="Item name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                padding: "12px",
                color: "black",
              }}
            />

            <input
              type="number"
              placeholder="Quantity"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                padding: "12px",
                color: "black",
              }}
            />

            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                padding: "12px",
                color: "black",
              }}
            >
              <option value="">Select department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>

            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                padding: "12px",
                color: "black",
              }}
            >
              <option value="">Select location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAddItem}
            style={{
              marginTop: "16px",
              backgroundColor: "black",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            Add Item
          </button>

          {message && <p style={{ marginTop: "12px", color: "black" }}>{message}</p>}
        </div>

        <div
          style={{
            backgroundColor: "white",
            borderRadius: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ fontSize: "28px", fontWeight: "bold", margin: 0 }}>
              Current Inventory
            </h2>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <select
                value={filterDepartmentId}
                onChange={(e) => setFilterDepartmentId(e.target.value)}
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  color: "black",
                }}
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>

              <select
                value={filterLocationId}
                onChange={(e) => setFilterLocationId(e.target.value)}
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  color: "black",
                }}
              >
                <option value="">All Locations</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>

              <button
                onClick={clearFilters}
                style={{
                  backgroundColor: "#374151",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {filteredItems.length === 0 ? (
              <p>No inventory matches the selected filters.</p>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: "12px",
                    padding: "20px",
                  }}
                >
                  <div style={{ marginBottom: "16px" }}>
                    <p style={{ fontSize: "22px", fontWeight: "bold", margin: "0 0 8px 0" }}>
                      {item.name}
                    </p>
                    <p style={{ margin: "4px 0" }}>Quantity: {item.quantity}</p>
                    <p style={{ margin: "4px 0" }}>
                      Department: {item.departments?.name ?? "N/A"}
                    </p>
                    <p style={{ margin: "4px 0" }}>
                      Location: {item.locations?.name ?? "N/A"}
                    </p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
                      style={{
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        padding: "12px",
                        maxWidth: "220px",
                        color: "black",
                      }}
                    />

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                      <button
                        onClick={() => handleCheckIn(item.id, item.quantity)}
                        style={{
                          backgroundColor: "green",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          padding: "10px 16px",
                          cursor: "pointer",
                        }}
                      >
                        Check In
                      </button>

                      <button
                        onClick={() => handleCheckOut(item.id, item.quantity)}
                        style={{
                          backgroundColor: "blue",
                          color: "white",
                          border: "none",
                          borderRadius: "8px",
                          padding: "10px 16px",
                          cursor: "pointer",
                        }}
                      >
                        Check Out
                      </button>

                      {role === "admin" && (
                        <button
                          onClick={() => handleArchive(item.id, item.name)}
                          style={{
                            backgroundColor: "red",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            padding: "10px 16px",
                            cursor: "pointer",
                          }}
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
        </div>
      </div>
    </main>
  );
}