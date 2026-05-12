"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type AuditLog = {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatAction(action: string) {
  return action.replaceAll("_", " ");
}

function getActionClass(action: string) {
  if (action.includes("approved")) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }

  if (action.includes("rejected")) {
    return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  }

  if (action.includes("edited")) {
    return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  }

  return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
}

function stringifyDetails(details: Record<string, unknown> | null) {
  if (!details) return "{}";

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return "{}";
  }
}

export default function AuditLogsPage() {
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filteredLogs = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();

    return logs.filter((log) => {
      const matchesSearch =
        !normalizedSearch ||
        log.action.toLowerCase().includes(normalizedSearch) ||
        log.entity_type.toLowerCase().includes(normalizedSearch) ||
        log.entity_id.toLowerCase().includes(normalizedSearch) ||
        (log.actor_email ?? "").toLowerCase().includes(normalizedSearch);

      const matchesAction =
        actionFilter === "all" || log.action === actionFilter;

      return matchesSearch && matchesAction;
    });
  }, [logs, search, actionFilter]);

  const actionOptions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.action))).sort();
  }, [logs]);

  const loadLogs = async () => {
    setError("");
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      const response = await fetch("/api/hr/audit-logs", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Unable to load audit logs.");
        return;
      }

      setLogs(result.logs || []);
    } catch {
      setError("Unable to connect to the audit log system.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl">
        <button
          onClick={() => router.push("/hr")}
          className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          ← Back to HR
        </button>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                HR Audit
              </p>

              <h1 className="mt-3 text-3xl font-bold tracking-tight">
                Audit Logs
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                Review HR actions including time entry edits, approvals,
                rejections, and resets.
              </p>
            </div>

            <button
              onClick={loadLogs}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Refresh
            </button>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-[1fr_260px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search actor, action, entity..."
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
            />

            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-emerald-950"
            >
              <option value="all">All actions</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {formatAction(action)}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="mt-8 text-sm text-slate-500">Loading audit logs...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="mt-8 text-sm text-slate-500">
              No audit logs found yet.
            </p>
          ) : (
            <div className="mt-8 space-y-4">
              {filteredLogs.map((log) => {
                const isExpanded = expandedId === log.id;

                return (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getActionClass(
                              log.action
                            )}`}
                          >
                            {formatAction(log.action)}
                          </span>

                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {formatDateTime(log.created_at)}
                          </span>
                        </div>

                        <h2 className="mt-3 text-lg font-semibold">
                          {log.actor_email || "Unknown user"}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          Entity: {log.entity_type}
                        </p>

                        <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                          Record ID: {log.entity_id}
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          setExpandedId(isExpanded ? null : log.id)
                        }
                        className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-700"
                      >
                        {isExpanded ? "Hide Details" : "View Details"}
                      </button>
                    </div>

                    {isExpanded && (
                      <pre className="mt-5 max-h-[500px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                        {stringifyDetails(log.details)}
                      </pre>
                    )}
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