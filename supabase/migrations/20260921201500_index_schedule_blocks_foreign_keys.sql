-- Cobre as chaves estrangeiras dos bloqueios para evitar varreduras desnecessarias.

drop index if exists public.schedule_blocks_court_date_idx;
create index if not exists schedule_blocks_court_arena_date_idx
  on public.schedule_blocks (court_id, arena_id, block_date);
create index if not exists schedule_blocks_created_by_idx
  on public.schedule_blocks (created_by);
