-- Fechamento diário de caixa por arena.
-- O dia fechado é imutável; ajustes futuros devem ser feitos por uma nova movimentação auditável.

create table if not exists public.cash_expenses (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas(id) on delete cascade,
  expense_date date not null,
  description text not null check (char_length(btrim(description)) between 2 and 160),
  category text not null default 'Outros' check (char_length(btrim(category)) between 2 and 60),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'pix', 'card', 'other')),
  amount numeric(12,2) not null check (amount > 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cash_expenses_arena_date_idx
  on public.cash_expenses (arena_id, expense_date, created_at desc);

create table if not exists public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas(id) on delete cascade,
  closing_date date not null,
  booking_received_total numeric(12,2) not null default 0 check (booking_received_total >= 0),
  inventory_sales_total numeric(12,2) not null default 0 check (inventory_sales_total >= 0),
  expenses_total numeric(12,2) not null default 0 check (expenses_total >= 0),
  expected_total numeric(12,2) not null default 0,
  counted_total numeric(12,2) not null check (counted_total >= 0),
  difference_total numeric(12,2) not null,
  payment_breakdown jsonb not null default '{}'::jsonb,
  notes text check (notes is null or char_length(notes) <= 500),
  status text not null default 'closed' check (status = 'closed'),
  closed_by uuid references auth.users(id) on delete set null default auth.uid(),
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (arena_id, closing_date)
);

create index if not exists cash_closings_arena_date_idx
  on public.cash_closings (arena_id, closing_date desc);

drop trigger if exists cash_expenses_set_updated_at on public.cash_expenses;
create trigger cash_expenses_set_updated_at
before update on public.cash_expenses
for each row execute function public.set_updated_at();

drop trigger if exists cash_closings_set_updated_at on public.cash_closings;
create trigger cash_closings_set_updated_at
before update on public.cash_closings
for each row execute function public.set_updated_at();

create or replace function private.prevent_closed_cash_closing_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Este fechamento já foi concluído e não pode ser alterado.';
end;
$$;

drop trigger if exists cash_closings_immutable on public.cash_closings;
create trigger cash_closings_immutable
before update or delete on public.cash_closings
for each row execute function private.prevent_closed_cash_closing_update();

create or replace function private.cash_day_is_open(target_arena_id uuid, target_date date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.cash_closings
    where arena_id = target_arena_id and closing_date = target_date
  );
$$;

alter table public.cash_expenses enable row level security;
alter table public.cash_closings enable row level security;

drop policy if exists "Admins can view cash expenses" on public.cash_expenses;
create policy "Admins can view cash expenses"
on public.cash_expenses for select to authenticated
using (private.is_arena_admin(arena_id));

drop policy if exists "Admins can create cash expenses" on public.cash_expenses;
create policy "Admins can create cash expenses"
on public.cash_expenses for insert to authenticated
with check (private.is_arena_admin(arena_id) and private.cash_day_is_open(arena_id, expense_date));

drop policy if exists "Admins can update cash expenses" on public.cash_expenses;
create policy "Admins can update cash expenses"
on public.cash_expenses for update to authenticated
using (private.is_arena_admin(arena_id) and private.cash_day_is_open(arena_id, expense_date))
with check (private.is_arena_admin(arena_id) and private.cash_day_is_open(arena_id, expense_date));

drop policy if exists "Admins can view cash closings" on public.cash_closings;
create policy "Admins can view cash closings"
on public.cash_closings for select to authenticated
using (private.is_arena_admin(arena_id));

revoke all on public.cash_expenses from public, anon;
grant select, insert, update on public.cash_expenses to authenticated;
revoke all on public.cash_closings from public, anon;
grant select on public.cash_closings to authenticated;

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
revoke all on function private.cash_day_is_open(uuid, date) from public, anon;
grant execute on function private.cash_day_is_open(uuid, date) to authenticated;
