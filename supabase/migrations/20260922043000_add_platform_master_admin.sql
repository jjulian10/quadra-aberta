create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create or replace function private.is_platform_admin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins
    where user_id = target_user_id
  );
$$;

revoke all on function private.is_platform_admin(uuid) from public;
grant execute on function private.is_platform_admin(uuid) to authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin(auth.uid());
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.get_master_arenas()
returns table (
  arena_id uuid,
  slug text,
  name text,
  city text,
  address text,
  whatsapp text,
  active boolean,
  court_count bigint,
  admin_email text,
  bookings_count bigint,
  received numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin(auth.uid()) then
    raise exception 'Acesso restrito ao administrador da plataforma'
      using errcode = '42501';
  end if;

  return query
  select
    a.id,
    a.slug,
    a.name,
    a.city,
    a.address,
    a.whatsapp,
    a.active,
    (
      select count(*)
      from public.courts c
      where c.arena_id = a.id
        and c.active = true
    ),
    (
      select u.email::text
      from public.arena_admins aa
      join auth.users u on u.id = aa.user_id
      where aa.arena_id = a.id
      order by case aa.role when 'owner' then 0 else 1 end, aa.created_at
      limit 1
    ),
    (
      select count(*)
      from public.bookings b
      where b.arena_id = a.id
        and b.status in ('pending', 'confirmed')
    ),
    coalesce((
      select sum(b.payment_received_amount)
      from public.bookings b
      where b.arena_id = a.id
    ), 0)::numeric
  from public.arenas a
  order by a.created_at, a.name;
end;
$$;

revoke all on function public.get_master_arenas() from public;
grant execute on function public.get_master_arenas() to authenticated;

insert into public.platform_admins (user_id)
select aa.user_id
from public.arena_admins aa
join public.arenas a on a.id = aa.arena_id
where a.slug = 'arena-vila'
  and aa.role = 'owner'
on conflict (user_id) do nothing;
