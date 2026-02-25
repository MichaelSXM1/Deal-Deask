"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AppRole, StackedDeal } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

type StageKey =
  | "psa_signed"
  | "buyer_signed"
  | "emd_in"
  | "lender_secured"
  | "appraisal_done"
  | "clear_to_close";

type SortableStackedColumn =
  | "address"
  | "acq_manager"
  | "purchase_price"
  | "net_to_buyer"
  | "assignment_fee"
  | "cashflow"
  | "notes"
  | StageKey;

interface StackedDashboardTableProps {
  deals: StackedDeal[];
  currentUserId: string;
  role: AppRole;
}

interface StackedDealFormValues {
  address: string;
  acq_manager: string;
  purchase_price: string;
  net_to_buyer: string;
  assignment_fee: string;
  cashflow: string;
  notes: string;
}

const defaultStackedValues: StackedDealFormValues = {
  address: "",
  acq_manager: "",
  purchase_price: "",
  net_to_buyer: "",
  assignment_fee: "",
  cashflow: "",
  notes: ""
};

const stageColumns: Array<{ key: StageKey; label: string }> = [
  { key: "psa_signed", label: "PSA Signed" },
  { key: "buyer_signed", label: "Buyer Signed" },
  { key: "emd_in", label: "EMD In" },
  { key: "lender_secured", label: "Lender Secured" },
  { key: "appraisal_done", label: "Appraisal Done" },
  { key: "clear_to_close", label: "Clear to Close" }
];

function normalizeStackedDeal(deal: StackedDeal): StackedDeal {
  const purchasePrice = Number(deal.purchase_price);
  const netToBuyer = Number(deal.net_to_buyer);
  const assignmentFee = Number(deal.assignment_fee);
  const cashflow = Number(deal.cashflow);

  return {
    ...deal,
    purchase_price: Number.isFinite(purchasePrice) ? purchasePrice : 0,
    net_to_buyer: Number.isFinite(netToBuyer) ? netToBuyer : 0,
    assignment_fee: Number.isFinite(assignmentFee) ? assignmentFee : 0,
    cashflow: Number.isFinite(cashflow) ? cashflow : 0,
    notes: deal.notes ?? "",
    psa_signed: Boolean(deal.psa_signed),
    buyer_signed: Boolean(deal.buyer_signed),
    emd_in: Boolean(deal.emd_in),
    lender_secured: Boolean(deal.lender_secured),
    appraisal_done: Boolean(deal.appraisal_done),
    clear_to_close: Boolean(deal.clear_to_close)
  };
}

function toFormValues(deal: StackedDeal): StackedDealFormValues {
  return {
    address: deal.address,
    acq_manager: deal.acq_manager,
    purchase_price: String(deal.purchase_price),
    net_to_buyer: String(deal.net_to_buyer),
    assignment_fee: String(deal.assignment_fee),
    cashflow: String(deal.cashflow),
    notes: deal.notes ?? ""
  };
}

