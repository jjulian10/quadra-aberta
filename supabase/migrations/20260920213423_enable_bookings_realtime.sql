-- Mantém a agenda administrativa sincronizada sem recarregar a página.
-- A leitura dos eventos continua protegida pelas políticas RLS de bookings.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end
$$;
