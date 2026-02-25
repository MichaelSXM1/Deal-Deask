import { redirect } from "next/navigation";
import { DashboardTable } from "@/components/dashboard-table";
import { DashboardSwitcher } from "@/components/dashboard-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { StackedDashboardTable } from "@/components/stacked-dashboard-table";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, AssignableUser, Deal, StackedDeal } from "@/lib/types";

async function getRole(userId: string): Promise<AppRole> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.role === "admin" ? "admin" : "acq_manager";
}

interface DashboardPageProps {
  searchParams?: {
    board?: string;
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const board = searchParams?.board === "stacked" ? "stacked" : "standard";
  const role = await getRole(user.id);

  const [dealsResult, profilesResult, stackedDealsResult] = await Promise.all([
    board === "standard"
      ? supabase.from("deals").select("*").order("dd_deadline", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    board === "standard"
      ? supabase
          .from("user_profiles")
          .select("user_id,email,first_name")
          .order("first_name", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    board === "stacked"
      ? supabase.from("stacked_deals").select("*").order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null })
  ]);

  if (dealsResult.error) {
    throw new Error(`Failed to load deals: ${dealsResult.error.message}`);
  }

  if (profilesResult.error) {
    throw new Error(`Failed to load user profiles: ${profilesResult.error.message}`);
  }

  const stackedTableMissing =
    stackedDealsResult.error?.code === "PGRST205" ||
    stackedDealsResult.error?.code === "42P01" ||
    stackedDealsResult.error?.message.toLowerCase().includes("stacked_deals") === true;

  if (stackedDealsResult.error && !stackedTableMissing) {
    throw new Error(`Failed to load stacked deals: ${stackedDealsResult.error.message}`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-none flex-col gap-4 px-3 py-6 sm:px-4 lg:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-cedar-700">
              Cedar Acquisitions
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {board === "standard" ? "Active Deals" : "Stacked Deals"}
            </h1>
            <p className="text-sm text-slate-600">
              {board === "standard"
                ? "Single global board. Everyone can view all deals. Edit access is role based."
                : "Stacked transactions board with checklist tracking to close."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DashboardSwitcher active={board} />
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
              {role === "admin" ? "Admin" : "Acq Manager"}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      {board === "standard" ? (
        <DashboardTable
          deals={(dealsResult.data as Deal[]) ?? []}
          assignableUsers={(profilesResult.data as AssignableUser[]) ?? []}
          currentUserId={user.id}
          role={role}
        />
      ) : stackedTableMissing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Run `supabase/migrations/20260225_stacked_dashboard.sql` in Supabase SQL Editor,
          then refresh.
        </div>
      ) : (
        <StackedDashboardTable
          deals={(stackedDealsResult.data as StackedDeal[]) ?? []}
          currentUserId={user.id}
          role={role}
        />
      )}
    </main>
  );
}
