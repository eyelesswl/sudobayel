-- ОЮН: начальная схема базы данных
-- Выполните целиком в Supabase Dashboard -> SQL Editor (или через `supabase db push`).

-- ---------------------------------------------------------------- таблицы

create table public.rooms (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  status            text not null default 'idle'
                      check (status in ('idle', 'active', 'finished', 'closed')),
  round_number      integer not null default 0,
  -- победитель текущего раунда (имя и команда копируются, чтобы пережить удаление игрока)
  winner_player_id  uuid,
  winner_name       text,
  winner_team_slot  smallint check (winner_team_slot between 0 and 3),
  winner_pressed_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.teams (
  room_id uuid not null references public.rooms(id) on delete cascade,
  slot    smallint not null check (slot between 0 and 3),
  color   text not null check (color in ('red', 'blue', 'green', 'yellow')),
  name    text check (name is null or char_length(name) between 1 and 20),  -- null = название по умолчанию
  primary key (room_id, slot)
);

create table public.players (
  id        uuid primary key default gen_random_uuid(),
  room_id   uuid not null references public.rooms(id) on delete cascade,
  name      text not null check (char_length(name) between 1 and 24),
  team_slot smallint check (team_slot between 0 and 3),
  is_admin  boolean not null default false,
  joined_at timestamptz not null default now()
);

create unique index players_room_name_uniq on public.players (room_id, lower(name));
create unique index players_one_admin_per_room on public.players (room_id) where is_admin;
create index players_room_idx on public.players (room_id);

-- Секретные токены игроков (хранится только SHA-256 хэш). Недоступны из браузера.
create table public.player_secrets (
  player_id  uuid primary key references public.players(id) on delete cascade,
  token_hash text not null
);

-- Таблица-"пульс" для Realtime: клиент слушает только её и перечитывает состояние через API.
-- Так в браузер никогда не попадают коды комнат, токены и прочие данные.
create table public.room_pulse (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  version bigint not null default 0
);

-- ---------------------------------------------------------------- триггеры пульса

create or replace function public.touch_pulse() returns trigger
language plpgsql
set search_path = public
as $$
declare
  rid uuid;
begin
  if tg_table_name = 'rooms' then
    rid := new.id;
  elsif tg_op = 'DELETE' then
    rid := old.room_id;
  else
    rid := new.room_id;
  end if;

  -- при каскадном удалении комнаты её уже нет: пропускаем
  if not exists (select 1 from public.rooms where id = rid) then
    return null;
  end if;

  insert into public.room_pulse (room_id, version) values (rid, 1)
  on conflict (room_id) do update set version = public.room_pulse.version + 1;
  return null;
end;
$$;

create trigger rooms_pulse   after insert or update            on public.rooms   for each row execute function public.touch_pulse();
create trigger players_pulse after insert or update or delete  on public.players for each row execute function public.touch_pulse();
create trigger teams_pulse   after update                      on public.teams   for each row execute function public.touch_pulse();

-- ---------------------------------------------------------------- функции

-- Создание комнаты: комната + 4 команды + администратор — одной транзакцией.
create or replace function public.create_room(p_code text, p_name text, p_token_hash text)
returns json
language plpgsql
set search_path = public
as $$
declare
  v_room   uuid;
  v_player uuid;
begin
  insert into rooms (code) values (p_code) returning id into v_room;  -- unique_violation при коллизии кода

  insert into teams (room_id, slot, color) values
    (v_room, 0, 'red'), (v_room, 1, 'blue'), (v_room, 2, 'green'), (v_room, 3, 'yellow');

  insert into players (room_id, name, is_admin) values (v_room, p_name, true)
  returning id into v_player;

  insert into player_secrets (player_id, token_hash) values (v_player, p_token_hash);

  return json_build_object('room_id', v_room, 'player_id', v_player);
end;
$$;

-- Вход в комнату.
create or replace function public.join_room(p_code text, p_name text, p_token_hash text)
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
  if not found then
    raise exception 'room_not_found';
  end if;
  if v_room.status = 'closed' then
    raise exception 'room_closed';
  end if;

  select count(*) into v_count from players where room_id = v_room.id;
  if v_count >= 100 then
    raise exception 'room_full';
  end if;

  -- одинаковое имя в комнате -> unique_violation (23505)
  insert into players (room_id, name) values (v_room.id, p_name) returning id into v_player;
  insert into player_secrets (player_id, token_hash) values (v_player, p_token_hash);
  return v_player;
end;
$$;

-- Начало нового раунда (инкремент номера атомарный).
create or replace function public.start_round(p_room uuid)
returns void
language sql
set search_path = public
as $$
  update rooms
     set status = 'active',
         round_number = round_number + 1,
         winner_player_id = null,
         winner_name = null,
         winner_team_slot = null,
         winner_pressed_at = null,
         updated_at = now()
   where id = p_room and status <> 'closed';
$$;

-- ГЛАВНАЯ ФУНКЦИЯ: нажатие кнопки.
-- Победитель определяется ОДНИМ атомарным UPDATE с условием "status = 'active'".
-- При одновременных нажатиях PostgreSQL блокирует строку комнаты: второй UPDATE дожидается
-- первого, перепроверяет условие WHERE (уже status = 'finished') и не обновляет ни одной строки.
-- Поэтому победитель всегда ровно один. Возвращает true только победителю.
create or replace function public.press_button(p_room uuid, p_player uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_name text;
  v_slot smallint;
  v_rows integer;
begin
  select name, team_slot into v_name, v_slot
    from players
   where id = p_player and room_id = p_room;

  if not found or v_slot is null then
    return false;
  end if;

  update rooms
     set status = 'finished',
         winner_player_id = p_player,
         winner_name = v_name,
         winner_team_slot = v_slot,
         winner_pressed_at = clock_timestamp(),
         updated_at = now()
   where id = p_room
     and status = 'active'
     and winner_player_id is null;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

-- Очистка старых комнат (можно повесить на pg_cron: select cron.schedule('0 * * * *', 'select public.cleanup_old_rooms()')).
create or replace function public.cleanup_old_rooms(p_hours integer default 24)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from rooms where created_at < now() - make_interval(hours => p_hours);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------- безопасность

alter table public.rooms          enable row level security;
alter table public.teams          enable row level security;
alter table public.players        enable row level security;
alter table public.player_secrets enable row level security;
alter table public.room_pulse     enable row level security;

-- Браузеру (anon) НЕ доступно ничего, кроме чтения "пульса" для Realtime.
revoke all on public.rooms, public.teams, public.players, public.player_secrets, public.room_pulse
  from anon, authenticated;

grant select on public.room_pulse to anon, authenticated;
create policy "pulse readable" on public.room_pulse for select to anon, authenticated using (true);

-- Функции вызываются только сервером (service_role).
revoke all on function public.create_room(text, text, text)  from public, anon, authenticated;
revoke all on function public.join_room(text, text, text)    from public, anon, authenticated;
revoke all on function public.start_round(uuid)              from public, anon, authenticated;
revoke all on function public.press_button(uuid, uuid)       from public, anon, authenticated;
revoke all on function public.cleanup_old_rooms(integer)     from public, anon, authenticated;
revoke all on function public.touch_pulse()                  from public, anon, authenticated;

grant execute on function public.create_room(text, text, text) to service_role;
grant execute on function public.join_room(text, text, text)   to service_role;
grant execute on function public.start_round(uuid)             to service_role;
grant execute on function public.press_button(uuid, uuid)      to service_role;
grant execute on function public.cleanup_old_rooms(integer)    to service_role;

-- ---------------------------------------------------------------- Realtime

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.room_pulse;
  end if;
end $$;
