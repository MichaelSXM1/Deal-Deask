"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  AccessType,
  AppRole,
  AssignableUser,
  AssignmentStatus,
  Deal,
  DealStrategy
} from "@/lib/types";
import { cn, formatCurrency, getHoursLeft } from "@/lib/utils";

type SortableDealColumn =
  | "address"
  | "acq_manager_first_name"
  | "assigned_rep_user_id"
  | "deal_strategy"
  | "contract_price"
  | "marketing_price"
  | "buyers_found"
  | "access_type"
  | "dd_deadline"
  | "title_company"
  | "assignment_status";

interface DashboardTableProps {
  deals: Deal[];
  assignableUsers: AssignableUser[];
  currentUserId: string;
  role: AppRole;
}

interface DealFormValues {
  address: string;
  acq_manager_first_name: string;
  deal_strategy: DealStrategy;
  contract_price: string;
  marketing_price: string;
  access_type: AccessType;
  dd_deadline: string;
  title_company: string;
  drive_link: string;
  assignment_status: AssignmentStatus;
  assigned_rep_user_id: string;
}

const defaultDealValues: DealFormValues = {
  address: "",
  acq_manager_first_name: "",
  deal_strategy: "Cash",
  contract_price: "",
  marketing_price: "",
  access_type: "Lockbox",
  dd_deadline: "",
  title_company: "",
  drive_link: "",
  assignment_status: "Not Assigned",
  assigned_rep_user_id: ""
};

function normalizeDeal(deal: Deal): Deal {
  const contractPrice = Number(deal.contract_price);
  const marketingPrice = Number(deal.marketing_price);

  return {
    ...deal,
    contract_price: Number.isFinite(contractPrice) ? contractPrice : 0,
    marketing_price: Number.isFinite(marketingPrice) ? marketingPrice : 0,
    buyers_found:
      typeof deal.buyers_found === "boolean"
        ? deal.buyers_found
        : Number(deal.buyers_found) > 0,
    drive_link: deal.drive_link ?? null,
    assigned_rep_user_id: deal.assigned_rep_user_id ?? null,
    access_type: deal.access_type ?? "Lockbox"
  };
}

function toFormValues(deal: Deal): DealFormValues {
  return {
    address: deal.address,
    acq_manager_first_name: deal.acq_manager_first_name,
    deal_strategy: deal.deal_strategy,
    contract_price: String(deal.contract_price),
    marketing_price: String(deal.marketing_price),
    access_type: deal.access_type,
    dd_deadline: deal.dd_deadline,
    title_company: deal.title_company,
    drive_link: deal.drive_link ?? "",
    assignment_status: deal.assignment_status,
    assigned_rep_user_id: deal.assigned_rep_user_id ?? ""
  };
}

function getAssignableLabel(user: AssignableUser) {
  const name = user.first_name?.trim();
  if (name) {
    return name;
  }
  return user.email.split("@")[0] ?? user.email;
}

function getAssignableOptionLabel(user: AssignableUser) {
  const name = user.first_name?.trim();
  return name ? `${name} (${user.email})` : user.email;
}

