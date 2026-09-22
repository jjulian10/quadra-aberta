alter table public.bookings
  add column if not exists reservation_access_token uuid not null default gen_random_uuid(),
  add column if not exists balance_payment_order_id text,
  add column if not exists balance_payment_amount numeric(12,2),
  add column if not exists balance_payment_qr_code text,
  add column if not exists balance_payment_qr_code_base64 text,
  add column if not exists balance_payment_ticket_url text,
  add column if not exists balance_payment_expires_at timestamptz;

create unique index if not exists bookings_reservation_access_token_key
  on public.bookings (reservation_access_token);

alter table public.bookings
  drop constraint if exists bookings_balance_payment_amount_check;

alter table public.bookings
  add constraint bookings_balance_payment_amount_check
  check (balance_payment_amount is null or balance_payment_amount > 0);
