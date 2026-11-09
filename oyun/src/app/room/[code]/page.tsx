"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Band } from "@/components/Ornament";
import { api, ApiClientError, clearSession, loadSession, saveSession, type Session } from "@/lib/client";
import { errText, useI18n, useTeamName } from "@/lib/i18n";
import { TEAM_HEX, TEAM_ON, type PlayerInfo, type RoomState } from "@/lib/shared";
import { getBrowserClient } from "@/lib/supabase-browser";

type Status = "loading" | "ok" | "missing" | "kicked";

/** Состояние комнаты: Realtime-сигнал -> перечитываем с сервера. Опрос — страховка. */
function useRoom(code: string) {
  const [state, setState] = useState<RoomState | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [live, setLive] = useState(false);
  const sess = useRef<Session | null>(null);
  const member = useRef(false);
  const busy = useRef(false);
  const again = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) { again.current = true; return; }
    busy.current = true;
    try {
      do {
        again.current = false;
        try {
          const s = await api.state(code, sess.current);
          if (sess.current && !s.me) { // сессия недействительна или участника удалили
            clearSession(code); sess.current = null; setSession(null);
            if (member.current) { member.current = false; setStatus("kicked"); }
          }
          if (s.me) member.current = true;
          setState(s);
          setStatus((p) => (p === "kicked" ? p : "ok"));
        } catch (e) {
          if (e instanceof ApiClientError && (e.code === "room_not_found" || e.code === "invalid_code")) setStatus("missing");
        }
      } while (again.current);
    } finally { busy.current = false; }
  }, [code]);

  useEffect(() => { const s = loadSession(code); sess.current = s; setSession(s); void refresh(); }, [code, refresh]);

  const roomId = state?.roomId;
  useEffect(() => {
    if (!roomId) return;
    const sb = getBrowserClient();
    if (!sb) return;
    const ch = sb.channel("pulse-" + roomId)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_pulse", filter: `room_id=eq.${roomId}` }, () => { void refresh(); })
      .subscribe((st) => { setLive(st === "SUBSCRIBED"); if (st === "SUBSCRIBED") void refresh(); });
    return () => { void sb.removeChannel(ch); setLive(false); };
  }, [roomId, refresh]);

  useEffect(() => {
    const id = setInterval(() => void refresh(), live ? 15000 : 3000);
    const onVis = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [live, refresh]);

  const join = async (name: string) => {
    const r = await api.join(code, name);
    const s = { playerId: r.playerId, token: r.token };
    saveSession(code, s); sess.current = s; setSession(s);
    await refresh();
  };
  return { state, session, status, live, setState, join };
}

function Center({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="card pop w-full max-w-sm overflow-hidden text-center">
        <Band />
        <div className="flex flex-col items-center gap-4 p-6">
          {children}
          <Link href="/" className="btn-ghost btn-sm">{t("room.home")}</Link>
        </div>
      </div>
    </main>
  );
}

