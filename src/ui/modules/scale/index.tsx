// Scale-out vs 3-tier: nodes join the cluster one at a time, on a loop. Each new node adds
// compute, drives and its own storage controller (CVM); the 3-tier design underneath gains a
// host each time but keeps one array's two controllers. Math in src/engine/scaleout.ts.
import './style.css';
import { useScenario } from '../../../state/scenario';
import { useClock } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, fmtTB } from '../../components/controls';
import { Kpis, Show, ease, phaseAt, prog } from '../../components/show';
import { JOIN_STEPS, scaleModel, type JoinStep } from '../../../engine/scaleout';

const FROM = 4;
const TO = 8;
const STEP_S: Record<'add' | 'join' | 'balance', number> = { add: 1.4, join: 1.2, balance: 2.2 };

type Phase = { id: 'start' | JoinStep['id']; node: number; t: number };

const PHASES: Phase[] = (() => {
  const out: Phase[] = [{ id: 'start', node: -1, t: 0 }];
  let t = 2.6;
  for (let n = FROM; n < TO; n++)
    for (const id of ['add', 'join', 'balance'] as const) {
      out.push({ id, node: n, t });
      t += STEP_S[id];
    }
  out.push({ id: 'done', node: -1, t });
  return out;
})();
const STARTS = PHASES.map((p) => p.t);
const END = PHASES[PHASES.length - 1].t + 3.6;
const STEP = Object.fromEntries(JOIN_STEPS.map((s) => [s.id, s])) as Record<JoinStep['id'], JoinStep>;

/** Nodes present and nodes joined at phase index i. */
function countsAt(i: number) {
  const upTo = PHASES.slice(0, i + 1);
  return { present: FROM + upTo.filter((p) => p.id === 'add').length, joined: FROM + upTo.filter((p) => p.id === 'join').length };
}

