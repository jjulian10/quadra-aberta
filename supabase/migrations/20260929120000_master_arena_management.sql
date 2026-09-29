-- The public catalog is separate from the ability to open an arena by its direct link.
alter table public.arenas add column if not exists public_listed boolean not null default true;

create table if not exists public.master_arena_audit (
  id bigint generated always as identity primary key,
  arena_id uuid not null references public.arenas(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists master_arena_audit_recent_idx on public.master_arena_audit(arena_id, created_at desc);
alter table public.master_arena_audit enable row level security;
revoke all on public.master_arena_audit from anon, authenticated;

create or replace function public.get_master_arena_detail(p_arena_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.is_platform_admin(auth.uid()) then
    raise exception 'Acesso restrito ao administrador da plataforma' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'arena', to_jsonb(a),
    'courts', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order, c.name) from public.courts c where c.arena_id = a.id), '[]'::jsonb),
    'admins', coalesce((select jsonb_agg(jsonb_build_object('user_id', aa.user_id, 'email', u.email, 'role', aa.role, 'created_at', aa.created_at) order by aa.created_at) from public.arena_admins aa join auth.users u on u.id = aa.user_id where aa.arena_id = a.id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from (select audit.id, audit.action, audit.details, audit.created_at, u.email as actor_email from public.master_arena_audit audit left join auth.users u on u.id = audit.actor_user_id where audit.arena_id = a.id order by audit.created_at desc limit 50) h), '[]'::jsonb)
  ) into result from public.arenas a where a.id = p_arena_id;
  if result is null then raise exception 'Arena não encontrada' using errcode = 'P0002'; end if;
  return result;
end; $$;
revoke all on function public.get_master_arena_detail(uuid) from public;
grant execute on function public.get_master_arena_detail(uuid) to authenticated;

