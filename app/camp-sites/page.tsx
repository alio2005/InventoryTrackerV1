"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type CampSite = {
  id: number;
  name: string;
  site_leader_name: string | null;
  site_leader_email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
};

export default function CampSitesPage() {
  const router = useRouter();

  const [sites, setSites] = useState<CampSite[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const [newSiteName, setNewSiteName] = useState("");
  const [newLeaderName, setNewLeaderName] = useState("");
  const [newLeaderEmail, setNewLeaderEmail] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const inputClass =
    "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-blue-400";

  const textAreaClass =
    "w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-blue-400";

  const loadSites = async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { data, error } = await supabase
      .from("camp_sites")
      .select("id, name, site_leader_name, site_leader_email, address, notes, is_active, created_at")
      .order("name");

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setSites((data ?? []) as CampSite[]);
    setLoading(false);
  };

  useEffect(() => {
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSiteField = (
    siteId: number,
    field: keyof CampSite,
    value: string | boolean
  ) => {
    setSites((prev) =>
      prev.map((site) =>
        site.id === siteId
          ? {
              ...site,
              [field]: value,
            }
          : site
      )
    );
  };

  const handleSaveSite = async (site: CampSite) => {
    setMessage("");
    setSavingId(site.id);

    if (!site.name.trim()) {
      setMessage("Site name is required.");
      setSavingId(null);
      return;
    }

    const { error } = await supabase
      .from("camp_sites")
      .update({
        name: site.name.trim(),
        site_leader_name: site.site_leader_name?.trim() || null,
        site_leader_email: site.site_leader_email?.trim() || null,
        address: site.address?.trim() || null,
        notes: site.notes?.trim() || null,
        is_active: site.is_active,
      })
      .eq("id", site.id);

    if (error) {
      setMessage(error.message);
      setSavingId(null);
      return;
    }

    setMessage(`${site.name} updated.`);
    setSavingId(null);
    await loadSites();
  };

  const handleCreateSite = async () => {
    setMessage("");

    if (!newSiteName.trim()) {
      setMessage("Enter a site name first.");
      return;
    }

    const { error } = await supabase.from("camp_sites").insert({
      name: newSiteName.trim(),
      site_leader_name: newLeaderName.trim() || null,
      site_leader_email: newLeaderEmail.trim() || null,
      address: newAddress.trim() || null,
      notes: newNotes.trim() || null,
      is_active: true,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewSiteName("");
    setNewLeaderName("");
    setNewLeaderEmail("");
    setNewAddress("");
    setNewNotes("");
    setMessage("Camp site added.");
    await loadSites();
  };

  const activeSites = sites.filter((site) => site.is_active);
  const inactiveSites = sites.filter((site) => !site.is_active);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">Inventory System</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Camp Sites
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Set up the 6 camp locations and assign each site leader. Camp allocations will auto-fill the responsible person from here.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => router.push("/camp-allocations")}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Camp Allocations
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200">
            {message}
          </div>
        )}

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Total Sites</p>
            <p className="mt-2 text-2xl font-bold">{sites.length}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Active Sites</p>
            <p className="mt-2 text-2xl font-bold">{activeSites.length}</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Inactive Sites</p>
            <p className="mt-2 text-2xl font-bold">{inactiveSites.length}</p>
          </div>
        </div>

        <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight">Add New Camp Site</h2>
          <p className="mt-1 text-sm text-slate-400">
            Use this only if you need more than the 6 default locations.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Site Name</label>
              <input
                type="text"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                placeholder="Example: Stonebridge PS"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Site Leader Name</label>
              <input
                type="text"
                value={newLeaderName}
                onChange={(e) => setNewLeaderName(e.target.value)}
                placeholder="Example: Cassie"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Site Leader Email</label>
              <input
                type="email"
                value={newLeaderEmail}
                onChange={(e) => setNewLeaderEmail(e.target.value)}
                placeholder="leader@email.com"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Address</label>
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Optional"
                className={inputClass}
              />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium text-slate-200">Notes</label>
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Optional notes"
                rows={3}
                className={textAreaClass}
              />
            </div>
          </div>

          <button
            onClick={handleCreateSite}
            className="mt-5 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Add Site
          </button>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight">Manage Camp Sites</h2>
            <p className="mt-1 text-sm text-slate-400">
              Rename the default locations and assign each site leader.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-sm text-slate-400">
              Loading sites...
            </div>
          ) : sites.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-sm text-slate-400">
              No camp sites found.
            </div>
          ) : (
            <div className="space-y-5">
              {sites.map((site) => (
                <div
                  key={site.id}
                  className={`rounded-3xl border p-5 ${
                    site.is_active
                      ? "border-slate-800 bg-slate-950"
                      : "border-rose-900/60 bg-rose-950/20"
                  }`}
                >
                  <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">
                          {site.name || "Unnamed Site"}
                        </h3>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            site.is_active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {site.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-400">
                        Leader: {site.site_leader_name || "Not assigned"}
                      </p>
                    </div>

                    <button
                      onClick={() => handleSaveSite(site)}
                      disabled={savingId === site.id}
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingId === site.id ? "Saving..." : "Save Site"}
                    </button>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-200">Site Name</label>
                      <input
                        type="text"
                        value={site.name}
                        onChange={(e) =>
                          updateSiteField(site.id, "name", e.target.value)
                        }
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-200">Site Leader Name</label>
                      <input
                        type="text"
                        value={site.site_leader_name ?? ""}
                        onChange={(e) =>
                          updateSiteField(
                            site.id,
                            "site_leader_name",
                            e.target.value
                          )
                        }
                        placeholder="Site leader name"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-200">Site Leader Email</label>
                      <input
                        type="email"
                        value={site.site_leader_email ?? ""}
                        onChange={(e) =>
                          updateSiteField(
                            site.id,
                            "site_leader_email",
                            e.target.value
                          )
                        }
                        placeholder="leader@email.com"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-200">Address</label>
                      <input
                        type="text"
                        value={site.address ?? ""}
                        onChange={(e) =>
                          updateSiteField(site.id, "address", e.target.value)
                        }
                        placeholder="Optional"
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-2 lg:col-span-2">
                      <label className="text-sm font-medium text-slate-200">Notes</label>
                      <textarea
                        value={site.notes ?? ""}
                        onChange={(e) =>
                          updateSiteField(site.id, "notes", e.target.value)
                        }
                        placeholder="Optional notes"
                        rows={3}
                        className={textAreaClass}
                      />
                    </div>

                    <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={site.is_active}
                        onChange={(e) =>
                          updateSiteField(site.id, "is_active", e.target.checked)
                        }
                      />
                      Active site
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
