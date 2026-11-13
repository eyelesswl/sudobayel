-- ОЮН: вопросы администратора, очки команд.
-- Выполните в SQL Editor ПОСЛЕ 20261109000000_init.sql.

create table public.questions (
  id      uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  pos     integer not null,
  text    text not null check (char_length(text) between 1 and 200),
  answer  text check (answer is null or char_length(answer) between 1 and 100),  -- видит только админ
  unique (room_id, pos)
);

alter table public.questions enable row level security;
revoke all on public.questions from anon, authenticated;

alter table public.rooms add column question_pos integer;                      -- текущий вопрос (pos) или null
alter table public.rooms add column awarded boolean not null default false;   -- очко за раунд уже засчитано
alter table public.teams add column score integer not null default 0;

-- Новый раунд: берёт следующий по порядку вопрос (если вопросы кончились или их нет — раунд без вопроса).
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
     set status = 'active', round_number = v_round, question_pos = v_pos, awarded = false,
         winner_player_id = null, winner_name = null, winner_team_slot = null, winner_pressed_at = null,
         updated_at = now()
   where id = p_room;
end;
$$;

-- Засчитать очко команде победителя (атомарно, не больше одного раза за раунд).
create or replace function public.award_point(p_room uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_slot smallint;
begin
  update rooms set awarded = true
   where id = p_room and status = 'finished' and not awarded and winner_team_slot is not null
  returning winner_team_slot into v_slot;

  if v_slot is null then return false; end if;
  update teams set score = score + 1 where room_id = p_room and slot = v_slot;
  return true;
end;
$$;

revoke all on function public.award_point(uuid) from public, anon, authenticated;
grant execute on function public.award_point(uuid) to service_role;
grant execute on function public.start_round(uuid) to service_role;
