export type DealStrategy = "Cash" | "Seller Finance" | "Subto";

export type AssignmentStatus = "Not Assigned" | "Assigned";

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
  dd_deadline: string;
  title_company: string;
  drive_link: string | null;
  assignment_status: AssignmentStatus;
  assigned_rep_user_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}
