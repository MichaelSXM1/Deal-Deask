-- Migration: allow all authenticated users to delete deals and stacked deals

drop policy if exists "deals_delete_admin_only" on public.deals;
drop policy if exists "deals_delete_authenticated" on public.deals;
create policy "deals_delete_authenticated"
on public.deals
for delete
to authenticated
using (true);

drop policy if exists "stacked_deals_delete_admin_only" on public.stacked_deals;
drop policy if exists "stacked_deals_delete_authenticated" on public.stacked_deals;
create policy "stacked_deals_delete_authenticated"
on public.stacked_deals
for delete
to authenticated
using (true);
