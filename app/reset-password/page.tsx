"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async () => {
    setMessage("");

    if (!password.trim() || !confirmPassword.trim()) {
      setMessageType("error");
      setMessage("Please enter and confirm your new password.");
      return;
    }

    if (password.length < 8) {
      setMessageType("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessageType("error");
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessageType("success");
    setMessage("Password updated successfully. Redirecting to sign in...");

    await supabase.auth.signOut();

    setTimeout(() => {
      router.push("/");
    }, 1500);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-sm">
          <p className="text-sm font-medium text-slate-400">Inventory System</p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Create new password
          </h1>

          <p className="mt-3 text-sm text-slate-400">
            Enter a new password for your account.
          </p>

          <div className="mt-8 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                New password
              </label>

              <input
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Confirm new password
              </label>

              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleUpdatePassword}
              disabled={loading}
              className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update password"}
            </button>

            {message && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  messageType === "success"
                    ? "border-emerald-900 bg-emerald-950/40 text-emerald-300"
                    : "border-rose-900 bg-rose-950/40 text-rose-300"
                }`}
              >
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}