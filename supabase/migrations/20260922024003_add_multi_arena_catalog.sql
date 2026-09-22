alter table public.arenas
  add column if not exists address text,
  add column if not exists whatsapp text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'arenas_address_length'
      and conrelid = 'public.arenas'::regclass
  ) then
    alter table public.arenas
      add constraint arenas_address_length
      check (address is null or char_length(address) between 5 and 180);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'arenas_whatsapp_format'
      and conrelid = 'public.arenas'::regclass
  ) then
    alter table public.arenas
      add constraint arenas_whatsapp_format
      check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$');
  end if;
end
$$;

update public.arenas
set address = 'Rua João Pessoa 5611, Nova Esperança | Porto Velho',
    whatsapp = '69992667022'
where slug = 'arena-vila';

insert into public.arenas (slug, name, city, timezone, active, address, whatsapp)
values
  ('arena-elsinho', 'Arena Elsinho', 'Porto Velho, RO', 'America/Porto_Velho', true, 'Rua João Pessoa 5611, Nova Esperança | Porto Velho', '69992667022'),
  ('arena-matrix', 'Arena Matrix', 'Porto Velho, RO', 'America/Porto_Velho', true, 'Rua João Pessoa 5611, Nova Esperança | Porto Velho', '69992667022')
on conflict (slug) do update
set name = excluded.name,
    city = excluded.city,
    timezone = excluded.timezone,
    active = excluded.active,
    address = excluded.address,
    whatsapp = excluded.whatsapp;

insert into public.courts (
  arena_id, name, sport, hourly_price, opening_hour, closing_hour, sort_order, active
)
select a.id, c.name, c.sport, c.hourly_price, c.opening_hour, c.closing_hour, c.sort_order, true
from public.arenas a
join (
  values
    ('arena-elsinho', 'Quadra 01', 'Vôlei', 100::numeric, 14::smallint, 23::smallint, 1::smallint),
    ('arena-elsinho', 'Quadra 02', 'Beach tennis', 120::numeric, 14::smallint, 23::smallint, 2::smallint),
    ('arena-elsinho', 'Quadra 03', 'Futsal', 150::numeric, 14::smallint, 23::smallint, 3::smallint),
    ('arena-matrix', 'Quadra 01', 'Vôlei', 100::numeric, 14::smallint, 23::smallint, 1::smallint),
    ('arena-matrix', 'Quadra 02', 'Vôlei', 100::numeric, 14::smallint, 23::smallint, 2::smallint),
    ('arena-matrix', 'Quadra 03', 'Vôlei', 100::numeric, 14::smallint, 23::smallint, 3::smallint),
    ('arena-matrix', 'Quadra 04', 'Vôlei', 100::numeric, 14::smallint, 23::smallint, 4::smallint)
) as c(slug, name, sport, hourly_price, opening_hour, closing_hour, sort_order)
  on a.slug = c.slug
on conflict (arena_id, name) do update
set sport = excluded.sport,
    hourly_price = excluded.hourly_price,
    opening_hour = excluded.opening_hour,
    closing_hour = excluded.closing_hour,
    sort_order = excluded.sort_order,
    active = true;

delete from public.courts c
using public.arenas a
where c.arena_id = a.id
  and a.slug = 'arena-matrix'
  and c.sort_order > 4;
