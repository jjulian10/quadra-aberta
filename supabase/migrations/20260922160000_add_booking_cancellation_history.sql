create table if not exists public.booking_cancellations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  arena_id uuid not null references public.arenas(id) on delete restrict,
  court_id uuid not null references public.courts(id) on delete restrict,
  court_name text not null,
  customer_name text not null,
  booking_date date not null,
  start_hour smallint not null,
  duration smallint not null,
  booking_amount numeric(12,2) not null,
  payment_received_amount numeric(12,2) not null default 0,
  payment_status public.payment_status not null,
  cancellation_reason text not null,
  cancelled_by uuid not null references auth.users(id) on delete restrict,
  cancelled_at timestamptz not null default now(),
  constraint booking_cancellations_booking_unique unique (booking_id),
  constraint booking_cancellations_reason_length
    check (char_length(btrim(cancellation_reason)) between 5 and 500)
);

create index if not exists booking_cancellations_arena_cancelled_at_idx
  on public.booking_cancellations (arena_id, cancelled_at desc);

create index if not exists booking_cancellations_arena_booking_date_idx
  on public.booking_cancellations (arena_id, booking_date desc);

alter table public.booking_cancellations enable row level security;

drop policy if exists "Arena admins can view cancellation history" on public.booking_cancellations;
create policy "Arena admins can view cancellation history"
on public.booking_cancellations
for select
to authenticated
using (private.is_arena_admin(arena_id));

revoke all on table public.booking_cancellations from anon;
revoke insert, update, delete on table public.booking_cancellations from authenticated;
grant select on table public.booking_cancellations to authenticated;

create or replace function public.cancel_booking_with_reason(
  p_booking_id uuid,
  p_reason text
)
returns public.booking_cancellations
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_booking public.bookings%rowtype;
  target_court public.courts%rowtype;
  history public.booking_cancellations%rowtype;
  actor uuid := auth.uid();
  normalized_reason text := btrim(coalesce(p_reason, ''));
begin
  if actor is null then
    raise exception 'Autenticação necessária.';
  end if;

  if char_length(normalized_reason) < 5 then
    raise exception 'Informe um motivo de cancelamento com pelo menos 5 caracteres.';
  end if;

  if char_length(normalized_reason) > 500 then
    raise exception 'O motivo de cancelamento deve ter no máximo 500 caracteres.';
  end if;

  select *
    into target_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Reserva não encontrada.';
  end if;

  if not private.is_arena_admin(target_booking.arena_id) then
    raise exception 'Você não possui acesso para cancelar esta reserva.';
  end if;

  if target_booking.status = 'cancelled' then
    raise exception 'Esta reserva já está cancelada.';
  end if;

  select *
    into target_court
  from public.courts
  where id = target_booking.court_id;

  if not found then
    raise exception 'Quadra da reserva não encontrada.';
  end if;

  insert into public.booking_cancellations (
    booking_id,
    arena_id,
    court_id,
    court_name,
    customer_name,
    booking_date,
    start_hour,
    duration,
    booking_amount,
    payment_received_amount,
    payment_status,
    cancellation_reason,
    cancelled_by
  )
  values (
    target_booking.id,
    target_booking.arena_id,
    target_booking.court_id,
    target_court.name,
    target_booking.customer_name,
    target_booking.booking_date,
    target_booking.start_hour,
    target_booking.duration,
    target_booking.amount,
    coalesce(target_booking.payment_received_amount, 0),
    target_booking.payment_status,
    normalized_reason,
    actor
  )
  returning * into history;

  update public.bookings
  set
    status = 'cancelled',
    updated_at = now()
  where id = target_booking.id;

  return history;
end;
$$;

revoke all on function public.cancel_booking_with_reason(uuid, text) from public;
grant execute on function public.cancel_booking_with_reason(uuid, text) to authenticated;