create or replace function public.master_update_arena(p_arena_id uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare previous public.arenas%rowtype;
next_name text; next_city text; next_address text; next_whatsapp text; next_listed boolean;
begin
  if not private.is_platform_admin(auth.uid()) then
    raise exception 'Acesso restrito ao administrador da plataforma' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or
     p_data ?| array['slug','id','active','timezone','created_at','updated_at'] then
    raise exception 'Dados inválidos para atualização' using errcode = '22023';
  end if;
  select * into previous from public.arenas where id = p_arena_id for update;
  if not found then raise exception 'Arena não encontrada' using errcode = 'P0002'; end if;
  next_name := btrim(p_data->>'name'); next_city := btrim(p_data->>'city');
  next_address := btrim(p_data->>'address'); next_whatsapp := regexp_replace(coalesce(p_data->>'whatsapp',''), '\D', '', 'g');
  if jsonb_typeof(p_data->'public_listed') is distinct from 'boolean' then
    raise exception 'Visibilidade inválida' using errcode = '22023';
  end if;
  next_listed := (p_data->>'public_listed')::boolean;
  if coalesce(char_length(next_name) between 2 and 80,false) = false or
     coalesce(char_length(next_city) between 2 and 80,false) = false or
     coalesce(char_length(next_address) between 5 and 180,false) = false or next_whatsapp !~ '^[0-9]{10,13}$' then
    raise exception 'Revise os dados da arena' using errcode = '22023';
  end if;
  if (previous.name, previous.city, previous.address, previous.whatsapp, previous.public_listed)
     is distinct from (next_name, next_city, next_address, next_whatsapp, next_listed) then
    update public.arenas set name = next_name, city = next_city, address = next_address,
      whatsapp = next_whatsapp, public_listed = next_listed where id = p_arena_id;
    insert into public.master_arena_audit(arena_id, actor_user_id, action, details)
    values (p_arena_id, auth.uid(), 'arena.updated', jsonb_build_object(
      'before', jsonb_build_object('name',previous.name,'city',previous.city,'address',previous.address,'whatsapp',previous.whatsapp,'public_listed',previous.public_listed),
      'after', jsonb_build_object('name',next_name,'city',next_city,'address',next_address,'whatsapp',next_whatsapp,'public_listed',next_listed)));
  end if;
end; $$;
revoke all on function public.master_update_arena(uuid,jsonb) from public;
grant execute on function public.master_update_arena(uuid,jsonb) to authenticated;

create or replace function public.master_save_court(p_arena_id uuid, p_court_id uuid, p_data jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public.courts%rowtype;
result_id uuid; next_name text; next_sport text; next_price numeric;
next_open integer; next_close integer; next_active boolean;
begin
  if not private.is_platform_admin(auth.uid()) then
    raise exception 'Acesso restrito ao administrador da plataforma' using errcode = '42501';
  end if;
  if not exists (select 1 from public.arenas where id = p_arena_id) then
    raise exception 'Arena não encontrada' using errcode = 'P0002';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or
     jsonb_typeof(p_data->'active') is distinct from 'boolean' then
    raise exception 'Dados da quadra inválidos' using errcode = '22023';
  end if;
  next_name := btrim(p_data->>'name'); next_sport := btrim(p_data->>'sport');
  if coalesce(p_data->>'hourly_price','') !~ '^\d+(\.\d{1,2})?$' or
     coalesce(p_data->>'opening_hour','') !~ '^\d{1,2}$' or
     coalesce(p_data->>'closing_hour','') !~ '^\d{1,2}$' then
    raise exception 'Preço ou horário inválido' using errcode = '22023';
  end if;
  next_price := (p_data->>'hourly_price')::numeric;
  next_open := (p_data->>'opening_hour')::integer;
  next_close := (p_data->>'closing_hour')::integer;
  next_active := (p_data->>'active')::boolean;
  if coalesce(char_length(next_name) between 2 and 60,false) = false or
     coalesce(char_length(next_sport) between 2 and 60,false) = false or
     next_open < 0 or next_open > 23 or next_close < 1 or next_close > 24 or next_close <= next_open then
    raise exception 'Revise os dados da quadra' using errcode = '22023';
  end if;
  if p_court_id is null then
    if not next_active then raise exception 'Nova quadra deve estar ativa' using errcode = '22023'; end if;
    insert into public.courts(arena_id,name,sport,hourly_price,opening_hour,closing_hour,sort_order,active)
    values (p_arena_id,next_name,next_sport,next_price,next_open,next_close,
      coalesce((select max(sort_order)+1 from public.courts where arena_id=p_arena_id),1),true) returning id into result_id;
    insert into public.master_arena_audit(arena_id,actor_user_id,action,details)
    values (p_arena_id,auth.uid(),'court.created',jsonb_build_object('court_id',result_id,'name',next_name));
  else
    select * into previous from public.courts where id=p_court_id and arena_id=p_arena_id for update;
    if not found then raise exception 'Quadra não encontrada' using errcode = 'P0002'; end if;
    if exists (select 1 from public.bookings b where b.court_id=p_court_id and b.booking_date>=current_date
      and b.status in ('pending','confirmed') and (not next_active or b.start_hour<next_open or b.start_hour+b.duration>next_close)) then
      raise exception 'Há reservas futuras fora do novo horário ou em uma quadra desativada' using errcode = '22023';
    end if;
    if not next_active and previous.active and not exists (
      select 1 from public.courts c where c.arena_id=p_arena_id and c.id<>p_court_id and c.active
    ) then raise exception 'A arena precisa manter ao menos uma quadra ativa' using errcode = '22023'; end if;
    result_id := p_court_id;
    if (previous.name,previous.sport,previous.hourly_price,previous.opening_hour,previous.closing_hour,previous.active)
       is distinct from (next_name,next_sport,next_price,next_open,next_close,next_active) then
      update public.courts set name=next_name,sport=next_sport,hourly_price=next_price,
        opening_hour=next_open,closing_hour=next_close,active=next_active where id=p_court_id;
      insert into public.master_arena_audit(arena_id,actor_user_id,action,details)
      values (p_arena_id,auth.uid(),'court.updated',jsonb_build_object('court_id',result_id,'name',next_name,
        'before',jsonb_build_object('name',previous.name,'sport',previous.sport,'hourly_price',previous.hourly_price,'opening_hour',previous.opening_hour,'closing_hour',previous.closing_hour,'active',previous.active),
        'after',jsonb_build_object('name',next_name,'sport',next_sport,'hourly_price',next_price,'opening_hour',next_open,'closing_hour',next_close,'active',next_active)));
    end if;
  end if;
  return result_id;
end; $$;
revoke all on function public.master_save_court(uuid,uuid,jsonb) from public;
grant execute on function public.master_save_court(uuid,uuid,jsonb) to authenticated;

create or replace function public.master_add_admin(p_arena_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target_email text;
begin
  if not private.is_platform_admin(auth.uid()) then
    raise exception 'Acesso restrito ao administrador da plataforma' using errcode = '42501';
  end if;
  if not exists (select 1 from public.arenas where id=p_arena_id) then
    raise exception 'Arena não encontrada' using errcode = 'P0002';
  end if;
  select email into target_email from auth.users where id=p_user_id;
  if target_email is null then raise exception 'Usuário não encontrado' using errcode = 'P0002'; end if;
  if exists (select 1 from public.arena_admins where user_id=p_user_id) then
    raise exception 'Este usuário já administra uma arena' using errcode = '23505';
  end if;
  insert into public.arena_admins(arena_id,user_id,role) values (p_arena_id,p_user_id,'admin');
  insert into public.master_arena_audit(arena_id,actor_user_id,action,details)
  values (p_arena_id,auth.uid(),'admin.added',jsonb_build_object('email',target_email,'user_id',p_user_id));
end; $$;
revoke all on function public.master_add_admin(uuid,uuid) from public;
grant execute on function public.master_add_admin(uuid,uuid) to authenticated;

create or replace function public.master_remove_admin(p_arena_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare membership public.arena_admins%rowtype; target_email text;
begin
  if not private.is_platform_admin(auth.uid()) then
    raise exception 'Acesso restrito ao administrador da plataforma' using errcode = '42501';
  end if;
  select * into membership from public.arena_admins where arena_id=p_arena_id and user_id=p_user_id for update;
  if not found then raise exception 'Administrador não encontrado' using errcode = 'P0002'; end if;
  if membership.role='owner' then raise exception 'O proprietário não pode ser removido aqui' using errcode = '22023'; end if;
  if not exists (select 1 from public.arena_admins where arena_id=p_arena_id and user_id<>p_user_id) then
    raise exception 'A arena precisa manter ao menos um administrador' using errcode = '22023';
  end if;
  select email into target_email from auth.users where id=p_user_id;
  delete from public.arena_admins where arena_id=p_arena_id and user_id=p_user_id;
  insert into public.master_arena_audit(arena_id,actor_user_id,action,details)
  values (p_arena_id,auth.uid(),'admin.removed',jsonb_build_object('email',target_email,'user_id',p_user_id));
end; $$;
revoke all on function public.master_remove_admin(uuid,uuid) from public;
grant execute on function public.master_remove_admin(uuid,uuid) to authenticated;
