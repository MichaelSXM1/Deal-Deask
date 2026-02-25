-- Migration: add dedicated stacked deals board + stage checklist toggles

create extension if not exists "pgcrypto";

create table if not exists public.stacked_deals (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  acq_manager text not null,
  purchase_price numeric(12, 2) not null check (purchase_price >= 0),
  net_to_buyer numeric(12, 2) not null check (net_to_buyer >= 0),
  assignment_fee numeric(12, 2) not null check (assignment_fee >= 0),
  cashflow numeric(12, 2) not null default 0,
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

create index if not exists idx_stacked_deals_created_by on public.stacked_deals (created_by);

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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
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

  -- Non-owner edits are restricted to checklist stage fields.
  if old.created_by is distinct from auth_user_id and (
    new.address is distinct from old.address
    or new.acq_manager is distinct from old.acq_manager
    or new.purchase_price is distinct from old.purchase_price
    or new.net_to_buyer is distinct from old.net_to_buyer
    or new.assignment_fee is distinct from old.assignment_fee
    or new.cashflow is distinct from old.cashflow
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

alter table public.stacked_deals enable row level security;

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

grant select, insert, update, delete on public.stacked_deals to authenticated;
revoke all on function public.set_stacked_stage(uuid, text, boolean) from public;
grant execute on function public.set_stacked_stage(uuid, text, boolean) to authenticated;
