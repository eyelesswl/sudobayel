"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Avatar } from "@/components/Avatar";
import { Screen } from "@/components/Screen";
import { api, saveSession } from "@/lib/client";
import { errText, useI18n } from "@/lib/i18n";
import { loadProfile, saveProfile, type Profile } from "@/lib/profile";

export default function CreatePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [prof, setProf] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { const p = loadProfile(); setProf(p); setName(p.name); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (busy) return;
    if (!n) return setErr(t("err.invalid_name"));
    setBusy(true);
    try {
      saveProfile({ name: n, avatar: prof?.avatar ?? null });
      const r = await api.create(n, prof?.avatar ?? null);
      saveSession(r.code, { playerId: r.playerId, token: r.token });
      router.push(`/room/${r.code}`);
    } catch (e) { setErr(errText(t, e)); setBusy(false); }
  }

  return (
    <Screen title={t("home.create")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={name || "?"} src={prof?.avatar} size={56} />
          <label className="flex-1 text-sm text-cream/70">{t("field.name")}
            <input className="input mt-1" maxLength={24} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
        {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
        <button className="btn-primary" disabled={busy}>{t("form.create")}</button>
        <Link href="/profile" className="text-center text-sm text-gold/80 underline-offset-4 hover:underline">{t("profile.edit")}</Link>
      </form>
    </Screen>
  );
}