export default function Scale() {
  const { cfg } = useScenario();
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: END });
  const t = clock.t;
  const i = phaseAt(STARTS, t);
  const ph = PHASES[i];
  const lp = prog(t, ph.t, PHASES[i + 1]?.t ?? END);
  const { present, joined } = countsAt(i);
  const m = scaleModel({ nodes: joined, drivesPerNode: cfg.drivesPerNode, driveTB: cfg.driveTB });
  const name = `N${ph.node + 1}`;
  const perCtl = (h: number) => (Number.isInteger(h / 2) ? String(h / 2) : (h / 2).toFixed(1));

  const caption =
    ph.id === 'start'
      ? { tone: 'ink' as const, k: `${FROM} nodes`, text: `Each node brings its own storage controller (its CVM), so ${FROM} nodes means ${FROM} controllers.`, rest: `3-tier: ${FROM} hosts share one array’s 2 controllers.` }
      : ph.id === 'done'
        ? { tone: 'ok' as const, k: `${TO} nodes, ${TO} controllers`, text: STEP.done.text, rest: `3-tier: ${TO} hosts still share 2 controllers. Growing past them means a bigger controller pair or another array to manage.` }
        : {
            tone: 'flow' as const,
            k: ph.id === 'add' ? `Adding ${name}` : ph.id === 'join' ? `${name} joins` : 'Disk balancing',
            text: STEP[ph.id].text,
            rest: ph.id === 'balance' ? null : `3-tier: host ${ph.node + 1} ${ph.id === 'add' ? 'is cabled to the storage network' : `shares the same 2 controllers, now ${perCtl(joined)} hosts each`}.`,
          };
  const word = ph.id === 'start' ? `${FROM} nodes` : ph.id === 'done' ? `${TO} nodes` : ph.id === 'add' ? `Adding ${name}` : ph.id === 'join' ? `${name} joins` : 'Balancing';

  return (
    <Show
      foot={
        <>
          <Follow tone={caption.tone} k={caption.k}>
            <p>{caption.text}</p>
            {caption.rest && <p class="rest">{caption.rest}</p>}
          </Follow>
          <Kpis
            items={[
              { k: 'Controllers, scale-out', v: m.hci.controllers, tone: 'ok', sub: 'one per node' },
              { k: 'Controllers, 3-tier', v: m.tier3.controllers, sub: `${perCtl(joined)} hosts each` },
              { k: 'Raw capacity, scale-out', v: fmtTB(m.hci.rawTB), sub: `+${fmtTB(cfg.drivesPerNode * cfg.driveTB)} per node`, tip: 'Drives per node and drive size come from the shared scenario. Usable capacity depends on RF and data reduction.' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <ScaleDiagram ph={ph} lp={lp} t={t} present={present} joined={joined} drives={cfg.drivesPerNode} />
      </div>
      <Legend
        items={[
          { color: 'var(--ink)', label: 'Storage controller' },
          { color: 'var(--flow)', label: 'Storage traffic' },
        ]}
      />
      <PlayBar clock={clock} label="Growth animation" fmt={() => word} extra={<Illus why="The 3-tier side is a generic, simplified model: one array with a controller pair. Many arrays scale in other ways, for example by adding controllers or arrays." />} />
    </Show>
  );
}

// ── geometry ──
const W = 960;
const PAD = 8;
const GAP = 12;
const NW = (W - 2 * PAD - (TO - 1) * GAP) / TO;
const Y1 = 34;
const NH1 = 112;
const POOL_Y = Y1 + NH1 + 10;
const Y2 = 236;
const NH2 = 50;
const SAN_Y = Y2 + NH2 + 24;
const AW = 330;
const AX = (W - AW) / 2;
const AY = SAN_Y + 20 + 32;
const H = AY + 82 + 8;
const CTL_X = [AX + 10 + (AW - 30) / 4, AX + 20 + ((AW - 30) * 3) / 4];
const nx = (i: number) => PAD + i * (NW + GAP);

/** A point a fraction f of the way along a polyline. */
function along(pts: [number, number][], f: number): [number, number] {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = f * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const r = seg[i] ? Math.min(1, d / seg[i]) : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r];
    }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}

function Vms({ x, y }: { x: number; y: number }) {
  return (
    <>
      {[0, 1, 2].map((k) => (
        <rect key={k} x={x + k * 22} y={y} width={16} height={16} class="vm hl" />
      ))}
    </>
  );
}

function ScaleDiagram({ ph, lp, t, present, joined, drives }: { ph: Phase; lp: number; t: number; present: number; joined: number; drives: number }) {
  const growing = ph.id === 'add' || ph.id === 'join' || ph.id === 'balance' ? ph.node : -1;
  const dShow = Math.min(drives, 6);
  const dW = (NW - 20) / dShow;
  // the pool reaches the last joined node; while a node joins it stretches over to it
  const poolEnd = ph.id === 'join' ? nx(joined - 2) + NW + (NW + GAP) * ease(lp) : nx(joined - 1) + NW;
  const balanceFrom = [0, Math.floor((growing - 1) / 2), growing - 1];

  return (
    <svg class="diagram scale-dia" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Scale-out: ${joined} nodes, each with its own storage controller, ${joined} controllers in all. 3-tier: ${joined} hosts sharing one array’s 2 controllers.`}>
      <text x={PAD} y={20} class="scale-h">
        Scale-out: every node brings compute, drives and its own storage controller
      </text>
      {Array.from({ length: present }, (_, i) => {
        const isNew = i === growing;
        const fresh = isNew && ph.id === 'add';
        const x = nx(i) + (fresh ? (1 - ease(lp)) * 50 : 0);
        const ctl = i >= joined ? 0 : isNew && ph.id === 'join' ? ease(lp) : 1;
        return (
          <g key={i} style={{ opacity: fresh ? Math.min(1, lp * 2) : 1 }}>
            <rect x={x} y={Y1} width={NW} height={NH1} class={`node-box${isNew ? ' sel' : ''}`} stroke-dasharray={i >= joined ? '5 4' : undefined} />
            <text x={x + 10} y={Y1 + 19} class="scale-s">
              N{i + 1}
              {isNew ? ' · new' : ''}
            </text>
            <Vms x={x + 10} y={Y1 + 28} />
            <rect x={x + 10} y={Y1 + 52} width={NW - 20} height={20} class="bg3" />
            {ctl > 0 && <rect x={x + 10} y={Y1 + 52} width={(NW - 20) * ctl} height={20} class="cvm" />}
            <text x={x + 16} y={Y1 + 66} class="scale-xs" style={{ fill: ctl > 0.3 ? '#fff' : undefined }}>
              CVM
            </text>
            {Array.from({ length: dShow }, (_, d) => (
              <rect key={d} x={x + 10 + d * dW} y={Y1 + 82} width={dW - 3} height={18} class="disk" />
            ))}
            {i < joined && <circle cx={x + NW - 16} cy={Y1 + 34 + ((t * 0.9 + i * 0.37) % 1) * 58} r={3.5} class="scale-io" />}
          </g>
        );
      })}
      <rect x={PAD} y={POOL_Y} width={poolEnd - PAD} height={12} class="ink-soft" stroke="var(--ink-line)" />
      <text x={PAD} y={POOL_Y + 30} class="scale-s scale-ink">
        One storage pool across {joined} nodes{ph.id === 'balance' ? ' · balancing data onto the new drives' : ''}
      </text>
      {ph.id === 'balance' &&
        balanceFrom.map((from, j) => {
          const fx = nx(from) + NW / 2;
          const gx = nx(growing) + NW / 2;
          const [x, y] = along(
            [
              [fx, Y1 + 100],
              [fx, POOL_Y + 6],
              [gx, POOL_Y + 6],
              [gx, Y1 + 100],
            ],
            (lp * 2.2 + j / 3) % 1,
          );
          return <circle key={j} cx={x} cy={y} r={4.5} class="scale-io" />;
        })}

      <line x1={PAD} x2={W - PAD} y1={Y2 - 38} y2={Y2 - 38} class="scale-rule" />
      <text x={PAD} y={Y2 - 14} class="scale-h">
        3-tier: hosts bring compute; all their storage goes through one array’s two controllers
      </text>
      {Array.from({ length: present }, (_, i) => {
        const isNew = i === growing;
        const fresh = isNew && ph.id === 'add';
        const x = nx(i) + (fresh ? (1 - ease(lp)) * 50 : 0);
        const linked = i < joined;
        const hx = nx(i) + NW / 2;
        const path: [number, number][] = [
          [hx, Y2 + NH2],
          [hx, SAN_Y + 10],
          [CTL_X[i % 2], SAN_Y + 10],
          [CTL_X[i % 2], AY + 10],
        ];
        const [dx, dy] = along(path, (t * 0.45 + i * 0.137) % 1);
        return (
          <g key={i} style={{ opacity: fresh ? Math.min(1, lp * 2) : 1 }}>
            <line x1={hx} y1={Y2 + NH2} x2={hx} y2={SAN_Y} class="scale-link" stroke-dasharray={linked ? undefined : '3 3'} />
            <rect x={x} y={Y2} width={NW} height={NH2} class={`node-box${isNew ? ' sel' : ''}`} />
            <text x={x + 10} y={Y2 + 19} class="scale-s">
              Host {i + 1}
            </text>
            <Vms x={x + 10} y={Y2 + 27} />
            {linked && <circle cx={dx} cy={dy} r={3.5} class="scale-io" />}
          </g>
        );
      })}
      <rect x={PAD} y={SAN_Y} width={W - 2 * PAD} height={20} class="bg3" stroke="var(--line-2)" />
      <text x={W - PAD - 10} y={SAN_Y + 14} text-anchor="end" class="scale-xs muted">
        storage network (SAN)
      </text>
      {CTL_X.map((cx) => (
        <line key={cx} x1={cx} y1={SAN_Y + 20} x2={cx} y2={AY + 10} class="scale-link strong" />
      ))}
      <rect x={AX} y={AY} width={AW} height={82} class="frame" />
      {[0, 1].map((c) => (
        <g key={c}>
          <rect x={AX + 10 + c * ((AW - 30) / 2 + 10)} y={AY + 10} width={(AW - 30) / 2} height={30} class="ink-fill" />
          <text x={CTL_X[c]} y={AY + 30} text-anchor="middle" class="scale-xs" style={{ fill: '#fff', fontWeight: 600 }}>
            Controller {c ? 'B' : 'A'}
          </text>
        </g>
      ))}
      <rect x={AX + 10} y={AY + 48} width={AW - 20} height={24} class="bg2" stroke="var(--line-2)" />
      <text x={AX + AW / 2} y={AY + 64} text-anchor="middle" class="scale-xs muted">
        drive shelves
      </text>
      <text x={AX + AW + 14} y={AY + 30} class="scale-xs muted">
        2 controllers, however many hosts
      </text>
    </svg>
  );
}
