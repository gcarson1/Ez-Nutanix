// The shapes the Protection & Capacity views draw: each piece of data is one shape, so a
// viewer can follow a piece and its copies across nodes.

/** Eight simple shapes; each piece of data is drawn as one of them. */
export function Shape({ kind, x, y, r, cls, style }: { kind: number; x: number; y: number; r: number; cls: string; style?: Record<string, string | number> }) {
  const k = kind % 8;
  if (k === 0) return <circle class={cls} cx={x} cy={y} r={r} style={style} />;
  if (k === 1) return <rect class={cls} x={x - r * 0.88} y={y - r * 0.88} width={r * 1.76} height={r * 1.76} style={style} />;
  const pts = (n: number, rot: number, rr = r) =>
    Array.from({ length: n }, (_, i) => {
      const a = rot + (i * 2 * Math.PI) / n;
      return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
  if (k === 2) return <polygon class={cls} points={pts(3, -Math.PI / 2, r * 1.12)} style={style} />;
  if (k === 3) return <polygon class={cls} points={pts(4, 0, r * 1.1)} style={style} />;
  if (k === 4) return <polygon class={cls} points={pts(6, 0)} style={style} />;
  if (k === 5) return <polygon class={cls} points={pts(5, -Math.PI / 2, r * 1.05)} style={style} />;
  if (k === 6) {
    // star
    const star = Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.5 : r * 1.15;
      return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
    return <polygon class={cls} points={star} style={style} />;
  }
  const a = r * 0.36;
  const b = r * 1.05;
  return <path class={cls} d={`M${x - a} ${y - b}h${2 * a}v${b - a}h${b - a}v${2 * a}h${a - b}v${b - a}h${-2 * a}v${a - b}h${a - b}v${-2 * a}h${b - a}z`} style={style} />;
}
