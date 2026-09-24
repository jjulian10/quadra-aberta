-- Lembrete no dia para reservas confirmadas após as 09h.
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
       and ((new.booking_date::timestamp + make_interval(hours => new.start_hour)) at time zone coalesce(arena_timezone, 'America/Porto_Velho')) > now() + interval '5 minutes' then
      insert into public.push_events (booking_id, arena_id, target, kind, event_key, scheduled_at)
      values (new.id, new.arena_id, 'player', 'reminder', new.id::text || ':player:reminder', greatest(reminder_at, now() + interval '5 minutes'))
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
