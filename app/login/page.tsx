"use client";

import { type FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasAuthError, setHasAuthError] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    setHasAuthError(url.searchParams.get("error") === "auth_callback");
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/confirm?next=/`
            : undefined
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

  async function onPasswordSignIn() {
    if (!password) {
      setMessage("Enter a password to sign in with password.");
      return;
    }

    setLoading(true);
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/";
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

          <label className="block text-sm font-medium text-slate-700" htmlFor="password">
            Password (fallback)
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Use if magic link is rate-limited"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cedar-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cedar-900 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Sending magic link..." : "Send magic link"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => void onPasswordSignIn()}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Sign in with password
          </button>
        </form>

        {hasAuthError ? (
          <p className="mt-4 text-sm text-red-600">
            Magic link verification failed. Request a new link and try again.
          </p>
        ) : null}
        {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}
      </div>
    </main>
  );
}
