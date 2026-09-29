alter table public.arenas
  add column if not exists suspension_reason text,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'arenas_suspension_reason_length'
      and conrelid = 'public.arenas'::regclass
  ) then
    alter table public.arenas
      add constraint arenas_suspension_reason_length
      check (
        suspension_reason is null
        or char_length(btrim(suspension_reason)) between 3 and 300
      );
  end if;
end
$$;

create or replace function private.is_arena_admin(target_arena_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.arena_admins aa
    join public.arenas a on a.id = aa.arena_id
    where aa.arena_id = target_arena_id
      and aa.user_id = (select auth.uid())
      and a.active = true
  );
$$;

revoke all on function private.is_arena_admin(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_arena_admin(uuid) to authenticated;

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
      'suspended_at', a.suspended_at
    )
    from public.arena_admins aa
    join public.arenas a on a.id = aa.arena_id
    where aa.user_id = auth.uid()
    order by aa.created_at
    limit 1
  );
$$;

revoke all on function public.get_my_arena_access() from public, anon;
grant execute on function public.get_my_arena_access() to authenticated;

create or replace function public.master_set_arena_active(
  p_arena_id uuid,
  p_active boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous public.arenas%rowtype;
  normalized_reason text;
begin
  if not private.is_platform_admin(auth.uid()) then
    raise exception 'Acesso restrito ao administrador da plataforma'
      using errcode = '42501';
  end if;

  if p_active is null then
    raise exception 'Situação da arena inválida'
      using errcode = '22023';
  end if;

  select * into previous from public.arenas where id = p_arena_id for update;
  if not found then
    raise exception 'Arena não encontrada' using errcode = 'P0002';
  end if;
  if previous.active = p_active then return; end if;

  if not p_active then
    normalized_reason := btrim(coalesce(p_reason, ''));
    if char_length(normalized_reason) not between 3 and 300 then
      raise exception 'Informe o motivo da suspensão' using errcode = '22023';
    end if;

    update public.arenas
    set active = false, suspension_reason = normalized_reason,
        suspended_at = now(), suspended_by = auth.uid()
    where id = p_arena_id;

    insert into public.master_arena_audit(arena_id, actor_user_id, action, details)
    values (p_arena_id, auth.uid(), 'arena.suspended',
      jsonb_build_object('reason', normalized_reason,
        'before', jsonb_build_object('active', true),
        'after', jsonb_build_object('active', false)));
  else
    update public.arenas
    set active = true, suspension_reason = null,
        suspended_at = null, suspended_by = null
    where id = p_arena_id;

    insert into public.master_arena_audit(arena_id, actor_user_id, action, details)
    values (p_arena_id, auth.uid(), 'arena.reactivated',
      jsonb_build_object('reason', previous.suspension_reason,
        'before', jsonb_build_object('active', false),
        'after', jsonb_build_object('active', true)));
  end if;
end;
$$;

revoke all on function public.master_set_arena_active(uuid, boolean, text) from public, anon;
grant execute on function public.master_set_arena_active(uuid, boolean, text) to authenticated;

create or replace function public.get_public_arena_status(target_slug text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.arenas a where a.slug = target_slug and not a.active) then 'suspended'
    when exists (select 1 from public.arenas a where a.slug = target_slug and a.active and not a.public_access) then 'private'
    when exists (select 1 from public.arenas a where a.slug = target_slug and a.active and a.public_access) then 'available'
    else 'unavailable'
  end;
$$;

revoke all on function public.get_public_arena_status(text) from public;
grant execute on function public.get_public_arena_status(text) to anon, authenticated;

notify pgrst, 'reload schema';
