"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    setMessage("");

    if (!email.trim()) {
      setMessageType("error");
      setMessage("Please enter your email address.");
      return;
    }

    setLoading(true);

    const redirectTo = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessageType("success");
    setMessage("Password reset email sent. Please check your inbox.");
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-sm">
          <p className="text-sm font-medium text-slate-400">Inventory System</p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Reset your password
          </h1>

          <p className="mt-3 text-sm text-slate-400">
            Enter your account email and we will send you a reset link.
          </p>

          <div className="mt-8 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Email
              </label>

              <input
                type="email"
                placeholder="name@upluseducation.ca"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send reset email"}
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

            <Link
              href="/"
              className="block text-center text-sm font-medium text-slate-300 hover:text-white"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}