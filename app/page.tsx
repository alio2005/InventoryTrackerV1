"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSignUp = async () => {
    setMessage("Loading...");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const user = data.user;

    if (user) {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: email,
        role: "staff",
      });

      if (profileError) {
        setMessage(profileError.message);
        return;
      }
    }

    setMessage("Account created. Check your email if confirmation is enabled.");
  };

  const handleSignIn = async () => {
    setMessage("Loading...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center">Inventory App Login</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg p-3"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg p-3"
        />

        <div className="flex gap-3">
          <button
            onClick={handleSignIn}
            className="flex-1 bg-black text-white rounded-lg p-3"
          >
            Sign In
          </button>

          <button
            onClick={handleSignUp}
            className="flex-1 bg-gray-300 rounded-lg p-3"
          >
            Sign Up
          </button>
        </div>

        {message && <p className="text-sm text-center">{message}</p>}
      </div>
    </main>
  );
}