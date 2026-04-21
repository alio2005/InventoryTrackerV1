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
  category_id?: number | null;
  inventory_categories: { name: string } | null;
  quantity: number;
};

type InventoryCategory = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
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

const ALL_WEEKS_VALUE = "all";

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
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
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
  const [categoryFilterId, setCategoryFilterId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const inputClass =
    "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-blue-400";

  const selectClass =
    "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 [color-scheme:dark]";

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

    const { data: itemData, error: itemError } = await supabase
      .from("inventory_items")
      .select("id, name, asset_code, category_id, quantity, inventory_categories(name)")
      .eq("is_active", true)
      .order("name");

    if (itemError) {
      setMessage(itemError.message);
      setLoading(false);
      return;
    }

    const { data: categoryData, error: categoryError } = await supabase
      .from("inventory_categories")
      .select("id, name, description, is_active")
      .eq("is_active", true)
      .order("name");

    if (categoryError) {
      setMessage(categoryError.message);
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
        inventory_items(id, name, asset_code, category_id, quantity, inventory_categories(name)),
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

    setItems((itemData ?? []) as unknown as InventoryItem[]);
    setCategories((categoryData ?? []) as InventoryCategory[]);
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

  const filteredItemsForSelection = useMemo(() => {
    return items.filter((item) => {
      return (
        !categoryFilterId ||
        String(item.category_id ?? "") === categoryFilterId
      );
    });
  }, [items, categoryFilterId]);

  const selectedItem = useMemo(() => {
    return items.find((item) => String(item.id) === selectedItemId) ?? null;
  }, [items, selectedItemId]);

  const selectedWeek = useMemo(() => {
    if (selectedWeekId === ALL_WEEKS_VALUE) return null;
    return weeks.find((week) => String(week.id) === selectedWeekId) ?? null;
  }, [weeks, selectedWeekId]);

  const isAllWeeksSelected = selectedWeekId === ALL_WEEKS_VALUE;

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

  const getRemainingQuantity = (item: InventoryItem, weekId: number) => {
    return item.quantity - getAllocatedQuantity(item.id, weekId);
  };

  const selectedItemRemainingByWeek = useMemo(() => {
    if (!selectedItem) return [];

    return weeks.map((week) => ({
      week,
      allocated: getAllocatedQuantity(selectedItem.id, week.id),
      remaining: getRemainingQuantity(selectedItem, week.id),
    }));
  }, [selectedItem, weeks, allocations]);

  const selectedItemAllocated =
    selectedItem && selectedWeek
      ? getAllocatedQuantity(selectedItem.id, selectedWeek.id)
      : 0;

  const selectedItemRemaining =
    selectedItem && selectedWeek
      ? selectedItem.quantity - selectedItemAllocated
      : selectedItem && isAllWeeksSelected && selectedItemRemainingByWeek.length > 0
      ? Math.min(...selectedItemRemainingByWeek.map((row) => row.remaining))
      : 0;

  const selectedWeekLabel = isAllWeeksSelected
    ? "All 6 Weeks"
    : selectedWeek?.label ?? "None";

  const weeklyItemSummary = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();

    return items
      .filter((item) =>
        !categoryFilterId ||
        String(item.category_id ?? "") === categoryFilterId
      )
      .map((item) => {
        if (isAllWeeksSelected) {
          const weekRows = weeks.map((week) => {
            const allocated = getAllocatedQuantity(item.id, week.id);
            return {
              week,
              allocated,
              remaining: item.quantity - allocated,
            };
          });

          const maxAllocated = weekRows.length
            ? Math.max(...weekRows.map((row) => row.allocated))
            : 0;

          const minRemaining = weekRows.length
            ? Math.min(...weekRows.map((row) => row.remaining))
            : item.quantity;

          return {
            ...item,
            allocated: maxAllocated,
            remaining: minRemaining,
          };
        }

        if (!selectedWeek) {
          return {
            ...item,
            allocated: 0,
            remaining: item.quantity,
          };
        }

        const allocated = getAllocatedQuantity(item.id, selectedWeek.id);

        return {
          ...item,
          allocated,
          remaining: item.quantity - allocated,
        };
      })
      .filter((item) => {
        if (!query) return true;

        return [
          item.name,
          item.asset_code ?? "",
          item.inventory_categories?.name ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, allocations, selectedWeek, isAllWeeksSelected, weeks, itemSearch, categoryFilterId]);

  const filteredAllocations = useMemo(() => {
    return allocations.filter((allocation) => {
      const matchesWeek =
        !selectedWeekId ||
        selectedWeekId === ALL_WEEKS_VALUE ||
        String(allocation.camp_week_id) === selectedWeekId;

      const matchesSite =
        !siteFilterId || String(allocation.camp_site_id) === siteFilterId;

      const matchesCategory =
        !categoryFilterId ||
        String(allocation.inventory_items?.category_id ?? "") === categoryFilterId;

      const query = itemSearch.trim().toLowerCase();
      const textBlob = [
        allocation.inventory_items?.name ?? "",
        allocation.inventory_items?.asset_code ?? "",
        allocation.inventory_items?.inventory_categories?.name ?? "",
        allocation.camp_sites?.name ?? "",
        allocation.responsible_person ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || textBlob.includes(query);

      return matchesWeek && matchesSite && matchesCategory && matchesSearch;
    });
  }, [allocations, selectedWeekId, siteFilterId, categoryFilterId, itemSearch]);

  const getTargetWeeksForSave = () => {
    if (selectedWeekId === ALL_WEEKS_VALUE) return weeks;
    const singleWeek = weeks.find((week) => String(week.id) === selectedWeekId);
    return singleWeek ? [singleWeek] : [];
  };

  const handleCreateAllocation = async () => {
    setMessage("");

    const targetWeeks = getTargetWeeksForSave();

    if (targetWeeks.length === 0 || !selectedItemId || !selectedSiteId) {
      setMessage("Choose a week, item, and camp site.");
      return;
    }

    if (quantity <= 0) {
      setMessage("Quantity must be greater than 0.");
      return;
    }

    if (!selectedItem) {
      setMessage("Selected item was not found.");
      return;
    }

    if (activeAllocationStatuses.includes(status)) {
      const overAllocatedWeek = targetWeeks.find((week) => {
        const remaining = getRemainingQuantity(selectedItem, week.id);
        return quantity > remaining;
      });

      if (overAllocatedWeek) {
        const remaining = getRemainingQuantity(selectedItem, overAllocatedWeek.id);
        setMessage(
          `Cannot allocate ${quantity}. Only ${remaining} remaining for ${selectedItem.name} in ${overAllocatedWeek.label}.`
        );
        return;
      }
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const rows = targetWeeks.map((week) => ({
      inventory_item_id: Number(selectedItemId),
      camp_site_id: Number(selectedSiteId),
      camp_week_id: week.id,
      quantity,
      status,
      responsible_person:
        responsiblePerson.trim() || selectedSite?.site_leader_name || null,
      responsible_email:
        responsibleEmail.trim() || selectedSite?.site_leader_email || null,
      notes: notes.trim() || null,
      created_by: user.id,
    }));

    const { error } = await supabase.from("camp_allocations").upsert(rows, {
      onConflict: "inventory_item_id,camp_site_id,camp_week_id",
    });

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    await sendCampNotification({
      title: isAllWeeksSelected
        ? "Camp allocation saved for all 6 weeks"
        : "Camp allocation saved",
      bodyMessage: `${quantity} of ${selectedItem?.name ?? "item"} was allocated to ${selectedSite?.name ?? "selected site"} for ${isAllWeeksSelected ? "all 6 weeks" : selectedWeek?.label ?? "the selected week"}. Responsible: ${responsiblePerson.trim() || selectedSite?.site_leader_name || "Not assigned"}.`,
      leaderEmail:
        responsibleEmail.trim() || selectedSite?.site_leader_email || null,
    });

    setMessage(
      isAllWeeksSelected
        ? "Camp allocation saved for all 6 weeks."
        : "Camp allocation saved."
    );
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

    const updatedAllocation = allocations.find(
      (allocation) => allocation.id === allocationId
    );

    await sendCampNotification({
      title: "Camp allocation status updated",
      bodyMessage: `${updatedAllocation?.inventory_items?.name ?? "An item"} for ${updatedAllocation?.camp_sites?.name ?? "a camp site"} (${updatedAllocation?.camp_weeks?.label ?? "selected week"}) was marked as ${newStatus.replace("_", " ")}.`,
      leaderEmail:
        updatedAllocation?.responsible_email ||
        updatedAllocation?.camp_sites?.site_leader_email ||
        null,
    });

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

    const deletedAllocation = allocations.find(
      (allocation) => allocation.id === allocationId
    );

    await sendCampNotification({
      title: "Camp allocation deleted",
      bodyMessage: `${deletedAllocation?.inventory_items?.name ?? "An item"} allocation for ${deletedAllocation?.camp_sites?.name ?? "a camp site"} (${deletedAllocation?.camp_weeks?.label ?? "selected week"}) was deleted.`,
      leaderEmail:
        deletedAllocation?.responsible_email ||
        deletedAllocation?.camp_sites?.site_leader_email ||
        null,
    });

    setMessage("Camp allocation deleted.");
    await loadData();
  };

  const totalAllocatedThisWeek = useMemo(() => {
    if (isAllWeeksSelected) {
      return allocations
        .filter((allocation) =>
          activeAllocationStatuses.includes(allocation.status)
        )
        .reduce((sum, allocation) => sum + allocation.quantity, 0);
    }

    if (!selectedWeek) return 0;

    return allocations
      .filter(
        (allocation) =>
          allocation.camp_week_id === selectedWeek.id &&
          activeAllocationStatuses.includes(allocation.status)
      )
      .reduce((sum, allocation) => sum + allocation.quantity, 0);
  }, [allocations, isAllWeeksSelected, selectedWeek]);

  const itemCountWithAllocationsThisWeek = useMemo(() => {
    if (isAllWeeksSelected) {
      return new Set(
        allocations
          .filter((allocation) =>
            activeAllocationStatuses.includes(allocation.status)
          )
          .map((allocation) => allocation.inventory_item_id)
      ).size;
    }

    if (!selectedWeek) return 0;

    return new Set(
      allocations
        .filter(
          (allocation) =>
            allocation.camp_week_id === selectedWeek.id &&
            activeAllocationStatuses.includes(allocation.status)
        )
        .map((allocation) => allocation.inventory_item_id)
    ).size;
  }, [allocations, isAllWeeksSelected, selectedWeek]);


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

  const exportCampAllocationsToExcel = () => {
    const allocationRows = filteredAllocations.map((allocation) => ({
      Week: sanitizeExcelCell(allocation.camp_weeks?.label ?? "Unknown"),
      "Week Number": allocation.camp_weeks?.week_number ?? "",
      "Start Date": sanitizeExcelCell(allocation.camp_weeks?.start_date ?? ""),
      "End Date": sanitizeExcelCell(allocation.camp_weeks?.end_date ?? ""),
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
      Category: sanitizeExcelCell(
        allocation.inventory_items?.inventory_categories?.name ?? "No Category"
      ),
      "Item Total Quantity": allocation.inventory_items?.quantity ?? "",
      "Allocated Quantity": allocation.quantity,
      Status: sanitizeExcelCell(allocation.status.replace("_", " ")),
      Notes: sanitizeExcelCell(allocation.notes ?? ""),
      "Created At": sanitizeExcelCell(
        allocation.created_at
          ? new Date(allocation.created_at).toLocaleString()
          : ""
      ),
      "Updated At": sanitizeExcelCell(
        allocation.updated_at
          ? new Date(allocation.updated_at).toLocaleString()
          : ""
      ),
    }));

    const weeklyRows = weeks.map((week) => {
      const weekAllocations = filteredAllocations.filter(
        (allocation) => allocation.camp_week_id === week.id
      );

      const activeWeekAllocations = weekAllocations.filter((allocation) =>
        activeAllocationStatuses.includes(allocation.status)
      );

      return {
        Week: sanitizeExcelCell(week.label),
        "Week Number": week.week_number,
        "Start Date": sanitizeExcelCell(week.start_date ?? ""),
        "End Date": sanitizeExcelCell(week.end_date ?? ""),
        "Visible Allocations": weekAllocations.length,
        "Active Allocations": activeWeekAllocations.length,
        "Total Units": weekAllocations.reduce(
          (sum, allocation) => sum + allocation.quantity,
          0
        ),
        "Active Units": activeWeekAllocations.reduce(
          (sum, allocation) => sum + allocation.quantity,
          0
        ),
      };
    });

    const siteRows = sites.map((site) => {
      const siteAllocations = filteredAllocations.filter(
        (allocation) => allocation.camp_site_id === site.id
      );

      const activeSiteAllocations = siteAllocations.filter((allocation) =>
        activeAllocationStatuses.includes(allocation.status)
      );

      return {
        Site: sanitizeExcelCell(site.name),
        "Site Leader": sanitizeExcelCell(site.site_leader_name ?? ""),
        Email: sanitizeExcelCell(site.site_leader_email ?? ""),
        Address: sanitizeExcelCell(site.address ?? ""),
        "Visible Allocations": siteAllocations.length,
        "Active Allocations": activeSiteAllocations.length,
        "Total Units": siteAllocations.reduce(
          (sum, allocation) => sum + allocation.quantity,
          0
        ),
        "Active Units": activeSiteAllocations.reduce(
          (sum, allocation) => sum + allocation.quantity,
          0
        ),
      };
    });

    const itemRows = items.map((item) => {
      const itemAllocations = filteredAllocations.filter(
        (allocation) => allocation.inventory_item_id === item.id
      );

      const activeItemAllocations = itemAllocations.filter((allocation) =>
        activeAllocationStatuses.includes(allocation.status)
      );

      return {
        "Asset Code": sanitizeExcelCell(item.asset_code ?? "No Asset Code"),
        "Item Name": sanitizeExcelCell(item.name),
        Category: sanitizeExcelCell(item.inventory_categories?.name ?? "No Category"),
        "Inventory Total Quantity": item.quantity,
        "Visible Allocations": itemAllocations.length,
        "Active Allocations": activeItemAllocations.length,
        "Total Allocated Units": itemAllocations.reduce(
          (sum, allocation) => sum + allocation.quantity,
          0
        ),
        "Active Allocated Units": activeItemAllocations.reduce(
          (sum, allocation) => sum + allocation.quantity,
          0
        ),
      };
    });

    const availabilityRows = weeklyItemSummary.map((item) => ({
      "Asset Code": sanitizeExcelCell(item.asset_code ?? "No Asset Code"),
      "Item Name": sanitizeExcelCell(item.name),
      Category: sanitizeExcelCell(item.inventory_categories?.name ?? "No Category"),
      "Inventory Total": item.quantity,
      [isAllWeeksSelected ? "Max Allocated in Any Week" : "Allocated This Week"]:
        item.allocated,
      [isAllWeeksSelected
        ? "Lowest Remaining Across Weeks"
        : "Remaining This Week"]: item.remaining,
      "Week View": sanitizeExcelCell(selectedWeekLabel),
    }));

    const summaryRows = [
      {
        Metric: "Generated At",
        Value: new Date().toLocaleString(),
      },
      {
        Metric: "Selected Week",
        Value: selectedWeekLabel,
      },
      {
        Metric: "Selected Site Filter",
        Value:
          sites.find((site) => String(site.id) === siteFilterId)?.name ??
          "All Sites",
      },
      {
        Metric: "Selected Category Filter",
        Value:
          categories.find((category) => String(category.id) === categoryFilterId)?.name ??
          "All Categories",
      },
      {
        Metric: "Search Filter",
        Value: itemSearch || "None",
      },
      {
        Metric: "Visible Allocations",
        Value: filteredAllocations.length,
      },
      {
        Metric: "Total Units in Visible Allocations",
        Value: filteredAllocations.reduce(
          (sum, allocation) => sum + allocation.quantity,
          0
        ),
      },
      {
        Metric: "Items Allocated",
        Value: itemCountWithAllocationsThisWeek,
      },
      {
        Metric: "Total Units Allocated",
        Value: totalAllocatedThisWeek,
      },
    ];

    statusOptions.forEach((option) => {
      summaryRows.push({
        Metric: option.label,
        Value: filteredAllocations.filter(
          (allocation) => allocation.status === option.value
        ).length,
      });
    });

    const workbook = XLSX.utils.book_new();

    addWorksheet(workbook, "Allocations", allocationRows);
    addWorksheet(workbook, "Summary", summaryRows);
    addWorksheet(workbook, "By Week", weeklyRows);
    addWorksheet(workbook, "By Site", siteRows);
    addWorksheet(workbook, "By Item", itemRows);
    addWorksheet(workbook, "Availability", availabilityRows);

    const fileDate = new Date().toISOString().slice(0, 10);
    const weekName = selectedWeekLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    XLSX.writeFile(workbook, `camp-allocation-report-${weekName}-${fileDate}.xlsx`);

    setMessage("Camp allocation report exported to Excel.");
  };

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
              onClick={exportCampAllocationsToExcel}
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
            <p className="mt-2 text-2xl font-bold">{selectedWeekLabel}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Camp Sites</p>
            <p className="mt-2 text-2xl font-bold">{sites.length}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              {isAllWeeksSelected ? "Items Allocated Across All Weeks" : "Items Allocated This Week"}
            </p>
            <p className="mt-2 text-2xl font-bold">
              {itemCountWithAllocationsThisWeek}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              {isAllWeeksSelected ? "Total Units Across All Weeks" : "Total Units Allocated"}
            </p>
            <p className="mt-2 text-2xl font-bold">{totalAllocatedThisWeek}</p>
          </div>
        </div>

        <div className="mb-8 grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight">
              Add / Update Allocation
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Choose one week or apply the same allocation to all 6 weeks.
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
                  <option value={ALL_WEEKS_VALUE} className={optionClass}>
                    All 6 Weeks
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
                <label className="text-sm font-medium text-slate-200">Category Filter</label>
                <select
                  value={categoryFilterId}
                  onChange={(e) => {
                    setCategoryFilterId(e.target.value);
                    setSelectedItemId("");
                  }}
                  className={selectClass}
                >
                  <option value="" className={optionClass}>
                    All Categories
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id} className={optionClass}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  Inventory Item
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className={selectClass}
                >
                  <option value="" className={optionClass}>
                    Select item
                  </option>
                  {filteredItemsForSelection.map((item) => (
                    <option key={item.id} value={item.id} className={optionClass}>
                      {item.asset_code ? `${item.asset_code} - ` : ""}
                      {item.name}
                      {item.inventory_categories?.name ? ` · ${item.inventory_categories.name}` : ""}
                      {` (${item.quantity} total)`}
                    </option>
                  ))}
                </select>

                {selectedItem && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                    <div>Category: {selectedItem.inventory_categories?.name ?? "No Category"}</div>
                    <div>Total: {selectedItem.quantity}</div>

                    {isAllWeeksSelected ? (
                      <>
                        <div>
                          Lowest remaining across all weeks:{" "}
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
                        <div className="mt-2 text-xs text-slate-500">
                          The app checks every week before saving. If one week does not have enough remaining, the allocation will be blocked.
                        </div>
                      </>
                    ) : selectedWeek ? (
                      <>
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
                      </>
                    ) : null}
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
                {saving
                  ? "Saving..."
                  : isAllWeeksSelected
                  ? "Save Allocation for All 6 Weeks"
                  : "Save Allocation"}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  {isAllWeeksSelected
                    ? "Inventory Availability Across All Weeks"
                    : "Weekly Inventory Availability"}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {isAllWeeksSelected
                    ? "Allocated shows the highest allocated amount in any week. Remaining shows the lowest remaining amount across all weeks."
                    : "Shows total, allocated, and remaining quantity for the selected week."}
                </p>
              </div>

              <div className="grid w-full gap-3 lg:max-w-xl lg:grid-cols-2">
                <select
                  value={categoryFilterId}
                  onChange={(e) => setCategoryFilterId(e.target.value)}
                  className={selectClass}
                >
                  <option value="" className={optionClass}>
                    All Categories
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id} className={optionClass}>
                      {category.name}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Search item, asset code, or category..."
                  className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-blue-400"
                />
              </div>
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
                          {item.inventory_categories?.name ? ` · ${item.inventory_categories.name}` : " · No Category"}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-sm sm:min-w-[280px]">
                        <div className="rounded-xl bg-slate-800 px-3 py-2">
                          <div className="text-xs text-slate-400">Total</div>
                          <div className="font-semibold">{item.quantity}</div>
                        </div>

                        <div className="rounded-xl bg-blue-950/50 px-3 py-2">
                          <div className="text-xs text-blue-300">
                            {isAllWeeksSelected ? "Max Allocated" : "Allocated"}
                          </div>
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
                          <div className="text-xs text-slate-300">
                            {isAllWeeksSelected ? "Lowest Remaining" : "Remaining"}
                          </div>
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
                <option value={ALL_WEEKS_VALUE} className={optionClass}>
                  All 6 Weeks
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

                        <span className="rounded-full bg-indigo-950/70 px-3 py-1 text-xs text-indigo-200">
                          {allocation.inventory_items?.inventory_categories?.name ?? "No Category"}
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
