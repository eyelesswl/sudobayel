// Колокольчики синтезируются в браузере (Web Audio) — файлы не нужны.
// Браузеры разрешают звук только после касания страницы, поэтому контекст "разблокируется" первым кликом.
let ctx: AudioContext | null = null;
let muted = false;
let started = false;

export function initSound() {
  if (started) return;
  started = true;
  try { muted = localStorage.getItem("oyun:muted") === "1"; } catch { /* ignore */ }
  const unlock = () => {
    try {
      if (!ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) ctx = new AC();
      }
      void ctx?.resume();
    } catch { /* ignore */ }
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem("oyun:muted", m ? "1" : "0"); } catch { /* ignore */ }
}

function bell(c: AudioContext, freq: number, when: number) {
  // колокольчик = основной тон + негармонические обертоны с быстрым затуханием
  for (const [mul, gain, decay] of [[1, 0.5, 1.8], [2.76, 0.18, 1.0], [5.4, 0.07, 0.5]] as const) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * mul;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain * 0.35, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.connect(g).connect(c.destination);
    osc.start(when);
    osc.stop(when + decay + 0.05);
  }
}

export function playBell() {
  if (muted || !ctx || ctx.state !== "running") return;
  const t0 = ctx.currentTime;
  [[1318.5, 0], [1760, 0.13], [2093, 0.26], [1568, 0.42]].forEach(([f, d]) => bell(ctx!, f, t0 + d));
}

/** Короткий сигнал отсчёта; high=true — сигнал "СТАРТ". */
export function playTick(high: boolean) {
  if (muted || !ctx || ctx.state !== "running") return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const t0 = ctx.currentTime;
  osc.type = "sine";
  osc.frequency.value = high ? 1320 : 660;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + (high ? 0.35 : 0.15));
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.4);
}