export function DashboardTable({
  deals,
  assignableUsers,
  currentUserId,
  role
}: DashboardTableProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<Deal[]>(() => deals.map(normalizeDeal));
  const [sortBy, setSortBy] = useState<SortableDealColumn>("dd_deadline");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingBuyerId, setTogglingBuyerId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const assignableLabelById = useMemo(() => {
    const map = new Map<string, string>();
    assignableUsers.forEach((user) => {
      map.set(user.user_id, getAssignableLabel(user));
    });
    return map;
  }, [assignableUsers]);

  useEffect(() => {
    setRows(deals.map(normalizeDeal));
  }, [deals]);

  function toggleSort(column: SortableDealColumn) {
    if (column === sortBy) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(column);
    setSortDirection("asc");
  }

  const sortedDeals = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      if (sortBy === "contract_price" || sortBy === "marketing_price") {
        return Number(a[sortBy]) - Number(b[sortBy]);
      }

      if (sortBy === "buyers_found") {
        return Number(a.buyers_found) - Number(b.buyers_found);
      }

      if (sortBy === "assigned_rep_user_id") {
        const leftLabel = a.assigned_rep_user_id
          ? assignableLabelById.get(a.assigned_rep_user_id) ?? ""
          : "";
        const rightLabel = b.assigned_rep_user_id
          ? assignableLabelById.get(b.assigned_rep_user_id) ?? ""
          : "";
        return leftLabel.localeCompare(rightLabel);
      }

      const left = a[sortBy] ?? "";
      const right = b[sortBy] ?? "";
      return String(left).localeCompare(String(right));
    });

    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [assignableLabelById, rows, sortBy, sortDirection]);

  async function handleCreate(values: DealFormValues) {
    setErrorMessage(null);
    setSuccessMessage(null);

    const contractPrice = Number(values.contract_price);
    const marketingPrice = Number(values.marketing_price);
    const assignedRepUserId =
      values.assignment_status === "Assigned"
        ? values.assigned_rep_user_id || null
        : null;

    if (!Number.isFinite(contractPrice) || !Number.isFinite(marketingPrice)) {
      setErrorMessage("Contract and marketing price must be valid numbers.");
      return;
    }

    if (values.assignment_status === "Assigned" && !assignedRepUserId) {
      setErrorMessage("Select an assigned rep when assignment status is Assigned.");
      return;
    }

    setIsSaving(true);

    const payload = {
      address: values.address.trim(),
      acq_manager_first_name: values.acq_manager_first_name.trim(),
      deal_strategy: values.deal_strategy,
      contract_price: contractPrice,
      marketing_price: marketingPrice,
      access_type: values.access_type,
      dd_deadline: values.dd_deadline,
      title_company: values.title_company.trim(),
      drive_link: values.drive_link.trim() || null,
      assignment_status: values.assignment_status,
      assigned_rep_user_id: assignedRepUserId
    };

    const { data, error } = await supabase
      .from("deals")
      .insert(payload)
      .select("*")
      .single();

    setIsSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setRows((current) => [normalizeDeal(data as Deal), ...current]);
    setIsCreateOpen(false);
    setSuccessMessage("Deal created.");
  }

  async function handleUpdate(values: DealFormValues) {
    if (!editingDeal) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const contractPrice = Number(values.contract_price);
    const marketingPrice = Number(values.marketing_price);
    const assignedRepUserId =
      values.assignment_status === "Assigned"
        ? values.assigned_rep_user_id || null
        : null;

    if (!Number.isFinite(contractPrice) || !Number.isFinite(marketingPrice)) {
      setErrorMessage("Contract and marketing price must be valid numbers.");
      return;
    }

    if (values.assignment_status === "Assigned" && !assignedRepUserId) {
      setErrorMessage("Select an assigned rep when assignment status is Assigned.");
      return;
    }

    setIsSaving(true);

    const payload = {
      address: values.address.trim(),
      acq_manager_first_name: values.acq_manager_first_name.trim(),
      deal_strategy: values.deal_strategy,
      contract_price: contractPrice,
      marketing_price: marketingPrice,
      access_type: values.access_type,
      dd_deadline: values.dd_deadline,
      title_company: values.title_company.trim(),
      drive_link: values.drive_link.trim() || null,
      assignment_status: values.assignment_status,
      assigned_rep_user_id: assignedRepUserId
    };

    const { data, error } = await supabase
      .from("deals")
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
        deal.id === editingDeal.id ? normalizeDeal(data as Deal) : deal
      )
    );
    setEditingDeal(null);
    setSuccessMessage("Deal updated.");
  }

  async function toggleBuyersFound(deal: Deal) {
    setErrorMessage(null);
    setSuccessMessage(null);
    setTogglingBuyerId(deal.id);

    const nextValue = !deal.buyers_found;
    const { error } = await supabase.rpc("set_buyers_found", {
      p_deal_id: deal.id,
      p_buyers_found: nextValue
    });

    setTogglingBuyerId(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setRows((current) =>
      current.map((row) =>
        row.id === deal.id ? { ...row, buyers_found: nextValue } : row
      )
    );
  }

  async function handleDelete(deal: Deal) {
    const confirmed = window.confirm(
      `Delete this deal?\n\n${deal.address}\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setDeletingId(deal.id);

    const { error } = await supabase.from("deals").delete().eq("id", deal.id);

    setDeletingId(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setRows((current) => current.filter((row) => row.id !== deal.id));
    setSuccessMessage("Deal deleted.");
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <p className="text-sm text-slate-600">
            {rows.length} active {rows.length === 1 ? "deal" : "deals"}
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
            Add Deal
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
              <HeaderCell label="Rep" onClick={() => toggleSort("acq_manager_first_name")} />
              <HeaderCell label="Assigned" onClick={() => toggleSort("assigned_rep_user_id")} />
              <HeaderCell label="Strategy" onClick={() => toggleSort("deal_strategy")} />
              <HeaderCell label="Contract" onClick={() => toggleSort("contract_price")} />
              <HeaderCell label="Marketing" onClick={() => toggleSort("marketing_price")} />
              <HeaderCell label="Buyer Found" onClick={() => toggleSort("buyers_found")} />
              <HeaderCell label="Access" onClick={() => toggleSort("access_type")} />
              <HeaderCell label="DD Date" onClick={() => toggleSort("dd_deadline")} />
              <th className="px-2 py-2 text-left font-semibold text-slate-700">DD Left</th>
              <HeaderCell label="Title" onClick={() => toggleSort("title_company")} />
              <HeaderCell label="Assign" onClick={() => toggleSort("assignment_status")} />
              <th className="px-2 py-2 text-left font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {sortedDeals.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-slate-500">
                  No active deals yet.
                </td>
              </tr>
            ) : (
              sortedDeals.map((deal) => {
                const hoursLeft = getHoursLeft(deal.dd_deadline);
                const urgent = hoursLeft <= 48;
                const overdue = hoursLeft < 0;
                const daysLeft = Math.ceil(hoursLeft / 24);
                const canEdit =
                  role === "admin" ||
                  deal.created_by === currentUserId ||
                  deal.assigned_rep_user_id === currentUserId;
                const canDelete = role === "admin";
                const assignedRepLabel = deal.assigned_rep_user_id
                  ? assignableLabelById.get(deal.assigned_rep_user_id) ?? "Unknown"
                  : "-";

                return (
                  <tr key={deal.id} className="hover:bg-slate-50">
                    <td className="px-2 py-2 font-medium text-slate-900" title={deal.address}>
                      <span className="break-words">{deal.address}</span>
                    </td>
                    <td className="px-2 py-2 text-slate-700">{deal.acq_manager_first_name}</td>
                    <td className="px-2 py-2 text-slate-700" title={assignedRepLabel}>
                      <span className="break-words">{assignedRepLabel}</span>
                    </td>
                    <td className="px-2 py-2 text-slate-700">{deal.deal_strategy}</td>
                    <td className="px-2 py-2 text-slate-700">{formatCurrency(deal.contract_price)}</td>
                    <td className="px-2 py-2 text-slate-700">{formatCurrency(deal.marketing_price)}</td>
                    <td className="px-2 py-2 text-slate-700">
                      <button
                        type="button"
                        onClick={() => void toggleBuyersFound(deal)}
                        disabled={togglingBuyerId === deal.id}
                        className={cn(
                          "inline-flex min-w-12 items-center justify-center rounded-full px-3 py-1 text-xs font-semibold transition",
                          deal.buyers_found
                            ? "bg-cedar-700 text-white"
                            : "border border-slate-300 bg-slate-100 text-slate-600",
                          togglingBuyerId === deal.id ? "opacity-70" : ""
                        )}
                      >
                        {togglingBuyerId === deal.id ? "..." : "Yes"}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-slate-700">{deal.access_type}</td>
                    <td className="px-2 py-2 text-slate-700">{deal.dd_deadline}</td>
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                          urgent
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        )}
                      >
                        {overdue
                          ? Math.abs(hoursLeft) < 24
                            ? `${Math.abs(hoursLeft)}h overdue`
                            : `${Math.ceil(Math.abs(hoursLeft) / 24)}d overdue`
                          : urgent
                            ? `${hoursLeft}h`
                            : `${daysLeft}d`}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-slate-700" title={deal.title_company}>
                      <span className="break-words">{deal.title_company}</span>
                    </td>
                    <td className="px-2 py-2 text-slate-700">{deal.assignment_status}</td>
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

      <DealFormModal
        open={isCreateOpen}
        title="Add Deal"
        submitLabel="Create Deal"
        initialValues={defaultDealValues}
        assignableUsers={assignableUsers}
        canManageAssignment
        isSubmitting={isSaving}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DealFormModal
        open={Boolean(editingDeal)}
        title="Edit Deal"
        submitLabel="Save Changes"
        initialValues={editingDeal ? toFormValues(editingDeal) : defaultDealValues}
        assignableUsers={assignableUsers}
        canManageAssignment={
          role === "admin" ||
          (editingDeal ? editingDeal.created_by === currentUserId : false)
        }
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

interface DealFormModalProps {
  open: boolean;
  title: string;
  submitLabel: string;
  initialValues: DealFormValues;
  assignableUsers: AssignableUser[];
  canManageAssignment: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: DealFormValues) => Promise<void>;
}

function DealFormModal({
  open,
  title,
  submitLabel,
  initialValues,
  assignableUsers,
  canManageAssignment,
  isSubmitting,
  onClose,
  onSubmit
}: DealFormModalProps) {
  const [formValues, setFormValues] = useState<DealFormValues>(initialValues);

  useEffect(() => {
    if (open) {
      setFormValues(initialValues);
    }
  }, [initialValues, open]);

  if (!open) {
    return null;
  }

  function updateValue<K extends keyof DealFormValues>(
    field: K,
    value: DealFormValues[K]
  ) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  function onAssignmentStatusChange(nextStatus: AssignmentStatus) {
    setFormValues((current) => ({
      ...current,
      assignment_status: nextStatus,
      assigned_rep_user_id:
        nextStatus === "Not Assigned" ? "" : current.assigned_rep_user_id
    }));
  }

  function onAssignedRepChange(nextUserId: string) {
    setFormValues((current) => ({
      ...current,
      assigned_rep_user_id: nextUserId,
      assignment_status: nextUserId ? "Assigned" : "Not Assigned"
    }));
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

            <Field label="Acq Manager First Name">
              <input
                required
                value={formValues.acq_manager_first_name}
                onChange={(event) =>
                  updateValue("acq_manager_first_name", event.target.value)
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              />
            </Field>

            <Field label="Deal Strategy">
              <select
                required
                value={formValues.deal_strategy}
                onChange={(event) =>
                  updateValue("deal_strategy", event.target.value as DealStrategy)
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              >
                <option value="Cash">Cash</option>
                <option value="Seller Finance">Seller Finance</option>
                <option value="Subto">Subto</option>
                <option value="Stacked">Stacked</option>
              </select>
            </Field>

            <Field label="Contract Price">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={formValues.contract_price}
                onChange={(event) => updateValue("contract_price", event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              />
            </Field>

            <Field label="Marketing Price">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={formValues.marketing_price}
                onChange={(event) => updateValue("marketing_price", event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              />
            </Field>

            <Field label="Access Type">
              <select
                required
                value={formValues.access_type}
                onChange={(event) =>
                  updateValue("access_type", event.target.value as AccessType)
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              >
                <option value="Lockbox">Lockbox</option>
                <option value="Appointment">Appointment</option>
                <option value="Open">Open</option>
              </select>
            </Field>

            <Field label="DD Deadline">
              <input
                required
                type="date"
                value={formValues.dd_deadline}
                onChange={(event) => updateValue("dd_deadline", event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              />
            </Field>

            <Field label="Title Company">
              <input
                required
                value={formValues.title_company}
                onChange={(event) => updateValue("title_company", event.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              />
            </Field>

            <Field label="Assignment Status">
              <select
                required
                value={formValues.assignment_status}
                onChange={(event) =>
                  onAssignmentStatusChange(event.target.value as AssignmentStatus)
                }
                disabled={!canManageAssignment}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              >
                <option value="Not Assigned">Not Assigned</option>
                <option value="Assigned">Assigned</option>
              </select>
            </Field>

            <Field label="Assigned Rep Account">
              <select
                value={formValues.assigned_rep_user_id}
                onChange={(event) => onAssignedRepChange(event.target.value)}
                disabled={!canManageAssignment}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              >
                <option value="">None</option>
                {assignableUsers.map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {getAssignableOptionLabel(user)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Google Drive Link">
              <input
                type="url"
                value={formValues.drive_link}
                onChange={(event) => updateValue("drive_link", event.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cedar-500 focus:ring-2 focus:ring-cedar-100"
              />
            </Field>
          </div>

          {!canManageAssignment ? (
            <p className="text-xs text-slate-500">
              Only the deal creator or an admin can change assignment fields.
            </p>
          ) : null}

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
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
