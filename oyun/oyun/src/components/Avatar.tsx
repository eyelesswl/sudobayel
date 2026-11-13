export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  const box = { width: size, height: size };
  if (src) return <img src={src} alt="" className="shrink-0 rounded-full border border-gold/40 object-cover" style={box} />;
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10 font-display font-semibold text-gold"
      style={{ ...box, fontSize: size * 0.42 }}>
      {(Array.from(name.trim())[0] ?? "?").toUpperCase()}
    </span>
  );
}