export function StackedDashboardTable({
  deals,
  currentUserId,
  role
}: StackedDashboardTableProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<StackedDeal[]>(() => deals.map(normalizeStackedDeal));
  const [sortBy, setSortBy] = useState<SortableStackedColumn>("address");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<StackedDeal | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingStage, setTogglingStage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setRows(deals.map(normalizeStackedDeal));
  }, [deals]);

  function toggleSort(column: SortableStackedColumn) {
    if (column === sortBy) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(column);
    setSortDirection("asc");
  }

  const sortedDeals = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      if (
        sortBy === "purchase_price" ||
        sortBy === "net_to_buyer" ||
        sortBy === "assignment_fee" ||
        sortBy === "cashflow"
      ) {
        return Number(a[sortBy]) - Number(b[sortBy]);
      }

      if (
        sortBy === "psa_signed" ||
        sortBy === "buyer_signed" ||
        sortBy === "emd_in" ||
        sortBy === "lender_secured" ||
        sortBy === "appraisal_done" ||
        sortBy === "clear_to_close"
      ) {
        return Number(a[sortBy]) - Number(b[sortBy]);
      }

      return String(a[sortBy] ?? "").localeCompare(String(b[sortBy] ?? ""));
    });

    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [rows, sortBy, sortDirection]);

  async function handleCreate(values: StackedDealFormValues) {
    setErrorMessage(null);
    setSuccessMessage(null);

    const purchasePrice = Number(values.purchase_price);
    const netToBuyer = Number(values.net_to_buyer);
    const assignmentFee = Number(values.assignment_fee);
    const cashflow = Number(values.cashflow);

    if (
      !Number.isFinite(purchasePrice) ||
      !Number.isFinite(netToBuyer) ||
      !Number.isFinite(assignmentFee) ||
      !Number.isFinite(cashflow)
    ) {
      setErrorMessage("All amount fields must be valid numbers.");
      return;
    }

    setIsSaving(true);

    const payload = {
      address: values.address.trim(),
      acq_manager: values.acq_manager.trim(),
      purchase_price: purchasePrice,
      net_to_buyer: netToBuyer,
      assignment_fee: assignmentFee,
      cashflow,
      notes: values.notes.trim()
    };

    const { data, error } = await supabase
      .from("stacked_deals")
      .insert(payload)
      .select("*")
      .single();

    setIsSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setRows((current) => [normalizeStackedDeal(data as StackedDeal), ...current]);
    setIsCreateOpen(false);
    setSuccessMessage("Stacked deal created.");
  }

  async function handleUpdate(values: StackedDealFormValues) {
    if (!editingDeal) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const purchasePrice = Number(values.purchase_price);
    const netToBuyer = Number(values.net_to_buyer);
    const assignmentFee = Number(values.assignment_fee);
    const cashflow = Number(values.cashflow);

    if (
      !Number.isFinite(purchasePrice) ||
      !Number.isFinite(netToBuyer) ||
      !Number.isFinite(assignmentFee) ||
      !Number.isFinite(cashflow)
    ) {
      setErrorMessage("All amount fields must be valid numbers.");
      return;
    }

    setIsSaving(true);

    const payload = {
      address: values.address.trim(),
      acq_manager: values.acq_manager.trim(),
      purchase_price: purchasePrice,
      net_to_buyer: netToBuyer,
      assignment_fee: assignmentFee,
      cashflow,
      notes: values.notes.trim()
    };

    const { data, error } = await supabase
      .from("stacked_deals")
      .update(payload)
      .eq("id", editingDeal.id)
      .select("*")
      .single();

    setIsSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setRows((current) =>
      current.map((deal) =>
        deal.id === editingDeal.id ? normalizeStackedDeal(data as StackedDeal) : deal
      )
    );
    setEditingDeal(null);
    setSuccessMessage("Stacked deal updated.");
  }

  async function toggleStage(deal: StackedDeal, stageKey: StageKey) {
    setErrorMessage(null);
    setSuccessMessage(null);
    setTogglingStage(`${deal.id}:${stageKey}`);

    const nextValue = !deal[stageKey];
    const { error } = await supabase.rpc("set_stacked_stage", {
      p_stacked_deal_id: deal.id,
      p_stage_key: stageKey,
      p_stage_value: nextValue
    });

    setTogglingStage(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setRows((current) =>
      current.map((row) =>
        row.id === deal.id ? { ...row, [stageKey]: nextValue } : row
      )
    );
  }

  async function handleDelete(deal: StackedDeal) {
    const confirmed = window.confirm(
      `Delete this stacked deal?\n\n${deal.address}\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setDeletingId(deal.id);

    const { error } = await supabase
      .from("stacked_deals")
      .delete()
      .eq("id", deal.id);

    setDeletingId(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setRows((current) => current.filter((row) => row.id !== deal.id));
    setSuccessMessage("Stacked deal deleted.");
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <p className="text-sm text-slate-600">
            {rows.length} stacked {rows.length === 1 ? "deal" : "deals"}
          </p>
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setSuccessMessage(null);
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-md bg-cedar-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cedar-900"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Stacked Deal
          </button>
        </div>

        {(errorMessage || successMessage) && (
          <div className="border-b border-slate-200 px-4 py-2 text-sm">
            {errorMessage ? <p className="text-red-600">{errorMessage}</p> : null}
            {successMessage ? (
              <p className="text-emerald-700">{successMessage}</p>
            ) : null}
          </div>
        )}

        <table className="w-full table-fixed divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50">
            <tr>
              <HeaderCell label="Address" onClick={() => toggleSort("address")} />
              <HeaderCell label="Acq" onClick={() => toggleSort("acq_manager")} />
              <HeaderCell label="Purchase" onClick={() => toggleSort("purchase_price")} />
              <HeaderCell label="Net Buyer" onClick={() => toggleSort("net_to_buyer")} />
              <HeaderCell label="Fee" onClick={() => toggleSort("assignment_fee")} />
              <HeaderCell label="Cashflow" onClick={() => toggleSort("cashflow")} />
              <HeaderCell label="Notes" onClick={() => toggleSort("notes")} />
              {stageColumns.map((stage) => (
                <HeaderCell
                  key={stage.key}
                  label={stage.label}
                  onClick={() => toggleSort(stage.key)}
                />
              ))}
              <th className="px-2 py-2 text-left font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {sortedDeals.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-4 py-8 text-center text-slate-500">
                  No stacked deals yet.
                </td>
              </tr>
            ) : (
              sortedDeals.map((deal) => {
                const canEdit = role === "admin" || deal.created_by === currentUserId;
                const canDelete = true;

                return (
                  <tr key={deal.id} className="hover:bg-slate-50">
                    <td className="px-2 py-2 font-medium text-slate-900" title={deal.address}>
                      <span className="block truncate">{deal.address}</span>
                    </td>
                    <td className="px-2 py-2 text-slate-700">{deal.acq_manager}</td>
                    <td className="px-2 py-2 text-slate-700">
                      {formatCurrency(deal.purchase_price)}
                    </td>
                    <td className="px-2 py-2 text-slate-700">
                      {formatCurrency(deal.net_to_buyer)}
                    </td>
                    <td className="px-2 py-2 text-slate-700">
                      {formatCurrency(deal.assignment_fee)}
                    </td>
                    <td className="px-2 py-2 text-slate-700">{formatCurrency(deal.cashflow)}</td>
                    <td className="px-2 py-2 text-slate-700" title={deal.notes}>
                      <span className="block truncate">{deal.notes || "-"}</span>
                    </td>
                    {stageColumns.map((stage) => {
                      const value = deal[stage.key];
                      const stageLoading = togglingStage === `${deal.id}:${stage.key}`;

                      return (
                        <td key={stage.key} className="px-2 py-2 text-center text-slate-700">
                          <button
                            type="button"
                            onClick={() => void toggleStage(deal, stage.key)}
                            disabled={stageLoading}
                            className={cn(
                              "inline-flex h-6 w-6 items-center justify-center rounded border transition",
                              value
                                ? "border-cedar-700 bg-cedar-700 text-white"
                                : "border-slate-300 bg-white text-slate-400",
                              stageLoading ? "opacity-60" : ""
                            )}
                            aria-label={`Toggle ${stage.label} for ${deal.address}`}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-slate-700">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (!canEdit) {
                              return;
                            }
                            setErrorMessage(null);
                            setSuccessMessage(null);
                            setEditingDeal(deal);
                          }}
                          disabled={!canEdit}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold",
                            canEdit
                              ? "border-cedar-500 text-cedar-700"
                              : "cursor-not-allowed border-slate-200 text-slate-400"
                          )}
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDelete(deal)}
                          disabled={!canDelete || deletingId === deal.id}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold",
                            canDelete
                              ? "border-red-300 text-red-700"
                              : "cursor-not-allowed border-slate-200 text-slate-400"
                          )}
                        >
                          <Trash2 className="h-3 w-3" />
                          {deletingId === deal.id ? "..." : "Del"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <StackedDealFormModal
        open={isCreateOpen}
        title="Add Stacked Deal"
        submitLabel="Create Deal"
        initialValues={defaultStackedValues}
        isSubmitting={isSaving}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <StackedDealFormModal
        open={Boolean(editingDeal)}
        title="Edit Stacked Deal"
        submitLabel="Save Changes"
        initialValues={editingDeal ? toFormValues(editingDeal) : defaultStackedValues}
        isSubmitting={isSaving}
        onClose={() => setEditingDeal(null)}
        onSubmit={handleUpdate}
      />
    </>
  );
}

function HeaderCell({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <th className="px-2 py-2 text-left font-semibold text-slate-700">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 hover:text-slate-900"
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );
}

interface StackedDealFormModalProps {
  open: boolean;
  title: string;
  submitLabel: string;
  initialValues: StackedDealFormValues;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: StackedDealFormValues) => Promise<void>;
}

function StackedDealFormModal({
  open,
  title,
  submitLabel,
  initialValues,
  isSubmitting,
  onClose,
  onSubmit
}: StackedDealFormModalProps) {
  const [formValues, setFormValues] = useState<StackedDealFormValues>(initialValues);

  useEffect(() => {
    if (open) {
      setFormValues(initialValues);
    }
  }, [initialValues, open]);

  if (!open) {
    return null;
  }

  function updateValue<K extends keyof StackedDealFormValues>(
    field: K,
    value: StackedDealFormValues[K]
  ) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(formValues);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Address">
              <input
                required
                value={formValues.address}
                onChange={(event) => updateValue("address", event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              />
            </Field>

            <Field label="Acq Manager">
              <input
                required
                value={formValues.acq_manager}
                onChange={(event) => updateValue("acq_manager", event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              />
            </Field>

            <Field label="Purchase Price">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={formValues.purchase_price}
                onChange={(event) => updateValue("purchase_price", event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              />
            </Field>

            <Field label="Net to Buyer">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={formValues.net_to_buyer}
                onChange={(event) => updateValue("net_to_buyer", event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              />
            </Field>

            <Field label="Assignment Fee">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={formValues.assignment_fee}
                onChange={(event) => updateValue("assignment_fee", event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              />
            </Field>

            <Field label="Cashflow">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={formValues.cashflow}
                onChange={(event) => updateValue("cashflow", event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              />
            </Field>

            <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
              <textarea
                value={formValues.notes}
                onChange={(event) => updateValue("notes", event.target.value)}
                rows={3}
                placeholder="Internal notes..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-cedar-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cedar-900 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1 text-sm", className)}>
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
