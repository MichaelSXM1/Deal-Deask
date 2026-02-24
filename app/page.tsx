import { redirect } from "next/navigation";
import { DashboardTable } from "@/components/dashboard-table";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, Deal } from "@/lib/types";

async function getRole(userId: string): Promise<AppRole> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.role === "admin" ? "admin" : "acq_manager";
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: deals, error } = await supabase
    .from("deals")
    .select("*")
    .order("dd_deadline", { ascending: true });

  if (error) {
    throw new Error(`Failed to load deals: ${error.message}`);
  }

  const role = await getRole(user.id);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-cedar-700">
          Cedar Acquisitions
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Active Deals
        </h1>
        <p className="text-sm text-slate-600">
          Single global board. Everyone can view all deals. Edit access is role based.
        </p>
      </header>

      <DashboardTable
        deals={(deals as Deal[]) ?? []}
        currentUserId={user.id}
        role={role}
      />
    </main>
  );
}
