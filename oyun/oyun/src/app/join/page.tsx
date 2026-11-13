"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Avatar } from "@/components/Avatar";
import QrScanner from "@/components/QrScanner";
import { Screen } from "@/components/Screen";
import { api, loadSession, saveSession } from "@/lib/client";
import { errText, useI18n } from "@/lib/i18n";
import { loadProfile, saveProfile, type Profile } from "@/lib/profile";

export default function JoinPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [prof, setProf] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [scan, setScan] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { const p = loadProfile(); setProf(p); setName(p.name); }, []);

  async function go(raw: string) {
    if (busy) return;
    setErr("");
    const c = raw.trim().toUpperCase();
    const n = name.trim();
    if (!n) return setErr(t("err.invalid_name"));
    if (!/^[A-Z0-9]{6}$/.test(c)) return setErr(t("err.invalid_code"));
    setBusy(true);
    try {
      saveProfile({ name: n, avatar: prof?.avatar ?? null });
      if (!loadSession(c)) { // уже в этой комнате — просто возвращаемся
        const r = await api.join(c, n, prof?.avatar ?? null);
        saveSession(c, { playerId: r.playerId, token: r.token });
      }
      router.push(`/room/${c}`);
    } catch (e) { setErr(errText(t, e)); setBusy(false); }
  }

  return (
    <Screen title={t("home.join")}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void go(code); }} className="flex flex-col gap-4">
        <label className="text-sm text-cream/70">{t("field.code")}
          <input className="input mt-1 text-center font-mono text-xl uppercase tracking-[.35em]" maxLength={6} autoFocus autoComplete="off"
            autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </label>
        <button type="button" className="btn-ghost" onClick={() => setScan(true)}>{t("qr.scan")}</button>
        <div className="flex items-center gap-3">
          <Avatar name={name || "?"} src={prof?.avatar} size={56} />
          <label className="flex-1 text-sm text-cream/70">{t("field.name")}
            <input className="input mt-1" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
        {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
        <button className="btn-primary" disabled={busy}>{t("form.join")}</button>
      </form>
      {scan && <QrScanner onClose={() => setScan(false)} onCode={(c) => { setScan(false); setCode(c); void go(c); }} />}
    </Screen>
  );
}
