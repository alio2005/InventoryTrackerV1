"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "staff";
};

export default function SettingsPage() {
  const router = useRouter();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const loadProfiles = async () => {
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    setCurrentUserId(user.id);

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (myProfile?.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .order("email", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setProfiles((data ?? []) as Profile[]);
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const updateRole = async (profileId: string, newRole: "admin" | "staff") => {
    setMessage("");

    if (profileId === currentUserId) {
      setMessage("You cannot change your own role from this page.");
      return;
    }

    setLoadingId(profileId);

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", profileId);

    if (error) {
      setMessage(error.message);
      setLoadingId(null);
      return;
    }

    setMessage(`User role updated to ${newRole}.`);
    setLoadingId(null);
    await loadProfiles();
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Admin Settings
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              User Role Management
            </h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Promote or demote users between staff and admin.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Back to Dashboard
          </button>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                App users
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Only admins can access this page.
              </p>
            </div>

            <div className="text-sm text-slate-500 dark:text-slate-400">
              Total users:{" "}
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {profiles.length}
              </span>
            </div>
          </div>

          {message && (
            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {message}
            </div>
          )}

          {profiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              No users found.
            </div>
          ) : (
            <div className="space-y-4">
              {profiles.map((profile) => {
                const isCurrentUser = profile.id === currentUserId;

                return (
                  <div
                    key={profile.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {profile.email || profile.full_name || "Unknown User"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          Role: <span className="font-medium capitalize">{profile.role}</span>
                          {isCurrentUser ? " (you)" : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => updateRole(profile.id, "staff")}
                          disabled={loadingId === profile.id || isCurrentUser}
                          className="inline-flex items-center justify-center rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                        >
                          Make Staff
                        </button>

                        <button
                          onClick={() => updateRole(profile.id, "admin")}
                          disabled={loadingId === profile.id || isCurrentUser}
                          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Make Admin
                        </button>
                      </div>
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