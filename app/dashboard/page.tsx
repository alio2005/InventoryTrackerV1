"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type InventoryItem = {
  id: number;
  quantity: number;
};

type SimpleRow = {
  id: number;
};

type BorrowedRow = {
  id: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [totalDepartments, setTotalDepartments] = useState(0);
  const [totalLocations, setTotalLocations] = useState(0);
  const [totalBorrowed, setTotalBorrowed] = useState(0);

  useEffect(() => {
    const loadDashboard = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      }

      setEmail(user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile) {
        setRole(profile.role);
      }

      const { data: inventoryData } = await supabase
        .from("inventory_items")
        .select("id, quantity")
        .eq("is_active", true);

      const safeInventory = (inventoryData ?? []) as InventoryItem[];
      setTotalItems(safeInventory.length);
      setTotalQuantity(
        safeInventory.reduce((sum, item) => sum + item.quantity, 0)
      );

      const { data: departmentsData } = await supabase
        .from("departments")
        .select("id");

      const { data: locationsData } = await supabase
        .from("locations")
        .select("id");

      const { data: borrowedData } = await supabase
        .from("borrowed_items")
        .select("id")
        .eq("returned", false);

      setTotalDepartments(((departmentsData ?? []) as SimpleRow[]).length);
      setTotalLocations(((locationsData ?? []) as SimpleRow[]).length);
      setTotalBorrowed(((borrowedData ?? []) as BorrowedRow[]).length);
    };

    loadDashboard();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Inventory System</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Dashboard
            </h1>
            <div className="mt-3 flex flex-col gap-1 text-sm text-slate-600 sm:flex-row sm:gap-6">
              <span>
                Signed in as: <span className="font-medium text-slate-900">{email}</span>
              </span>
              <span>
                Role: <span className="font-medium capitalize text-slate-900">{role || "unknown"}</span>
              </span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Sign Out
          </button>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Active Items</p>
            <p className="mt-3 text-3xl font-bold tracking-tight">{totalItems}</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total Quantity</p>
            <p className="mt-3 text-3xl font-bold tracking-tight">{totalQuantity}</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Departments</p>
            <p className="mt-3 text-3xl font-bold tracking-tight">{totalDepartments}</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Locations</p>
            <p className="mt-3 text-3xl font-bold tracking-tight">{totalLocations}</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Borrowed Out</p>
            <p className="mt-3 text-3xl font-bold tracking-tight">{totalBorrowed}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight">Workspace</h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage inventory, borrowed products, history, departments, and locations.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button
              onClick={() => router.push("/inventory")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-blue-200 hover:bg-blue-50"
            >
              <div className="mb-3 inline-flex rounded-xl bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                Inventory
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Manage inventory
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Add items, sign products in or out, apply filters, and archive stock.
              </p>
            </button>

            <button
              onClick={() => router.push("/borrowed")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-cyan-200 hover:bg-cyan-50"
            >
              <div className="mb-3 inline-flex rounded-xl bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                Borrowed Items
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Track borrowed products
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                See what is currently signed out and process product returns.
              </p>
            </button>

            <button
              onClick={() => router.push("/transactions")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-violet-200 hover:bg-violet-50"
            >
              <div className="mb-3 inline-flex rounded-xl bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                Transactions
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                View transaction history
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Review sign-ins, sign-outs, item creation, and archive activity.
              </p>
            </button>

            <button
              onClick={() => router.push("/departments")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
            >
              <div className="mb-3 inline-flex rounded-xl bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Departments
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Manage departments
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Create and maintain department groups used across the app.
              </p>
            </button>

            <button
              onClick={() => router.push("/locations")}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-amber-200 hover:bg-amber-50"
            >
              <div className="mb-3 inline-flex rounded-xl bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                Locations
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Manage locations
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Organize inventory across office locations and branches.
              </p>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}