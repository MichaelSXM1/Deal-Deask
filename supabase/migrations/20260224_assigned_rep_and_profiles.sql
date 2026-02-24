-- Migration: add assigned_rep_user_id and user_profiles for account-based assignments

create extension if not exists "pgcrypto";

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  first_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create index if not exists idx_deals_assigned_rep on public.deals (assigned_rep_user_id);

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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

alter table public.user_profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.user_profiles;
create policy "profiles_select_authenticated"
on public.user_profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_update_self_or_admin" on public.user_profiles;
create policy "profiles_update_self_or_admin"
on public.user_profiles
for update
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()))
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

grant select, update on public.user_profiles to authenticated;

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
