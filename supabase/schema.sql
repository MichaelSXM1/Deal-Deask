-- Cedar Deal Dashboard schema
-- Run this in Supabase SQL editor.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'deal_strategy' and typnamespace = 'public'::regnamespace
  ) then
    create type public.deal_strategy as enum ('Cash', 'Seller Finance', 'Subto');
  end if;
end
$$;

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
  dd_deadline date not null,
  title_company text not null,
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

alter table public.deals
add column if not exists assigned_rep_user_id uuid references auth.users (id);

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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.enforce_deal_update_permissions()
returns trigger
language plpgsql
as $$
declare
  current_user uuid;
begin
  current_user := auth.uid();

  if current_user is null then
    return new;
  end if;

  if public.is_admin(current_user) then
    return new;
  end if;

  -- created_by must stay immutable for non-admin users.
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed';
  end if;

  -- Assigned reps can edit deal details, but only creator/admin can reassign ownership.
  if old.created_by is distinct from current_user and (
    new.assignment_status is distinct from old.assignment_status
    or new.assigned_rep_user_id is distinct from old.assigned_rep_user_id
  ) then
    raise exception 'Only the deal creator or an admin can change assignment fields';
  end if;

  return new;
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
