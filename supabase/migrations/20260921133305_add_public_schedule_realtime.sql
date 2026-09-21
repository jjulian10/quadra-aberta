-- Public Realtime signal for schedule changes. This table deliberately contains
-- no customer, payment, booking or administrative-note data.
create table public.schedule_change_events (
  arena_id uuid not null references public.arenas(id) on delete cascade,
  schedule_date date not null,
  changed_at timestamptz not null default now(),
  primary key (arena_id, schedule_date)
);

alter table public.schedule_change_events enable row level security;

create policy "Public can view active arena schedule changes"
on public.schedule_change_events
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.arenas arena
    where arena.id = schedule_change_events.arena_id
      and arena.active
  )
);

revoke all on table public.schedule_change_events from public, anon, authenticated;
grant select on table public.schedule_change_events to anon, authenticated;

create or replace function private.touch_booking_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    insert into public.schedule_change_events (arena_id, schedule_date, changed_at)
    values (old.arena_id, old.booking_date, now())
    on conflict (arena_id, schedule_date)
    do update set changed_at = excluded.changed_at;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.schedule_change_events (arena_id, schedule_date, changed_at)
    values (new.arena_id, new.booking_date, now())
    on conflict (arena_id, schedule_date)
    do update set changed_at = excluded.changed_at;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.touch_block_schedule_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    insert into public.schedule_change_events (arena_id, schedule_date, changed_at)
    values (old.arena_id, old.block_date, now())
    on conflict (arena_id, schedule_date)
    do update set changed_at = excluded.changed_at;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    insert into public.schedule_change_events (arena_id, schedule_date, changed_at)
    values (new.arena_id, new.block_date, now())
    on conflict (arena_id, schedule_date)
    do update set changed_at = excluded.changed_at;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.touch_booking_schedule_change() from public, anon, authenticated;
revoke all on function private.touch_block_schedule_change() from public, anon, authenticated;

create trigger bookings_touch_public_schedule
after insert or update or delete on public.bookings
for each row execute function private.touch_booking_schedule_change();

create trigger schedule_blocks_touch_public_schedule
after insert or update or delete on public.schedule_blocks
for each row execute function private.touch_block_schedule_change();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'schedule_change_events'
  ) then
    alter publication supabase_realtime add table public.schedule_change_events;
  end if;
end
$$;
