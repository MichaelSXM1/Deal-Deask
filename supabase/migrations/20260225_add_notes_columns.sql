-- Migration: add notes fields to deals and stacked deals

alter table public.deals
add column if not exists notes text not null default '';

do $$
begin
  if to_regclass('public.stacked_deals') is not null then
    execute $sql$
      alter table public.stacked_deals
      add column if not exists notes text not null default ''
    $sql$;
  end if;
end
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
