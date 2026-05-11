"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
};

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function initialsFor(text: string) {
  return (
    text
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function roleLabel(role: string | null | undefined) {
  if (role === "admin") return "Admin";
  if (role === "staff") return "Staff";
  return "User";
}

export default function SettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [myRole, setMyRole] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [roleLoadingId, setRoleLoadingId] = useState<string | null>(null);

  const isAdmin = myRole === "admin";

  const loadSettings = useCallback(async () => {
    setError("");
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, avatar_url")
      .eq("id", user.id)
      .single();

    const metadata = user.user_metadata as Record<string, unknown>;
    const email = myProfile?.email || user.email || "";
    const name =
      getString(metadata.display_name) ||
      getString(metadata.full_name) ||
      myProfile?.full_name ||
      email ||
      "Inventory User";

    setUserId(user.id);
    setUserEmail(email);
    setMyRole(myProfile?.role ?? "");
    setDisplayName(name);
    setAvatarUrl(getString(myProfile?.avatar_url) || getString(metadata.avatar_url));

    if (myProfile?.role === "admin") {
      const { data, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, avatar_url")
        .order("email", { ascending: true });

      if (profilesError) {
        setError(profilesError.message);
        return;
      }

      setProfiles((data ?? []) as Profile[]);
    } else {
      setProfiles([]);
    }
  }, [router]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const filteredProfiles = useMemo(() => {
    const search = userSearch.trim().toLowerCase();
    if (!search) return profiles;

    return profiles.filter((profile) => {
      const text = `${profile.email ?? ""} ${profile.full_name ?? ""} ${profile.role ?? ""}`.toLowerCase();
      return text.includes(search);
    });
  }, [profiles, userSearch]);

  const previewName = displayName.trim() || userEmail || "Inventory User";

  const saveProfile = async () => {
    setSavingProfile(true);
    setError("");
    setMessage("");

    const cleanedName = displayName.trim() || userEmail || "Inventory User";
    const cleanedAvatarUrl = avatarUrl.trim();

    const { error: authError } = await supabase.auth.updateUser({
      data: {
        display_name: cleanedName,
        full_name: cleanedName,
        avatar_url: cleanedAvatarUrl,
      },
    });

    if (authError) {
      setError(authError.message);
      setSavingProfile(false);
      return;
    }

    if (userId) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: cleanedName, avatar_url: cleanedAvatarUrl })
        .eq("id", userId);

      if (profileError) {
        setError(profileError.message);
        setSavingProfile(false);
        return;
      }
    }

    setDisplayName(cleanedName);
    setAvatarUrl(cleanedAvatarUrl);
    setMessage("Profile updated. The sidebar will show your name and picture.");
    window.dispatchEvent(new Event("inventory-profile-updated"));
    setSavingProfile(false);
    await loadSettings();
  };

  const uploadProfilePhoto = async () => {
    if (!selectedFile || !userId) {
      setError("Choose an image file first.");
      return;
    }

    setUploadingPhoto(true);
    setError("");
    setMessage("");

    const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
    const filePath = `${userId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-pictures")
      .upload(filePath, selectedFile, { upsert: true });

    if (uploadError) {
      setError(`${uploadError.message}. If this mentions a bucket or policy, run the included Supabase SQL file.`);
      setUploadingPhoto(false);
      return;
    }

    const { data } = supabase.storage.from("profile-pictures").getPublicUrl(filePath);
    const publicUrl = data.publicUrl;

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        display_name: previewName,
        full_name: previewName,
        avatar_url: publicUrl,
      },
    });

    if (updateError) {
      setError(updateError.message);
      setUploadingPhoto(false);
      return;
    }

    if (userId) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: previewName, avatar_url: publicUrl })
        .eq("id", userId);

      if (profileError) {
        setError(profileError.message);
        setUploadingPhoto(false);
        return;
      }
    }

    setAvatarUrl(publicUrl);
    setSelectedFile(null);
    setMessage("Profile picture uploaded.");
    window.dispatchEvent(new Event("inventory-profile-updated"));
    setUploadingPhoto(false);
    await loadSettings();
  };

  const updateRole = async (profileId: string, newRole: "admin" | "staff") => {
    setError("");
    setMessage("");

    if (profileId === userId) {
      setError("You cannot change your own role from this page.");
      return;
    }

    setRoleLoadingId(profileId);

    const { error: roleError } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", profileId);

    if (roleError) {
      setError(roleError.message);
      setRoleLoadingId(null);
      return;
    }

    setMessage(`User role updated to ${newRole}.`);
    setRoleLoadingId(null);
    await loadSettings();
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
            Settings
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Profile & app settings</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-zinc-400">
            Update your name and profile picture. Admin users can also manage account roles.
          </p>
        </div>

        {(message || error) && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start gap-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile preview"
                  className="h-20 w-20 rounded-3xl border border-slate-200 object-cover dark:border-zinc-800"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-2xl font-bold text-white dark:bg-zinc-800">
                  {initialsFor(previewName)}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold">{previewName}</h2>
                <p className="mt-1 truncate text-sm text-slate-500 dark:text-zinc-400">{userEmail}</p>
                <span className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {roleLabel(myRole)}
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="text-sm font-bold text-slate-700 dark:text-zinc-300">Display name</label>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Enter your name"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 dark:text-zinc-300">Profile picture URL</label>
                <input
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="https://..."
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
                  Pasting an image URL works immediately. Uploading a file needs the Supabase storage bucket.
                </p>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 dark:text-zinc-300">Upload image</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  className="mt-2 w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                />
                <button
                  type="button"
                  onClick={uploadProfilePhoto}
                  disabled={uploadingPhoto || !selectedFile}
                  className="mt-3 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  {uploadingPhoto ? "Uploading..." : "Upload Profile Picture"}
                </button>
              </div>

              <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  {savingProfile ? "Saving..." : "Save Profile"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
                  Admin tools
                </p>
                <h2 className="mt-2 text-xl font-bold">User role management</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                  {isAdmin ? "Search users, view profile photos, and update staff/admin access." : "Only admins can manage user roles."}
                </p>
              </div>
              {isAdmin && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {profiles.length} users
                </span>
              )}
            </div>

            {!isAdmin ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                Your profile settings are available on the left. Admin-only tools are hidden for this account.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Search by name, email, or role..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
                />

                {filteredProfiles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    No users found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredProfiles.map((profile) => {
                      const isCurrentUser = profile.id === userId;
                      const label = profile.full_name || profile.email || "Unknown User";

                      return (
                        <div
                          key={profile.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              {profile.avatar_url ? (
                                <img
                                  src={profile.avatar_url}
                                  alt={`${label} profile picture`}
                                  className="h-10 w-10 shrink-0 rounded-2xl border border-slate-200 object-cover dark:border-zinc-700"
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white dark:bg-zinc-800">
                                  {initialsFor(label)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <h3 className="truncate text-sm font-bold text-slate-950 dark:text-zinc-100">
                                  {label}
                                </h3>
                                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-zinc-400">
                                  {profile.email || "No email"} · {roleLabel(profile.role)}{isCurrentUser ? " · You" : ""}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => updateRole(profile.id, "staff")}
                                disabled={roleLoadingId === profile.id || isCurrentUser}
                                className="rounded-xl bg-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                              >
                                Make Staff
                              </button>
                              <button
                                type="button"
                                onClick={() => updateRole(profile.id, "admin")}
                                disabled={roleLoadingId === profile.id || isCurrentUser}
                                className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
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
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