export default function RoomPage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { t } = useI18n();
  const teamName = useTeamName();
  const { state, session, status, live, setState, join } = useRoom(code);
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState("");
  const [joinName, setJoinName] = useState("");
  const lock = useRef(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { try { setJoinName(localStorage.getItem("oyun:name") ?? ""); } catch { /* ignore */ } }, []);

  const flash = (m: string) => { setMsg(m); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(""), 3500); };

  const act = async (body: Record<string, unknown>) => {
    if (!session) return null;
    try { const r = await api.act(code, session, body); setState(r.state); return r; }
    catch (e) { flash(errText(t, e)); return null; }
  };

  const copy = async (what: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(what === "code" ? code : `${location.origin}/room/${code}`);
      setCopied(what); setTimeout(() => setCopied(""), 1500);
    } catch { /* ignore */ }
  };

  if (status === "loading" || !state) {
    return status === "missing"
      ? <Center><p>{t("err.room_not_found")}</p></Center>
      : <main className="flex min-h-dvh items-center justify-center text-cream/60">{t("common.loading")}</main>;
  }
  if (status === "missing") return <Center><p>{t("err.room_not_found")}</p></Center>;
  if (state.status === "closed") return <Center><p className="font-display text-xl">{t("room.closed")}</p></Center>;
  if (status === "kicked") return <Center><p className="font-display text-xl">{t("room.kicked")}</p></Center>;

  // ---- вход в комнату по ссылке
  if (!state.me) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5">
        <form className="card pop w-full max-w-sm overflow-hidden"
          onSubmit={async (e) => { e.preventDefault(); try { try { localStorage.setItem("oyun:name", joinName.trim()); } catch { /* ignore */ } await join(joinName); } catch (er) { flash(errText(t, er)); } }}>
          <Band />
          <div className="flex flex-col gap-3 p-6">
            <div className="text-center font-mono text-2xl tracking-[.35em] text-gold">{code}</div>
            <label className="text-sm text-cream/70">{t("field.name")}
              <input className="input mt-1" maxLength={24} autoFocus value={joinName} onChange={(e) => setJoinName(e.target.value)} />
            </label>
            {msg && <p role="alert" className="text-sm text-red-400">{msg}</p>}
            <button className="btn-primary">{t("form.join")}</button>
            <Link href="/" className="btn-ghost btn-sm">{t("common.back")}</Link>
          </div>
        </form>
      </main>
    );
  }

  const me = state.me;
  const myTeam = me.teamSlot;
  const iWon = !!state.winner && state.winner.playerId === me.id;
  const mode = myTeam === null ? "noTeam" : state.status === "active" ? "live" : state.status === "finished" ? "done" : "wait";
  const hint = {
    noTeam: t("game.pickFirst"),
    wait: state.players.length < 2 ? t("game.waitPlayers") : t("game.waitAdmin"),
    live: t("game.ready"),
    done: iWon ? t("game.youWon") : t("game.waitNext"),
  }[mode];
  const hex = TEAM_HEX[myTeam ?? 0];
  const style = { "--team": myTeam === null ? "#6b6258" : hex, "--on": myTeam === null ? "#ddd" : TEAM_ON[myTeam] } as CSSProperties;

  const press = async () => {
    if (state.status !== "active" || myTeam === null || pending || lock.current === state.roundNumber) return;
    lock.current = state.roundNumber; // защита от повторных нажатий в этом раунде
    setPending(true);
    try { navigator.vibrate?.(25); } catch { /* ignore */ }
    const r = await act({ action: "press" });
    setPending(false);
    if (!r) lock.current = -1;
    else if (!r.won) flash(t("game.tooLate"));
  };

  const winnerTeam = state.winner ? state.teams[state.winner.teamSlot] : null;
  const members = (slot: number | null) => state.players.filter((p) => p.teamSlot === slot);
  const kick = (p: PlayerInfo) => { if (window.confirm(t("admin.kickConfirm", { name: p.name }))) void act({ action: "kick", playerId: p.id }); };

  const chip = (p: PlayerInfo) => (
    <span key={p.id} className="chip">
      {p.name}
      {p.id === me.id && <span className="text-cream/50">({t("room.you")})</span>}
      {p.isAdmin && <span className="text-xs text-gold">{t("room.admin")}</span>}
      {me.isAdmin && !p.isAdmin && (
        <button onClick={() => kick(p)} aria-label={t("admin.kick")} title={t("admin.kick")} className="-mr-1 px-1 text-cream/50 hover:text-red-400">×</button>
      )}
    </span>
  );

  return (
    <main className="fade-up mx-auto w-full max-w-4xl px-4 pb-16 pt-16">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/" className="font-display text-2xl font-extrabold tracking-widest text-gold">ОЮН</Link>
          <span className={`h-2 w-2 rounded-full ${live ? "bg-green-500" : "bg-yellow-500"}`} title={live ? "live" : t("room.offline")} />
          {!live && <span className="text-xs text-cream/50">{t("room.offline")}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xl tracking-[.3em]">{code}</span>
          <button className="btn-ghost btn-sm" onClick={() => copy("code")}>{copied === "code" ? t("room.copied") : t("room.copy")}</button>
          <button className="btn-ghost btn-sm" onClick={() => copy("link")}>{copied === "link" ? t("room.copied") : t("room.link")}</button>
        </div>
      </header>

      {/* ---- игра */}
      <section className="mt-8 flex flex-col items-center gap-5">
        <div className="text-xs uppercase tracking-[.3em] text-gold/80">
          {state.roundNumber > 0 ? t("game.round", { n: state.roundNumber }) : " "}
        </div>

        {state.winner && winnerTeam && (
          <div key={`${state.roundNumber}-${state.winner.name}`} className="card pop w-full max-w-md overflow-hidden text-center"
            style={{ borderColor: TEAM_HEX[state.winner.teamSlot] }}>
            <Band />
            <div className="px-6 pb-6 pt-4">
              <div className="text-xs uppercase tracking-[.3em] text-gold">{t("game.winner")}</div>
              <div className="mt-2 break-words font-display text-4xl font-extrabold">{state.winner.name}</div>
              <span className="mt-3 inline-block rounded-full px-4 py-1 text-sm font-semibold"
                style={{ background: TEAM_HEX[state.winner.teamSlot], color: TEAM_ON[state.winner.teamSlot] }}>{teamName(winnerTeam)}</span>
            </div>
          </div>
        )}

        <button className={`big-btn ${mode === "live" && !pending ? "live" : ""}`} style={style}
          disabled={mode !== "live" || pending}
          onPointerDown={(e) => { if (e.pointerType === "mouse" && e.button !== 0) return; void press(); }}
          onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); void press(); } }}>
          {t("game.press")}
        </button>
        <p className="min-h-6 text-center text-cream/70">{msg || hint}</p>
      </section>

      {/* ---- команды */}
      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {state.teams.map((team) => {
          const mine = myTeam === team.slot;
          return (
            <div key={team.slot} className="card flex flex-col gap-3 p-4" style={mine ? { borderColor: TEAM_HEX[team.slot] } : undefined}>
              <div className="flex items-center gap-2 font-display text-lg font-semibold">
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: TEAM_HEX[team.slot] }} />
                {teamName(team)}
                <span className="ml-auto text-sm font-normal text-cream/50">{members(team.slot).length}</span>
              </div>
              <div className="flex min-h-8 flex-wrap gap-1.5">
                {members(team.slot).length === 0 ? <span className="text-sm text-cream/40">{t("room.empty")}</span>
                  : members(team.slot).map(chip)}
              </div>
              <button className={mine ? "btn-ghost btn-sm" : "btn-primary btn-sm"} disabled={mine}
                onClick={() => void act({ action: "team", slot: team.slot })}>
                {mine ? t("room.yourTeam") : t("room.chooseTeam")}
              </button>
            </div>
          );
        })}
      </section>

      {members(null).length > 0 && (
        <section className="mt-4">
          <div className="mb-2 text-xs uppercase tracking-[.25em] text-cream/50">{t("room.noTeam")}</div>
          <div className="flex flex-wrap gap-1.5">{members(null).map(chip)}</div>
        </section>
      )}

      {/* ---- панель администратора (кнопки работают только если сервер подтвердил права) */}
      {me.isAdmin && (
        <details open className="card mt-8 overflow-hidden">
          <summary className="cursor-pointer select-none px-5 py-4 font-display text-lg font-semibold">{t("admin.panel")}</summary>
          <div className="flex flex-col gap-5 px-5 pb-5">
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => void act({ action: "start" })}>{t("admin.newRound")}</button>
              <button className="btn-ghost" onClick={() => void act({ action: "reset" })}>{t("admin.reset")}</button>
            </div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-[.25em] text-cream/50">{t("admin.teams")}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {state.teams.map((team) => (
                  <label key={`${team.slot}-${team.name ?? ""}`} className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: TEAM_HEX[team.slot] }} />
                    <input className="input py-2" maxLength={20} defaultValue={team.name ?? ""} placeholder={teamName({ color: team.color, name: null })}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v !== (team.name ?? "")) void act({ action: "rename", slot: team.slot, name: v }); }} />
                  </label>
                ))}
              </div>
            </div>
            <button className="btn-ghost self-start border-red-500/50 text-red-300"
              onClick={() => { if (window.confirm(t("admin.closeConfirm"))) void act({ action: "close" }); }}>{t("admin.close")}</button>
          </div>
        </details>
      )}
    </main>
  );
}
