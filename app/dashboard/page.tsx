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

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [totalItems, setTotalItems] = useState(0);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [totalDepartments, setTotalDepartments] = useState(0);
  const [totalLocations, setTotalLocations] = useState(0);

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

      setTotalDepartments(((departmentsData ?? []) as SimpleRow[]).length);
      setTotalLocations(((locationsData ?? []) as SimpleRow[]).length);
    };

    loadDashboard();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="mb-2">Signed in as: {email}</p>
          <p className="mb-6">Role: {role || "No role found"}</p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border p-4 bg-white">
              <h2 className="text-sm text-gray-500">Active Items</h2>
              <p className="text-3xl font-bold">{totalItems}</p>
            </div>

            <div className="rounded-xl border p-4 bg-white">
              <h2 className="text-sm text-gray-500">Total Quantity</h2>
              <p className="text-3xl font-bold">{totalQuantity}</p>
            </div>

            <div className="rounded-xl border p-4 bg-white">
              <h2 className="text-sm text-gray-500">Departments</h2>
              <p className="text-3xl font-bold">{totalDepartments}</p>
            </div>

            <div className="rounded-xl border p-4 bg-white">
              <h2 className="text-sm text-gray-500">Locations</h2>
              <p className="text-3xl font-bold">{totalLocations}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div
              onClick={() => router.push("/inventory")}
              className="rounded-xl border p-4 cursor-pointer hover:bg-gray-50"
            >
              <h2 className="font-semibold text-lg">Inventory</h2>
              <p className="text-sm text-gray-600">
                View and manage inventory items.
              </p>
            </div>

            <div
              onClick={() => router.push("/transactions")}
              className="rounded-xl border p-4 cursor-pointer hover:bg-gray-50"
            >
              <h2 className="font-semibold text-lg">Transactions</h2>
              <p className="text-sm text-gray-600">
                Track sign in and sign out history.
              </p>
            </div>

            <div
              onClick={() => router.push("/departments")}
              className="rounded-xl border p-4 cursor-pointer hover:bg-gray-50"
            >
              <h2 className="font-semibold text-lg">Departments</h2>
              <p className="text-sm text-gray-600">
                Organize inventory by department.
              </p>
            </div>

            <div
              onClick={() => router.push("/locations")}
              className="rounded-xl border p-4 cursor-pointer hover:bg-gray-50"
            >
              <h2 className="font-semibold text-lg">Locations</h2>
              <p className="text-sm text-gray-600">
                Separate items by office location.
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="mt-6 bg-black text-white rounded-lg px-4 py-2"
          >
            Sign Out
          </button>
        </div>
      </div>
    </main>
  );
}