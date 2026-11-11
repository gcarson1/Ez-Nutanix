// Shared drawing parts for the Kubernetes Platform detail tabs (lifecycle.tsx, fleet.tsx, services.tsx):
// a cluster's worker node with its pods, its control plane, and a row inside a box that lights up
// when that capability is at work. The scene frame itself is the one Enterprise AI uses (../ai/kit).
import '../ai/style.css';

export type WorkerState = 'ok' | 'new' | 'bad' | 'leaving';
export const WK = { w: 150, h: 96, slots: 4 };

/** A worker node: its name, a status in words, and up to four pods. `lost` pods are drawn crossed out. */
export function Worker({ x, y, name, state = 'ok', status, pods, lost = 0, opacity = 1 }: { x: number; y: number; name: string; state?: WorkerState; status?: string; pods: number; lost?: number; opacity?: number }) {
  const tone = state === 'bad' ? 'bad' : state === 'new' ? 'flow' : undefined;
  return (
    <g style={{ opacity }}>
      <rect class={`nk-wk ${state}`} x={x} y={y} width={WK.w} height={WK.h} rx={5} />
      <text class="d-sub" x={x + 10} y={y + 18} style={{ fontWeight: 600 }}>
        {name}
      </text>
      <text class={`d-fine ${tone ? `${tone}-fill` : 'muted'}`} x={x + WK.w - 10} y={y + 18} text-anchor="end" style={{ fontWeight: tone ? 600 : 400 }}>
        {status ?? (state === 'bad' ? '✕ down' : state === 'new' ? 'starting' : state === 'leaving' ? 'being removed' : 'ready')}
      </text>
      {Array.from({ length: WK.slots }, (_, i) => {
        const cx = x + 24 + i * 34;
        const cy = y + 50;
        if (i < pods) return <circle key={i} cx={cx} cy={cy} r={9} class="nk-pod" />;
        if (i < pods + lost) return <path key={i} d={`M${cx - 6} ${cy - 6} l12 12 m0 -12 l-12 12`} class="gw-x" />;
        return <circle key={i} cx={cx} cy={cy} r={9} class="nk-slot" />;
      })}
      <text class="d-fine muted" x={x + 10} y={y + 84}>
        {lost ? `${lost} pods lost` : `${pods} of ${WK.slots} pods`}
      </text>
    </g>
  );
}

/** The control plane: three small nodes. */
export function ControlPlane({ x, y, up = 3 }: { x: number; y: number; up?: number }) {
  return (
    <g>
      <text class="d-fine muted" x={x} y={y - 8}>
        Control plane
      </text>
      {[0, 1, 2].map((i) => (
        <g key={i} style={{ opacity: i < up ? 1 : 0.25 }}>
          <rect class="nk-node" x={x + i * 62} y={y} width={56} height={30} rx={4} />
          <text class="d-fine" x={x + i * 62 + 28} y={y + 19} text-anchor="middle">
            CP {i + 1}
          </text>
        </g>
      ))}
    </g>
  );
}

/** One capability inside a box: a dot and a line of text that light up while it is at work. */
export function Row({ x, y, label, on, tone = 'flow' }: { x: number; y: number; label: string; on: boolean; tone?: 'flow' | 'ok' | 'bad' | 'warn' }) {
  return (
    <g>
      <circle cx={x + 5} cy={y - 4} r={4.5} class={on ? `ai-dot on ${tone}` : 'ai-dot'} />
      <text class={`d-sub${on ? '' : ' muted'}`} x={x + 16} y={y} style={{ fontWeight: on ? 600 : 400 }}>
        {label}
      </text>
    </g>
  );
}

/** A cluster as a card: its name, where it runs, and a status in words. */
export function ClusterCard({
  x,
  y,
  w,
  h = 58,
  name,
  sub,
  status,
  tone,
  cls = '',
  dim,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  name: string;
  sub: string;
  status?: string;
  tone?: 'ok' | 'warn' | 'bad';
  cls?: string;
  dim?: boolean;
}) {
  return (
    <g style={{ opacity: dim ? 0.35 : 1 }}>
      <rect class={`nk-cl ${cls}`} x={x} y={y} width={w} height={h} rx={5} />
      <text class="d-label" x={x + 12} y={y + 22} style={{ fontWeight: 600 }}>
        {name}
      </text>
      <text class="d-sub muted" x={x + 12} y={y + 40}>
        {sub}
      </text>
      {status && (
        <text class={`d-sub ${tone ? `${tone}-fill` : 'muted'}`} x={x + w - 12} y={y + 22} text-anchor="end" style={{ fontWeight: tone ? 600 : 400 }}>
          {status}
        </text>
      )}
    </g>
  );
}
