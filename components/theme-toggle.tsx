"use client";

import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-5 right-5 z-50 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-lg transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
    >
      {theme === "dark" ? "Light Mode" : "Dark Mode"}
    </button>
  );
}