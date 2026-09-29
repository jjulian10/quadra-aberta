-- Keep the one-arena-per-administrator invariant enforced under concurrent invitations.
create unique index if not exists arena_admins_one_arena_per_user_idx on public.arena_admins(user_id);

-- Compare reservations against the arena's local calendar day.
create or replace function public.master_save_court(p_arena_id uuid, p_court_id uuid, p_data jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public.courts%rowtype;
result_id uuid; next_name text; next_sport text; next_price numeric;
next_open integer; next_close integer; next_active boolean; arena_today date;
begin
  if not private.is_platform_admin(auth.uid()) then
    raise exception 'Acesso restrito ao administrador da plataforma' using errcode = '42501';
  end if;
  select (now() at time zone a.timezone)::date into arena_today from public.arenas a where a.id = p_arena_id;
  if arena_today is null then
    raise exception 'Arena não encontrada' using errcode = 'P0002';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or
     jsonb_typeof(p_data->'active') is distinct from 'boolean' then
    raise exception 'Dados da quadra inválidos' using errcode = '22023';
  end if;
  next_name := btrim(p_data->>'name'); next_sport := btrim(p_data->>'sport');
  if coalesce(p_data->>'hourly_price','') !~ '^\d+(\.\d{1,2})?$' or
     coalesce(p_data->>'opening_hour','') !~ '^\d{1,2}$' or
     coalesce(p_data->>'closing_hour','') !~ '^\d{1,2}$' then
    raise exception 'Preço ou horário inválido' using errcode = '22023';
  end if;
  next_price := (p_data->>'hourly_price')::numeric;
  next_open := (p_data->>'opening_hour')::integer;
  next_close := (p_data->>'closing_hour')::integer;
  next_active := (p_data->>'active')::boolean;
  if coalesce(char_length(next_name) between 2 and 60,false) = false or
     coalesce(char_length(next_sport) between 2 and 60,false) = false or
     next_open < 0 or next_open > 23 or next_close < 1 or next_close > 24 or next_close <= next_open then
    raise exception 'Revise os dados da quadra' using errcode = '22023';
  end if;
  if p_court_id is null then
    if not next_active then raise exception 'Nova quadra deve estar ativa' using errcode = '22023'; end if;
    insert into public.courts(arena_id,name,sport,hourly_price,opening_hour,closing_hour,sort_order,active)
    values (p_arena_id,next_name,next_sport,next_price,next_open,next_close,
      coalesce((select max(sort_order)+1 from public.courts where arena_id=p_arena_id),1),true) returning id into result_id;
    insert into public.master_arena_audit(arena_id,actor_user_id,action,details)
    values (p_arena_id,auth.uid(),'court.created',jsonb_build_object('court_id',result_id,'name',next_name));
  else
    select * into previous from public.courts where id=p_court_id and arena_id=p_arena_id for update;
    if not found then raise exception 'Quadra não encontrada' using errcode = 'P0002'; end if;
    if exists (select 1 from public.bookings b where b.court_id=p_court_id and b.booking_date>=arena_today
      and b.status in ('pending','confirmed') and (not next_active or b.start_hour<next_open or b.start_hour+b.duration>next_close)) then
      raise exception 'Há reservas futuras fora do novo horário ou em uma quadra desativada' using errcode = '22023';
    end if;
    if not next_active and previous.active and not exists (
      select 1 from public.courts c where c.arena_id=p_arena_id and c.id<>p_court_id and c.active
    ) then raise exception 'A arena precisa manter ao menos uma quadra ativa' using errcode = '22023'; end if;
    result_id := p_court_id;
    if (previous.name,previous.sport,previous.hourly_price,previous.opening_hour,previous.closing_hour,previous.active)
       is distinct from (next_name,next_sport,next_price,next_open,next_close,next_active) then
      update public.courts set name=next_name,sport=next_sport,hourly_price=next_price,
        opening_hour=next_open,closing_hour=next_close,active=next_active where id=p_court_id;
      insert into public.master_arena_audit(arena_id,actor_user_id,action,details)
      values (p_arena_id,auth.uid(),'court.updated',jsonb_build_object('court_id',result_id,'name',next_name,
        'before',jsonb_build_object('name',previous.name,'sport',previous.sport,'hourly_price',previous.hourly_price,'opening_hour',previous.opening_hour,'closing_hour',previous.closing_hour,'active',previous.active),
        'after',jsonb_build_object('name',next_name,'sport',next_sport,'hourly_price',next_price,'opening_hour',next_open,'closing_hour',next_close,'active',next_active)));
    end if;
  end if;
  return result_id;
end; $$;
revoke all on function public.master_save_court(uuid,uuid,jsonb) from public;
grant execute on function public.master_save_court(uuid,uuid,jsonb) to authenticated;
