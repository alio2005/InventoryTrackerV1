"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Department = {
  id: number;
  name: string;
};

export default function DepartmentsPage() {
  const router = useRouter();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDepartment, setNewDepartment] = useState("");
  const [message, setMessage] = useState("");
  const [role, setRole] = useState("");
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const loadDepartments = async () => {
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
      .from("departments")
      .select("id, name")
      .order("name");

    if (error) {
      setMessage(error.message);
      return;
    }

    setDepartments(data || []);
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleAddDepartment = async () => {
    setMessage("");

    if (role !== "admin") {
      setMessage("Only admins can add departments.");
      return;
    }

    if (!newDepartment.trim()) {
      setMessage("Please enter a department name.");
      return;
    }

    const { error } = await supabase.from("departments").insert({
      name: newDepartment.trim(),
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewDepartment("");
    setMessage("Department added.");
    await loadDepartments();
  };

  const handleDeleteDepartment = async (
    departmentId: number,
    departmentName: string
  ) => {
    setMessage("");

    if (role !== "admin") {
      setMessage("Only admins can delete departments.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${departmentName}"? This will fail if inventory items are still assigned to it.`
    );

    if (!confirmed) return;

    setLoadingId(departmentId);

    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", departmentId);

    if (error) {
      setMessage(
        error.message ||
          "Could not delete department. It may still be assigned to inventory items."
      );
      setLoadingId(null);
      return;
    }

    setMessage("Department deleted.");
    setLoadingId(null);
    await loadDepartments();
  };

  return (
    <main className="min-h-screen bg-black text-zinc-100 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Inventory System
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Departments
            </h1>
            <div className="mt-3 flex flex-col gap-1 text-sm text-zinc-400 dark:text-zinc-300 sm:flex-row sm:gap-6">
              <span>
                Role:{" "}
                <span className="font-medium capitalize text-zinc-100 dark:text-zinc-100">
                  {role || "unknown"}
                </span>
              </span>
              <span>
                Total Departments:{" "}
                <span className="font-medium text-zinc-100 dark:text-zinc-100">
                  {departments.length}
                </span>
              </span>
            </div>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center justify-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-5">
              <h2 className="text-xl font-semibold tracking-tight">
                Add department
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Create a department to organize inventory more clearly.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300 dark:text-zinc-300">
                  Department name
                </label>
                <input
                  type="text"
                  placeholder="Enter department name"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-400 focus:bg-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:bg-zinc-900"
                />
              </div>

              <button
                onClick={handleAddDepartment}
                className="inline-flex items-center justify-center rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700"
              >
                Add Department
              </button>

              {message && (
                <div className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  {message}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Current departments
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Departments available for assigning inventory items.
                </p>
              </div>

              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Count:{" "}
                <span className="font-medium text-zinc-100 dark:text-zinc-100">
                  {departments.length}
                </span>
              </div>
            </div>

            {departments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-700 bg-black p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                No departments yet.
              </div>
            ) : (
              <div className="space-y-4">
                {departments.map((department) => (
                  <div
                    key={department.id}
                    className="rounded-3xl border border-zinc-800 bg-black p-5 transition hover:border-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-zinc-100 dark:text-zinc-100">
                          {department.name}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          Department ID: {department.id}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                          Active
                        </span>

                        {role === "admin" && (
                          <button
                            onClick={() =>
                              handleDeleteDepartment(
                                department.id,
                                department.name
                              )
                            }
                            disabled={loadingId === department.id}
                            className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {loadingId === department.id ? "Deleting..." : "Delete"}
                          </button>
                        )}
                      </div>
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