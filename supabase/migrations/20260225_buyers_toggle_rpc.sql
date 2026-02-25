-- Migration: make buyers_found a global yes/no toggle and expose authenticated RPC

alter table public.deals
add column if not exists buyers_found boolean not null default false;

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

revoke all on function public.set_buyers_found(uuid, boolean) from public;
grant execute on function public.set_buyers_found(uuid, boolean) to authenticated;
