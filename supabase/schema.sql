-- Quadra Aberta — estrutura inicial do Supabase
-- Execute este arquivo no SQL Editor de um projeto Supabase novo.

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
do $$
begin
  if exists (
    select 1
    from pg_extension extension_record
    join pg_namespace namespace_record
      on namespace_record.oid = extension_record.extnamespace
    where extension_record.extname = 'btree_gist'
      and namespace_record.nspname = 'public'
  ) then
    alter extension btree_gist set schema extensions;
  end if;
end $$;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$
begin
  create type public.booking_status as enum ('pending', 'confirmed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_status as enum ('pending', 'paid', 'refunded');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.arenas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 2 and 80),
  city text not null default 'Porto Velho, RO',
  timezone text not null default 'America/Porto_Velho',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  sport text not null check (char_length(sport) between 2 and 60),
  hourly_price numeric(10, 2) not null check (hourly_price >= 0),
  opening_hour smallint not null default 14 check (opening_hour between 0 and 23),
  closing_hour smallint not null default 23 check (closing_hour between 1 and 24),
  sort_order smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, arena_id),
  unique (arena_id, name),
  check (closing_hour > opening_hour)
);

create table if not exists public.arena_admins (
  arena_id uuid not null references public.arenas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  primary key (arena_id, user_id)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas(id) on delete cascade,
  court_id uuid not null,
  booking_date date not null,
  start_hour smallint not null check (start_hour between 0 and 23),
  duration smallint not null check (duration between 1 and 3),
  customer_name text not null check (char_length(customer_name) between 2 and 70),
  customer_phone text not null check (customer_phone ~ '^[0-9]{10,13}$'),
  status public.booking_status not null default 'pending',
  payment_status public.payment_status not null default 'pending',
  amount numeric(10, 2) not null check (amount >= 0),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_court_belongs_to_arena
    foreign key (court_id, arena_id)
    references public.courts(id, arena_id)
    on delete restrict,
  constraint booking_inside_same_day check (start_hour + duration <= 24),
  constraint booking_no_time_overlap exclude using gist (
    court_id with =,
    booking_date with =,
    int4range(start_hour, start_hour + duration, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);

create index if not exists bookings_arena_date_idx
  on public.bookings (arena_id, booking_date);

create index if not exists bookings_status_idx
  on public.bookings (arena_id, status, payment_status);

create index if not exists bookings_court_arena_idx
  on public.bookings (court_id, arena_id);

create index if not exists courts_arena_idx
  on public.courts (arena_id);

create index if not exists arena_admins_user_idx
  on public.arena_admins (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arenas_set_updated_at on public.arenas;
create trigger arenas_set_updated_at
before update on public.arenas
for each row execute function public.set_updated_at();

drop trigger if exists courts_set_updated_at on public.courts;
create trigger courts_set_updated_at
before update on public.courts
for each row execute function public.set_updated_at();

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

create or replace function private.is_arena_admin(target_arena_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.arena_admins
    where arena_id = target_arena_id
      and user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_arena_admin(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_arena_admin(uuid) to authenticated;

create or replace function public.get_public_schedule(
  target_arena_slug text,
  target_date date
)
returns table (
  court_id uuid,
  start_hour smallint,
  duration smallint,
  status public.booking_status
)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.court_id, b.start_hour, b.duration, b.status
  from public.bookings b
  join public.arenas a on a.id = b.arena_id
  where a.slug = target_arena_slug
    and a.active
    and b.booking_date = target_date
    and b.status in ('pending', 'confirmed');
$$;

create or replace function public.create_public_booking(
  target_arena_slug text,
  target_court_id uuid,
  target_date date,
  target_start_hour smallint,
  target_duration smallint,
  target_customer_name text,
  target_customer_phone text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_arena public.arenas%rowtype;
  selected_court public.courts%rowtype;
  normalized_phone text;
  new_booking_id uuid;
begin
  normalized_phone := regexp_replace(target_customer_phone, '[^0-9]', '', 'g');

  if target_date < current_date then
    raise exception 'Não é possível reservar uma data passada.';
  end if;

  if target_duration not between 1 and 3 then
    raise exception 'A duração deve ser de uma a três horas.';
  end if;

  if char_length(trim(target_customer_name)) not between 2 and 70 then
    raise exception 'Informe o nome do responsável.';
  end if;

  if normalized_phone !~ '^[0-9]{10,13}$' then
    raise exception 'Informe um celular válido com DDD.';
  end if;

  select * into selected_arena
  from public.arenas
  where slug = target_arena_slug and active;

  if not found then
    raise exception 'Arena indisponível.';
  end if;

  select * into selected_court
  from public.courts
  where id = target_court_id
    and arena_id = selected_arena.id
    and active;

  if not found then
    raise exception 'Quadra indisponível.';
  end if;

  if target_start_hour < selected_court.opening_hour
    or target_start_hour + target_duration > selected_court.closing_hour then
    raise exception 'Horário fora do funcionamento da quadra.';
  end if;

  new_booking_id := gen_random_uuid();

  insert into public.bookings (
    id,
    arena_id,
    court_id,
    booking_date,
    start_hour,
    duration,
    customer_name,
    customer_phone,
    amount
  ) values (
    new_booking_id,
    selected_arena.id,
    selected_court.id,
    target_date,
    target_start_hour,
    target_duration,
    trim(target_customer_name),
    normalized_phone,
    selected_court.hourly_price * target_duration
  );

  return new_booking_id;
exception
  when exclusion_violation then
    raise exception 'Este horário acabou de ser reservado. Escolha outro.';
end;
$$;

alter table public.arenas enable row level security;
alter table public.courts enable row level security;
alter table public.arena_admins enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "Public can view active arenas" on public.arenas;
create policy "Public can view active arenas"
on public.arenas for select
to anon
using (active);

drop policy if exists "Admins can view their arena" on public.arenas;
create policy "Admins can view their arena"
on public.arenas for select
to authenticated
using (active or private.is_arena_admin(id));

drop policy if exists "Admins can update their arena" on public.arenas;
create policy "Admins can update their arena"
on public.arenas for update
to authenticated
using (private.is_arena_admin(id))
with check (private.is_arena_admin(id));

drop policy if exists "Public can view active courts" on public.courts;
create policy "Public can view active courts"
on public.courts for select
to anon
using (active);

drop policy if exists "Admins can view their courts" on public.courts;
create policy "Admins can view their courts"
on public.courts for select
to authenticated
using (active or private.is_arena_admin(arena_id));

drop policy if exists "Admins can manage courts" on public.courts;
drop policy if exists "Admins can create courts" on public.courts;
create policy "Admins can create courts"
on public.courts for insert
to authenticated
with check (private.is_arena_admin(arena_id));

drop policy if exists "Admins can update courts" on public.courts;
create policy "Admins can update courts"
on public.courts for update
to authenticated
using (private.is_arena_admin(arena_id))
with check (private.is_arena_admin(arena_id));

drop policy if exists "Admins can delete courts" on public.courts;
create policy "Admins can delete courts"
on public.courts for delete
to authenticated
using (private.is_arena_admin(arena_id));

drop policy if exists "Admins can view memberships" on public.arena_admins;
create policy "Admins can view memberships"
on public.arena_admins for select
to authenticated
using (user_id = (select auth.uid()) or private.is_arena_admin(arena_id));

drop policy if exists "Admins can manage bookings" on public.bookings;
create policy "Admins can manage bookings"
on public.bookings for all
to authenticated
using (private.is_arena_admin(arena_id))
with check (private.is_arena_admin(arena_id));

drop policy if exists "Public can view occupied slots" on public.bookings;
create policy "Public can view occupied slots"
on public.bookings for select
to anon
using (
  status in ('pending', 'confirmed')
  and exists (
    select 1
    from public.arenas
    where arenas.id = bookings.arena_id
      and arenas.active
  )
);

drop policy if exists "Public can request bookings" on public.bookings;
create policy "Public can request bookings"
on public.bookings for insert
to anon
with check (
  status = 'pending'
  and payment_status = 'pending'
  and booking_date >= current_date
  and exists (
    select 1
    from public.courts
    join public.arenas on arenas.id = courts.arena_id
    where courts.id = bookings.court_id
      and courts.arena_id = bookings.arena_id
      and courts.active
      and arenas.active
      and bookings.start_hour >= courts.opening_hour
      and bookings.start_hour + bookings.duration <= courts.closing_hour
      and bookings.amount = courts.hourly_price * bookings.duration
  )
);

grant usage on schema public to anon, authenticated;
grant select on public.arenas, public.courts to anon, authenticated;
grant select (arena_id, court_id, booking_date, start_hour, duration, status)
  on public.bookings to anon;
grant insert on public.bookings to anon;
grant select on public.arena_admins to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;
grant insert, update, delete on public.courts to authenticated;
grant update on public.arenas to authenticated;

revoke all on function public.get_public_schedule(text, date) from public;
revoke all on function public.create_public_booking(text, uuid, date, smallint, smallint, text, text) from public;
grant execute on function public.get_public_schedule(text, date) to anon, authenticated;
grant execute on function public.create_public_booking(text, uuid, date, smallint, smallint, text, text) to anon, authenticated;

insert into public.arenas (id, slug, name, city)
values (
  '10000000-0000-4000-8000-000000000001',
  'arena-vila',
  'Arena Vila',
  'Porto Velho, RO'
)
on conflict (slug) do update
set name = excluded.name,
    city = excluded.city;

insert into public.courts (
  id,
  arena_id,
  name,
  sport,
  hourly_price,
  opening_hour,
  closing_hour,
  sort_order
)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Quadra 01', 'Vôlei', 100, 14, 23, 1),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Quadra 02', 'Beach tennis', 120, 14, 23, 2),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Quadra 03', 'Futsal', 150, 14, 23, 3)
on conflict (arena_id, name) do update
set sport = excluded.sport,
    hourly_price = excluded.hourly_price,
    opening_hour = excluded.opening_hour,
    closing_hour = excluded.closing_hour,
    sort_order = excluded.sort_order;

-- Depois de criar o primeiro usuário em Authentication > Users,
-- vincule-o como administrador substituindo o UUID abaixo:
-- insert into public.arena_admins (arena_id, user_id, role)
-- values (
--   '10000000-0000-4000-8000-000000000001',
--   'UUID-DO-USUARIO',
--   'owner'
-- );
