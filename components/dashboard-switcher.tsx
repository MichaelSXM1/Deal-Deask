import Link from "next/link";
import { cn } from "@/lib/utils";

export function DashboardSwitcher({
  active
}: {
  active: "standard" | "stacked";
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
      <Link
        href="/?board=standard"
        className={cn(
          "rounded-md px-3 py-1.5 text-xs font-semibold",
          active === "standard"
            ? "bg-cedar-700 text-white"
            : "text-slate-600 hover:bg-slate-100"
        )}
      >
        Standard Deals
      </Link>
      <Link
        href="/?board=stacked"
        className={cn(
          "rounded-md px-3 py-1.5 text-xs font-semibold",
          active === "stacked"
            ? "bg-cedar-700 text-white"
            : "text-slate-600 hover:bg-slate-100"
        )}
      >
        Stacked Deals
      </Link>
    </div>
  );
}
