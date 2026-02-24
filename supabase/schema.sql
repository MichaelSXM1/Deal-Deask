-- Cedar Deal Dashboard schema
-- Run this in Supabase SQL editor.

create extension if not exists "pgcrypto";

create type public.deal_strategy as enum ('Cash', 'Seller Finance', 'Subto');
create type public.assignment_status as enum ('Not Assigned', 'Assigned');
create type public.app_role as enum ('admin', 'acq_manager');

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'acq_manager',
  created_at timestamptz not null default now()
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  acq_manager_first_name text not null,
  deal_strategy public.deal_strategy not null,
  contract_price numeric(12, 2) not null check (contract_price >= 0),
  marketing_price numeric(12, 2) not null check (marketing_price >= 0),
  dd_deadline date not null,
  title_company text not null,
  drive_link text,
  assignment_status public.assignment_status not null default 'Not Assigned',
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_deals_dd_deadline on public.deals (dd_deadline);
create index if not exists idx_deals_created_by on public.deals (created_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_deals_updated_at on public.deals;
create trigger trg_deals_updated_at
before update on public.deals
for each row
execute procedure public.set_updated_at();

create or replace function public.is_admin(check_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = check_user
      and ur.role = 'admin'
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

alter table public.deals enable row level security;
alter table public.user_roles enable row level security;

-- Every authenticated user can view every deal.
drop policy if exists "deals_select_authenticated" on public.deals;
create policy "deals_select_authenticated"
on public.deals
for select
to authenticated
using (true);

-- Users can create deals only under their own auth user id.
drop policy if exists "deals_insert_own" on public.deals;
create policy "deals_insert_own"
on public.deals
for insert
to authenticated
with check (created_by = auth.uid());

-- Admins can update anything. Acquisition managers can only update their own deals.
drop policy if exists "deals_update_admin_or_owner" on public.deals;
create policy "deals_update_admin_or_owner"
on public.deals
for update
to authenticated
using (public.is_admin(auth.uid()) or created_by = auth.uid())
with check (public.is_admin(auth.uid()) or created_by = auth.uid());

-- Only admins can delete deals.
drop policy if exists "deals_delete_admin_only" on public.deals;
create policy "deals_delete_admin_only"
on public.deals
for delete
to authenticated
using (public.is_admin(auth.uid()));

-- Users can read their own role row so the app can render role-aware UI.
drop policy if exists "roles_select_own" on public.user_roles;
create policy "roles_select_own"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.deals to authenticated;
grant select on public.user_roles to authenticated;

-- Seed admins after Michael and Nico create their accounts.
-- Replace emails below, run once, then verify in table editor.
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where email in ('michael@cedaracquisitions.com', 'nico@cedaracquisitions.com')
on conflict (user_id)
do update set role = excluded.role;
