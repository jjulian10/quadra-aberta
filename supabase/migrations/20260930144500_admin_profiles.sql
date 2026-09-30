-- Store administrator profile information used by arena management and the admin header.

alter table public.arena_admins
  add column if not exists display_name text,
  add column if not exists phone text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'arena_admins_display_name_check'
      and conrelid = 'public.arena_admins'::regclass
  ) then
    alter table public.arena_admins
      add constraint arena_admins_display_name_check
      check (display_name is null or char_length(btrim(display_name)) between 2 and 80);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'arena_admins_phone_check'
      and conrelid = 'public.arena_admins'::regclass
  ) then
    alter table public.arena_admins
      add constraint arena_admins_phone_check
      check (phone is null or phone ~ '^[0-9]{10,13}$');
  end if;
end
$$;

create or replace function public.get_master_arena_detail(p_arena_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not (private.is_platform_admin(auth.uid()) or private.is_arena_admin(p_arena_id)) then
    raise exception 'Acesso restrito ao administrador da plataforma' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'arena', to_jsonb(a),
    'courts', coalesce(
      (
        select jsonb_agg(to_jsonb(c) order by c.sort_order, c.name)
        from public.courts c
        where c.arena_id = a.id
      ),
      '[]'::jsonb
    ),
    'admins', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'user_id', aa.user_id,
            'email', u.email,
            'name', aa.display_name,
            'phone', aa.phone,
            'role', aa.role,
            'created_at', aa.created_at
          )
          order by aa.created_at
        )
        from public.arena_admins aa
        join auth.users u on u.id = aa.user_id
        where aa.arena_id = a.id
      ),
      '[]'::jsonb
    ),
    'history', coalesce(
      (
        select jsonb_agg(to_jsonb(h) order by h.created_at desc)
        from (
          select
            audit.id,
            audit.action,
            audit.details,
            audit.created_at,
            u.email as actor_email
          from public.master_arena_audit audit
          left join auth.users u on u.id = audit.actor_user_id
          where audit.arena_id = a.id
          order by audit.created_at desc
          limit 50
        ) h
      ),
      '[]'::jsonb
    )
  )
  into result
  from public.arenas a
  where a.id = p_arena_id;

  if result is null then
    raise exception 'Arena não encontrada' using errcode = 'P0002';
  end if;

  return result;
end;
$$;

create or replace function public.get_my_arena_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select jsonb_build_object(
      'arena_id', a.id,
      'slug', a.slug,
      'name', a.name,
      'role', aa.role,
      'active', a.active,
      'suspension_reason', a.suspension_reason,
      'suspended_at', a.suspended_at,
      'admin_name', aa.display_name,
      'admin_phone', aa.phone,
      'admin_email', u.email
    )
    from public.arena_admins aa
    join public.arenas a on a.id = aa.arena_id
    join auth.users u on u.id = aa.user_id
    where aa.user_id = auth.uid()
    order by aa.created_at
    limit 1
  );
$$;

revoke all on function public.get_master_arena_detail(uuid) from public;
grant execute on function public.get_master_arena_detail(uuid) to authenticated;

revoke all on function public.get_my_arena_access() from public;
grant execute on function public.get_my_arena_access() to authenticated;
