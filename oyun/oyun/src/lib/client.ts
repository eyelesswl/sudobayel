import type { RoomState } from "./shared";

export class ApiClientError extends Error {
  constructor(public code: string) { super(code); }
}
export interface Session { playerId: string; token: string }

const key = (code: string) => `oyun:session:${code}`;
export function loadSession(code: string): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(key(code)) ?? "null");
    return s && typeof s.playerId === "string" && typeof s.token === "string" ? s : null;
  } catch { return null; }
}
export function saveSession(code: string, s: Session) { try { localStorage.setItem(key(code), JSON.stringify(s)); } catch { /* ignore */ } }
export function clearSession(code: string) { try { localStorage.removeItem(key(code)); } catch { /* ignore */ } }

async function call<T>(path: string, method: string, body?: unknown, s?: Session | null): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(s ? { "x-player-id": s.playerId, "x-player-token": s.token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch { throw new ApiClientError("network"); }
  let data: { error?: string } | null = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) throw new ApiClientError(data?.error ?? "server_error");
  return data as T;
}

export const api = {
  create: (name: string, avatar: string | null) => call<{ code: string; playerId: string; token: string }>("/api/rooms", "POST", { name, avatar }),
  join: (code: string, name: string, avatar: string | null) => call<{ playerId: string; token: string }>(`/api/rooms/${code}`, "POST", { action: "join", name, avatar }),
  state: (code: string, s: Session | null) => call<RoomState>(`/api/rooms/${code}`, "GET", undefined, s),
  act: (code: string, s: Session, body: Record<string, unknown>) =>
    call<{ result?: string; state: RoomState }>(`/api/rooms/${code}`, "POST", body, s),
};
