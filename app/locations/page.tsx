"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Location = {
  id: number;
  name: string;
};

export default function LocationsPage() {
  const router = useRouter();

  const [locations, setLocations] = useState<Location[]>([]);
  const [newLocation, setNewLocation] = useState("");
  const [message, setMessage] = useState("");
  const [role, setRole] = useState("");

  const loadLocations = async () => {
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const userRole = profile?.role ?? "";
    setRole(userRole);

    const { data, error } = await supabase
      .from("locations")
      .select("id, name")
      .order("name");

    if (error) {
      setMessage(error.message);
      return;
    }

    setLocations(data || []);
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const handleAddLocation = async () => {
    setMessage("");

    if (role !== "admin") {
      setMessage("Only admins can add locations.");
      return;
    }

    if (!newLocation.trim()) {
      setMessage("Please enter a location name.");
      return;
    }

    const { error } = await supabase.from("locations").insert({
      name: newLocation.trim(),
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewLocation("");
    setMessage("Location added.");
    await loadLocations();
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Inventory System</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Locations
            </h1>
            <div className="mt-3 flex flex-col gap-1 text-sm text-slate-600 sm:flex-row sm:gap-6">
              <span>
                Role:{" "}
                <span className="font-medium capitalize text-slate-900">
                  {role || "unknown"}
                </span>
              </span>
              <span>
                Total Locations:{" "}
                <span className="font-medium text-slate-900">
                  {locations.length}
                </span>
              </span>
            </div>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-semibold tracking-tight">
                Add location
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Create a new office or branch location for inventory tracking.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Location name
                </label>
                <input
                  type="text"
                  placeholder="Enter location name"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                />
              </div>

              <button
                onClick={handleAddLocation}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Add Location
              </button>

              {message && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {message}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Current locations
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Office and branch locations available for inventory assignment.
                </p>
              </div>

              <div className="text-sm text-slate-500">
                Count:{" "}
                <span className="font-medium text-slate-900">
                  {locations.length}
                </span>
              </div>
            </div>

            {locations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                No locations yet.
              </div>
            ) : (
              <div className="space-y-4">
                {locations.map((location) => (
                  <div
                    key={location.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">
                          {location.name}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Location ID: {location.id}
                        </p>
                      </div>

                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                        Active
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}