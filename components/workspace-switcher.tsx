"use client";

import Link from "next/link";
import { useWorkspace } from "@/components/workspace-provider";

export function WorkspaceSwitcher() {
  const {
    departments,
    selectedDepartmentId,
    selectedDepartment,
    isLoading,
    setSelectedDepartmentId,
    clearWorkspace,
    refreshDepartments,
  } = useWorkspace();

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="hidden min-w-0 flex-col xl:flex">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500">
          Workspace
        </span>
        <span className="max-w-[190px] truncate text-xs font-semibold text-slate-600 dark:text-zinc-300">
          {selectedDepartment?.name || "All departments"}
        </span>
      </div>

      <div className="relative">
        <select
          value={selectedDepartmentId}
          onChange={(event) => setSelectedDepartmentId(event.target.value)}
          className="h-11 w-[180px] appearance-none rounded-2xl border border-slate-200 bg-white px-3 pr-9 text-sm font-semibold text-slate-800 shadow-sm outline-none transition hover:bg-slate-50 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 dark:focus:border-zinc-600 dark:focus:ring-zinc-900 sm:w-[220px]"
          title="Choose department workspace"
          disabled={isLoading}
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>

        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {selectedDepartmentId ? (
        <button
          type="button"
          onClick={clearWorkspace}
          className="hidden rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 sm:inline-flex"
        >
          Clear
        </button>
      ) : (
        <Link
          href="/departments"
          onClick={() => void refreshDepartments()}
          className="hidden rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 sm:inline-flex"
        >
          Manage
        </Link>
      )}
    </div>
  );
}
