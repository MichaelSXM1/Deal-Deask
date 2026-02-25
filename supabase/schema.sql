-- Cedar Deal Dashboard schema
-- Run this in Supabase SQL editor.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'deal_strategy' and typnamespace = 'public'::regnamespace
  ) then
    create type public.deal_strategy as enum ('Cash', 'Seller Finance', 'Subto', 'Stacked');
  end if;
end
$$;

alter type public.deal_strategy add value if not exists 'Stacked';

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'assignment_status' and typnamespace = 'public'::regnamespace
  ) then
    create type public.assignment_status as enum ('Not Assigned', 'Assigned');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'access_type' and typnamespace = 'public'::regnamespace
  ) then
    create type public.access_type as enum ('Lockbox', 'Appointment', 'Open');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'app_role' and typnamespace = 'public'::regnamespace
  ) then
    create type public.app_role as enum ('admin', 'acq_manager');
  end if;
end
$$;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'acq_manager',
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  first_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  acq_manager_first_name text not null,
  deal_strategy public.deal_strategy not null,
  contract_price numeric(12, 2) not null check (contract_price >= 0),
  marketing_price numeric(12, 2) not null check (marketing_price >= 0),
  buyers_found boolean not null default false,
  access_type public.access_type not null default 'Lockbox',
  dd_deadline date not null,
  title_company text not null,
  notes text not null default '',
  drive_link text,
  assignment_status public.assignment_status not null default 'Not Assigned',
  assigned_rep_user_id uuid references auth.users (id),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deals_assignment_consistent check (
    (
      assignment_status = 'Assigned'
      and assigned_rep_user_id is not null
    )
    or (
      assignment_status = 'Not Assigned'
      and assigned_rep_user_id is null
    )
  )
);

create table if not exists public.stacked_deals (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  acq_manager text not null,
  purchase_price numeric(12, 2) not null check (purchase_price >= 0),
  net_to_buyer numeric(12, 2) not null check (net_to_buyer >= 0),
  assignment_fee numeric(12, 2) not null check (assignment_fee >= 0),
  cashflow numeric(12, 2) not null default 0,
  notes text not null default '',
  psa_signed boolean not null default false,
  buyer_signed boolean not null default false,
  emd_in boolean not null default false,
  lender_secured boolean not null default false,
  appraisal_done boolean not null default false,
  clear_to_close boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deals
add column if not exists assigned_rep_user_id uuid references auth.users (id);

alter table public.deals
add column if not exists buyers_found boolean not null default false;

alter table public.deals
add column if not exists access_type public.access_type not null default 'Lockbox';

alter table public.deals
add column if not exists notes text not null default '';

alter table public.stacked_deals
add column if not exists notes text not null default '';

alter table public.deals
drop constraint if exists deals_buyers_found_nonnegative;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deals'
      and column_name = 'buyers_found'
      and data_type = 'integer'
  ) then
    alter table public.deals
      alter column buyers_found drop default;

    alter table public.deals
      alter column buyers_found type boolean
      using (buyers_found > 0);
  end if;
end
$$;

alter table public.deals
alter column buyers_found set default false;

update public.deals
set assigned_rep_user_id = created_by
where assignment_status = 'Assigned'
  and assigned_rep_user_id is null;

update public.deals
set assigned_rep_user_id = null
where assignment_status = 'Not Assigned';

alter table public.deals
drop constraint if exists deals_assignment_consistent;

alter table public.deals
add constraint deals_assignment_consistent check (
  (
    assignment_status = 'Assigned'
    and assigned_rep_user_id is not null
  )
  or (
    assignment_status = 'Not Assigned'
    and assigned_rep_user_id is null
  )
);

