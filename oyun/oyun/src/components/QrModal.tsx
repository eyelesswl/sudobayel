"use client";
import { toDataURL } from "qrcode";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

/** QR-код со ссылкой на комнату — друзья наводят камеру и попадают на вход. */
export default function QrModal({ code, onClose }: { code: string; onClose: () => void }) {
  const { t } = useI18n();
  const [src, setSrc] = useState("");
  useEffect(() => {
    let off = false;
    toDataURL(`${location.origin}/room/${code}`, { margin: 1, width: 300, color: { dark: "#0E0A0A", light: "#F3E9D2" } })
      .then((u) => { if (!off) setSrc(u); }).catch(() => {});
    return () => { off = true; };
  }, [code]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-5" onClick={onClose}>
      <div className="card pop flex w-full max-w-xs flex-col items-center gap-3 p-6" onClick={(e) => e.stopPropagation()}>
        {src ? <img src={src} alt="QR" className="w-full rounded-xl" /> : <div className="aspect-square w-full animate-pulse rounded-xl bg-white/10" />}
        <div className="font-mono text-2xl tracking-[.35em] text-gold">{code}</div>
        <p className="text-center text-sm text-cream/60">{t("qr.share")}</p>
        <button className="btn-ghost btn-sm" onClick={onClose}>{t("common.close")}</button>
      </div>
    </div>
  );
}
