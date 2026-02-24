"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignOutButton() {
  const [loading, setLoading] = useState(false);

  async function onSignOut() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={() => void onSignOut()}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <LogOut className="h-3.5 w-3.5" />
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
