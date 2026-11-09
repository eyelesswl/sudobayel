"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Band, Muyuz } from "@/components/Ornament";
import { api, loadSession, saveSession } from "@/lib/client";
import { errText, useI18n } from "@/lib/i18n";

export default function Home() {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<null | "create" | "join">(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { try { setName(localStorage.getItem("oyun:name") ?? ""); } catch { /* ignore */ } }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr("");
    const n = name.trim();
    if (!n) return setErr(t("err.invalid_name"));
    const c = code.trim().toUpperCase();
    if (mode === "join" && !/^[A-Z0-9]{6}$/.test(c)) return setErr(t("err.invalid_code"));
    setBusy(true);
    try {
      try { localStorage.setItem("oyun:name", n); } catch { /* ignore */ }
      if (mode === "create") {
        const r = await api.create(n);
        saveSession(r.code, { playerId: r.playerId, token: r.token });
        router.push(`/room/${r.code}`);
      } else {
        if (!loadSession(c)) {
          const r = await api.join(c, n);
          saveSession(c, { playerId: r.playerId, token: r.token });
        }
        router.push(`/room/${c}`);
      }
    } catch (e) {
      setErr(errText(t, e));
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-5 pb-24 pt-20">
      <div className="fade-up flex w-full max-w-sm flex-col items-center text-center">
        <Muyuz size={110} draw className="text-gold" />
        <h1 className="mt-2 font-display text-7xl font-extrabold tracking-[.12em] text-cream">ОЮН</h1>
        <div className="my-4 w-40 opacity-90"><Band /></div>
        <p className="text-cream/70">{t("home.tagline")}</p>

        {mode === null ? (
          <div className="mt-10 flex w-full flex-col gap-3">
            <button className="btn-primary" onClick={() => setMode("create")}>{t("home.create")}</button>
            <button className="btn-ghost" onClick={() => setMode("join")}>{t("home.join")}</button>
          </div>
        ) : (
          <form onSubmit={submit} className="card fade-up mt-8 flex w-full flex-col gap-3 p-5 text-left">
            {mode === "join" && (
              <label className="text-sm text-cream/70">{t("field.code")}
                <input className="input mt-1 text-center font-mono text-xl uppercase tracking-[.35em]" maxLength={6} autoFocus
                  autoCapitalize="characters" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              </label>
            )}
            <label className="text-sm text-cream/70">{t("field.name")}
              <input className="input mt-1" maxLength={24} autoFocus={mode === "create"} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
            <button className="btn-primary mt-1" disabled={busy}>{mode === "create" ? t("form.create") : t("form.join")}</button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => { setMode(null); setErr(""); }}>{t("common.back")}</button>
          </form>
        )}
      </div>

      {/* Подпись автора — всегда в правом нижнем углу, на любом языке */}
      <footer className="absolute bottom-4 right-5 flex items-center gap-2 text-gold/80">
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-gold/70" />
        <span className="h-1.5 w-1.5 rotate-45 bg-gold/80" />
        <span className="font-display text-sm italic tracking-wide">Субанбеков Байел</span>
      </footer>
    </main>
  );
}
