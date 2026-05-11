"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setLoading(true);
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setMessage("Please enter both email and password.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Account created. Check your email if confirmation is enabled.");
    setLoading(false);
  };

  const handleSignIn = async () => {
    setLoading(true);
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setMessage("Please enter both email and password.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/apps");
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 transition-colors dark:bg-black dark:text-zinc-100">
      <div className="mx-auto flex min-h-[85vh] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/60 lg:grid-cols-2">
          <section className="login-brand-panel flex min-h-[420px] flex-col justify-center p-8 text-white sm:p-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#cbd5e1]">
                Inventory System
              </p>
              <h1 className="mt-4 max-w-lg text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Smarter inventory management for YRES/U+.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-6 text-[#d4d4d8] sm:text-base">
                Track products, manage sign-ins and sign-outs, monitor borrowed items,
                and keep inventory organized across departments and office locations.
              </p>
            </div>
          </section>

          <section className="flex items-center justify-center bg-white p-8 transition-colors dark:bg-zinc-950 sm:p-10">
            <div className="w-full max-w-md">
              <div className="mb-8">
                <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">
                  Welcome back
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-zinc-100">
                  Sign in to continue
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                  Use your organization email to access the inventory dashboard.
                </p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="login-input w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-zinc-500 focus:ring-4 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-800"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="login-input w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-zinc-500 focus:ring-4 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-800"
                  />
                </div>

                <div className="mt-3 text-right">
                  <Link
                    href="/forgot-password"
                    className="text-sm font-semibold text-slate-700 transition hover:text-black dark:text-zinc-300 dark:hover:text-white"
                  >
                    Forgot password?
                  </Link>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={handleSignIn}
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
                  >
                    {loading ? "Loading..." : "Sign In"}
                  </button>

                  <button
                    onClick={handleSignUp}
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-2xl border border-zinc-950 bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {loading ? "Please wait..." : "Create Account"}
                  </button>
                </div>

                {message && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                    {message}
                  </div>
                )}
              </div>

              <div className="mt-8 border-t border-slate-200 pt-6 text-xs text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
                Secure access for staff and admins with role-based permissions.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
