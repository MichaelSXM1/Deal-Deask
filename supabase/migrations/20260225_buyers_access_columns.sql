-- Migration: add buyers_found and access_type fields to deals

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'access_type' and typnamespace = 'public'::regnamespace
  ) then
    create type public.access_type as enum ('Lockbox', 'Appointment', 'Open');
  end if;
end
$$;

alter table public.deals
add column if not exists buyers_found integer not null default 0;

alter table public.deals
add column if not exists access_type public.access_type not null default 'Lockbox';

update public.deals
set buyers_found = 0
where buyers_found is null;

update public.deals
set access_type = 'Lockbox'
where access_type is null;

alter table public.deals
drop constraint if exists deals_buyers_found_nonnegative;

alter table public.deals
add constraint deals_buyers_found_nonnegative check (buyers_found >= 0);
