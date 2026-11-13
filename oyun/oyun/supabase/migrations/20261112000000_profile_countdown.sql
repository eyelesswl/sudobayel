-- ОЮН: профиль игрока (фото), обратный отсчёт и фальстарт; убираем очки.
-- Выполните в SQL Editor ПОСЛЕ двух предыдущих миграций.

-- ---- очки больше не нужны
drop function if exists public.award_point(uuid);
alter table public.teams drop column if exists score;
alter table public.rooms drop column if exists awarded;

-- ---- новые поля
alter table public.rooms   add column go_at timestamptz;   -- момент "СТАРТ" (после обратного отсчёта)
alter table public.players add column avatar text check (avatar is null or char_length(avatar) <= 40000);  -- base64 JPEG 128x128
alter table public.players add column has_avatar boolean generated always as (avatar is not null) stored;
alter table public.players add column locked_until timestamptz;  -- штраф за фальстарт

-- Штраф за фальстарт не должен будить всех участников: пульс только при изменении имени/команды/состава.
drop trigger if exists players_pulse on public.players;
create trigger players_pulse after insert or delete or update of name, team_slot, is_admin
  on public.players for each row execute function public.touch_pulse();

-- Единые часы: время считает база данных.
create or replace function public.db_now() returns timestamptz
language sql set search_path = public as $$ select clock_timestamp() $$;

-- ---- создание комнаты и вход (с фото)
drop function if exists public.create_room(text, text, text);
create or replace function public.create_room(p_code text, p_name text, p_token_hash text, p_avatar text default null)
returns json
language plpgsql
set search_path = public
as $$
declare
  v_room   uuid;
  v_player uuid;
begin
  insert into rooms (code) values (p_code) returning id into v_room;
  insert into teams (room_id, slot, color) values
    (v_room, 0, 'red'), (v_room, 1, 'blue'), (v_room, 2, 'green'), (v_room, 3, 'yellow');
  insert into players (room_id, name, is_admin, avatar) values (v_room, p_name, true, p_avatar)
  returning id into v_player;
  insert into player_secrets (player_id, token_hash) values (v_player, p_token_hash);
  return json_build_object('room_id', v_room, 'player_id', v_player);
end;
$$;

drop function if exists public.join_room(text, text, text);
create or replace function public.join_room(p_code text, p_name text, p_token_hash text, p_avatar text default null)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_room   rooms%rowtype;
  v_count  integer;
  v_player uuid;
begin
  select * into v_room from rooms where code = p_code;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.status = 'closed' then raise exception 'room_closed'; end if;
  select count(*) into v_count from players where room_id = v_room.id;
  if v_count >= 100 then raise exception 'room_full'; end if;

  insert into players (room_id, name, avatar) values (v_room.id, p_name, p_avatar) returning id into v_player;
  insert into player_secrets (player_id, token_hash) values (v_player, p_token_hash);
  return v_player;
end;
$$;

-- ---- новый раунд: отсчёт 3 секунды (go_at), вопрос берётся по порядку
create or replace function public.start_round(p_room uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_round integer;
  v_pos   integer;
begin
  select round_number + 1 into v_round from rooms where id = p_room and status <> 'closed' for update;
  if v_round is null then return; end if;

  select pos into v_pos from questions where room_id = p_room order by pos offset v_round - 1 limit 1;

  update rooms
     set status = 'active', round_number = v_round, question_pos = v_pos,
         go_at = clock_timestamp() + interval '3 seconds',
         winner_player_id = null, winner_name = null, winner_team_slot = null, winner_pressed_at = null,
         updated_at = now()
   where id = p_room;
end;
$$;

-- ---- нажатие: победитель определяется атомарным UPDATE; нажатие до go_at = фальстарт (штраф 2 с).
-- Возвращает: 'won' | 'late' | 'false_start' | 'locked' | 'no_team'
drop function if exists public.press_button(uuid, uuid);
create or replace function public.press_button(p_room uuid, p_player uuid)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_name   text;
  v_slot   smallint;
  v_locked timestamptz;
  v_status text;
  v_go     timestamptz;
  v_rows   integer;
begin
  select name, team_slot, locked_until into v_name, v_slot, v_locked
    from players where id = p_player and room_id = p_room;
  if not found or v_slot is null then return 'no_team'; end if;
  if v_locked is not null and v_locked > clock_timestamp() then return 'locked'; end if;

  select status, go_at into v_status, v_go from rooms where id = p_room;
  if v_status is distinct from 'active' then return 'late'; end if;

  if v_go is not null and v_go > clock_timestamp() then
    update players set locked_until = clock_timestamp() + interval '2 seconds' where id = p_player;
    return 'false_start';
  end if;

  update rooms
     set status = 'finished', winner_player_id = p_player, winner_name = v_name, winner_team_slot = v_slot,
         winner_pressed_at = clock_timestamp(), updated_at = now()
   where id = p_room and status = 'active' and winner_player_id is null;

  get diagnostics v_rows = row_count;
  return case when v_rows = 1 then 'won' else 'late' end;
end;
$$;

-- ---- права
revoke all on function public.db_now()                              from public, anon, authenticated;
revoke all on function public.create_room(text, text, text, text)   from public, anon, authenticated;
revoke all on function public.join_room(text, text, text, text)     from public, anon, authenticated;
revoke all on function public.start_round(uuid)                     from public, anon, authenticated;
revoke all on function public.press_button(uuid, uuid)              from public, anon, authenticated;
grant execute on function public.db_now()                              to service_role;
grant execute on function public.create_room(text, text, text, text)   to service_role;
grant execute on function public.join_room(text, text, text, text)     to service_role;
grant execute on function public.start_round(uuid)                     to service_role;
grant execute on function public.press_button(uuid, uuid)              to service_role;
