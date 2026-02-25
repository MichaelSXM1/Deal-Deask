import { redirect } from "next/navigation";
import { DashboardSwitcher } from "@/components/dashboard-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { StackedDashboardTable } from "@/components/stacked-dashboard-table";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, StackedDeal } from "@/lib/types";

async function getRole(userId: string): Promise<AppRole> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.role === "admin" ? "admin" : "acq_manager";
}

export default async function StackedDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: stackedDeals, error } = await supabase
    .from("stacked_deals")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load stacked deals: ${error.message}`);
  }

  const role = await getRole(user.id);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-none flex-col gap-4 px-3 py-6 sm:px-4 lg:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-cedar-700">
              Cedar Acquisitions
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Stacked Deals
            </h1>
            <p className="text-sm text-slate-600">
              Separate board for stacked transactions and close checklist tracking.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DashboardSwitcher active="stacked" />
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
              {role === "admin" ? "Admin" : "Acq Manager"}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <StackedDashboardTable
        deals={(stackedDeals as StackedDeal[]) ?? []}
        currentUserId={user.id}
        role={role}
      />
    </main>
  );
}
