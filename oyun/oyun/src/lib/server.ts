import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { RoomState, RoomStatus } from "./shared";

export class ApiError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

let client: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars are not set (see .env.example)");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Оборачивает обработчик: единый формат ошибок {error: code}. */
export function route<P>(fn: (req: Request, ctx: { params: P }) => Promise<unknown>) {
  return async (req: Request, ctx: { params: P }) => {
    try {
      return NextResponse.json(await fn(req, ctx), { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.code }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const v = await req.json();
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch { /* fallthrough */ }
  throw new ApiError("invalid_request");
}

// ---------------------------------------------------------------- валидация

export function parseCode(raw: string): string {
  const c = String(raw).trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(c)) throw new ApiError("invalid_code");
  return c;
}

function clean(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  const s = raw.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  return Array.from(s).length <= max ? s : "";
}

export function parseName(raw: unknown): string {
  const n = clean(raw, 24);
  if (!n) throw new ApiError("invalid_name");
  return n;
}

export function parseText(raw: unknown, max: number): string {
  const n = clean(raw, max);
  if (!n) throw new ApiError("invalid_request");
  return n;
}

export function parseSlot(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > 3) throw new ApiError("invalid_request");
  return raw;
}

/** Название команды: пустая строка -> null (вернуть название по умолчанию). */
export function parseTeamName(raw: unknown): string | null {
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") throw new ApiError("invalid_request");
  const n = clean(raw, 20);
  if (!n) { if (raw.trim() === "") return null; throw new ApiError("invalid_name"); }
  return n;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

// ---------------------------------------------------------------- токены игроков

export const newToken = () => randomBytes(32).toString("hex");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export interface RoomRow {
  id: string; code: string; status: RoomStatus; round_number: number;
  winner_player_id: string | null; winner_name: string | null; winner_team_slot: number | null;
  question_pos: number | null; awarded: boolean;
}
export interface PlayerRow { id: string; room_id: string; name: string; team_slot: number | null; is_admin: boolean }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID.test(s);

export async function getRoom(code: string): Promise<RoomRow> {
  const { data, error } = await db().from("rooms").select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError("room_not_found", 404);
  return data as RoomRow;
}

/** Проверяет токен игрока на сервере. Права администратора берутся из БД, а не из запроса. */
export async function authenticate(req: Request, room: RoomRow): Promise<PlayerRow> {
  const id = req.headers.get("x-player-id") ?? "";
  const token = req.headers.get("x-player-token") ?? "";
  const fail = new ApiError("unauthorized", 401);
  if (!UUID.test(id) || !token) throw fail;

  const { data: player } = await db().from("players").select("*").eq("id", id).eq("room_id", room.id).maybeSingle();
  const { data: secret } = await db().from("player_secrets").select("token_hash").eq("player_id", id).maybeSingle();
  if (!player || !secret) throw fail;

  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(String(secret.token_hash), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw fail;
  return player as PlayerRow;
}

export async function tryAuthenticate(req: Request, room: RoomRow): Promise<PlayerRow | null> {
  try { return await authenticate(req, room); } catch (e) { if (e instanceof ApiError) return null; throw e; }
}

// ---------------------------------------------------------------- состояние комнаты

export async function buildState(code: string, meId: string | null): Promise<RoomState> {
  const room = await getRoom(code);
  const [p, t] = await Promise.all([
    db().from("players").select("*").eq("room_id", room.id).order("joined_at"),
    db().from("teams").select("*").eq("room_id", room.id).order("slot"),
  ]);
  if (p.error) throw p.error;
  if (t.error) throw t.error;
  const players = (p.data as PlayerRow[]).map((x) => ({ id: x.id, name: x.name, teamSlot: x.team_slot, isAdmin: x.is_admin }));
  const me = meId ? players.find((x) => x.id === meId) : undefined;

  // Вопрос виден всем только во время раунда; ответы и полный список — только администратору.
  const showing = room.status === "active" || room.status === "finished";
  let question: RoomState["question"] = null;
  let questions: RoomState["questions"];
  if (me?.isAdmin) {
    const q = await db().from("questions").select("id,pos,text,answer").eq("room_id", room.id).order("pos");
    if (q.error) throw q.error;
    const rows = q.data as { id: string; pos: number; text: string; answer: string | null }[];
    questions = rows.map((x) => ({ id: x.id, text: x.text, answer: x.answer }));
    const cur = rows.find((x) => x.pos === room.question_pos);
    if (showing && cur) question = { text: cur.text, answer: cur.answer ?? undefined };
  } else if (showing && room.question_pos !== null) {
    const q = await db().from("questions").select("text").eq("room_id", room.id).eq("pos", room.question_pos).maybeSingle();
    if (q.data) question = { text: (q.data as { text: string }).text };
  }
  return {
    roomId: room.id,
    code: room.code,
    status: room.status,
    roundNumber: room.round_number,
    winner: room.winner_name !== null && room.winner_team_slot !== null
      ? { playerId: room.winner_player_id, name: room.winner_name, teamSlot: room.winner_team_slot } : null,
    teams: (t.data as { slot: number; color: string; name: string | null; score: number }[]).map((x) => ({ slot: x.slot, color: x.color, name: x.name, score: x.score })),
    players,
    me: me ? { id: me.id, isAdmin: me.isAdmin, teamSlot: me.teamSlot } : null,
    awarded: room.awarded,
    question,
    questions,
  };
}
