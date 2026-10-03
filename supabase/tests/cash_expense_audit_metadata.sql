-- Run in a transaction; no synthetic records are retained.
begin;
do $setup$
declare actor uuid; arena uuid;
begin
  select aa.user_id, aa.arena_id into actor, arena
  from public.arena_admins aa join public.arenas a on a.id=aa.arena_id
  where a.active limit 1;
  if actor is null then raise exception 'No active arena admin available for test'; end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('qa.cash_test_arena', arena::text, true);
end;
$setup$;
set local role authenticated;
do $test$
declare
  arena uuid := current_setting('qa.cash_test_arena')::uuid;
  actor uuid := auth.uid();
  expense uuid;
  record_row public.cash_expenses;
  test_date date;
  affected integer;
  denied boolean;
begin
  select d::date into test_date
  from generate_series(date '2099-01-01',date '2099-12-31',interval '1 day') d
  where private.cash_day_is_open(arena,d::date) limit 1;
  if test_date is null then raise exception 'No open test date'; end if;
  insert into public.cash_expenses(arena_id,expense_date,description,amount,created_by,created_at,updated_at)
  values(arena,test_date,'Security regression - rolled back',1,gen_random_uuid(),'2000-01-01','2000-01-01')
  returning * into record_row;
  expense := record_row.id;
  if record_row.created_by is distinct from actor or record_row.created_at < transaction_timestamp()
    or record_row.updated_at is distinct from record_row.created_at then
    raise exception 'Forged insertion audit fields were accepted';
  end if;
  update public.cash_expenses set description='Edited regression - rolled back',amount=2 where id=expense;
  get diagnostics affected = row_count;
  if affected<>1 then raise exception 'Legitimate update failed'; end if;
  denied:=false;
  begin
    update public.cash_expenses set created_by=null where id=expense;
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'Author update was allowed'; end if;
  denied:=false;
  begin
    update public.cash_expenses set created_at='2000-01-01' where id=expense;
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'Creation date update was allowed'; end if;
  if has_table_privilege(current_user,'public.cash_expenses','TRUNCATE')
    or has_table_privilege(current_user,'public.cash_expenses','TRIGGER') then
    raise exception 'Unsafe table privileges remain';
  end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  update public.cash_expenses set amount=3 where id=expense;
  get diagnostics affected = row_count;
  if affected<>0 then raise exception 'Unauthorized update was allowed'; end if;
  denied:=false;
  begin
    insert into public.cash_expenses(arena_id,expense_date,description,amount)
    values(arena,test_date,'Unauthorized regression',1);
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'Unauthorized insert was allowed'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  select * into record_row from public.cash_expenses where id=expense;
  if record_row.created_by is distinct from actor or record_row.amount<>2 then
    raise exception 'Audit metadata or legitimate update not preserved';
  end if;
end;
$test$;
reset role;
rollback;
