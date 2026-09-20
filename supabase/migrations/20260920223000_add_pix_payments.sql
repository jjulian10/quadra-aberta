-- Fluxo de sinal via Pix: cria reservas temporárias, expira cobranças e
-- permite consultar somente o estado de pagamento com um token aleatório.

alter table public.bookings
  add column if not exists customer_email text,
  add column if not exists deposit_amount numeric(10, 2) not null default 0.01,
  add column if not exists payment_provider text,
  add column if not exists payment_provider_order_id text,
  add column if not exists payment_access_token uuid not null default gen_random_uuid(),
  add column if not exists payment_expires_at timestamptz,
  add column if not exists payment_confirmed_at timestamptz;

alter table public.bookings
  drop constraint if exists bookings_customer_email_check,
  add constraint bookings_customer_email_check
    check (customer_email is null or customer_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  drop constraint if exists bookings_deposit_amount_check,
  add constraint bookings_deposit_amount_check
    check (deposit_amount >= 0);

create unique index if not exists bookings_payment_access_token_idx
  on public.bookings (payment_access_token);

create unique index if not exists bookings_provider_order_idx
  on public.bookings (payment_provider, payment_provider_order_id)
  where payment_provider_order_id is not null;

create or replace function private.cancel_expired_pix_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.bookings
  set status = 'cancelled', updated_at = now()
  where status = 'pending'
    and payment_status = 'pending'
    and payment_provider = 'mercado_pago'
    and payment_expires_at <= now();

  get diagnostics affected = row_count;
  return affected;
end;
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
  where slug = target_arena_slug and active;
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

create or replace function public.create_pix_booking(
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
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_pix_booking_impl(
    target_arena_slug, target_court_id, target_date, target_start_hour,
    target_duration, target_customer_name, target_customer_phone,
    target_customer_email, target_client_ip
  );
$$;

create or replace function private.get_public_payment_status_impl(
  target_booking_id uuid,
  target_payment_token uuid
)
returns table (booking_status text, payment_status text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.status::text, b.payment_status::text
  from public.bookings b
  where b.id = target_booking_id
    and b.payment_access_token = target_payment_token;
$$;

create or replace function public.get_public_payment_status(
  target_booking_id uuid,
  target_payment_token uuid
)
returns table (booking_status text, payment_status text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_public_payment_status_impl(target_booking_id, target_payment_token);
$$;

revoke all on function private.cancel_expired_pix_bookings() from public, anon, authenticated;
revoke all on function private.create_pix_booking_impl(text, uuid, date, integer, integer, text, text, text, inet) from public, anon, authenticated;
revoke all on function public.create_pix_booking(text, uuid, date, integer, integer, text, text, text, inet) from public, anon, authenticated;
revoke all on function private.get_public_payment_status_impl(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_public_payment_status(uuid, uuid) from public, anon, authenticated;

grant execute on function private.create_pix_booking_impl(text, uuid, date, integer, integer, text, text, text, inet) to service_role;
grant execute on function public.create_pix_booking(text, uuid, date, integer, integer, text, text, text, inet) to service_role;
grant usage on schema private to service_role;
grant execute on function private.get_public_payment_status_impl(uuid, uuid) to anon, authenticated;
grant execute on function public.get_public_payment_status(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
