create table if not exists public.arena_announcements (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.arenas(id) on delete cascade,
  template_key text,
  announcement_type text not null default 'promotion'
    check (announcement_type in ('promotion', 'notice', 'event')),
  title text not null
    check (char_length(btrim(title)) between 3 and 100),
  description text not null
    check (char_length(btrim(description)) between 5 and 500),
  image_path text,
  link_url text
    check (link_url is null or link_url ~ '^https://'),
  cta_label text not null default 'Ver detalhes'
    check (char_length(btrim(cta_label)) between 2 and 40),
  starts_on date not null default current_date,
  ends_on date not null default (current_date + 7),
  is_featured boolean not null default false,
  active boolean not null default false,
  sort_order integer not null default 0
    check (sort_order between 0 and 999),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arena_announcements_date_range check (ends_on >= starts_on),
  constraint arena_announcements_template_unique unique (arena_id, template_key)
);

create index if not exists arena_announcements_arena_idx
  on public.arena_announcements (arena_id, active, starts_on, ends_on);

create index if not exists arena_announcements_featured_idx
  on public.arena_announcements (arena_id, is_featured, active);

drop trigger if exists arena_announcements_set_updated_at on public.arena_announcements;
create trigger arena_announcements_set_updated_at
before update on public.arena_announcements
for each row execute function public.set_updated_at();

alter table public.arena_announcements enable row level security;

drop policy if exists "Public can view published arena announcements" on public.arena_announcements;
create policy "Public can view published arena announcements"
on public.arena_announcements for select
to anon
using (
  active
  and current_date between starts_on and ends_on
  and exists (
    select 1
    from public.arenas a
    where a.id = arena_id
      and a.active
      and a.public_access
  )
);

drop policy if exists "Arena admins can view announcements" on public.arena_announcements;
create policy "Arena admins can view announcements"
on public.arena_announcements for select
to authenticated
using (private.is_arena_admin(arena_id));

drop policy if exists "Arena admins can create announcements" on public.arena_announcements;
create policy "Arena admins can create announcements"
on public.arena_announcements for insert
to authenticated
with check (private.is_arena_admin(arena_id));

drop policy if exists "Arena admins can update announcements" on public.arena_announcements;
create policy "Arena admins can update announcements"
on public.arena_announcements for update
to authenticated
using (private.is_arena_admin(arena_id))
with check (private.is_arena_admin(arena_id));

drop policy if exists "Arena admins can delete announcements" on public.arena_announcements;
create policy "Arena admins can delete announcements"
on public.arena_announcements for delete
to authenticated
using (private.is_arena_admin(arena_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'announcement-images',
  'announcement-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Arena admins can upload announcement images" on storage.objects;
create policy "Arena admins can upload announcement images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'announcement-images'
  and exists (
    select 1
    from public.arena_admins aa
    join public.arenas a on a.id = aa.arena_id
    where aa.user_id = (select auth.uid())
      and a.active
      and aa.arena_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "Arena admins can update announcement images" on storage.objects;
create policy "Arena admins can update announcement images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'announcement-images'
  and exists (
    select 1
    from public.arena_admins aa
    join public.arenas a on a.id = aa.arena_id
    where aa.user_id = (select auth.uid())
      and a.active
      and aa.arena_id::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'announcement-images'
  and exists (
    select 1
    from public.arena_admins aa
    join public.arenas a on a.id = aa.arena_id
    where aa.user_id = (select auth.uid())
      and a.active
      and aa.arena_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "Arena admins can delete announcement images" on storage.objects;
create policy "Arena admins can delete announcement images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'announcement-images'
  and exists (
    select 1
    from public.arena_admins aa
    join public.arenas a on a.id = aa.arena_id
    where aa.user_id = (select auth.uid())
      and a.active
      and aa.arena_id::text = (storage.foldername(name))[1]
  )
);

create or replace function public.seed_arena_announcement_templates(target_arena_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.arena_announcements (
    arena_id, template_key, announcement_type, title, description,
    cta_label, starts_on, ends_on, is_featured, active, sort_order
  )
  values
    (
      target_arena_id,
      'example-football-night',
      'promotion',
      'Promoção Futebol Noturno',
      'Quadras com 20% de desconto das 18h às 22h! Chame os amigos e garanta seu horário.',
      'Reservar agora',
      current_date,
      current_date + 30,
      true,
      false,
      10
    ),
    (
      target_arena_id,
      'example-futsal-tournament',
      'event',
      'Torneio de Futsal',
      'Vagas abertas! Monte seu time e participe. Inscrições e informações diretamente com a arena.',
      'Ver detalhes',
      current_date,
      current_date + 30,
      false,
      false,
      20
    ),
    (
      target_arena_id,
      'example-new-lighting',
      'notice',
      'Nova iluminação nas quadras',
      'Mais conforto e segurança para seus jogos. Conheça as melhorias realizadas pela arena.',
      'Saiba mais',
      current_date,
      current_date + 30,
      false,
      false,
      30
    )
  on conflict (arena_id, template_key) do nothing;
end;
$$;

revoke all on function public.seed_arena_announcement_templates(uuid) from public, anon, authenticated;

do $$
declare
  current_arena record;
begin
  for current_arena in select id from public.arenas loop
    perform public.seed_arena_announcement_templates(current_arena.id);
  end loop;
end
$$;

create or replace function public.seed_new_arena_announcement_templates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_arena_announcement_templates(new.id);
  return new;
end;
$$;

drop trigger if exists arenas_seed_announcement_templates on public.arenas;
create trigger arenas_seed_announcement_templates
after insert on public.arenas
for each row execute function public.seed_new_arena_announcement_templates();

notify pgrst, 'reload schema';
