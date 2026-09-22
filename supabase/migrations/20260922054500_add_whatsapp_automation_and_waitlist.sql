create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  booking_date date not null,
  start_hour smallint not null check (start_hour between 0 and 23),
  duration smallint not null default 1 check (duration between 1 and 3),
  customer_name text not null check (char_length(customer_name) between 2 and 70),
  customer_phone text not null check (customer_phone ~ '^[0-9]{10,13}$'),
  status text not null default 'waiting'
    check (status in ('waiting','notified','converted','cancelled','expired')),
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists waitlist_active_slot_phone_key
  on public.waitlist_entries (
    arena_id, court_id, booking_date, start_hour, duration, customer_phone
  )
  where status = 'waiting';

alter table public.waitlist_entries enable row level security;

drop policy if exists "Arena admins can view waitlist" on public.waitlist_entries;
create policy "Arena admins can view waitlist"
  on public.waitlist_entries
  for select
  to authenticated
  using (private.is_arena_admin(arena_id));

drop policy if exists "Arena admins can manage waitlist" on public.waitlist_entries;
create policy "Arena admins can manage waitlist"
  on public.waitlist_entries
  for all
  to authenticated
  using (private.is_arena_admin(arena_id))
  with check (private.is_arena_admin(arena_id));

create table if not exists public.whatsapp_message_queue (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  waitlist_id uuid references public.waitlist_entries(id) on delete cascade,
  phone text not null check (phone ~ '^[0-9]{10,13}$'),
  template_key text not null
    check (template_key in ('booking_confirmation','booking_reminder','booking_followup','waitlist_available')),
  scheduled_at timestamptz not null default now(),
  status text not null default 'queued'
    check (status in ('queued','sending','sent','failed','skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  payload jsonb not null default '{}'::jsonb,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (booking_id is not null or waitlist_id is not null)
);

create unique index if not exists whatsapp_booking_template_once_key
  on public.whatsapp_message_queue (booking_id, template_key)
  where booking_id is not null;

create index if not exists whatsapp_queue_due_idx
  on public.whatsapp_message_queue (status, scheduled_at)
  where status = 'queued';

alter table public.whatsapp_message_queue enable row level security;

drop policy if exists "Arena admins can view whatsapp queue" on public.whatsapp_message_queue;
create policy "Arena admins can view whatsapp queue"
  on public.whatsapp_message_queue
  for select
  to authenticated
  using (private.is_arena_admin(arena_id));

create table if not exists private.whatsapp_worker_tokens (
  id boolean primary key default true check (id),
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

insert into private.whatsapp_worker_tokens (id)
values (true)
on conflict (id) do nothing;

create or replace function public.validate_whatsapp_worker_token(candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.whatsapp_worker_tokens
    where token = candidate
  );
$$;

revoke all on function public.validate_whatsapp_worker_token(uuid) from public;
grant execute on function public.validate_whatsapp_worker_token(uuid) to service_role;

create or replace function private.queue_booking_whatsapp_messages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  arena_timezone text;
  event_at timestamptz;
  reminder_at timestamptz;
  followup_at timestamptz;
begin
  if old.payment_status is not distinct from new.payment_status then
    return new;
  end if;

  if old.payment_status <> 'pending'
     or new.payment_status not in ('partial','paid')
     or new.status <> 'confirmed'
     or new.payment_provider <> 'mercado_pago' then
    return new;
  end if;

  select timezone into arena_timezone
  from public.arenas
  where id = new.arena_id;

  arena_timezone := coalesce(arena_timezone, 'America/Porto_Velho');

  event_at :=
    (new.booking_date::timestamp + make_interval(hours => new.start_hour))
    at time zone arena_timezone;

  reminder_at :=
    (new.booking_date::timestamp + time '09:00')
    at time zone arena_timezone;

  followup_at :=
    ((new.booking_date + 1)::timestamp + time '10:00')
    at time zone arena_timezone;

  insert into public.whatsapp_message_queue (
    arena_id, booking_id, phone, template_key, scheduled_at
  ) values (
    new.arena_id, new.id, new.customer_phone, 'booking_confirmation', now()
  )
  on conflict do nothing;

  if event_at > now() then
    insert into public.whatsapp_message_queue (
      arena_id, booking_id, phone, template_key, scheduled_at
    ) values (
      new.arena_id,
      new.id,
      new.customer_phone,
      'booking_reminder',
      greatest(reminder_at, now() + interval '2 minutes')
    )
    on conflict do nothing;
  end if;

  insert into public.whatsapp_message_queue (
    arena_id, booking_id, phone, template_key, scheduled_at
  ) values (
    new.arena_id,
    new.id,
    new.customer_phone,
    'booking_followup',
    greatest(followup_at, now() + interval '10 minutes')
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_queue_booking_whatsapp_messages on public.bookings;
create trigger trg_queue_booking_whatsapp_messages
after update of payment_status on public.bookings
for each row
execute function private.queue_booking_whatsapp_messages();

create or replace function private.queue_waitlist_on_booking_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = new.status or new.status <> 'cancelled' then
    return new;
  end if;

  insert into public.whatsapp_message_queue (
    arena_id,
    waitlist_id,
    phone,
    template_key,
    scheduled_at,
    payload
  )
  select
    w.arena_id,
    w.id,
    w.customer_phone,
    'waitlist_available',
    now(),
    jsonb_build_object('released_booking_id', new.id)
  from public.waitlist_entries w
  where w.arena_id = new.arena_id
    and w.court_id = new.court_id
    and w.booking_date = new.booking_date
    and w.status = 'waiting'
    and w.start_hour < new.start_hour + new.duration
    and w.start_hour + w.duration > new.start_hour
    and not exists (
      select 1
      from public.whatsapp_message_queue q
      where q.waitlist_id = w.id
        and q.template_key = 'waitlist_available'
        and q.status in ('queued','sending')
    );

  return new;
end;
$$;

drop trigger if exists trg_queue_waitlist_on_booking_cancel on public.bookings;
create trigger trg_queue_waitlist_on_booking_cancel
after update of status on public.bookings
for each row
execute function private.queue_waitlist_on_booking_cancel();

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'quadra-aberta-whatsapp-worker'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end;
$$;

select cron.schedule(
  'quadra-aberta-whatsapp-worker',
  '* * * * *',
  $job$
    select net.http_post(
      url := 'https://xuflojecqfvmfkoaqebv.supabase.co/functions/v1/process-whatsapp-messages',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object(
        'worker_token',
        (select token::text from private.whatsapp_worker_tokens where id = true)
      ),
      timeout_milliseconds := 20000
    );
  $job$
);
