"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-zinc-100 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto flex min-h-[85vh] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 lg:grid-cols-2">
          <div className="flex flex-col justify-center bg-gradient-to-br from-black via-zinc-950 to-zinc-900 p-8 text-white sm:p-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-100">
                Inventory System
              </p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
                Smarter inventory management for YRES/U+.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-6 text-zinc-100 sm:text-base">
                Track products, manage sign-ins and sign-outs, monitor borrowed items,
                and keep inventory organized across departments and office locations.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center p-8 sm:p-10">
            <div className="w-full max-w-md">
              <div className="mb-8">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Welcome back
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight">
                  Sign in to continue
                </h2>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Use your organization email to access the inventory dashboard.
                </p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 dark:text-zinc-300">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm outline-none transition focus:border-zinc-400 focus:bg-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:bg-zinc-900"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300 dark:text-zinc-300">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm outline-none transition focus:border-zinc-400 focus:bg-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:bg-zinc-900"
                  />
                </div>
                <div className="mt-3 text-right">
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-zinc-400 hover:text-zinc-300"
                  >
                    Forgot password?
                  </Link>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={handleSignIn}
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {loading ? "Loading..." : "Sign In"}
                  </button>

                  <button
                    onClick={handleSignUp}
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-2xl bg-zinc-800 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Please wait..." : "Create Account"}
                  </button>
                </div>

                {message && (
                  <div className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                    {message}
                  </div>
                )}
              </div>

              <div className="mt-8 border-t border-zinc-800 pt-6 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                Secure access for staff and admins with role-based permissions.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}