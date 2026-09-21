-- Permite que administradores bloqueiem um horario ou um dia inteiro.

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas(id) on delete cascade,
  court_id uuid,
  block_date date not null,
  start_hour smallint,
  duration smallint,
  reason text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint schedule_block_court_belongs_to_arena foreign key (court_id, arena_id)
    references public.courts(id, arena_id) on delete cascade,
  constraint schedule_block_period_valid check (
    (start_hour is null and duration is null)
    or (start_hour between 0 and 23 and duration between 1 and 24 and start_hour + duration <= 24)
  ),
  constraint schedule_block_reason_length check (reason is null or char_length(reason) <= 300)
);

create index schedule_blocks_arena_date_idx on public.schedule_blocks (arena_id, block_date);
create index schedule_blocks_court_arena_date_idx on public.schedule_blocks (court_id, arena_id, block_date);
create index schedule_blocks_created_by_idx on public.schedule_blocks (created_by);
alter table public.schedule_blocks enable row level security;

create policy "Admins can view schedule blocks" on public.schedule_blocks for select to authenticated
using (private.is_arena_admin(arena_id));
create policy "Admins can create schedule blocks" on public.schedule_blocks for insert to authenticated
with check (private.is_arena_admin(arena_id) and created_by = (select auth.uid()));
create policy "Admins can update schedule blocks" on public.schedule_blocks for update to authenticated
using (private.is_arena_admin(arena_id)) with check (private.is_arena_admin(arena_id));
create policy "Admins can delete schedule blocks" on public.schedule_blocks for delete to authenticated
using (private.is_arena_admin(arena_id));

grant select, insert, update, delete on public.schedule_blocks to authenticated;
revoke all on public.schedule_blocks from anon;

create or replace function private.assert_booking_not_blocked()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('pending', 'confirmed') and exists (
    select 1 from public.schedule_blocks block
    where block.arena_id = new.arena_id and block.block_date = new.booking_date
      and (block.court_id is null or block.court_id = new.court_id)
      and (block.start_hour is null or int4range(block.start_hour, block.start_hour + block.duration, '[)') && int4range(new.start_hour, new.start_hour + new.duration, '[)'))
  ) then
    raise exception 'Este horario foi bloqueado pelo administrador.';
  end if;
  return new;
end;
$$;
revoke all on function private.assert_booking_not_blocked() from public, anon, authenticated;
create trigger bookings_reject_schedule_block
before insert or update of arena_id, court_id, booking_date, start_hour, duration, status on public.bookings
for each row execute function private.assert_booking_not_blocked();

create or replace function private.assert_block_has_no_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.bookings booking
    where booking.arena_id = new.arena_id and booking.booking_date = new.block_date
      and booking.status in ('pending', 'confirmed')
      and (new.court_id is null or new.court_id = booking.court_id)
      and (new.start_hour is null or int4range(new.start_hour, new.start_hour + new.duration, '[)') && int4range(booking.start_hour, booking.start_hour + booking.duration, '[)'))
  ) then
    raise exception 'Existem reservas ativas neste periodo. Cancele-as antes de bloquear a agenda.';
  end if;
  return new;
end;
$$;
revoke all on function private.assert_block_has_no_booking() from public, anon, authenticated;
create trigger schedule_blocks_reject_active_booking
before insert or update of arena_id, court_id, block_date, start_hour, duration on public.schedule_blocks
for each row execute function private.assert_block_has_no_booking();

create or replace function private.get_public_schedule_v2_impl(target_arena_slug text, target_date date)
returns table (court_id uuid, start_hour smallint, duration smallint, status public.booking_status, entry_type text)
language sql stable security definer set search_path = '' as $$
  select booking.court_id, booking.start_hour, booking.duration, booking.status, 'booking'::text
  from public.bookings booking join public.arenas arena on arena.id = booking.arena_id
  where arena.slug = target_arena_slug and arena.active and booking.booking_date = target_date
    and booking.status in ('pending', 'confirmed')
  union all
  select court.id, coalesce(block.start_hour, court.opening_hour)::smallint,
         coalesce(block.duration, court.closing_hour - court.opening_hour)::smallint,
         'confirmed'::public.booking_status, 'block'::text
  from public.schedule_blocks block
  join public.arenas arena on arena.id = block.arena_id
  join public.courts court on court.arena_id = block.arena_id and (block.court_id is null or block.court_id = court.id)
  where arena.slug = target_arena_slug and arena.active and court.active and block.block_date = target_date;
$$;

create or replace function public.get_public_schedule_v2(target_arena_slug text, target_date date)
returns table (court_id uuid, start_hour smallint, duration smallint, status public.booking_status, entry_type text)
language sql stable security invoker set search_path = '' as $$
  select * from private.get_public_schedule_v2_impl(target_arena_slug, target_date);
$$;

revoke all on function private.get_public_schedule_v2_impl(text, date) from public, anon, authenticated;
revoke all on function public.get_public_schedule_v2(text, date) from public, anon, authenticated;
grant execute on function private.get_public_schedule_v2_impl(text, date) to anon, authenticated;
grant execute on function public.get_public_schedule_v2(text, date) to anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'schedule_blocks') then
    alter publication supabase_realtime add table public.schedule_blocks;
  end if;
end
$$;

notify pgrst, 'reload schema';
