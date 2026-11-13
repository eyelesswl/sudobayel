import { useId } from "react";

/** «Кочкор мүйүз» — рога барана: две симметричные спирали. */
function spiral(cx: number, dir: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const a = Math.PI * 0.2 + t * 1.6 * 2 * Math.PI;
    const r = 12.5 * (1 - t) + 1.2 * t;
    pts.push(`${(cx + dir * r * Math.cos(a)).toFixed(1)} ${(36 + r * Math.sin(a)).toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}
const LEFT = spiral(22, 1);
const RIGHT = spiral(50, -1);

export function Muyuz({ size = 96, className = "", draw = false }: { size?: number; className?: string; draw?: boolean }) {
  return (
    <svg viewBox="0 0 72 72" width={size} height={size} className={className} fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={LEFT} pathLength={1} className={draw ? "draw" : ""} />
      <path d={RIGHT} pathLength={1} className={draw ? "draw" : ""} />
      <path d="M36 33.2 L38.8 36 L36 38.8 L33.2 36Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Полоса в стиле шырдака (ромбы). Используется как граница карточек. */
export function Band({ className = "" }: { className?: string }) {
  const id = "b" + useId().replace(/:/g, "");
  return (
    <svg width="100%" height="10" className={className} aria-hidden>
      <defs>
        <pattern id={id} width="20" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 1 L16 5 L10 9 L4 5Z" fill="#B3202A" stroke="#D4A94F" strokeWidth="0.8" />
          <path d="M0 5 L2.5 2.5 L2.5 7.5Z M20 5 L17.5 2.5 L17.5 7.5Z" fill="#F3E9D2" fillOpacity="0.35" />
        </pattern>
      </defs>
      <rect width="100%" height="10" fill={`url(#${id})`} />
    </svg>
  );
}

/** Фон: мягкое бордовое свечение и медленно сдвигающийся узор (за контентом, не под текстом карточек). */
export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-ink">
      <div className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 80% 55% at 50% -10%, rgba(120,18,30,.55), transparent 70%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(212,169,79,.07), transparent 70%)" }} />
      <svg className="pattern-drift absolute text-gold opacity-[0.07]"
        style={{ left: -80, top: -80, width: "calc(100% + 160px)", height: "calc(100% + 160px)" }}>
        <defs>
          <pattern id="bg-muyuz" width="80" height="80" patternUnits="userSpaceOnUse">
            <g transform="translate(4 4)" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <path d={LEFT} /><path d={RIGHT} />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg-muyuz)" />
      </svg>
    </div>
  );
}
