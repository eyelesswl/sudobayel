"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Avatar } from "@/components/Avatar";
import { Screen } from "@/components/Screen";
import { useI18n } from "@/lib/i18n";
import { fileToAvatar, loadProfile, saveProfile } from "@/lib/profile";

export default function ProfilePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => { const p = loadProfile(); setName(p.name); setAvatar(p.avatar); }, []);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setAvatar(await fileToAvatar(f)); setErr(""); } catch { setErr(t("err.invalid_request")); }
  }

  function save() {
    const n = name.trim();
    if (!n) return setErr(t("err.invalid_name"));
    saveProfile({ name: n, avatar });
    router.push("/");
  }

  return (
    <Screen title={t("profile.title")}>
      <div className="flex flex-col items-center gap-3">
        <Avatar name={name || "?"} src={avatar} size={96} />
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => file.current?.click()}>{t("profile.upload")}</button>
          {avatar && <button className="btn-ghost btn-sm" onClick={() => setAvatar(null)}>{t("profile.remove")}</button>}
        </div>
      </div>
      <label className="text-sm text-cream/70">{t("field.name")}
        <input className="input mt-1" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <p className="text-xs text-cream/50">{t("profile.hint")}</p>
      {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
      <button className="btn-primary" onClick={save}>{t("profile.save")}</button>
    </Screen>
  );
}
