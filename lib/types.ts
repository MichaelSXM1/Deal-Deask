export type DealStrategy = "Cash" | "Seller Finance" | "Subto" | "Stacked";

export type AssignmentStatus = "Not Assigned" | "Assigned";

export type AccessType = "Lockbox" | "Appointment" | "Open";

export type AppRole = "admin" | "acq_manager";

export interface AssignableUser {
  user_id: string;
  email: string;
  first_name: string | null;
}

export interface Deal {
  id: string;
  address: string;
  acq_manager_first_name: string;
  deal_strategy: DealStrategy;
  contract_price: number;
  marketing_price: number;
  buyers_found: boolean;
  access_type: AccessType;
  dd_deadline: string;
  title_company: string;
  drive_link: string | null;
  assignment_status: AssignmentStatus;
  assigned_rep_user_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface StackedDeal {
  id: string;
  address: string;
  acq_manager: string;
  purchase_price: number;
  net_to_buyer: number;
  assignment_fee: number;
  cashflow: number;
  psa_signed: boolean;
  buyer_signed: boolean;
  emd_in: boolean;
  lender_secured: boolean;
  appraisal_done: boolean;
  clear_to_close: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}
