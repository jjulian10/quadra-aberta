-- Libera automaticamente, a cada minuto, horários cujo Pix venceu.
create extension if not exists pg_cron;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'expire-pix-bookings';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'expire-pix-bookings',
    '* * * * *',
    'select private.cancel_expired_pix_bookings();'
  );
end;
$$;
