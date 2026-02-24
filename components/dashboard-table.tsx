"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import type { AppRole, Deal } from "@/lib/types";
import { cn, formatCurrency, getDaysLeft } from "@/lib/utils";

type SortableDealColumn =
  | "address"
  | "acq_manager_first_name"
  | "deal_strategy"
  | "contract_price"
  | "marketing_price"
  | "dd_deadline"
  | "title_company"
  | "drive_link"
  | "assignment_status";

interface DashboardTableProps {
  deals: Deal[];
  currentUserId: string;
  role: AppRole;
}

export function DashboardTable({ deals, currentUserId, role }: DashboardTableProps) {
  const [sortBy, setSortBy] = useState<SortableDealColumn>("dd_deadline");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function toggleSort(column: SortableDealColumn) {
    if (column === sortBy) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(column);
    setSortDirection("asc");
  }

  const sortedDeals = useMemo(() => {
    const sorted = [...deals].sort((a, b) => {
      const left = a[sortBy];
      const right = b[sortBy];

      if (typeof left === "number" && typeof right === "number") {
        return left - right;
      }

      return String(left).localeCompare(String(right));
    });

    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [deals, sortBy, sortDirection]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="table-scrollbar overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <HeaderCell label="Address" onClick={() => toggleSort("address")} />
              <HeaderCell
                label="Rep"
                onClick={() => toggleSort("acq_manager_first_name")}
              />
              <HeaderCell
                label="Strategy"
                onClick={() => toggleSort("deal_strategy")}
              />
              <HeaderCell
                label="Contract"
                onClick={() => toggleSort("contract_price")}
              />
              <HeaderCell
                label="Marketing"
                onClick={() => toggleSort("marketing_price")}
              />
              <HeaderCell
                label="DD Deadline"
                onClick={() => toggleSort("dd_deadline")}
              />
              <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-slate-700">
                DD Days Left
              </th>
              <HeaderCell
                label="Title Company"
                onClick={() => toggleSort("title_company")}
              />
              <HeaderCell
                label="Drive"
                onClick={() => toggleSort("drive_link")}
              />
              <HeaderCell
                label="Assignment"
                onClick={() => toggleSort("assignment_status")}
              />
              <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-slate-700">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {sortedDeals.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                  No active deals yet.
                </td>
              </tr>
            ) : (
              sortedDeals.map((deal) => {
                const daysLeft = getDaysLeft(deal.dd_deadline);
                const urgent = daysLeft <= 2;
                const canEdit = role === "admin" || deal.created_by === currentUserId;

                return (
                  <tr key={deal.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {deal.address}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {deal.acq_manager_first_name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {deal.deal_strategy}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatCurrency(deal.contract_price)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatCurrency(deal.marketing_price)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {deal.dd_deadline}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          urgent
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        )}
                      >
                        {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days`}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {deal.title_company}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {deal.drive_link ? (
                        <a
                          href={deal.drive_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cedar-700 underline decoration-slate-300 underline-offset-2"
                        >
                          Open
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {deal.assignment_status}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      <button
                        type="button"
                        disabled={!canEdit}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-semibold",
                          canEdit
                            ? "border-cedar-500 text-cedar-700"
                            : "cursor-not-allowed border-slate-200 text-slate-400"
                        )}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HeaderCell({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <th className="px-4 py-3 text-left font-semibold text-slate-700">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 whitespace-nowrap hover:text-slate-900"
      >
        {label}
        <ArrowUpDown className="h-3.5 w-3.5" />
      </button>
    </th>
  );
}
