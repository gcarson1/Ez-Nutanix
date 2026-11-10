// Data Lens, Data age & tiering tab: Data Lens watches every read and write on a share, ages each
// file by its last access into hot, warm and cold, and once both the age and the file server's
// capacity threshold are met, Smart Tiering moves cold data to Nutanix Objects (or another S3
// target) on its own, leaving a stub so a user can still read the file inline.
// Claims: docs/facts.md section 18 (OWN-9).
import { paced, useClock } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Kpis, Show, ease, phaseAt, prog } from '../../components/show';

type Heat = 'hot' | 'warm' | 'cold';

const COLS = 8;
const ROWS = 6;
const N = COLS * ROWS;
/** Each file's access pattern: hot files are read and written all the time, cold ones not for months. */
const HEAT: Heat[] = Array.from({ length: N }, (_, i) => (i % 7 === 0 || i % 5 === 1 ? 'hot' : i % 4 === 2 ? 'warm' : 'cold'));
const COUNT = { hot: HEAT.filter((h) => h === 'hot').length, warm: HEAT.filter((h) => h === 'warm').length, cold: HEAT.filter((h) => h === 'cold').length };
const COLD = HEAT.map((h, i) => (h === 'cold' ? i : -1)).filter((i) => i >= 0);
const RATE: Record<Heat, number> = { hot: 0.9, warm: 0.22, cold: 0 };
const AGE: Record<Heat, string> = { hot: 'read or written this month', warm: '30 to 90 days', cold: 'over 90 days' };
const USED0 = 82;
const USED1 = 46;
const THRESHOLD = 75;
const READ_FILE = COLD[3];

const P = [0, 5, 9, 14, 18];
const END = 22;
const LINES: { tone: Tone | 'ink'; k: string; text: string }[] = [
  { tone: 'ink', k: 'Access patterns', text: 'Data Lens tracks every read and write on the share. A few files are touched all the time, some now and then, and many have not been opened in months.' },
  { tone: 'flow', k: 'Files sorted by access frequency', text: 'From those access patterns Data Lens ages every file by its last read or write and sorts it hot, warm or cold. You set what each heat level means; the data age explorer shows it share by share.' },
  { tone: 'flow', k: 'Cold data tiers automatically', text: `The file server is ${USED0}% full, over its ${THRESHOLD}% capacity threshold, so the tiering policy runs in its time window: data in cold files moves to Nutanix Objects. Each file’s metadata and a stub stay in the share.` },
  { tone: 'ok', k: 'A tiered file is still there', text: 'A user opens a file that was tiered. The stub reads the data inline from Objects, at the same path, with nothing to restore; files can also be recalled automatically.' },
  { tone: 'ok', k: 'Fast storage for hot data', text: `Primary capacity drops from ${USED0}% to ${USED1}%, keeping the file server’s space for the hot and warm data people use, and Data Lens shows the cost saved by tiering.` },
];
const STEPS = paced(P, LINES.map((l) => [l.k, l.text]));

const W = 960;
const H = 320;
const USERS = { x: 0, y: 124, w: 122, h: 56 };
const SHARE = { x: 160, y: 28, w: 438, h: 252 };
const CW = 42;
const CH = 26;
const CG = 8;
const cx0 = SHARE.x + (SHARE.w - (COLS * CW + (COLS - 1) * CG)) / 2;
const cellXY = (i: number) => ({ x: cx0 + (i % COLS) * (CW + CG), y: SHARE.y + 54 + Math.floor(i / COLS) * (CH + CG) });
const DL = { x: 622, y: 28, w: 168, h: 252 };
const TGT = { x: 812, y: 92, w: 148, h: 124 };
const LANE = 300;
const tierAt = (k: number) => P[2] + 0.8 + k * 0.13;

type Pt = [number, number];
function along(pts: Pt[], f: number): Pt {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = Math.max(0, Math.min(1, f)) * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const r = seg[i] ? d / seg[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r];
    }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}
const toTarget = (i: number): Pt[] => {
  const c = cellXY(i);
  return [[c.x + CW / 2, c.y + CH], [c.x + CW / 2, LANE], [TGT.x + TGT.w / 2, LANE], [TGT.x + TGT.w / 2, TGT.y + TGT.h]];
};

/** How far the moved cold files are, and the capacity used, at time t. */
function stateAt(t: number) {
  const tiered = COLD.filter((_, k) => t >= tierAt(k) + 0.9).length;
  const used = t < P[2] ? USED0 : USED0 - ((USED0 - USED1) * tiered) / COLD.length;
  return { tiered, used };
}

