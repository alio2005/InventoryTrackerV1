"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type SearchGroup = "inventory" | "units" | "borrowing" | "issues" | "setup" | "camp";

type SearchResult = {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle: string;
  badge: string;
  href: string;
  keywords: string;
  priority: number;
};

type InventoryItemRow = {
  id: number;
  name: string;
  asset_code: string | null;
  quantity: number;
  is_active: boolean;
  department_id: number | null;
  location_id: number | null;
  category_id: number | null;
  min_quantity: number | null;
  notes: string | null;
};

type InventoryUnitRow = {
  id: number;
  inventory_item_id: number;
  unit_code: string;
  phone_number: string | null;
  serial_number: string | null;
  imei: string | null;
  status: string;
  notes: string | null;
};

type BorrowRequestRow = {
  id: number;
  inventory_item_id: number | null;
  inventory_unit_id: number | null;
  borrower_name: string;
  borrower_email: string | null;
  quantity: number;
  start_date: string;
  end_date: string;
  status: string;
  notes: string | null;
  created_at: string;
};

type IssueRow = {
  id: number;
  inventory_item_id: number;
  inventory_unit_id: number | null;
  report_type: string;
  quantity: number;
  issue_status: string;
  notes: string | null;
  reported_by: string | null;
  reported_at: string;
  resolution_notes: string | null;
};

type NamedRow = {
  id: number;
  name: string;
  description?: string | null;
  is_active?: boolean | null;
};

type CampSiteRow = {
  id: number;
  name: string;
  site_leader_name: string | null;
  site_leader_email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean | null;
};

const groupLabels: Record<SearchGroup, string> = {
  inventory: "Inventory Items",
  units: "Units / Asset Codes",
  borrowing: "Borrowing",
  issues: "Issues",
  setup: "Setup",
  camp: "Camp Planning",
};

const groupOrder: SearchGroup[] = ["inventory", "units", "borrowing", "issues", "camp", "setup"];

