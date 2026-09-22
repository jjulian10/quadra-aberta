grant select on table public.platform_admins to authenticated;

drop policy if exists "Users can view own platform role" on public.platform_admins;
create policy "Users can view own platform role"
  on public.platform_admins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke execute on function public.is_platform_admin() from authenticated;
drop function if exists public.is_platform_admin();
