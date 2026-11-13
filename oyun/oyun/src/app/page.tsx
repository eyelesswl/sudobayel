"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Band, Muyuz } from "@/components/Ornament";
import { useI18n } from "@/lib/i18n";
import { loadProfile, type Profile } from "@/lib/profile";

export default function Home() {
  const { t } = useI18n();
  const [p, setP] = useState<Profile | null>(null);
  useEffect(() => setP(loadProfile()), []);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-5 pb-24 pt-20">
      <div className="fade-up flex w-full max-w-sm flex-col items-center text-center">
        <Muyuz size={110} draw className="text-gold" />
        <h1 className="mt-2 font-display text-7xl font-extrabold tracking-[.12em] text-cream">ОЮН</h1>
        <div className="my-4 w-40 opacity-90"><Band /></div>
        <p className="text-cream/70">{t("home.tagline")}</p>

        {/* Профиль игрока: имя и фото подставляются при создании комнаты и входе */}
        <Link href="/profile" className="card mt-8 flex w-full items-center gap-3 p-3 text-left transition hover:border-gold/60">
          <Avatar name={p?.name || "?"} src={p?.avatar} size={48} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{p?.name || t("profile.setup")}</div>
            <div className="text-xs text-cream/50">{t("profile.edit")}</div>
          </div>
          <span className="text-xl text-gold">›</span>
        </Link>

        <div className="mt-4 flex w-full flex-col gap-3">
          <Link href="/create" className="btn-primary">{t("home.create")}</Link>
          <Link href="/join" className="btn-ghost">{t("home.join")}</Link>
        </div>
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