const quickLinks = [
  { label: "Inventory", href: "/inventory", helper: "Items, folders, quantities" },
  { label: "Borrow / Return", href: "/borrowed", helper: "Active requests and checkouts" },
  { label: "Missing / Damaged", href: "/missing-damaged", helper: "Open issue reports" },
  { label: "Camp Packing", href: "/camp-packing-list", helper: "Packing lists by site/week" },
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9@._\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const compactDate = (value: string | null | undefined) => {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const titleCaseStatus = (value: string | null | undefined) =>
  (value ?? "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const keywordText = (parts: Array<string | number | null | undefined | false>) =>
  normalize(parts.filter((part) => part !== null && part !== undefined && part !== false).join(" "));

const scoreResult = (result: SearchResult, query: string) => {
  const normalizedQuery = normalize(query);
  const tokens = normalizedQuery.split(" ").filter(Boolean);

  if (!normalizedQuery || tokens.length === 0) return 0;
  if (!tokens.every((token) => result.keywords.includes(token))) return 0;

  const title = normalize(result.title);
  const subtitle = normalize(result.subtitle);
  const badge = normalize(result.badge);

  let score = result.priority;
  if (title === normalizedQuery) score += 100;
  if (title.startsWith(normalizedQuery)) score += 70;
  if (title.includes(normalizedQuery)) score += 45;
  if (subtitle.includes(normalizedQuery)) score += 25;
  if (badge.includes(normalizedQuery)) score += 15;
  score += tokens.filter((token) => title.includes(token)).length * 12;
  score += tokens.filter((token) => subtitle.includes(token)).length * 6;
  score += tokens.filter((token) => badge.includes(token)).length * 4;

  return score;
};

const resultBadgeClass = (group: SearchGroup) => {
  switch (group) {
    case "inventory":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "units":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300";
    case "borrowing":
      return "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300";
    case "issues":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300";
    case "camp":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";
  }
};

const groupIcon = (group: SearchGroup) => {
  switch (group) {
    case "inventory":
      return "IT";
    case "units":
      return "ID";
    case "borrowing":
      return "BR";
    case "issues":
      return "IS";
    case "camp":
      return "CP";
    default:
      return "ST";
  }
};

function buildSearchResults({
  items,
  units,
  borrowRequests,
  issues,
  departments,
  locations,
  categories,
  campSites,
}: {
  items: InventoryItemRow[];
  units: InventoryUnitRow[];
  borrowRequests: BorrowRequestRow[];
  issues: IssueRow[];
  departments: NamedRow[];
  locations: NamedRow[];
  categories: NamedRow[];
  campSites: CampSiteRow[];
}) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const departmentById = new Map(departments.map((department) => [department.id, department.name]));
  const locationById = new Map(locations.map((location) => [location.id, location.name]));
  const categoryById = new Map(categories.map((category) => [category.id, category.name]));

  const results: SearchResult[] = [];

  for (const item of items) {
    const departmentName = item.department_id ? departmentById.get(item.department_id) ?? "" : "";
    const locationName = item.location_id ? locationById.get(item.location_id) ?? "" : "";
    const categoryName = item.category_id ? categoryById.get(item.category_id) ?? "" : "";
    const lowStock = item.min_quantity !== null && item.quantity <= item.min_quantity;

    results.push({
      id: `item-${item.id}`,
      group: "inventory",
      title: item.name,
      subtitle: [item.asset_code, departmentName, locationName, categoryName]
        .filter(Boolean)
        .join(" • ") || "Inventory item",
      badge: lowStock ? "Low stock" : item.is_active ? `${item.quantity} available` : "Archived",
      href: "/inventory",
      priority: lowStock ? 20 : 14,
      keywords: keywordText([
        item.name,
        item.asset_code,
        item.quantity,
        item.is_active ? "active available inventory item" : "archived inactive inventory item",
        lowStock && "low stock",
        departmentName,
        locationName,
        categoryName,
        item.notes,
      ]),
    });
  }

  for (const unit of units) {
    const item = itemById.get(unit.inventory_item_id);
    const statusLabel = titleCaseStatus(unit.status) || "Unit";

    results.push({
      id: `unit-${unit.id}`,
      group: "units",
      title: unit.unit_code || `Unit ${unit.id}`,
      subtitle: [item?.name, unit.serial_number && `Serial ${unit.serial_number}`, unit.imei && `IMEI ${unit.imei}`, unit.phone_number]
        .filter(Boolean)
        .join(" • ") || "Inventory unit",
      badge: statusLabel,
      href: `/inventory-units/${unit.inventory_item_id}`,
      priority: 28,
      keywords: keywordText([
        unit.unit_code,
        unit.status,
        statusLabel,
        item?.name,
        item?.asset_code,
        unit.phone_number,
        unit.serial_number,
        unit.imei,
        unit.notes,
        "asset code unit exact item",
      ]),
    });
  }

  for (const request of borrowRequests) {
    const item = request.inventory_item_id ? itemById.get(request.inventory_item_id) : undefined;
    const unit = request.inventory_unit_id ? unitById.get(request.inventory_unit_id) : undefined;
    const statusLabel = titleCaseStatus(request.status) || "Request";
    const isOpen = ["pending", "scheduled", "checked_out"].includes(request.status);

    results.push({
      id: `borrow-${request.id}`,
      group: "borrowing",
      title: request.borrower_name || request.borrower_email || `Borrow request ${request.id}`,
      subtitle: [item?.name, unit?.unit_code, `${compactDate(request.start_date)} to ${compactDate(request.end_date)}`]
        .filter(Boolean)
        .join(" • "),
      badge: statusLabel,
      href: isOpen ? "/borrowed" : "/closed-bookings",
      priority: isOpen ? 24 : 10,
      keywords: keywordText([
        request.borrower_name,
        request.borrower_email,
        request.status,
        statusLabel,
        item?.name,
        item?.asset_code,
        unit?.unit_code,
        unit?.serial_number,
        unit?.imei,
        request.quantity,
        request.start_date,
        request.end_date,
        request.notes,
        "borrow booking request checked out returned scheduled pending overdue",
      ]),
    });
  }

  for (const issue of issues) {
    const item = itemById.get(issue.inventory_item_id);
    const unit = issue.inventory_unit_id ? unitById.get(issue.inventory_unit_id) : undefined;
    const typeLabel = titleCaseStatus(issue.report_type);
    const statusLabel = titleCaseStatus(issue.issue_status);

    results.push({
      id: `issue-${issue.id}`,
      group: "issues",
      title: `${typeLabel || "Issue"}: ${item?.name ?? "Unknown item"}`,
      subtitle: [unit?.unit_code, statusLabel, issue.reported_by, compactDate(issue.reported_at)]
        .filter(Boolean)
        .join(" • "),
      badge: statusLabel || "Issue",
      href: "/missing-damaged",
      priority: issue.issue_status === "open" ? 26 : 9,
      keywords: keywordText([
        issue.report_type,
        typeLabel,
        issue.issue_status,
        statusLabel,
        item?.name,
        item?.asset_code,
        unit?.unit_code,
        unit?.serial_number,
        unit?.imei,
        issue.quantity,
        issue.notes,
        issue.resolution_notes,
        issue.reported_by,
        "missing damaged report issue open resolved written off",
      ]),
    });
  }

  for (const department of departments) {
    results.push({
      id: `department-${department.id}`,
      group: "setup",
      title: department.name,
      subtitle: "Department folder",
      badge: "Department",
      href: "/departments",
      priority: 8,
      keywords: keywordText([department.name, "department folder inventory setup"]),
    });
  }

  for (const location of locations) {
    results.push({
      id: `location-${location.id}`,
      group: "setup",
      title: location.name,
      subtitle: "Inventory location",
      badge: "Location",
      href: "/locations",
      priority: 8,
      keywords: keywordText([location.name, "location room site inventory setup"]),
    });
  }

  for (const category of categories) {
    results.push({
      id: `category-${category.id}`,
      group: "setup",
      title: category.name,
      subtitle: category.description || "Inventory category",
      badge: category.is_active === false ? "Inactive" : "Category",
      href: "/inventory",
      priority: 6,
      keywords: keywordText([category.name, category.description, "category inventory setup"]),
    });
  }

  for (const campSite of campSites) {
    results.push({
      id: `camp-site-${campSite.id}`,
      group: "camp",
      title: campSite.name,
      subtitle: [campSite.site_leader_name, campSite.site_leader_email, campSite.address]
        .filter(Boolean)
        .join(" • ") || "Camp site",
      badge: campSite.is_active === false ? "Inactive" : "Camp Site",
      href: "/camp-sites",
      priority: 7,
      keywords: keywordText([
        campSite.name,
        campSite.site_leader_name,
        campSite.site_leader_email,
        campSite.address,
        campSite.notes,
        campSite.is_active === false ? "inactive" : "active",
        "camp site planning allocation packing",
      ]),
    });
  }

  return results;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [records, setRecords] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const loadSearchData = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError("");

    const [
      itemsResponse,
      unitsResponse,
      borrowResponse,
      issuesResponse,
      departmentsResponse,
      locationsResponse,
      categoriesResponse,
      campSitesResponse,
    ] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id, name, asset_code, quantity, is_active, department_id, location_id, category_id, min_quantity, notes")
        .order("name", { ascending: true })
        .limit(500),
      supabase
        .from("inventory_units")
        .select("id, inventory_item_id, unit_code, phone_number, serial_number, imei, status, notes")
        .order("unit_code", { ascending: true })
        .limit(1000),
      supabase
        .from("borrow_requests")
        .select("id, inventory_item_id, inventory_unit_id, borrower_name, borrower_email, quantity, start_date, end_date, status, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("missing_damaged_reports")
        .select("id, inventory_item_id, inventory_unit_id, report_type, quantity, issue_status, notes, reported_by, reported_at, resolution_notes")
        .order("reported_at", { ascending: false })
        .limit(500),
      supabase.from("departments").select("id, name").order("name", { ascending: true }).limit(250),
      supabase.from("locations").select("id, name").order("name", { ascending: true }).limit(250),
      supabase
        .from("inventory_categories")
        .select("id, name, description, is_active")
        .order("name", { ascending: true })
        .limit(250),
      supabase
        .from("camp_sites")
        .select("id, name, site_leader_name, site_leader_email, address, notes, is_active")
        .order("name", { ascending: true })
        .limit(250),
    ]);

    const firstError = [
      itemsResponse.error,
      unitsResponse.error,
      borrowResponse.error,
      issuesResponse.error,
      departmentsResponse.error,
      locationsResponse.error,
      categoriesResponse.error,
      campSitesResponse.error,
    ].find(Boolean);

    if (firstError) {
      setError(firstError.message);
      setIsLoading(false);
      return;
    }

    const searchableRecords = buildSearchResults({
      items: (itemsResponse.data ?? []) as InventoryItemRow[],
      units: (unitsResponse.data ?? []) as InventoryUnitRow[],
      borrowRequests: (borrowResponse.data ?? []) as BorrowRequestRow[],
      issues: (issuesResponse.data ?? []) as IssueRow[],
      departments: (departmentsResponse.data ?? []) as NamedRow[],
      locations: (locationsResponse.data ?? []) as NamedRow[],
      categories: (categoriesResponse.data ?? []) as NamedRow[],
      campSites: (campSitesResponse.data ?? []) as CampSiteRow[],
    });

    setRecords(searchableRecords);
    setHasLoaded(true);
    setLastLoadedAt(new Date());
    setIsLoading(false);
  }, [isLoading]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
        if (!hasLoaded) void loadSearchData();
        return;
      }

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
        if (!hasLoaded) void loadSearchData();
        return;
      }

      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasLoaded, loadSearchData]);

  const matchingResults = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    return records
      .map((result) => ({ result, score: scoreResult(result, trimmed) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.result.title.localeCompare(b.result.title))
      .slice(0, 18)
      .map((entry) => entry.result);
  }, [query, records]);

  const groupedResults = useMemo(() => {
    return groupOrder
      .map((group) => ({
        group,
        items: matchingResults.filter((result) => result.group === group).slice(0, 5),
      }))
      .filter((section) => section.items.length > 0);
  }, [matchingResults]);

  const showResults = isOpen && (query.trim().length >= 2 || !query.trim());
  const lastLoadedLabel = lastLoadedAt
    ? lastLoadedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : "not loaded yet";

  return (
    <div className="relative w-full max-w-3xl">
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            setIsOpen(true);
            if (!hasLoaded) void loadSearchData();
          }}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 160);
          }}
          placeholder="Search item, asset code, borrower, department, location, status..."
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-24 text-sm font-medium text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-900"
        />
        <div className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 sm:flex">
          Ctrl K
        </div>
      </div>

      {showResults && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">Global Search</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                Data loaded: {lastLoadedLabel}
              </p>
            </div>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void loadSearchData()}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
              disabled={isLoading}
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="max-h-[56vh] overflow-y-auto p-3">
            {isLoading && !hasLoaded && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                Loading searchable inventory data...
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                Search could not load: {error}
              </div>
            )}

            {!error && query.trim().length < 2 && (
              <div className="space-y-3">
                <p className="px-1 text-sm font-medium text-slate-500 dark:text-zinc-400">
                  Type at least 2 characters. Try an asset code, borrower name, item name, department, or status.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {quickLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className="rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    >
                      <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">{link.label}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{link.helper}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {!error && query.trim().length >= 2 && groupedResults.length === 0 && !isLoading && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                No results found for <span className="font-semibold">{query}</span>. Try an asset code, item name, borrower, location, or status.
              </div>
            )}

            {!error && groupedResults.length > 0 && (
              <div className="space-y-4">
                {groupedResults.map((section) => (
                  <section key={section.group}>
                    <div className="mb-2 flex items-center justify-between px-1">
                      <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
                        {groupLabels[section.group]}
                      </h3>
                      <span className="text-xs text-slate-400 dark:text-zinc-500">{section.items.length}</span>
                    </div>
                    <div className="space-y-2">
                      {section.items.map((result) => (
                        <Link
                          key={result.id}
                          href={result.href}
                          onClick={() => setIsOpen(false)}
                          className="flex items-center gap-3 rounded-2xl border border-transparent p-3 transition hover:border-slate-200 hover:bg-slate-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/70"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-xs font-black text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                            {groupIcon(result.group)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-900 dark:text-zinc-100">{result.title}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-zinc-400">{result.subtitle}</p>
                          </div>
                          <span className={`hidden shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold sm:inline-flex ${resultBadgeClass(result.group)}`}>
                            {result.badge}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
