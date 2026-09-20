-- Protege dados pessoais das reservas e limita abuso da API pública.

create table if not exists private.booking_rate_limits (
  id bigint generated always as identity primary key,
  client_ip inet not null,
  requested_at timestamptz not null default now()
);

create index if not exists booking_rate_limits_ip_requested_at_idx
  on private.booking_rate_limits (client_ip, requested_at desc);

revoke all on table private.booking_rate_limits from public, anon, authenticated;
revoke all on sequence private.booking_rate_limits_id_seq from public, anon, authenticated;

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
    and a.active
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
  where slug = target_arena_slug and active;

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

create or replace function public.get_public_schedule(
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
security invoker
set search_path = ''
as $$
  select *
  from private.get_public_schedule_impl(target_arena_slug, target_date);
$$;

create or replace function public.create_public_booking(
  target_arena_slug text,
  target_court_id uuid,
  target_date date,
  target_start_hour smallint,
  target_duration smallint,
  target_customer_name text,
  target_customer_phone text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_public_booking_impl(
    target_arena_slug,
    target_court_id,
    target_date,
    target_start_hour,
    target_duration,
    target_customer_name,
    target_customer_phone
  );
$$;

drop policy if exists "Public can view occupied slots" on public.bookings;
drop policy if exists "Public can request bookings" on public.bookings;

revoke all on table public.bookings from anon;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function private.get_public_schedule_impl(text, date) from public, anon, authenticated;
revoke all on function private.create_public_booking_impl(text, uuid, date, smallint, smallint, text, text) from public, anon, authenticated;
revoke all on function public.get_public_schedule(text, date) from public, anon, authenticated;
revoke all on function public.create_public_booking(text, uuid, date, smallint, smallint, text, text) from public, anon, authenticated;

grant usage on schema private to anon, authenticated;
grant execute on function private.get_public_schedule_impl(text, date) to anon, authenticated;
grant execute on function private.create_public_booking_impl(text, uuid, date, smallint, smallint, text, text) to anon, authenticated;
grant execute on function public.get_public_schedule(text, date) to anon, authenticated;
grant execute on function public.create_public_booking(text, uuid, date, smallint, smallint, text, text) to anon, authenticated;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, public;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;

notify pgrst, 'reload schema';
