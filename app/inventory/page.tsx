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
  is_active: boolean;
  department_id?: number | null;
  location_id?: number | null;
  min_quantity: number;
  notes: string | null;
  photo_url: string | null;
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

type BorrowedSummary = {
  item_id: number;
};

type SortOption =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "qty_high"
  | "qty_low";

type InventoryView = "active" | "archived";

export default function InventoryPage() {
  const router = useRouter();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<InventoryItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [name, setName] = useState("");
  const [assetCode, setAssetCode] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [departmentId, setDepartmentId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [minQuantity, setMinQuantity] = useState(0);
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [message, setMessage] = useState("");

  const [filterDepartmentId, setFilterDepartmentId] = useState("");
  const [filterLocationId, setFilterLocationId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showBorrowedOnly, setShowBorrowedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [inventoryView, setInventoryView] = useState<InventoryView>("active");

  const [adjustments, setAdjustments] = useState<Record<number, number>>({});
  const [role, setRole] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [borrowerName, setBorrowerName] = useState("");

  const [borrowedItemIds, setBorrowedItemIds] = useState<number[]>([]);

  const [openBorrowItemId, setOpenBorrowItemId] = useState<number | null>(null);
  const [borrowQuantities, setBorrowQuantities] = useState<Record<number, number>>({});
  const [borrowComments, setBorrowComments] = useState<Record<number, string>>({});
  const [borrowDates, setBorrowDates] = useState<Record<number, string>>({});

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editAssetCode, setEditAssetCode] = useState("");
  const [editQuantity, setEditQuantity] = useState(0);
  const [editDepartmentId, setEditDepartmentId] = useState("");
  const [editLocationId, setEditLocationId] = useState("");
  const [editMinQuantity, setEditMinQuantity] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");

  const [deletingArchivedItemId, setDeletingArchivedItemId] = useState<number | null>(null);
  const [restoringArchivedItemId, setRestoringArchivedItemId] = useState<number | null>(null);

  const extractFirstName = (email: string) => {
    const localPart = email.split("@")[0] || "";
    const firstPart = localPart.split(".")[0] || "";
    if (!firstPart) return "";
    return firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
  };

  const normalizeAssetCode = (value: string) => {
    const cleaned = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);

    if (cleaned.length <= 3) {
      return cleaned;
    }

    return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  };

  const isValidAssetCode = (value: string) => {
    return /^[A-Z]{3}-[0-9]{3}$/.test(value);
  };

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
      .select("role, email")
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

    const itemSelect = `
      id,
      name,
      asset_code,
      quantity,
      is_active,
      department_id,
      location_id,
      min_quantity,
      notes,
      photo_url,
      departments(name),
      locations(name)
    `;

    const { data: activeItemData, error: activeItemError } = await supabase
      .from("inventory_items")
      .select(itemSelect)
      .eq("is_active", true);

    if (activeItemError) {
      setMessage(activeItemError.message);
      return;
    }

    const { data: archivedItemData, error: archivedItemError } = await supabase
      .from("inventory_items")
      .select(itemSelect)
      .eq("is_active", false);

    if (archivedItemError) {
      setMessage(archivedItemError.message);
      return;
    }

    const { data: borrowedData, error: borrowedError } = await supabase
      .from("borrowed_items")
      .select("item_id")
      .eq("returned", false);

    if (borrowedError) {
      setMessage(borrowedError.message);
      return;
    }

    const safeItems = (activeItemData ?? []) as unknown as InventoryItem[];
    const safeArchivedItems = (archivedItemData ?? []) as unknown as InventoryItem[];
    const safeBorrowed = (borrowedData ?? []) as BorrowedSummary[];

    setDepartments(deptData || []);
    setLocations(locationData || []);
    setItems(safeItems);
    setArchivedItems(safeArchivedItems);
    setBorrowedItemIds(Array.from(new Set(safeBorrowed.map((row) => Number(row.item_id)))));

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

  const filteredActiveItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const result = items.filter((item) => {
      const matchesDepartment =
        !filterDepartmentId || String(item.department_id ?? "") === filterDepartmentId;

      const matchesLocation =
        !filterLocationId || String(item.location_id ?? "") === filterLocationId;

      const isLowStock = item.quantity <= item.min_quantity;
      const isBorrowed = borrowedItemIds.includes(item.id);

      const matchesLowStock = !showLowStockOnly || isLowStock;
      const matchesBorrowed = !showBorrowedOnly || isBorrowed;

      const textBlob = [
        item.name,
        item.asset_code ?? "",
        item.notes ?? "",
        item.departments?.name ?? "",
        item.locations?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || textBlob.includes(query);

      return matchesDepartment && matchesLocation && matchesLowStock && matchesBorrowed && matchesSearch;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return a.id - b.id;
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "qty_high":
          return b.quantity - a.quantity;
        case "qty_low":
          return a.quantity - b.quantity;
        case "newest":
        default:
          return b.id - a.id;
      }
    });

    return result;
  }, [
    items,
    filterDepartmentId,
    filterLocationId,
    searchTerm,
    showLowStockOnly,
    showBorrowedOnly,
    sortBy,
    borrowedItemIds,
  ]);

  const filteredArchivedItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const result = archivedItems.filter((item) => {
      const matchesDepartment =
        !filterDepartmentId || String(item.department_id ?? "") === filterDepartmentId;

      const matchesLocation =
        !filterLocationId || String(item.location_id ?? "") === filterLocationId;

      const isLowStock = item.quantity <= item.min_quantity;
      const matchesLowStock = !showLowStockOnly || isLowStock;

      const textBlob = [
        item.name,
        item.asset_code ?? "",
        item.notes ?? "",
        item.departments?.name ?? "",
        item.locations?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || textBlob.includes(query);

      return matchesDepartment && matchesLocation && matchesLowStock && matchesSearch;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return a.id - b.id;
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "qty_high":
          return b.quantity - a.quantity;
        case "qty_low":
          return a.quantity - b.quantity;
        case "newest":
        default:
          return b.id - a.id;
      }
    });

    return result;
  }, [
    archivedItems,
    filterDepartmentId,
    filterLocationId,
    searchTerm,
    showLowStockOnly,
    sortBy,
  ]);

  const handleAddItem = async () => {
    setMessage("");

    const normalizedAssetCode = normalizeAssetCode(assetCode);

    if (!name.trim() || !normalizedAssetCode || !departmentId || !locationId) {
      setMessage("Please fill in all required fields, including asset code.");
      return;
    }

    if (!isValidAssetCode(normalizedAssetCode)) {
      setMessage("Asset code must be 3 letters, a dash, and 3 numbers. Example: LEG-001.");
      return;
    }

    if (quantity < 0 || minQuantity < 0) {
      setMessage("Quantity values cannot be negative.");
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
        asset_code: normalizedAssetCode,
        quantity,
        department_id: Number(departmentId),
        location_id: Number(locationId),
        min_quantity: minQuantity,
        notes: notes.trim() || null,
        photo_url: photoUrl.trim() || null,
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
        note: `Added item: ${name.trim()} (${normalizedAssetCode})`,
      });

    if (transactionError) {
      setMessage(transactionError.message);
      return;
    }

    await createNotificationsForUserAndAdmins({
      title: "Inventory item added",
      message: `${name.trim()} (${normalizedAssetCode}) was added with quantity ${quantity}.`,
      currentUserId: user.id,
    });

    setName("");
    setAssetCode("");
    setQuantity(0);
    setDepartmentId("");
    setLocationId("");
    setMinQuantity(0);
    setNotes("");
    setPhotoUrl("");
    setMessage("Item added.");

    await loadData();
  };

  const openEditForm = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditAssetCode(item.asset_code ?? "");
    setEditQuantity(item.quantity);
    setEditDepartmentId(String(item.department_id ?? ""));
    setEditLocationId(String(item.location_id ?? ""));
    setEditMinQuantity(item.min_quantity ?? 0);
    setEditNotes(item.notes ?? "");
    setEditPhotoUrl(item.photo_url ?? "");
    setMessage("");
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setEditName("");
    setEditAssetCode("");
    setEditQuantity(0);
    setEditDepartmentId("");
    setEditLocationId("");
    setEditMinQuantity(0);
    setEditNotes("");
    setEditPhotoUrl("");
  };

  const handleSaveEdit = async (itemId: number) => {
    setMessage("");

    const normalizedAssetCode = normalizeAssetCode(editAssetCode);

    if (!editName.trim() || !normalizedAssetCode || !editDepartmentId || !editLocationId) {
      setMessage("Please fill in all required edit fields, including asset code.");
      return;
    }

    if (!isValidAssetCode(normalizedAssetCode)) {
      setMessage("Asset code must be 3 letters, a dash, and 3 numbers. Example: LEG-001.");
      return;
    }

    if (editQuantity < 0 || editMinQuantity < 0) {
      setMessage("Quantity values cannot be negative.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const originalItem =
      items.find((item) => item.id === itemId) ??
      archivedItems.find((item) => item.id === itemId);

    const { error: updateError } = await supabase
      .from("inventory_items")
      .update({
        name: editName.trim(),
        asset_code: normalizedAssetCode,
        quantity: editQuantity,
        department_id: Number(editDepartmentId),
        location_id: Number(editLocationId),
        min_quantity: editMinQuantity,
        notes: editNotes.trim() || null,
        photo_url: editPhotoUrl.trim() || null,
      })
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
        action: "add",
        quantity_changed: 0,
        note: `Edited item: ${originalItem?.name ?? "Item"} -> ${editName.trim()} (${normalizedAssetCode})`,
      });

    if (transactionError) {
      setMessage(transactionError.message);
      return;
    }

    await createNotificationsForUserAndAdmins({
      title: "Inventory item edited",
      message: `${originalItem?.name ?? "Item"} was updated.`,
      currentUserId: user.id,
    });

    cancelEdit();
    setMessage("Item updated.");
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

  const handleRestoreArchived = async (id: number, itemName: string) => {
    if (role !== "admin") {
      setMessage("Only admins can restore archived items.");
      return;
    }

    setMessage("");
    setRestoringArchivedItemId(id);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { error: updateError } = await supabase
      .from("inventory_items")
      .update({ is_active: true })
      .eq("id", id);

    if (updateError) {
      setMessage(updateError.message);
      setRestoringArchivedItemId(null);
      return;
    }

    const { error: transactionError } = await supabase
      .from("inventory_transactions")
      .insert({
        item_id: id,
        user_id: user.id,
        action: "add",
        quantity_changed: 0,
        note: `Restored archived item: ${itemName}`,
      });

    if (transactionError) {
      setMessage(transactionError.message);
      setRestoringArchivedItemId(null);
      return;
    }

    await createNotificationsForUserAndAdmins({
      title: "Inventory item restored",
      message: `${itemName} was restored from archive.`,
      currentUserId: user.id,
    });

    setMessage("Archived item restored.");
    setRestoringArchivedItemId(null);
    await loadData();
  };

  const handleDeleteArchived = async (id: number, itemName: string) => {
    if (role !== "admin") {
      setMessage("Only admins can delete archived items.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${itemName}" permanently? This cannot be undone.`
    );

    if (!confirmed) return;

    setMessage("");
    setDeletingArchivedItemId(id);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { error: deleteError } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", id)
      .eq("is_active", false);

    if (deleteError) {
      setMessage(deleteError.message);
      setDeletingArchivedItemId(null);
      return;
    }

    await createNotificationsForUserAndAdmins({
      title: "Archived item deleted",
      message: `${itemName} was permanently deleted from archive.`,
      currentUserId: user.id,
    });

    setMessage("Archived item permanently deleted.");
    setDeletingArchivedItemId(null);
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
    setSearchTerm("");
    setShowLowStockOnly(false);
    setShowBorrowedOnly(false);
    setSortBy("newest");
  };

  const visibleCount =
    inventoryView === "active"
      ? filteredActiveItems.length
      : filteredArchivedItems.length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Inventory System
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Inventory</h1>
            <div className="mt-3 flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300 sm:flex-row sm:gap-6">
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

          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => setInventoryView("active")}
            className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium transition ${
              inventoryView === "active"
                ? "bg-blue-600 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Active Inventory ({items.length})
          </button>

          <button
            onClick={() => setInventoryView("archived")}
            className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-medium transition ${
              inventoryView === "archived"
                ? "bg-rose-600 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Archived Inventory ({archivedItems.length})
          </button>
        </div>

        {inventoryView === "active" && (
          <div className="mb-8 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5">
                <h2 className="text-xl font-semibold tracking-tight">Add inventory item</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Create a new item with a required asset code, thresholds, notes, and optional photo URL.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Item name</label>
                  <input
                    type="text"
                    placeholder="Enter item name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Asset code</label>
                  <input
                    type="text"
                    placeholder="LEG-001"
                    value={assetCode}
                    maxLength={7}
                    onChange={(e) => setAssetCode(normalizeAssetCode(e.target.value))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Required format: 3 letters + 3 numbers, example LEG-001.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Quantity</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
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
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Location</label>
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                  >
                    <option value="">Select location</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Low stock threshold</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(Number(e.target.value))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Photo URL</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
                  <textarea
                    placeholder="Condition, serial number, storage details, missing parts..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                  />
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
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    {message}
                  </span>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5">
                <h2 className="text-xl font-semibold tracking-tight">Search, filters, and sort</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Search by item name, asset code, notes, department, or location.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Search</label>
                  <input
                    type="text"
                    placeholder="Search inventory or asset code..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Department filter</label>
                  <select
                    value={filterDepartmentId}
                    onChange={(e) => setFilterDepartmentId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
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
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Location filter</label>
                  <select
                    value={filterLocationId}
                    onChange={(e) => setFilterLocationId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                  >
                    <option value="">All Locations</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sort by</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="name_asc">Name A-Z</option>
                    <option value="name_desc">Name Z-A</option>
                    <option value="qty_high">Highest quantity</option>
                    <option value="qty_low">Lowest quantity</option>
                  </select>
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={showLowStockOnly}
                    onChange={(e) => setShowLowStockOnly(e.target.checked)}
                  />
                  Show low stock only
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={showBorrowedOnly}
                    onChange={(e) => setShowBorrowedOnly(e.target.checked)}
                  />
                  Show borrowed items only
                </label>

                <button
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                >
                  Clear All
                </button>
              </div>
            </section>
          </div>
        )}

        {inventoryView === "archived" && (
          <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Archived inventory</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Restore archived items or permanently delete them from the app.
                </p>
              </div>

              {role === "admin" ? (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                  Permanent delete is admin-only and cannot be undone.
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  You can view archived items, but only admins can restore or delete them.
                </div>
              )}
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-sm text-slate-500 dark:text-slate-400">Archived Items</div>
                <div className="mt-2 text-2xl font-bold">{archivedItems.length}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-sm text-slate-500 dark:text-slate-400">Showing</div>
                <div className="mt-2 text-2xl font-bold">{filteredArchivedItems.length}</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-sm text-slate-500 dark:text-slate-400">Search / Filters</div>
                <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                  Reuses the same search, department, location, and asset code filters.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-sm text-slate-500 dark:text-slate-400">Admin Actions</div>
                <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                  Restore or permanently delete archived items.
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                {inventoryView === "active" ? "Current inventory" : "Archived items"}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {inventoryView === "active"
                  ? "Edit items, sign products in, sign them out, and manage stock."
                  : "Restore archived items or permanently delete them."}
              </p>
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Showing{" "}
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {visibleCount}
              </span>{" "}
              item(s)
            </div>
          </div>

          <div className="space-y-5">
            {inventoryView === "active" && filteredActiveItems.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                No inventory matches the current search or filters.
              </div>
            )}

            {inventoryView === "archived" && filteredArchivedItems.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                No archived items match the current search or filters.
              </div>
            )}

            {inventoryView === "active" &&
              filteredActiveItems.map((item) => {
                const isLowStock = item.quantity <= item.min_quantity;
                const isBorrowed = borrowedItemIds.includes(item.id);

                return (
                  <div
                    key={item.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700"
                  >
                    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex gap-4">
                        {item.photo_url && (
                          <img
                            src={item.photo_url}
                            alt={item.name}
                            className="h-24 w-24 rounded-2xl border border-slate-200 object-cover dark:border-slate-700"
                          />
                        )}

                        <div>
                          <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                            {item.name}
                          </h3>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                              {item.asset_code || "No Asset Code"}
                            </span>

                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                              Quantity: {item.quantity}
                            </span>

                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                              {item.departments?.name ?? "No Department"}
                            </span>

                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                              {item.locations?.name ?? "No Location"}
                            </span>

                            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                              Min: {item.min_quantity}
                            </span>

                            {isLowStock && (
                              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">
                                Low Stock
                              </span>
                            )}

                            {isBorrowed && (
                              <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-medium text-cyan-700">
                                Borrowed Out
                              </span>
                            )}
                          </div>

                          {item.notes && (
                            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                              <span className="font-medium">Notes:</span> {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {editingItemId === item.id ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                        <div className="mb-4">
                          <h4 className="text-lg font-semibold">Edit Item</h4>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Item name"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          />

                          <div>
                            <input
                              type="text"
                              value={editAssetCode}
                              maxLength={7}
                              onChange={(e) => setEditAssetCode(normalizeAssetCode(e.target.value))}
                              placeholder="LEG-001"
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Required format: 3 letters + 3 numbers, example LEG-001.
                            </p>
                          </div>

                          <input
                            type="number"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(Number(e.target.value))}
                            placeholder="Quantity"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          />

                          <select
                            value={editDepartmentId}
                            onChange={(e) => setEditDepartmentId(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          >
                            <option value="">Select department</option>
                            {departments.map((dept) => (
                              <option key={dept.id} value={dept.id}>
                                {dept.name}
                              </option>
                            ))}
                          </select>

                          <select
                            value={editLocationId}
                            onChange={(e) => setEditLocationId(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          >
                            <option value="">Select location</option>
                            {locations.map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.name}
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            value={editMinQuantity}
                            onChange={(e) => setEditMinQuantity(Number(e.target.value))}
                            placeholder="Low stock threshold"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          />

                          <input
                            type="text"
                            value={editPhotoUrl}
                            onChange={(e) => setEditPhotoUrl(e.target.value)}
                            placeholder="Photo URL"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          />

                          <textarea
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            rows={4}
                            placeholder="Notes"
                            className="sm:col-span-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                          >
                            Save Changes
                          </button>

                          <button
                            onClick={cancelEdit}
                            className="inline-flex items-center justify-center rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
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
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-500"
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

                            <button
                              onClick={() => openEditForm(item)}
                              className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700"
                            >
                              Edit Item
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
                          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                            <div className="mb-4">
                              <h4 className="text-lg font-semibold">Product Sign Out</h4>
                              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Borrower auto-detected from email. This reduces inventory and creates a borrow record.
                              </p>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Borrower</label>
                                <input
                                  type="text"
                                  value={borrowerName}
                                  readOnly
                                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Borrower email</label>
                                <input
                                  type="text"
                                  value={userEmail}
                                  readOnly
                                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Quantity to sign out</label>
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
                                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Expected return date</label>
                                <input
                                  type="date"
                                  value={borrowDates[item.id] ?? ""}
                                  onChange={(e) =>
                                    setBorrowDates((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value,
                                    }))
                                  }
                                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                />
                              </div>

                              <div className="space-y-2 sm:col-span-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Comment</label>
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
                                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                                className="inline-flex items-center justify-center rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

            {inventoryView === "archived" &&
              filteredArchivedItems.map((item) => {
                const isLowStock = item.quantity <= item.min_quantity;
                const isDeleting = deletingArchivedItemId === item.id;
                const isRestoring = restoringArchivedItemId === item.id;

                return (
                  <div
                    key={item.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex gap-4">
                        {item.photo_url && (
                          <img
                            src={item.photo_url}
                            alt={item.name}
                            className="h-24 w-24 rounded-2xl border border-slate-200 object-cover dark:border-slate-700"
                          />
                        )}

                        <div>
                          <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                            {item.name}
                          </h3>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                              Archived
                            </span>

                            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                              {item.asset_code || "No Asset Code"}
                            </span>

                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                              Quantity: {item.quantity}
                            </span>

                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                              {item.departments?.name ?? "No Department"}
                            </span>

                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                              {item.locations?.name ?? "No Location"}
                            </span>

                            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                              Min: {item.min_quantity}
                            </span>

                            {isLowStock && (
                              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">
                                Low Stock
                              </span>
                            )}
                          </div>

                          {item.notes && (
                            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                              <span className="font-medium">Notes:</span> {item.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {role === "admin" ? (
                          <>
                            <button
                              onClick={() => handleRestoreArchived(item.id, item.name)}
                              disabled={isRestoring || isDeleting}
                              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isRestoring ? "Restoring..." : "Restore"}
                            </button>

                            <button
                              onClick={() => handleDeleteArchived(item.id, item.name)}
                              disabled={isDeleting || isRestoring}
                              className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isDeleting ? "Deleting..." : "Delete Permanently"}
                            </button>
                          </>
                        ) : (
                          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                            View only
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

            {message && inventoryView === "archived" && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {message}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
