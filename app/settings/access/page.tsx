"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type UserAccess = {
  globalAdmin: boolean;
  inventoryAdmin: boolean;
  hrAdmin: boolean;
  employeeAccess: boolean;
};

type AccessUser = {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  oldProfileRole: string | null;
  access: UserAccess;
};

type DraftAccess = Record<string, UserAccess>;

const emptyAccess: UserAccess = {
  globalAdmin: false,
  inventoryAdmin: false,
  hrAdmin: false,
  employeeAccess: false,
};

function formatDate(value: string | null) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function cloneAccess(access: UserAccess): UserAccess {
  return {
    globalAdmin: access.globalAdmin,
    inventoryAdmin: access.inventoryAdmin,
    hrAdmin: access.hrAdmin,
    employeeAccess: access.employeeAccess,
  };
}

function accessSummary(access: UserAccess) {
  const items = [];

  if (access.globalAdmin) items.push("Admin for All");
  if (access.inventoryAdmin) items.push("Inventory Admin");
  if (access.hrAdmin) items.push("HR Admin");
  if (access.employeeAccess) items.push("Employee Access");

  return items.length > 0 ? items.join(", ") : "No access";
}

export default function AccessManagementPage() {
  const router = useRouter();

  const [users, setUsers] = useState<AccessUser[]>([]);
  const [draftAccess, setDraftAccess] = useState<DraftAccess>({});
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filteredUsers = useMemo(() => {
    const normalized = search.toLowerCase().trim();

    if (!normalized) return users;

    return users.filter((user) =>
      (user.email ?? "").toLowerCase().includes(normalized)
    );
  }, [users, search]);

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const response = await fetch("/api/admin/access", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Unable to load user access.");
        return;
      }

      const nextUsers: AccessUser[] = result.users || [];

      const nextDrafts: DraftAccess = {};

      nextUsers.forEach((user) => {
        nextDrafts[user.id] = cloneAccess(user.access || emptyAccess);
      });

      setUsers(nextUsers);
      setDraftAccess(nextDrafts);
    } catch {
      setError("Unable to connect to access management.");
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (
    userId: string,
    key: keyof UserAccess,
    value: boolean
  ) => {
    setDraftAccess((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] || emptyAccess),
        [key]: value,
      },
    }));
  };

  const applyPreset = (userId: string, preset: string) => {
    let next = cloneAccess(emptyAccess);

    if (preset === "admin_all") {
      next = {
        globalAdmin: true,
        inventoryAdmin: true,
        hrAdmin: true,
        employeeAccess: true,
      };
    }

    if (preset === "inventory_admin") {
      next = {
        globalAdmin: false,
        inventoryAdmin: true,
        hrAdmin: false,
        employeeAccess: false,
      };
    }

    if (preset === "hr_admin") {
      next = {
        globalAdmin: false,
        inventoryAdmin: false,
        hrAdmin: true,
        employeeAccess: true,
      };
    }

    if (preset === "employee_access") {
      next = {
        globalAdmin: false,
        inventoryAdmin: false,
        hrAdmin: false,
        employeeAccess: true,
      };
    }

    if (preset === "hr_and_inventory") {
      next = {
        globalAdmin: false,
        inventoryAdmin: true,
        hrAdmin: true,
        employeeAccess: true,
      };
    }

    if (preset === "none") {
      next = cloneAccess(emptyAccess);
    }

    setDraftAccess((current) => ({
      ...current,
      [userId]: next,
    }));
  };

  const saveAccess = async (userId: string) => {
    setError("");
    setMessage("");
    setSavingUserId(userId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const access = draftAccess[userId] || emptyAccess;

      const response = await fetch("/api/admin/access", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId,
          ...access,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Unable to update user access.");
        return;
      }

      setMessage(result.message || "Access updated.");
      await loadUsers();
    } catch {
      setError("Unable to save access changes.");
    } finally {
      setSavingUserId(null);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={() => router.push("/apps")}
          className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          ← Back to apps
        </button>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-600 dark:text-rose-400">
                Global Settings
              </p>

              <h1 className="mt-3 text-3xl font-bold tracking-tight">
                Access Management
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                View all sign-ups and assign access for Inventory, HR,
                employee tools, or full admin control.
              </p>
            </div>

            <button
              onClick={loadUsers}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Refresh
            </button>
          </div>

          {message && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-8">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by email..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-rose-950"
            />
          </div>

          {loading ? (
            <p className="mt-8 text-sm text-slate-500">Loading users...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="mt-8 text-sm text-slate-500">No users found.</p>
          ) : (
            <div className="mt-8 space-y-4">
              {filteredUsers.map((user) => {
                const draft = draftAccess[user.id] || emptyAccess;

                return (
                  <div
                    key={user.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800"
                  >
                    <div className="grid gap-5 xl:grid-cols-[1.1fr_1.5fr_auto] xl:items-start">
                      <div>
                        <h2 className="text-lg font-semibold">
                          {user.email || "No email"}
                        </h2>

                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Signed up: {formatDate(user.createdAt)}
                        </p>

                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Last sign-in: {formatDate(user.lastSignInAt)}
                        </p>

                        {user.oldProfileRole && (
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            Old profile role: {user.oldProfileRole}
                          </p>
                        )}

                        <p className="mt-3 rounded-xl bg-white p-3 text-xs font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                          Current draft: {accessSummary(draft)}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Quick preset
                        </label>

                        <select
                          onChange={(event) =>
                            applyPreset(user.id, event.target.value)
                          }
                          defaultValue=""
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-rose-950"
                        >
                          <option value="" disabled>
                            Choose preset...
                          </option>
                          <option value="admin_all">Admin for All</option>
                          <option value="inventory_admin">
                            Inventory Admin only
                          </option>
                          <option value="hr_admin">HR Admin only</option>
                          <option value="employee_access">
                            Employee Access only
                          </option>
                          <option value="hr_and_inventory">
                            HR Admin + Inventory Admin
                          </option>
                          <option value="none">No access</option>
                        </select>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-medium dark:border-slate-700 dark:bg-slate-900">
                            <input
                              type="checkbox"
                              checked={draft.globalAdmin}
                              onChange={(event) =>
                                updateDraft(
                                  user.id,
                                  "globalAdmin",
                                  event.target.checked
                                )
                              }
                            />
                            Admin for All
                          </label>

                          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-medium dark:border-slate-700 dark:bg-slate-900">
                            <input
                              type="checkbox"
                              checked={draft.inventoryAdmin}
                              onChange={(event) =>
                                updateDraft(
                                  user.id,
                                  "inventoryAdmin",
                                  event.target.checked
                                )
                              }
                            />
                            Inventory Admin
                          </label>

                          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-medium dark:border-slate-700 dark:bg-slate-900">
                            <input
                              type="checkbox"
                              checked={draft.hrAdmin}
                              onChange={(event) =>
                                updateDraft(
                                  user.id,
                                  "hrAdmin",
                                  event.target.checked
                                )
                              }
                            />
                            HR Admin
                          </label>

                          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-medium dark:border-slate-700 dark:bg-slate-900">
                            <input
                              type="checkbox"
                              checked={draft.employeeAccess}
                              onChange={(event) =>
                                updateDraft(
                                  user.id,
                                  "employeeAccess",
                                  event.target.checked
                                )
                              }
                            />
                            Employee Access
                          </label>
                        </div>
                      </div>

                      <button
                        onClick={() => saveAccess(user.id)}
                        disabled={savingUserId === user.id}
                        className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingUserId === user.id
                          ? "Saving..."
                          : "Save Access"}
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