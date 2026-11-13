"use client";
import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

/** Сканер QR камерой телефона. Понимает ссылку вида .../room/ABC123 или просто код. */
export default function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let stop = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        const v = video.current;
        if (!v || stop) { stream.getTracks().forEach((x) => x.stop()); return; }
        v.srcObject = stream;
        await v.play();
        const tick = () => {
          if (stop) return;
          if (v.readyState >= 2 && v.videoWidth && ctx) {
            const w = Math.min(480, v.videoWidth);
            const h = Math.round((v.videoHeight * w) / v.videoWidth);
            canvas.width = w; canvas.height = h;
            ctx.drawImage(v, 0, 0, w, h);
            const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
            const m = r?.data.trim().match(/(?:\/room\/|^)([A-Z0-9]{6})\/?(?:[?#].*)?$/i);
            if (m) { stop = true; onCode(m[1].toUpperCase()); return; }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch { setErr(t("qr.denied")); }
    })();

    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((x) => x.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-black/90 p-5">
      {err ? <p className="text-red-400">{err}</p> : (
        <>
          <video ref={video} playsInline muted className="aspect-square w-full max-w-sm rounded-3xl border border-gold/40 object-cover" />
          <p className="text-cream/70">{t("qr.hint")}</p>
        </>
      )}
      <button className="btn-ghost" onClick={onClose}>{t("common.close")}</button>
    </div>
  );
}
