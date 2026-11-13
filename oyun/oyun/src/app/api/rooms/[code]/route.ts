import {
  ApiError, authenticate, buildState, db, getRoom, hashToken, newToken, parseCode, parseName,
  isUuid, parseAvatar, parseSlot, parseTeamName, parseText, readJson, route, tryAuthenticate,
} from "@/lib/server";

export const dynamic = "force-dynamic";
type P = { code: string };

/** Состояние комнаты (участники, команды, победитель). Токены сюда не попадают. */
export const GET = route<P>(async (req, { params }) => {
  const code = parseCode(params.code);
  const room = await getRoom(code);
  const me = await tryAuthenticate(req, room);
  return buildState(code, me?.id ?? null);
});

/** Все действия в комнате. Каждое проверяется на сервере. */
export const POST = route<P>(async (req, { params }) => {
  const code = parseCode(params.code);
  const body = await readJson(req);
  const action = body.action;
  const room = await getRoom(code);

  if (action === "join") {
    const token = newToken();
    const { data, error } = await db().rpc("join_room", { p_code: code, p_name: parseName(body.name), p_token_hash: hashToken(token), p_avatar: parseAvatar(body.avatar) });
    if (error) {
      if (error.code === "23505") throw new ApiError("name_taken", 409);
      for (const k of ["room_not_found", "room_closed", "room_full"]) {
        if (error.message?.includes(k)) throw new ApiError(k, k === "room_not_found" ? 404 : 409);
      }
      throw error;
    }
    return { playerId: data as string, token };
  }

  const me = await authenticate(req, room);
  if (room.status === "closed") throw new ApiError("room_closed", 409);
  const ok = (r: { error: unknown }) => { if (r.error) throw r.error; };
  let result: string | undefined;

  if (action === "team") {
    const slot = body.slot === null ? null : parseSlot(body.slot);
    if (room.status === "active" && me.team_slot !== null) throw new ApiError("team_locked", 409);
    ok(await db().from("players").update({ team_slot: slot }).eq("id", me.id));
  } else if (action === "press") {
    if (me.team_slot === null) throw new ApiError("no_team", 409);
    // Атомарно в БД: победитель ровно один на всю комнату; нажатие до сигнала — фальстарт.
    const { data, error } = await db().rpc("press_button", { p_room: room.id, p_player: me.id });
    if (error) throw error;
    result = String(data); // won | late | false_start | locked | no_team
  } else {
    // ---- только администратор
    if (!me.is_admin) throw new ApiError("not_admin", 403);
    if (action === "start") {
      ok(await db().rpc("start_round", { p_room: room.id }));
    } else if (action === "reset") {
      ok(await db().from("rooms").update({
        status: "idle", winner_player_id: null, winner_name: null, winner_team_slot: null,
        winner_pressed_at: null, go_at: null, updated_at: new Date().toISOString(),
      }).eq("id", room.id));
    } else if (action === "rename") {
      ok(await db().from("teams").update({ name: parseTeamName(body.name) }).eq("room_id", room.id).eq("slot", parseSlot(body.slot)));
    } else if (action === "kick") {
      const id = String(body.playerId ?? "");
      const { data } = await db().from("players").select("id,is_admin").eq("id", id).eq("room_id", room.id).maybeSingle();
      if (!data) throw new ApiError("player_not_found", 404);
      if (data.is_admin) throw new ApiError("cannot_kick_admin", 400);
      ok(await db().from("players").delete().eq("id", id).eq("room_id", room.id));
    } else if (action === "q_add") {
      const text = parseText(body.text, 200);
      const answer = typeof body.answer === "string" && body.answer.trim() ? parseText(body.answer, 100) : null;
      const { count } = await db().from("questions").select("id", { count: "exact", head: true }).eq("room_id", room.id);
      if ((count ?? 0) >= 50) throw new ApiError("too_many_questions", 409);
      const { data: last } = await db().from("questions").select("pos").eq("room_id", room.id).order("pos", { ascending: false }).limit(1);
      const pos = ((last as { pos: number }[] | null)?.[0]?.pos ?? 0) + 1;
      ok(await db().from("questions").insert({ room_id: room.id, pos, text, answer }));
    } else if (action === "q_del") {
      const id = String(body.id ?? "");
      if (!isUuid(id)) throw new ApiError("invalid_request");
      ok(await db().from("questions").delete().eq("id", id).eq("room_id", room.id));
    } else if (action === "close") {
      ok(await db().from("rooms").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", room.id));
    } else {
      throw new ApiError("invalid_request");
    }
  }

  return { result, state: await buildState(code, me.id) };
});
