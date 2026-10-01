-- Mantém a função pública como invoker e deixa a operação privilegiada somente no schema privado.
create or replace function private.close_cash_day_impl(
  target_arena_id uuid,
  target_date date,
  target_counted_total numeric,
  target_payment_breakdown jsonb default '{}'::jsonb,
  target_notes text default null
)
returns public.cash_closings
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_total numeric(12,2);
  inventory_total numeric(12,2);
  expenses_total numeric(12,2);
  expected_total numeric(12,2);
  closing_row public.cash_closings;
begin
  if not private.is_arena_admin(target_arena_id) then
    raise exception 'Você não tem permissão para fechar o caixa desta arena.';
  end if;

  if target_date is null or target_date > (now() at time zone 'America/Manaus')::date then
    raise exception 'O fechamento precisa ser de hoje ou de uma data passada.';
  end if;

  if target_counted_total is null or target_counted_total < 0 then
    raise exception 'Informe um valor contado válido.';
  end if;

  if exists (
    select 1 from public.cash_closings
    where arena_id = target_arena_id and closing_date = target_date
  ) then
    raise exception 'Este dia já foi fechado.';
  end if;

  select coalesce(sum(payment_received_amount), 0)::numeric(12,2)
  into booking_total
  from public.bookings
  where arena_id = target_arena_id
    and booking_date = target_date
    and status in ('pending', 'confirmed');

  select coalesce(sum(total_amount), 0)::numeric(12,2)
  into inventory_total
  from public.inventory_movements
  where arena_id = target_arena_id
    and movement_type = 'sale'
    and (created_at at time zone 'America/Manaus')::date = target_date;

  select coalesce(sum(amount), 0)::numeric(12,2)
  into expenses_total
  from public.cash_expenses
  where arena_id = target_arena_id and expense_date = target_date;

  expected_total := booking_total + inventory_total - expenses_total;

  insert into public.cash_closings (
    arena_id, closing_date, booking_received_total, inventory_sales_total,
    expenses_total, expected_total, counted_total, difference_total,
    payment_breakdown, notes, closed_by
  ) values (
    target_arena_id, target_date, booking_total, inventory_total,
    expenses_total, expected_total, target_counted_total,
    target_counted_total - expected_total,
    coalesce(target_payment_breakdown, '{}'::jsonb),
    nullif(btrim(target_notes), ''), auth.uid()
  ) returning * into closing_row;

  return closing_row;
exception
  when unique_violation then
    raise exception 'Este dia já foi fechado.';
end;
$$;

create or replace function public.close_cash_day(
  target_arena_id uuid,
  target_date date,
  target_counted_total numeric,
  target_payment_breakdown jsonb default '{}'::jsonb,
  target_notes text default null
)
returns public.cash_closings
language sql
security invoker
set search_path = ''
as $$
  select private.close_cash_day_impl(
    target_arena_id, target_date, target_counted_total,
    target_payment_breakdown, target_notes
  );
$$;

revoke all on function private.close_cash_day_impl(uuid, date, numeric, jsonb, text) from public, anon;
grant execute on function private.close_cash_day_impl(uuid, date, numeric, jsonb, text) to authenticated;
revoke all on function public.close_cash_day(uuid, date, numeric, jsonb, text) from public, anon;
grant execute on function public.close_cash_day(uuid, date, numeric, jsonb, text) to authenticated;
