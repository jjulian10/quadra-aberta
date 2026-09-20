-- A execução já é restrita ao service_role pelos privilégios da função.

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
