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
    <main className="min-h-screen bg-black text-zinc-100 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Admin Settings
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              User Role Management
            </h1>
            <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-300">
              Promote or demote users between staff and admin.
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center justify-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Back to Dashboard
          </button>
        </div>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                App users
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Only admins can access this page.
              </p>
            </div>

            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              Total users:{" "}
              <span className="font-medium text-zinc-100 dark:text-zinc-100">
                {profiles.length}
              </span>
            </div>
          </div>

          {message && (
            <div className="mb-5 rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {message}
            </div>
          )}

          {profiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-black p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              No users found.
            </div>
          ) : (
            <div className="space-y-4">
              {profiles.map((profile) => {
                const isCurrentUser = profile.id === currentUserId;

                return (
                  <div
                    key={profile.id}
                    className="rounded-3xl border border-zinc-800 bg-black p-5 transition hover:border-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-zinc-100 dark:text-zinc-100">
                          {profile.email || profile.full_name || "Unknown User"}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          Role: <span className="font-medium capitalize">{profile.role}</span>
                          {isCurrentUser ? " (you)" : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => updateRole(profile.id, "staff")}
                          disabled={loadingId === profile.id || isCurrentUser}
                          className="inline-flex items-center justify-center rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                        >
                          Make Staff
                        </button>

                        <button
                          onClick={() => updateRole(profile.id, "admin")}
                          disabled={loadingId === profile.id || isCurrentUser}
                          className="inline-flex items-center justify-center rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
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