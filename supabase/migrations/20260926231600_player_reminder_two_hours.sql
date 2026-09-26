-- The player sees confirmation when opting in; schedule one reminder two hours
-- before the start in the arena timezone, without a duplicate server confirmation.
-- Keep admin payment/confirmation alerts and player cancellation alerts unchanged.
create or replace function private.queue_booking_push() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  booking_start_at timestamptz;
  booking_end_at timestamptz;
  reminder_at timestamptz;
  arena_timezone text;
begin
  if new.status = 'confirmed' then
    select coalesce(timezone, 'America/Porto_Velho') into arena_timezone
    from public.arenas where id = new.arena_id;
    arena_timezone := coalesce(arena_timezone, 'America/Porto_Velho');
    booking_start_at := (new.booking_date::timestamp + make_interval(hours => new.start_hour))
      at time zone arena_timezone;
    booking_end_at := booking_start_at + make_interval(hours => new.duration);

    if (tg_op = 'INSERT' or old.status is distinct from new.status)
       and booking_end_at > now() then
      insert into public.push_events (booking_id, arena_id, target, kind, event_key)
      values (new.id, new.arena_id, 'admin', 'confirmed', new.id::text || ':admin:confirmed')
      on conflict (event_key) do nothing;
    end if;

    if tg_op = 'INSERT' or old.status is distinct from new.status
       or old.booking_date is distinct from new.booking_date
       or old.start_hour is distinct from new.start_hour then
      reminder_at := booking_start_at - interval '2 hours';
      if reminder_at > now() then
        insert into public.push_events (booking_id, arena_id, target, kind, event_key, scheduled_at)
        values (new.id, new.arena_id, 'player', 'reminder', new.id::text || ':player:reminder', reminder_at)
        on conflict (event_key) do update set scheduled_at = excluded.scheduled_at
          where push_events.status = 'queued';
      else
        -- A late booking or move must not leave an obsolete reminder in the queue.
        -- Remove only unsent events so a later move can schedule the first reminder.
        delete from public.push_events
        where event_key = new.id::text || ':player:reminder' and status = 'queued';
      end if;
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
    delete from public.push_events
    where event_key = new.id::text || ':player:reminder' and status = 'queued';
    insert into public.push_events (booking_id, arena_id, target, kind, event_key)
    values (new.id, new.arena_id, 'admin', 'cancelled', new.id::text || ':admin:cancelled'),
           (new.id, new.arena_id, 'player', 'cancelled', new.id::text || ':player:cancelled')
    on conflict (event_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.queue_booking_push() from public, anon, authenticated;

drop trigger if exists queue_booking_push on public.bookings;
create trigger queue_booking_push after insert or update of status, payment_status, booking_date, start_hour
on public.bookings for each row execute function private.queue_booking_push();

-- Replace the old 09h schedule for pending reminders. Never resend a done event.
update public.push_events e
set scheduled_at = ((b.booking_date::timestamp + make_interval(hours => b.start_hour))
                     at time zone coalesce(a.timezone, 'America/Porto_Velho')) - interval '2 hours'
from public.bookings b join public.arenas a on a.id = b.arena_id
where e.booking_id = b.id and e.target = 'player' and e.kind = 'reminder'
  and e.status = 'queued' and b.status = 'confirmed'
  and ((b.booking_date::timestamp + make_interval(hours => b.start_hour))
    at time zone coalesce(a.timezone, 'America/Porto_Velho')) > now() + interval '2 hours';

delete from public.push_events e using public.bookings b, public.arenas a
where e.booking_id = b.id and a.id = b.arena_id and e.target = 'player'
  and e.kind = 'reminder' and e.status = 'queued'
  and (b.status <> 'confirmed' or
    ((b.booking_date::timestamp + make_interval(hours => b.start_hour))
      at time zone coalesce(a.timezone, 'America/Porto_Velho')) <= now() + interval '2 hours');

-- Future confirmed bookings without a reminder (including late-day bookings).
insert into public.push_events (booking_id, arena_id, target, kind, event_key, scheduled_at)
select b.id, b.arena_id, 'player', 'reminder', b.id::text || ':player:reminder',
  ((b.booking_date::timestamp + make_interval(hours => b.start_hour))
    at time zone coalesce(a.timezone, 'America/Porto_Velho')) - interval '2 hours'
from public.bookings b join public.arenas a on a.id = b.arena_id
where b.status = 'confirmed' and
  ((b.booking_date::timestamp + make_interval(hours => b.start_hour))
    at time zone coalesce(a.timezone, 'America/Porto_Velho')) > now() + interval '2 hours'
on conflict (event_key) do nothing;

-- Old queued player confirmations would duplicate the on-device confirmation.
update public.push_events set status = 'done'
where target = 'player' and kind = 'confirmed' and status = 'queued';

-- Exactly one scheduled reminder; remove the old next-day follow-up.
update public.push_events set status = 'done'
where target = 'player' and kind = 'followup' and status = 'queued';
