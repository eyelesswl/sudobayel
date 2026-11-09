import { ApiError, db, generateCode, hashToken, newToken, parseName, readJson, route } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Создание комнаты: создатель становится администратором. */
export const POST = route<unknown>(async (req) => {
  const name = parseName((await readJson(req)).name);
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateCode();
    const token = newToken();
    const { data, error } = await db().rpc("create_room", { p_code: code, p_name: name, p_token_hash: hashToken(token) });
    if (error) {
      if (error.code === "23505") continue; // коллизия кода — пробуем другой
      throw error;
    }
    return { code, playerId: (data as { player_id: string }).player_id, token };
  }
  throw new ApiError("server_error", 500);
});
