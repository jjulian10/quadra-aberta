-- An arena can be absent from the catalog yet open by link, or fully private.
alter table public.arenas add column if not exists public_access boolean not null default true;
-- All edits go through checked, audited RPCs.
revoke insert, update, delete, truncate on public.arenas from authenticated;
revoke insert, update, delete, truncate on public.courts from authenticated;
drop policy if exists "Public can view active arenas" on public.arenas;
create policy "Public can view open arenas" on public.arenas for select to anon using (active and public_access);
drop policy if exists "Admins can view their arena" on public.arenas;
create policy "Admins can view open or own arena" on public.arenas for select to authenticated using ((active and public_access) or private.is_arena_admin(id));
drop policy if exists "Public can view active courts" on public.courts;
create policy "Public can view open courts" on public.courts for select to anon using (active and exists (select 1 from public.arenas a where a.id=arena_id and a.active and a.public_access));
drop policy if exists "Admins can view their courts" on public.courts;
create policy "Admins can view open or own courts" on public.courts for select to authenticated using (private.is_arena_admin(arena_id) or (active and exists (select 1 from public.arenas a where a.id=arena_id and a.active and a.public_access)));
drop policy if exists "Public can view active arena schedule changes" on public.schedule_change_events;
create policy "Open arenas can show schedule changes" on public.schedule_change_events for select to anon, authenticated using (exists (select 1 from public.arenas a where a.id=schedule_change_events.arena_id and a.active and a.public_access));