function TierDiagram({ t }: { t: number }) {
  const ph = phaseAt(P, t);
  const colored = ease(prog(t, P[1] + 0.3, P[1] + 1.6));
  const { used } = stateAt(t);
  const heatCls = (h: Heat) => `dt-cell ${h}`;
  return (
    <svg class="diagram dt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A share of ${N} files. Data Lens tracks access and ages files: ${COUNT.hot} hot, ${COUNT.warm} warm and ${COUNT.cold} cold. Over the capacity threshold, cold data tiers to Nutanix Objects with a stub left in the share, and a user still reads a tiered file inline.`}>
      <rect x={USERS.x} y={USERS.y} width={USERS.w} height={USERS.h} rx={4} class="dl-pc" />
      <text class="d-label" x={USERS.x + 12} y={USERS.y + 24} style={{ fontWeight: 600 }}>
        Users
      </text>
      <text x={USERS.x + 12} y={USERS.y + 42} class="muted d-sub">
        SMB and NFS clients
      </text>
      <line x1={USERS.x + USERS.w} x2={SHARE.x} y1={USERS.y + USERS.h / 2} y2={USERS.y + USERS.h / 2} class="dl-link" />

      {/* the share and its capacity */}
      <rect x={SHARE.x} y={SHARE.y} width={SHARE.w} height={SHARE.h} rx={4} class="dl-srv" />
      <text class="d-title" x={SHARE.x + 14} y={SHARE.y + 20} style={{ fontWeight: 600 }}>
        Nutanix Files · <tspan class="mono d-label" style={{ fontWeight: 400 }}>\\files01\projects</tspan>
      </text>
      <text x={SHARE.x + 14} y={SHARE.y + 42} class="muted d-sub">
        capacity used
      </text>
      <rect x={SHARE.x + 100} y={SHARE.y + 33} width={220} height={12} class="bg3" />
      <rect x={SHARE.x + 100} y={SHARE.y + 33} width={(220 * used) / 100} height={12} class={used > THRESHOLD ? 'warn-fill' : 'ok-fill'} />
      <line x1={SHARE.x + 100 + (220 * THRESHOLD) / 100} x2={SHARE.x + 100 + (220 * THRESHOLD) / 100} y1={SHARE.y + 29} y2={SHARE.y + 49} class="dt-limit" />
      <text x={SHARE.x + 330} y={SHARE.y + 44} class="mono d-sub" style={{ fontWeight: 600 }}>
        {Math.round(used)}%
      </text>
      <text x={SHARE.x + 330 + 38} y={SHARE.y + 44} class="muted d-fine">
        limit {THRESHOLD}%
      </text>

      {HEAT.map((h, i) => {
        const c = cellXY(i);
        const k = COLD.indexOf(i);
        const stub = k >= 0 && t >= tierAt(k) + 0.9;
        const rate = RATE[h];
        const hit = rate > 0 && ph < 2 && ((t * rate + i * 0.37) % 1) < 0.18;
        const read = i === READ_FILE && ph === 3;
        return (
          <g key={i}>
            <rect x={c.x} y={c.y} width={CW} height={CH} rx={3} class={`${colored > 0.5 ? heatCls(h) : 'dt-cell'}${stub ? ' stub' : ''}${hit || read ? ' hit' : ''}`} />
            {stub && (
              <text x={c.x + CW / 2} y={c.y + 17} text-anchor="middle" class="muted d-fine">
                stub
              </text>
            )}
          </g>
        );
      })}

      {/* Data Lens: the data age explorer and the tiering policy */}
      <rect x={DL.x} y={DL.y} width={DL.w} height={DL.h} rx={4} class={`dl-srv${ph >= 1 ? ' dt-on' : ''}`} />
      <text class="d-title" x={DL.x + 12} y={DL.y + 22} style={{ fontWeight: 600 }}>
        Data Lens
      </text>
      <text x={DL.x + 12} y={DL.y + 40} class="muted d-sub">
        {ph === 0 ? 'watching reads and writes' : 'data age explorer'}
      </text>
      {(['hot', 'warm', 'cold'] as Heat[]).map((h, r) => (
        <g key={h} style={{ opacity: colored }}>
          <rect x={DL.x + 12} y={DL.y + 56 + r * 44} width={((DL.w - 24) * COUNT[h]) / N} height={14} class={`dt-bar ${h}`} />
          <text class="d-sub" x={DL.x + 12} y={DL.y + 84 + r * 44} style={{ fontWeight: 600 }}>
            {h[0].toUpperCase() + h.slice(1)} · {COUNT[h]} files
          </text>
          <text x={DL.x + 12} y={DL.y + 97 + r * 44} class="muted d-fine">
            {AGE[h]}
          </text>
        </g>
      ))}
      <text x={DL.x + 12} y={DL.y + DL.h - 30} class={`${ph >= 2 ? 'warn-fill' : 'muted'} d-fine`} style={{ fontWeight: 600 }}>
        policy: cold, over {THRESHOLD}%
      </text>
      <text x={DL.x + 12} y={DL.y + DL.h - 14} class="muted d-fine">
        {ph >= 4 ? 'cost saved: shown here' : 'runs in its time window'}
      </text>

      {/* the tiering target */}
      <rect x={TGT.x} y={TGT.y} width={TGT.w} height={TGT.h} rx={4} class={`dl-snap${ph >= 2 ? ' on' : ''}`} />
      <text class="d-label" x={TGT.x + 12} y={TGT.y + 24} style={{ fontWeight: 600 }}>
        Nutanix Objects
      </text>
      <text x={TGT.x + 12} y={TGT.y + 42} class="muted d-fine">
        or AWS S3, Azure Blob,
      </text>
      <text x={TGT.x + 12} y={TGT.y + 56} class="muted d-fine">
        Wasabi
      </text>
      <text x={TGT.x + 12} y={TGT.y + 92} class="mono d-sub" style={{ fontWeight: 600 }}>
        {stateAt(t).tiered} files tiered
      </text>
      <polyline points={`${cx0 - 6},${LANE} ${TGT.x + TGT.w / 2},${LANE} ${TGT.x + TGT.w / 2},${TGT.y + TGT.h}`} class="dl-link" fill="none" stroke-dasharray="4 4" />

      {/* access: dots from users to hot files while Data Lens watches */}
      {ph < 2 &&
        HEAT.map((h, i) => {
          if (h !== 'hot') return null;
          const f = (t * RATE.hot + i * 0.37) % 1;
          if (f > 0.5) return null;
          const c = cellXY(i);
          const [x, y] = along([[USERS.x + USERS.w, USERS.y + USERS.h / 2], [SHARE.x + 6, USERS.y + USERS.h / 2], [c.x + CW / 2, c.y + CH / 2]], f / 0.5);
          return <circle key={i} cx={x} cy={y} r={4} class="dl-dot ev" />;
        })}
      {/* cold data on its way to the target */}
      {COLD.map((i, k) => {
        const f = prog(t, tierAt(k), tierAt(k) + 0.9);
        if (f <= 0 || f >= 1) return null;
        const [x, y] = along(toTarget(i), ease(f));
        return <rect key={i} x={x - 5} y={y - 5} width={10} height={10} rx={2} class="dt-move" />;
      })}
      {/* an inline read of a tiered file: from the target, through the stub, to the user */}
      {ph === 3 &&
        (() => {
          const f = prog(t, P[3] + 0.5, P[3] + 3);
          if (f <= 0 || f >= 1) return null;
          const c = cellXY(READ_FILE);
          const back = [...toTarget(READ_FILE)].reverse();
          const pts: Pt[] = [...back, [c.x, c.y + CH / 2], [SHARE.x + 6, USERS.y + USERS.h / 2], [USERS.x + USERS.w, USERS.y + USERS.h / 2]];
          const [x, y] = along(pts, ease(f));
          return <circle cx={x} cy={y} r={5} class="dl-dot ok" />;
        })()}
    </svg>
  );
}

