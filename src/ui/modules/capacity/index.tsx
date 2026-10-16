// Protection & Capacity: pick RF2 or RF3 and a node count, and watch pieces of data land as
// copies on different nodes, a node fail, and the copies being re-created on the others.
// Placement lives in src/engine/spread.ts; this file only animates it.
import { useMemo } from 'preact/hooks';
import { useScenario } from '../../../state/scenario';
import { capacityShares, planSpread } from '../../../engine/spread';
import type { RF } from '../../../engine/rules';
import { useClock, useRestartOn } from '../../components/clock';
import { Follow, PlayBar } from '../../components/controls';
import { Choice, Kpis, Show, ease, phaseAt, prog } from '../../components/show';
import './style.css';

const NODE_OPTS = [3, 4, 5, 6, 8, 12];
const W = 960;
const PAD = 8;
const TOP = 100;
const FLIGHT = 0.7;
const REBUILD_FLIGHT = 0.9;

/** Eight simple shapes; each piece of data is drawn as one of them. */
function Shape({ kind, x, y, r, cls, style }: { kind: number; x: number; y: number; r: number; cls: string; style?: Record<string, string | number> }) {
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

function useTimeline(nodes: number, rf: RF) {
  return useMemo(() => {
    const plan = planSpread(nodes, rf);
    const dt = 5 / plan.pieces;
    const t0 = 0.5;
    const writesEnd = t0 + (plan.pieces - 1) * dt + FLIGHT;
    const fail = writesEnd + 1;
    const detect = fail + 1.3;
    const rebuilds = plan.copies.filter((c) => c.kind === 'rebuild');
    const gap = Math.min(0.14, 2.4 / Math.max(1, rebuilds.length));
    const done = detect + Math.max(0, rebuilds.length - 1) * gap + REBUILD_FLIGHT + 0.2;
    const end = done + 2.4;
    const start = new Map<string, number>();
    let j = 0;
    for (const c of plan.copies) start.set(`${c.piece}:${c.node}`, c.kind === 'write' ? t0 + c.piece * dt : detect + j++ * gap);
    return { plan, start, fail, detect, done, end };
  }, [nodes, rf]);
}

function Spread({ nodes, rf, t, tl }: { nodes: number; rf: RF; t: number; tl: ReturnType<typeof useTimeline> }) {
  const { plan, start, fail } = tl;
  const gap = nodes > 8 ? 8 : 14;
  const nW = (W - PAD * 2 - gap * (nodes - 1)) / nodes;
  const cols = Math.max(2, Math.min(4, Math.floor((nW - 10) / 22)));
  const sz = Math.min(38, (nW - 10) / cols);
  const maxSlots = Math.max(...plan.copies.map((c) => c.slot)) + 1;
  const rows = Math.ceil(maxSlots / cols);
  const nH = 34 + rows * sz + 10;
  const H = TOP + nH + 8;
  const down = new Set(plan.failed);
  const isDown = (n: number) => down.has(n) && t >= fail;
  const nodeX = (n: number) => PAD + n * (nW + gap);
  const slotXY = (n: number, s: number) => {
    const gridW = cols * sz;
    const x0 = nodeX(n) + (nW - gridW) / 2;
    return { x: x0 + (s % cols) * sz + sz / 2, y: TOP + 34 + Math.floor(s / cols) * sz + sz / 2 };
  };
  const src = { x: W / 2, y: 62 };
  const r = sz * 0.32;

  return (
    <svg class="diagram cp-spread" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${nodes} nodes with RF${rf}: each piece of data is kept as ${rf} copies on different nodes. When ${rf === 2 ? 'a node fails' : 'two nodes fail'}, the other nodes re-create the missing copies.`}>
      <rect class="cp-src" x={W / 2 - 90} y={18} width={180} height={40} />
      <text x={W / 2} y={43} text-anchor="middle" class="cp-src-t">
        Apps write data
      </text>
      {Array.from({ length: nodes }, (_, n) => (
        <g key={n}>
          <rect class={`node-box${isDown(n) ? ' down' : ''}`} x={nodeX(n)} y={TOP} width={nW} height={nH} />
          <text x={nodeX(n) + 10} y={TOP + 21} style={{ fontWeight: 600, fontSize: nodes > 8 ? '12px' : '14px' }}>
            N{n + 1}
          </text>
          {isDown(n) && (
            <text x={nodeX(n) + nW - 8} y={TOP + 21} text-anchor="end" class="bad-fill" style={{ fontSize: '11px', fontWeight: 600 }}>
              ✕ {nW > 70 ? 'down' : ''}
            </text>
          )}
        </g>
      ))}
      {plan.copies.map((c) => {
        const t0 = start.get(`${c.piece}:${c.node}`)!;
        if (t < t0) return null;
        const to = slotXY(c.node, c.slot);
        const from = c.kind === 'write' ? src : slotXY(c.from!.node, c.from!.slot);
        const k = ease(prog(t, t0, t0 + (c.kind === 'write' ? FLIGHT : REBUILD_FLIGHT)));
        const x = from.x + (to.x - from.x) * k;
        const y = from.y + (to.y - from.y) * k;
        const lost = isDown(c.node);
        const fresh = c.kind === 'rebuild' && t < t0 + REBUILD_FLIGHT + 0.8;
        const cls = lost ? 'cp-lost' : fresh ? 'cp-new' : 'cp-copy';
        return <Shape key={`${c.piece}:${c.node}`} kind={c.piece} x={x} y={y} r={r} cls={cls} />;
      })}
    </svg>
  );
}

function pct(x: number) {
  return `${Math.round(x * 100)}%`;
}

export default function Capacity() {
  const { cfg, set } = useScenario();
  const rf: RF = cfg.rf === 3 ? 3 : 2;
  const nodes = Math.min(16, Math.max(3, cfg.nodes));
  const tl = useTimeline(nodes, rf);
  const clock = useClock({ rate: 1, duration: tl.end, keys: true, poster: tl.done + 0.5, stops: [tl.fail, tl.detect, tl.done] });
  useRestartOn(clock, [nodes, rf]);
  const t = clock.t;
  const phase = phaseAt([0, tl.fail, tl.detect, tl.done], t);
  const share = capacityShares(nodes, rf);
  const failedNames = tl.plan.failed.map((n) => `N${n + 1}`).join(' and ');

  const opts = NODE_OPTS.includes(nodes) ? NODE_OPTS : [...NODE_OPTS, nodes].sort((a, b) => a - b);
  const caption = [
    { tone: 'ink' as const, k: 'Writing', text: `Every piece of data is stored as ${rf} copies, each on a different node. No node holds two copies of the same piece.` },
    { tone: 'bad' as const, k: rf === 2 ? 'A node fails' : 'Two nodes fail at once', text: `${failedNames} ${rf === 2 ? 'goes' : 'go'} down. Every piece still has a copy on a healthy node, so nothing is lost and VMs keep running.` },
    { tone: 'flow' as const, k: 'Self-healing', text: 'The healthy nodes re-create the missing copies together, many nodes to many nodes, so the cluster heals quickly.' },
    { tone: 'ok' as const, k: 'Protected again', text: `Back to ${rf} copies of everything, on the nodes that are left. The cluster can take another failure.` },
  ][phase];

  return (
    <Show
      top={
        <>
          <Choice<RF>
            label="Protection"
            value={rf}
            onChange={(v) => (v === 3 ? set({ rf: 3, ft: 3, nodes: Math.max(5, nodes), ecx: false }) : set({ rf: 2, ft: 2, ecx: false }))}
            options={[
              { value: 2, label: 'RF2 · 2 copies' },
              { value: 3, label: 'RF3 · 3 copies' },
            ]}
          />
          <Choice<number>
            label="Nodes"
            value={nodes}
            onChange={(v) => set({ nodes: v })}
            why={rf === 3 ? 'RF3 needs at least 5 nodes.' : null}
            options={opts.map((n) => ({ value: n, label: String(n), disabled: rf === 3 && n < 5, title: rf === 3 && n < 5 ? 'RF3 needs at least 5 nodes' : undefined }))}
          />
        </>
      }
      foot={
        <>
          <Follow tone={caption.tone} k={caption.k}>
            <p>{caption.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Copies of each piece', v: rf },
              { k: 'Survives', v: rf === 2 ? '1 failure' : '2 at once', tone: 'ok' },
              { k: 'Usable', v: pct(share.data), sub: 'of raw, after the reserve', tip: `Raw divided by ${rf} copies, after keeping ${share.reserveNodes === 1 ? 'one node' : 'two nodes'} of free space so data can fully re-protect after a failure.` },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <Spread nodes={nodes} rf={rf} t={t} tl={tl} />
      </div>
      <PlayBar clock={clock} label="Data placement animation" fmt={() => ['Writing', 'Failure', 'Self-healing', 'Protected'][phase]} />
      <div class="cp-share" role="img" aria-label={`Raw capacity: ${pct(share.data)} your data, ${pct(share.copies)} extra copies, ${pct(share.reserve)} kept free for a rebuild`}>
        <div class="cp-share-bar">
          <i class="cp-d" style={{ width: pct(share.data) }} />
          <i class="cp-c" style={{ width: pct(share.copies) }} />
          <i class="cp-r" style={{ width: pct(share.reserve) }} />
        </div>
        <div class="cp-share-l">
          <span>
            <b class="cp-d" /> Your data {pct(share.data)}
          </span>
          <span>
            <b class="cp-c" /> Extra copies {pct(share.copies)}
          </span>
          <span>
            <b class="cp-r" /> Kept free for a rebuild {pct(share.reserve)}
          </span>
        </div>
      </div>
    </Show>
  );
}
