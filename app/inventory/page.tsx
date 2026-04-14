"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { createNotificationsForUserAndAdmins } from "@/lib/notifications";

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
  const [userEmail, setUserEmail] = useState("");
  const [borrowerName, setBorrowerName] = useState("");

  const [darkMode, setDarkMode] = useState(false);

  const [openBorrowItemId, setOpenBorrowItemId] = useState<number | null>(null);
  const [borrowQuantities, setBorrowQuantities] = useState<Record<number, number>>(
    {}
  );
  const [borrowComments, setBorrowComments] = useState<Record<number, string>>({});
  const [borrowDates, setBorrowDates] = useState<Record<number, string>>({});

  const extractFirstName = (email: string) => {
    const localPart = email.split("@")[0] || "";
    const firstPart = localPart.split(".")[0] || "";
    if (!firstPart) return "";
    return firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("inventory-dark-mode");
    if (savedTheme === "true") {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("inventory-dark-mode", String(darkMode));
  }, [darkMode]);

  const loadData = async () => {
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const currentEmail = user.email ?? "";
    setUserEmail(currentEmail);
    setBorrowerName(extractFirstName(currentEmail));

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
    const newBorrowQuantities: Record<number, number> = {};

    safeItems.forEach((item) => {
      newAdjustments[item.id] = adjustments[item.id] ?? 1;
      newBorrowQuantities[item.id] = borrowQuantities[item.id] ?? 1;
    });

    setAdjustments(newAdjustments);
    setBorrowQuantities(newBorrowQuantities);
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
    await createNotificationsForUserAndAdmins({
      title: "Inventory item added",
      message: `${name.trim()} was added with quantity ${quantity}.`,
      currentUserId: user.id,
    });

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
    await createNotificationsForUserAndAdmins({
     title: "Inventory item archived",
     message: `${itemName} was archived.`,
     currentUserId: user.id,
    });

    setMessage("Item archived.");
    await loadData();
  };

  const handleSignIn = async (itemId: number, currentQuantity: number) => {
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
        note: "Product signed in",
      });

    if (transactionError) {
      setMessage(transactionError.message);
      return;
    }
    const itemName = items.find((item) => item.id === itemId)?.name ?? "Item";

    await createNotificationsForUserAndAdmins({
      title: "Product signed in",
      message: `${itemName} was signed in with quantity ${amount}.`,
      currentUserId: user.id,
    });
    setMessage("Product signed in.");
    await loadData();
  };

  const handleBorrowSignOut = async (
    itemId: number,
    itemName: string,
    currentQuantity: number
  ) => {
    setMessage("");

    const amount = Number(borrowQuantities[itemId] ?? 0);
    const comment = borrowComments[itemId] ?? "";
    const expectedReturnDate = borrowDates[itemId] ?? "";

    if (amount <= 0) {
      setMessage("Enter a sign-out quantity greater than 0.");
      return;
    }

    if (amount > currentQuantity) {
      setMessage("Cannot sign out more than available quantity.");
      return;
    }

    if (!expectedReturnDate) {
      setMessage("Please choose an expected return date.");
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

    const { error: borrowError } = await supabase.from("borrowed_items").insert({
      item_id: itemId,
      user_id: user.id,
      borrower_email: userEmail,
      borrower_name: borrowerName,
      quantity: amount,
      comment,
      expected_return_date: expectedReturnDate,
      returned: false,
    });

    if (borrowError) {
      setMessage(borrowError.message);
      return;
    }

    const noteText = `Signed out by ${borrowerName}${
      comment ? ` | ${comment}` : ""
    } | Expected back: ${expectedReturnDate}`;

    const { error: transactionError } = await supabase
      .from("inventory_transactions")
      .insert({
        item_id: itemId,
        user_id: user.id,
        action: "check_out",
        quantity_changed: amount,
        note: noteText,
      });

    if (transactionError) {
      setMessage(transactionError.message);
      return;
    }
    await createNotificationsForUserAndAdmins({
      title: "Product signed out",
      message: `${borrowerName} signed out ${amount} of ${itemName}. Expected back: ${expectedReturnDate}.${comment ? ` Comment: ${comment}` : ""}`,
      currentUserId: user.id,
    });

    setBorrowComments((prev) => ({ ...prev, [itemId]: "" }));
    setBorrowDates((prev) => ({ ...prev, [itemId]: "" }));
    setBorrowQuantities((prev) => ({ ...prev, [itemId]: 1 }));
    setOpenBorrowItemId(null);

    setMessage(`${itemName} signed out by ${borrowerName}.`);
    await loadData();
  };

  const clearFilters = () => {
    setFilterDepartmentId("");
    setFilterLocationId("");
  };

  const pageBg = darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";
  const mainCard = darkMode
    ? "border-slate-800 bg-slate-900"
    : "border-slate-200 bg-white";
  const subCard = darkMode
    ? "border-slate-800 bg-slate-900"
    : "border-slate-200 bg-white";
  const itemCard = darkMode
    ? "border-slate-800 bg-slate-900 hover:border-slate-700"
    : "border-slate-200 bg-slate-50 hover:border-slate-300";
  const inputClass = darkMode
    ? "border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:bg-slate-800"
    : "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white";
  const mutedText = darkMode ? "text-slate-400" : "text-slate-500";
  const sectionText = darkMode ? "text-slate-300" : "text-slate-600";

  return (
    <main className={`min-h-screen ${pageBg}`}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className={`mb-8 flex flex-col gap-4 rounded-3xl border p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between ${mainCard}`}>
          <div>
            <p className={`text-sm font-medium ${mutedText}`}>Inventory System</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Inventory</h1>
            <div className={`mt-3 flex flex-col gap-1 text-sm sm:flex-row sm:gap-6 ${sectionText}`}>
              <span>
                User: <span className="font-medium">{borrowerName || "Unknown"}</span>
              </span>
              <span>
                Email: <span className="font-medium">{userEmail || "Unknown"}</span>
              </span>
              <span>
                Role: <span className="font-medium capitalize">{role || "unknown"}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setDarkMode((prev) => !prev)}
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                darkMode
                  ? "bg-slate-200 text-slate-900 hover:bg-white"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
              }`}
            >
              {darkMode ? "Light Mode" : "Dark Mode"}
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="mb-8 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <section className={`rounded-3xl border p-6 shadow-sm ${subCard}`}>
            <div className="mb-5">
              <h2 className="text-xl font-semibold tracking-tight">Add inventory item</h2>
              <p className={`mt-1 text-sm ${mutedText}`}>
                Create a new item and assign it to a department and location.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className={`text-sm font-medium ${sectionText}`}>Item name</label>
                <input
                  type="text"
                  placeholder="Enter item name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${inputClass}`}
                />
              </div>

              <div className="space-y-2">
                <label className={`text-sm font-medium ${sectionText}`}>Quantity</label>
                <input
                  type="number"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${inputClass}`}
                />
              </div>

              <div className="space-y-2">
                <label className={`text-sm font-medium ${sectionText}`}>Department</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${inputClass}`}
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
                <label className={`text-sm font-medium ${sectionText}`}>Location</label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${inputClass}`}
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
                <span className={`text-sm ${sectionText}`}>{message}</span>
              )}
            </div>
          </section>

          <section className={`rounded-3xl border p-6 shadow-sm ${subCard}`}>
            <div className="mb-5">
              <h2 className="text-xl font-semibold tracking-tight">Filters</h2>
              <p className={`mt-1 text-sm ${mutedText}`}>
                Narrow inventory by department or office location.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className={`text-sm font-medium ${sectionText}`}>Department filter</label>
                <select
                  value={filterDepartmentId}
                  onChange={(e) => setFilterDepartmentId(e.target.value)}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${inputClass}`}
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
                <label className={`text-sm font-medium ${sectionText}`}>Location filter</label>
                <select
                  value={filterLocationId}
                  onChange={(e) => setFilterLocationId(e.target.value)}
                  className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${inputClass}`}
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
                className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  darkMode
                    ? "bg-slate-700 text-slate-100 hover:bg-slate-600"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                Clear Filters
              </button>
            </div>
          </section>
        </div>

        <section className={`rounded-3xl border p-6 shadow-sm ${subCard}`}>
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Current inventory</h2>
              <p className={`mt-1 text-sm ${mutedText}`}>
                Sign products in, sign them out with comments and expected return dates, and manage stock.
              </p>
            </div>
            <div className={`text-sm ${mutedText}`}>
              Showing <span className="font-medium text-inherit">{filteredItems.length}</span> item(s)
            </div>
          </div>

          <div className="space-y-5">
            {filteredItems.length === 0 ? (
              <div
                className={`rounded-2xl border border-dashed p-8 text-center text-sm ${
                  darkMode
                    ? "border-slate-700 bg-slate-900 text-slate-400"
                    : "border-slate-300 bg-slate-50 text-slate-500"
                }`}
              >
                No inventory matches the selected filters.
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-3xl border p-5 transition ${itemCard}`}
                >
                  <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight">
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
                      <label className={`text-sm font-medium ${sectionText}`}>
                        Sign-in amount
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
                        className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${inputClass}`}
                      />
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                      <button
                        onClick={() => handleSignIn(item.id, item.quantity)}
                        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                      >
                        Sign In
                      </button>

                      <button
                        onClick={() =>
                          setOpenBorrowItemId((prev) =>
                            prev === item.id ? null : item.id
                          )
                        }
                        className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                      >
                        {openBorrowItemId === item.id ? "Close Sign Out" : "Sign Out"}
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

                  {openBorrowItemId === item.id && (
                    <div
                      className={`mt-5 rounded-2xl border p-5 ${
                        darkMode
                          ? "border-slate-700 bg-slate-800"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="mb-4">
                        <h4 className="text-lg font-semibold">Product Sign Out</h4>
                        <p className={`mt-1 text-sm ${mutedText}`}>
                          Borrower auto-detected from email. This reduces inventory and creates a borrow record.
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className={`text-sm font-medium ${sectionText}`}>
                            Borrower
                          </label>
                          <input
                            type="text"
                            value={borrowerName}
                            readOnly
                            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClass}`}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className={`text-sm font-medium ${sectionText}`}>
                            Borrower email
                          </label>
                          <input
                            type="text"
                            value={userEmail}
                            readOnly
                            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none ${inputClass}`}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className={`text-sm font-medium ${sectionText}`}>
                            Quantity to sign out
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={borrowQuantities[item.id] ?? 1}
                            onChange={(e) =>
                              setBorrowQuantities((prev) => ({
                                ...prev,
                                [item.id]: Number(e.target.value),
                              }))
                            }
                            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${inputClass}`}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className={`text-sm font-medium ${sectionText}`}>
                            Expected return date
                          </label>
                          <input
                            type="date"
                            value={borrowDates[item.id] ?? ""}
                            onChange={(e) =>
                              setBorrowDates((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${inputClass}`}
                          />
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                          <label className={`text-sm font-medium ${sectionText}`}>
                            Comment
                          </label>
                          <textarea
                            placeholder="Why are you taking it? Add any notes here."
                            value={borrowComments[item.id] ?? ""}
                            onChange={(e) =>
                              setBorrowComments((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            rows={4}
                            className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${inputClass}`}
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          onClick={() =>
                            handleBorrowSignOut(item.id, item.name, item.quantity)
                          }
                          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                        >
                          Confirm Sign Out
                        </button>

                        <button
                          onClick={() => setOpenBorrowItemId(null)}
                          className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                            darkMode
                              ? "bg-slate-700 text-slate-100 hover:bg-slate-600"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                          }`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}