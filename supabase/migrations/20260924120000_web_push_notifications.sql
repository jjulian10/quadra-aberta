-- Web Push: subscriptions are scoped to one arena and one administrator or reservation.
create table public.push_configuration (
  id boolean primary key default true check (id),
  worker_token uuid not null default gen_random_uuid(),
  vapid_public text,
  vapid_private text,
  created_at timestamptz not null default now()
);
alter table public.push_configuration enable row level security;
revoke all on public.push_configuration from anon, authenticated;
insert into public.push_configuration (id) values (true);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null check (length(endpoint) between 30 and 2048),
  p256dh text not null,
  auth text not null,
  arena_id uuid not null references public.arenas(id) on delete cascade,
  admin_user_id uuid references auth.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((admin_user_id is not null) <> (booking_id is not null))
);
create index push_subscriptions_admin_idx on public.push_subscriptions (arena_id, admin_user_id);
create index push_subscriptions_booking_idx on public.push_subscriptions (arena_id, booking_id);
create unique index push_subscriptions_admin_unique on public.push_subscriptions (endpoint, admin_user_id) where admin_user_id is not null;
create unique index push_subscriptions_booking_unique on public.push_subscriptions (endpoint, booking_id) where booking_id is not null;
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create table public.push_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  arena_id uuid not null references public.arenas(id) on delete cascade,
  target text not null check (target in ('admin','player')),
  kind text not null check (kind in ('confirmed','payment','cancelled','reminder','followup')),
  event_key text not null unique,
  scheduled_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued','sending','done')),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index push_events_due_idx on public.push_events (scheduled_at) where status <> 'done';
alter table public.push_events enable row level security;
revoke all on public.push_events from anon, authenticated;

create table public.push_deliveries (
  event_id uuid not null references public.push_events(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','sent','expired','failed')),
  attempts integer not null default 0,
  last_error text,
  primary key (event_id, subscription_id)
);
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from anon, authenticated;

create or replace function private.queue_booking_push() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  reminder_at timestamptz;
  followup_at timestamptz;
  arena_timezone text;
begin
  if new.status = 'confirmed' and
     (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.push_events (booking_id, arena_id, target, kind, event_key)
    values (new.id, new.arena_id, 'admin', 'confirmed', new.id::text || ':admin:confirmed'),
           (new.id, new.arena_id, 'player', 'confirmed', new.id::text || ':player:confirmed')
    on conflict (event_key) do nothing;

    select coalesce(timezone, 'America/Porto_Velho') into arena_timezone
    from public.arenas where id = new.arena_id;
    reminder_at := (new.booking_date::timestamp + time '09:00') at time zone coalesce(arena_timezone, 'America/Porto_Velho');
    followup_at := ((new.booking_date + 1)::timestamp + time '10:00') at time zone coalesce(arena_timezone, 'America/Porto_Velho');
    -- Never send a reminder for an already elapsed reservation.
    if reminder_at < ((new.booking_date::timestamp + make_interval(hours => new.start_hour)) at time zone coalesce(arena_timezone, 'America/Porto_Velho'))
       and reminder_at > now() then
      insert into public.push_events (booking_id, arena_id, target, kind, event_key, scheduled_at)
      values (new.id, new.arena_id, 'player', 'reminder', new.id::text || ':player:reminder', reminder_at)
      on conflict (event_key) do nothing;
    end if;
    if followup_at > now() then
      insert into public.push_events (booking_id, arena_id, target, kind, event_key, scheduled_at)
      values (new.id, new.arena_id, 'player', 'followup', new.id::text || ':player:followup', followup_at)
      on conflict (event_key) do nothing;
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status = 'confirmed' and
     new.payment_status in ('partial','paid') and
     old.payment_status is distinct from new.payment_status then
    insert into public.push_events (booking_id, arena_id, target, kind, event_key)
    values (new.id, new.arena_id, 'admin', 'payment', new.id::text || ':admin:payment:' || new.payment_status::text)
    on conflict (event_key) do nothing;
  end if;

  if tg_op = 'UPDATE' and new.status = 'cancelled' and old.status is distinct from new.status then
    insert into public.push_events (booking_id, arena_id, target, kind, event_key)
    values (new.id, new.arena_id, 'admin', 'cancelled', new.id::text || ':admin:cancelled'),
           (new.id, new.arena_id, 'player', 'cancelled', new.id::text || ':player:cancelled')
    on conflict (event_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.queue_booking_push() from public, anon, authenticated;
create trigger queue_booking_push after insert or update of status, payment_status
on public.bookings for each row execute function private.queue_booking_push();

select cron.schedule(
  'quadra-aberta-push-worker',
  '* * * * *',
  $job$
    select net.http_post(
      url := 'https://xuflojecqfvmfkoaqebv.supabase.co/functions/v1/process-push-notifications',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := jsonb_build_object('worker_token', (select worker_token from public.push_configuration where id = true)),
      timeout_milliseconds := 20000
    );
  $job$
);