export function Tiering() {
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: P[2] + 3, steps: STEPS });
  const t = clock.t;
  const ph = phaseAt(P, t);
  const line = LINES[ph];
  const s = stateAt(t);
  return (
    <Show clock={clock}
      foot={
        <>
          <Follow tone={line.tone} k={line.k}>
            <p>{line.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Hot · warm · cold', v: ph >= 1 ? `${COUNT.hot} · ${COUNT.warm} · ${COUNT.cold}` : '…', sub: 'files, by last access' },
              { k: 'Capacity used', v: `${Math.round(s.used)}%`, tone: s.used > THRESHOLD ? 'warn' : 'ok', sub: `threshold ${THRESHOLD}%` },
              { k: 'Tiered', v: `${s.tiered} files`, sub: 'stubs stay in the share', tone: s.tiered ? 'ok' : undefined },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <TierDiagram t={t} />
      </div>
      <Legend
        items={[
          { color: 'var(--flow)', label: 'Hot: used all the time' },
          { color: 'var(--warn)', label: 'Warm' },
          { color: 'var(--s2)', label: 'Cold: not opened in months' },
          { color: 'var(--line-2)', dashed: true, label: 'Stub left after tiering' },
        ]}
      />
      <PlayBar
        clock={clock}
        label="Data age and tiering animation"
        extra={<Illus why="Example share: file counts, heat levels, the 90-day cold age and the 75% threshold are settings you choose. Months of access are compressed into seconds. Tiering moves file data, not metadata, and runs in the time windows you set." />}
      />
    </Show>
  );
}