create or replace function private.get_public_schedule_impl(
  target_arena_slug text,
  target_date date
)
returns table (
  court_id uuid,
  start_hour smallint,
  duration smallint,
  status public.booking_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.court_id, b.start_hour, b.duration, b.status
  from public.bookings b
  join public.arenas a on a.id = b.arena_id
  where a.slug = target_arena_slug
    and a.active and a.public_access
    and b.booking_date = target_date
    and b.status in ('pending', 'confirmed');
$$;


create or replace function private.create_public_booking_impl(
  target_arena_slug text,
  target_court_id uuid,
  target_date date,
  target_start_hour smallint,
  target_duration smallint,
  target_customer_name text,
  target_customer_phone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_arena public.arenas%rowtype;
  selected_court public.courts%rowtype;
  normalized_phone text;
  new_booking_id uuid;
  forwarded_for text;
  request_ip inet;
  recent_requests integer;
begin
  forwarded_for := split_part(
    coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''),
    ',',
    1
  );

  begin
    request_ip := nullif(trim(forwarded_for), '')::inet;
  exception
    when others then
      request_ip := '0.0.0.0'::inet;
  end;

  perform pg_advisory_xact_lock(hashtext('public-booking:' || host(request_ip)));

  delete from private.booking_rate_limits
  where requested_at < now() - interval '1 day';

  select count(*)::integer
  into recent_requests
  from private.booking_rate_limits
  where client_ip = request_ip
    and requested_at >= now() - interval '15 minutes';

  if recent_requests >= 6 then
    raise sqlstate 'PGRST' using
      message = json_build_object(
        'code', 'booking_rate_limit',
        'message', 'Muitas tentativas de reserva. Aguarde 15 minutos e tente novamente.'
      )::text,
      detail = json_build_object(
        'status', 429,
        'headers', json_build_object(),
        'status_text', 'Too Many Requests'
      )::text;
  end if;

  insert into private.booking_rate_limits (client_ip)
  values (request_ip);

  normalized_phone := regexp_replace(target_customer_phone, '[^0-9]', '', 'g');

  if target_date < current_date then
    raise exception 'Não é possível reservar uma data passada.';
  end if;

  if target_duration not between 1 and 3 then
    raise exception 'A duração deve ser de uma a três horas.';
  end if;

  if char_length(trim(target_customer_name)) not between 2 and 70 then
    raise exception 'Informe o nome do responsável.';
  end if;

  if normalized_phone !~ '^[0-9]{10,13}$' then
    raise exception 'Informe um celular válido com DDD.';
  end if;

  select * into selected_arena
  from public.arenas
  where slug = target_arena_slug and active and public_access;

  if not found then
    raise exception 'Arena indisponível.';
  end if;

  select * into selected_court
  from public.courts
  where id = target_court_id
    and arena_id = selected_arena.id
    and active;

  if not found then
    raise exception 'Quadra indisponível.';
  end if;

  if target_start_hour < selected_court.opening_hour
    or target_start_hour + target_duration > selected_court.closing_hour then
    raise exception 'Horário fora do funcionamento da quadra.';
  end if;

  new_booking_id := gen_random_uuid();

  insert into public.bookings (
    id,
    arena_id,
    court_id,
    booking_date,
    start_hour,
    duration,
    customer_name,
    customer_phone,
    amount
  ) values (
    new_booking_id,
    selected_arena.id,
    selected_court.id,
    target_date,
    target_start_hour,
    target_duration,
    trim(target_customer_name),
    normalized_phone,
    selected_court.hourly_price * target_duration
  );

  return new_booking_id;
exception
  when exclusion_violation then
    raise exception 'Este horário acabou de ser reservado. Escolha outro.';
end;
$$;


create or replace function private.get_public_schedule_v2_impl(target_arena_slug text, target_date date)
returns table (court_id uuid, start_hour smallint, duration smallint, status public.booking_status, entry_type text)
language sql stable security definer set search_path = '' as $$
  select booking.court_id, booking.start_hour, booking.duration, booking.status, 'booking'::text
  from public.bookings booking join public.arenas arena on arena.id = booking.arena_id
  where arena.slug = target_arena_slug and arena.active and arena.public_access and booking.booking_date = target_date
    and booking.status in ('pending', 'confirmed')
  union all
  select court.id, coalesce(block.start_hour, court.opening_hour)::smallint,
         coalesce(block.duration, court.closing_hour - court.opening_hour)::smallint,
         'confirmed'::public.booking_status, 'block'::text
  from public.schedule_blocks block
  join public.arenas arena on arena.id = block.arena_id
  join public.courts court on court.arena_id = block.arena_id and (block.court_id is null or block.court_id = court.id)
  where arena.slug = target_arena_slug and arena.active and arena.public_access and court.active and block.block_date = target_date;
$$;


create or replace function private.create_pix_booking_impl(
  target_arena_slug text,
  target_court_id uuid,
  target_date date,
  target_start_hour integer,
  target_duration integer,
  target_customer_name text,
  target_customer_phone text,
  target_customer_email text,
  target_client_ip inet
)
returns table (booking_id uuid, payment_token uuid, total_amount numeric, deposit_amount numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_arena public.arenas%rowtype;
  selected_court public.courts%rowtype;
  normalized_phone text;
  normalized_email text;
  new_booking_id uuid := gen_random_uuid();
  new_payment_token uuid := gen_random_uuid();
  recent_requests integer;
begin
  perform private.cancel_expired_pix_bookings();
  target_client_ip := coalesce(target_client_ip, '0.0.0.0'::inet);
  perform pg_advisory_xact_lock(hashtext('pix-booking:' || host(target_client_ip)));

  delete from private.booking_rate_limits
  where requested_at < now() - interval '1 day';

  select count(*)::integer into recent_requests
  from private.booking_rate_limits
  where client_ip = target_client_ip
    and requested_at >= now() - interval '15 minutes';

  if recent_requests >= 6 then
    raise exception 'Muitas tentativas de reserva. Aguarde 15 minutos e tente novamente.';
  end if;

  insert into private.booking_rate_limits (client_ip) values (target_client_ip);

  normalized_phone := regexp_replace(coalesce(target_customer_phone, ''), '[^0-9]', '', 'g');
  normalized_email := lower(trim(coalesce(target_customer_email, '')));

  if target_date < current_date then
    raise exception 'Não é possível reservar uma data passada.';
  end if;
  if target_duration not between 1 and 3 then
    raise exception 'A duração deve ser de uma a três horas.';
  end if;
  if char_length(trim(coalesce(target_customer_name, ''))) not between 2 and 70 then
    raise exception 'Informe o nome do responsável.';
  end if;
  if normalized_phone !~ '^[0-9]{10,13}$' then
    raise exception 'Informe um celular válido com DDD.';
  end if;
  if normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Informe um e-mail válido para o pagamento.';
  end if;

  select * into selected_arena
  from public.arenas
  where slug = target_arena_slug and active and public_access;
  if not found then raise exception 'Arena indisponível.'; end if;

  select * into selected_court
  from public.courts
  where id = target_court_id
    and arena_id = selected_arena.id
    and active;
  if not found then raise exception 'Quadra indisponível.'; end if;

  if target_start_hour < selected_court.opening_hour
    or target_start_hour + target_duration > selected_court.closing_hour then
    raise exception 'Horário fora do funcionamento da quadra.';
  end if;

  insert into public.bookings (
    id, arena_id, court_id, booking_date, start_hour, duration,
    customer_name, customer_phone, customer_email, status, payment_status,
    amount, deposit_amount, payment_provider, payment_access_token,
    payment_expires_at
  ) values (
    new_booking_id, selected_arena.id, selected_court.id, target_date,
    target_start_hour::smallint, target_duration::smallint,
    trim(target_customer_name), normalized_phone, normalized_email,
    'pending', 'pending', selected_court.hourly_price * target_duration,
    0.01, 'mercado_pago', new_payment_token, now() + interval '30 minutes'
  );

  return query select new_booking_id, new_payment_token,
    selected_court.hourly_price * target_duration, 0.01::numeric;
exception
  when exclusion_violation then
    raise exception 'Este horário acabou de ser reservado. Escolha outro.';
end;
$$;
create or replace function public.get_master_arena_detail(p_arena_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not (private.is_platform_admin(auth.uid()) or private.is_arena_admin(p_arena_id)) then
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

create or replace function public.master_update_arena(p_arena_id uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare previous public.arenas%rowtype;
next_name text; next_city text; next_address text; next_whatsapp text; next_listed boolean; next_access boolean;
begin
  if not (private.is_platform_admin(auth.uid()) or private.is_arena_admin(p_arena_id)) then
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
  if p_data ? 'public_access' and jsonb_typeof(p_data->'public_access') is distinct from 'boolean' then
    raise exception 'Acesso público inválido' using errcode = '22023';
  end if;
  next_access := coalesce((p_data->>'public_access')::boolean, previous.public_access);
  if coalesce(char_length(next_name) between 2 and 80,false) = false or
     coalesce(char_length(next_city) between 2 and 80,false) = false or
     coalesce(char_length(next_address) between 5 and 180,false) = false or next_whatsapp !~ '^[0-9]{10,13}$' then
    raise exception 'Revise os dados da arena' using errcode = '22023';
  end if;
  if (previous.name, previous.city, previous.address, previous.whatsapp, previous.public_listed, previous.public_access)
     is distinct from (next_name, next_city, next_address, next_whatsapp, next_listed, next_access) then
    update public.arenas set name = next_name, city = next_city, address = next_address,
      whatsapp = next_whatsapp, public_listed = next_listed, public_access = next_access where id = p_arena_id;
    insert into public.master_arena_audit(arena_id, actor_user_id, action, details)
    values (p_arena_id, auth.uid(), 'arena.updated', jsonb_build_object(
      'before', jsonb_build_object('name',previous.name,'city',previous.city,'address',previous.address,'whatsapp',previous.whatsapp,'public_listed',previous.public_listed,'public_access',previous.public_access),
      'after', jsonb_build_object('name',next_name,'city',next_city,'address',next_address,'whatsapp',next_whatsapp,'public_listed',next_listed,'public_access',next_access)));
  end if;
end; $$;

create or replace function public.master_save_court(p_arena_id uuid, p_court_id uuid, p_data jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public.courts%rowtype;
result_id uuid; next_name text; next_sport text; next_price numeric;
next_open integer; next_close integer; next_active boolean; arena_today date;
begin
  if not (private.is_platform_admin(auth.uid()) or private.is_arena_admin(p_arena_id)) then
    raise exception 'Acesso restrito ao administrador da plataforma' using errcode = '42501';
  end if;
  select (now() at time zone a.timezone)::date into arena_today from public.arenas a where a.id = p_arena_id;
  if arena_today is null then
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
    if exists (select 1 from public.bookings b where b.court_id=p_court_id and b.booking_date>=arena_today
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

create or replace function public.master_add_admin(p_arena_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target_email text;
begin
  if not (private.is_platform_admin(auth.uid()) or private.is_arena_admin(p_arena_id)) then
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

create or replace function public.master_remove_admin(p_arena_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare membership public.arena_admins%rowtype; target_email text;
begin
  if not (private.is_platform_admin(auth.uid()) or private.is_arena_admin(p_arena_id)) then
    raise exception 'Acesso restrito ao administrador da plataforma' using errcode = '42501';
  end if;
  select * into membership from public.arena_admins where arena_id=p_arena_id and user_id=p_user_id for update;
  if not found then raise exception 'Administrador não encontrado' using errcode = 'P0002'; end if;
  if p_user_id = auth.uid() then raise exception 'Você não pode remover seu próprio acesso' using errcode = '22023'; end if;
  if membership.role='owner' then raise exception 'O proprietário não pode ser removido aqui' using errcode = '22023'; end if;
  if not exists (select 1 from public.arena_admins where arena_id=p_arena_id and user_id<>p_user_id) then
    raise exception 'A arena precisa manter ao menos um administrador' using errcode = '22023';
  end if;
  select email into target_email from auth.users where id=p_user_id;
  delete from public.arena_admins where arena_id=p_arena_id and user_id=p_user_id;
  insert into public.master_arena_audit(arena_id,actor_user_id,action,details)
  values (p_arena_id,auth.uid(),'admin.removed',jsonb_build_object('email',target_email,'user_id',p_user_id));
end; $$;

create or replace function public.get_public_arena_status(target_slug text)
returns text language sql stable security definer set search_path = '' as $$
  select case when exists (select 1 from public.arenas a where a.slug=target_slug and a.active and not a.public_access) then 'private' else 'unavailable' end;
$$;
revoke all on function public.get_public_arena_status(text) from public;
grant execute on function public.get_public_arena_status(text) to anon, authenticated;
notify pgrst, 'reload schema';