create index if not exists idx_deals_dd_deadline on public.deals (dd_deadline);
create index if not exists idx_deals_created_by on public.deals (created_by);
create index if not exists idx_deals_assigned_rep on public.deals (assigned_rep_user_id);
create index if not exists idx_stacked_deals_created_by on public.stacked_deals (created_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

create or replace function public.enforce_deal_update_permissions()
returns trigger
language plpgsql
as $$
declare
  auth_user_id uuid;
begin
  auth_user_id := auth.uid();

  if auth_user_id is null then
    return new;
  end if;

  if public.is_admin(auth_user_id) then
    return new;
  end if;

  -- created_by must stay immutable for non-admin users.
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed';
  end if;

  -- Assigned reps can edit deal details, but only creator/admin can reassign ownership.
  if old.created_by is distinct from auth_user_id and (
    new.assignment_status is distinct from old.assignment_status
    or new.assigned_rep_user_id is distinct from old.assigned_rep_user_id
  ) then
    raise exception 'Only the deal creator or an admin can change assignment fields';
  end if;

  return new;
end;
$$;

create or replace function public.set_buyers_found(
  p_deal_id uuid,
  p_buyers_found boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.deals
  set buyers_found = p_buyers_found
  where id = p_deal_id;

  if not found then
    raise exception 'Deal not found';
  end if;
end;
$$;

create or replace function public.enforce_stacked_deal_update_permissions()
returns trigger
language plpgsql
as $$
declare
  auth_user_id uuid;
begin
  auth_user_id := auth.uid();

  if auth_user_id is null then
    return new;
  end if;

  if public.is_admin(auth_user_id) then
    return new;
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed';
  end if;

  -- Non-owner updates are limited to checkbox stage fields only.
  if old.created_by is distinct from auth_user_id and (
    new.address is distinct from old.address
    or new.acq_manager is distinct from old.acq_manager
    or new.purchase_price is distinct from old.purchase_price
    or new.net_to_buyer is distinct from old.net_to_buyer
    or new.assignment_fee is distinct from old.assignment_fee
    or new.cashflow is distinct from old.cashflow
    or new.notes is distinct from old.notes
  ) then
    raise exception 'Only deal owner or admin can edit stacked deal amounts/details';
  end if;

  return new;
end;
$$;

create or replace function public.set_stacked_stage(
  p_stacked_deal_id uuid,
  p_stage_key text,
  p_stage_value boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_stage_key not in (
    'psa_signed',
    'buyer_signed',
    'emd_in',
    'lender_secured',
    'appraisal_done',
    'clear_to_close'
  ) then
    raise exception 'Invalid stacked stage key';
  end if;

  update public.stacked_deals
  set
    psa_signed = case when p_stage_key = 'psa_signed' then p_stage_value else psa_signed end,
    buyer_signed = case when p_stage_key = 'buyer_signed' then p_stage_value else buyer_signed end,
    emd_in = case when p_stage_key = 'emd_in' then p_stage_value else emd_in end,
    lender_secured = case when p_stage_key = 'lender_secured' then p_stage_value else lender_secured end,
    appraisal_done = case when p_stage_key = 'appraisal_done' then p_stage_value else appraisal_done end,
    clear_to_close = case when p_stage_key = 'clear_to_close' then p_stage_value else clear_to_close end
  where id = p_stacked_deal_id;

  if not found then
    raise exception 'Stacked deal not found';
  end if;
end;
$$;

drop trigger if exists trg_deals_updated_at on public.deals;
create trigger trg_deals_updated_at
before update on public.deals
for each row
execute procedure public.set_updated_at();

drop trigger if exists trg_deals_enforce_update_permissions on public.deals;
create trigger trg_deals_enforce_update_permissions
before update on public.deals
for each row
execute procedure public.enforce_deal_update_permissions();

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row
execute procedure public.set_updated_at();

drop trigger if exists trg_stacked_deals_updated_at on public.stacked_deals;
create trigger trg_stacked_deals_updated_at
before update on public.stacked_deals
for each row
execute procedure public.set_updated_at();

drop trigger if exists trg_stacked_deals_enforce_update_permissions on public.stacked_deals;
create trigger trg_stacked_deals_enforce_update_permissions
before update on public.stacked_deals
for each row
execute procedure public.enforce_stacked_deal_update_permissions();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'acq_manager')
  on conflict (user_id)
  do nothing;

  insert into public.user_profiles (user_id, email, first_name)
  values (
    new.id,
    coalesce(new.email, concat(new.id::text, '@unknown.local')),
    coalesce(nullif(new.raw_user_meta_data ->> 'first_name', ''), split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (user_id)
  do update set
    email = excluded.email,
    first_name = excluded.first_name;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;
revoke all on function public.set_buyers_found(uuid, boolean) from public;
grant execute on function public.set_buyers_found(uuid, boolean) to authenticated;
revoke all on function public.set_stacked_stage(uuid, text, boolean) from public;
grant execute on function public.set_stacked_stage(uuid, text, boolean) to authenticated;

alter table public.deals enable row level security;
alter table public.stacked_deals enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_profiles enable row level security;

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

-- Admins can update anything. Managers can update deals they created or are assigned to.
drop policy if exists "deals_update_admin_or_owner" on public.deals;
create policy "deals_update_admin_or_owner"
on public.deals
for update
to authenticated
using (
  public.is_admin(auth.uid())
  or created_by = auth.uid()
  or assigned_rep_user_id = auth.uid()
)
with check (
  public.is_admin(auth.uid())
  or created_by = auth.uid()
  or assigned_rep_user_id = auth.uid()
);

-- Any authenticated user can delete deals.
drop policy if exists "deals_delete_admin_only" on public.deals;
drop policy if exists "deals_delete_authenticated" on public.deals;
create policy "deals_delete_authenticated"
on public.deals
for delete
to authenticated
using (true);

drop policy if exists "stacked_deals_select_authenticated" on public.stacked_deals;
create policy "stacked_deals_select_authenticated"
on public.stacked_deals
for select
to authenticated
using (true);

drop policy if exists "stacked_deals_insert_own" on public.stacked_deals;
create policy "stacked_deals_insert_own"
on public.stacked_deals
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "stacked_deals_update_admin_or_owner" on public.stacked_deals;
create policy "stacked_deals_update_admin_or_owner"
on public.stacked_deals
for update
to authenticated
using (public.is_admin(auth.uid()) or created_by = auth.uid())
with check (public.is_admin(auth.uid()) or created_by = auth.uid());

drop policy if exists "stacked_deals_delete_admin_only" on public.stacked_deals;
drop policy if exists "stacked_deals_delete_authenticated" on public.stacked_deals;
create policy "stacked_deals_delete_authenticated"
on public.stacked_deals
for delete
to authenticated
using (true);

-- Users can read their own role row so the app can render role-aware UI.
drop policy if exists "roles_select_own" on public.user_roles;
create policy "roles_select_own"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

-- Every authenticated user can view assignable accounts.
drop policy if exists "profiles_select_authenticated" on public.user_profiles;
create policy "profiles_select_authenticated"
on public.user_profiles
for select
to authenticated
using (true);

-- Users can edit their own profile; admins can edit any profile.
drop policy if exists "profiles_update_self_or_admin" on public.user_profiles;
create policy "profiles_update_self_or_admin"
on public.user_profiles
for update
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()))
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.deals to authenticated;
grant select, insert, update, delete on public.stacked_deals to authenticated;
grant select on public.user_roles to authenticated;
grant select, update on public.user_profiles to authenticated;

-- Backfill current auth users into role/profile tables.
insert into public.user_roles (user_id, role)
select id, 'acq_manager'::public.app_role
from auth.users
on conflict (user_id)
do nothing;

insert into public.user_profiles (user_id, email, first_name)
select
  id,
  coalesce(email, concat(id::text, '@unknown.local')),
  coalesce(nullif(raw_user_meta_data ->> 'first_name', ''), split_part(coalesce(email, ''), '@', 1))
from auth.users
on conflict (user_id)
do update set
  email = excluded.email,
  first_name = excluded.first_name;

-- Seed admins after Michael and Nico create their accounts.
-- Replace emails below, run once, then verify in table editor.
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where email in ('michael@cedaracquisitions.com', 'nico@cedaracquisitions.com')
on conflict (user_id)
do update set role = excluded.role;
