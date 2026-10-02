-- Allow authenticated arena administrators to read and update waitlist entries.
-- Row-level security policies continue restricting access to each administrator's arena.
grant select, update on table public.waitlist_entries to authenticated;
