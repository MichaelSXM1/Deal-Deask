"use client";

import { type FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/` : undefined
      }
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Check your inbox for a magic link.");
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-cedar-700">
          Cedar Acquisitions
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Use your work email to access the global deal dashboard.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@cedaracquisitions.com"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cedar-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cedar-900 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Sending magic link..." : "Send magic link"}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}
      </div>
    </main>
  );
}
