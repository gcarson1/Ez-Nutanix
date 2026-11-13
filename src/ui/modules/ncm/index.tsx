// Nutanix Cloud Manager (NCM): one tab per component (AIOps, Self-Service, Cost, Security).
// Each tab is one looping picture with at most one preset choice. The models live in
// src/engine/ncm.ts; this file only animates them.
import { useMemo } from 'preact/hooks';
import { useEnum } from '../../../state/route';
import {
  accrued,
  anomalyBand,
  budgetState,
  cpuSeries,
  crossDay,
  monthlyCost,
  paceEnd,
  requestSteps,
  runRequests,
  score,
  SEV_WEIGHT,
  SS_PROJECT,
  SS_REQUESTS,
  stepAt,
  stretches,
  withSpike,
  type Check,
  type ProvStep,
  type Surge,
  type Usage,
} from '../../../engine/ncm';
import { paced, stepsFrom, useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { Choice, Kpis, Points, Show, ease, phaseAt, prog, type Point, Tabs } from '../../components/show';
import './style.css';

type Line = { tone: Tone | 'ink'; k: string; text: string };

const TIER_TIP = {
  Pro: 'Needs NCM Pro or higher. Pro adds Cost Governance, the Self-Service marketplace, single-VM blueprints and runbooks.',
  Ultimate: 'Needs NCM Ultimate: multi-VM app blueprints, approvals and scheduling, and Security Compliance.',
} as const;

const W = 960;

const REPLATFORM = ' NCM is being re-platformed, and its services are not all deployed the same way, so check what your release runs and where.';

// ───────────────────────── AIOps ─────────────────────────
const DAYS = 21;
const LEARN = 14;
const K_SIGMA = 3;
const FIXED = 70;
const SPIKE = 35;
const DRAW_FROM = 0.8;
const DRAW_DUR = 8;
const AI_END = DRAW_FROM + DRAW_DUR + 0.6;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Two spikes in the same week: one at 3 a.m. that a fixed alarm misses, one on a busy afternoon that it catches. */
const SPIKES = [
  { at: 1 * 24 + 2, when: 'at 3 a.m.' },
  { at: 3 * 24 + 13, when: 'at 2 p.m.' },
];

/** 12-hour clock for the readout: 0 is 12 a.m., 13 is 1 p.m. */
const hour12 = (h: number) => `${h % 12 || 12} ${h < 12 ? 'a.m.' : 'p.m.'}`;

function useWeek() {
  return useMemo(() => {
    const series = SPIKES.reduce((sr, sp) => withSpike(sr, LEARN * 24 + sp.at, SPIKE), cpuSeries(DAYS, 11));
    const pts = anomalyBand(series, K_SIGMA, LEARN).slice(LEARN * 24);
    const flagged = stretches(pts.map((p) => p.out));
    const fixed = stretches(pts.map((p) => p.v > FIXED));
    const peaks = flagged.map((f) => Math.max(...pts.slice(f.start, f.end).map((p) => p.v)));
    const flagAt = flagged.map((f) => DRAW_FROM + (f.start / (pts.length - 1)) * DRAW_DUR);
    return { pts, flagged, fixed, peaks, flagAt };
  }, []);
}

function WeekChart({ wk, hc, t }: { wk: ReturnType<typeof useWeek>; hc: number; t: number }) {
  const { pts, flagged, fixed } = wk;
  const H = 340;
  const l = 68;
  const r = 16;
  const top = 64;
  const b = 56;
  const n = pts.length;
  const sx = (i: number) => l + (i / (n - 1)) * (W - l - r);
  const sy = (v: number) => top + (1 - v / 100) * (H - top - b);
  const hi = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)} ${sy(Math.min(100, p.hi)).toFixed(1)}`).join(' ');
  const lo = pts
    .map((p, i) => ({ p, i }))
    .reverse()
    .map(({ p, i }) => `L${sx(i).toFixed(1)} ${sy(Math.max(0, p.lo)).toFixed(1)}`)
    .join(' ');
  const last = Math.floor(hc);
  const drawn = pts.slice(0, last + 1).map((p, i) => [sx(i), sy(p.v)] as const);
  if (last < n - 1) {
    const f = hc - last;
    drawn.push([sx(hc), sy(pts[last].v + (pts[last + 1].v - pts[last].v) * f)]);
  }
  const line = drawn.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const shown = flagged.filter((s) => s.start <= hc);
  const alarmed = (s: { start: number; end: number }) => fixed.some((f) => f.start < s.end && f.end > s.start);
  return (
    <svg class="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`CPU over one week with the learned normal band and a fixed ${FIXED}% alarm line. Spikes ${SPIKES[0].when} and ${SPIKES[1].when} are both flagged as unusual; the fixed alarm fires only for the one ${SPIKES[1].when}.`}>
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={l} x2={W - r} y1={sy(v)} y2={sy(v)} class={v ? 'ncm-grid' : 'line'} />
          <text x={l - 8} y={sy(v) + 4} text-anchor="end" class="mono muted d-fine">
            {v}%
          </text>
        </g>
      ))}
      {WEEKDAYS.map((d, i) => (
        <text key={d} x={sx(i * 24 + 12)} y={H - 30} text-anchor="middle" class="muted d-sub">
          {d}
        </text>
      ))}
      <text x={(l + W - r) / 2} y={H - 8} text-anchor="middle" class="muted d-sub">
        Time, hour by hour over one week
      </text>
      <text transform={`translate(16 ${(top + H - b) / 2}) rotate(-90)`} text-anchor="middle" class="muted d-sub">
        CPU %
      </text>
      <path d={`${hi} ${lo} Z`} class="ncm-band" style={{ opacity: prog(t, 0, DRAW_FROM) }} />
      <line x1={l} x2={W - r} y1={sy(FIXED)} y2={sy(FIXED)} class="ncm-fixed" />
      <text x={W - r} y={sy(FIXED) - 6} text-anchor="end" class="muted halo d-sub">
        A fixed {FIXED}% alarm
      </text>
      {t >= DRAW_FROM && <path d={line} class="ncm-cpu" />}
      {t >= DRAW_FROM && hc < n - 1 && <line x1={sx(hc)} x2={sx(hc)} y1={top} y2={H - b} class="ncm-cursor" />}
      {shown.map((s) => {
        const seg = pts.slice(s.start, s.end);
        const k = seg.reduce((m, p, i) => (p.v > seg[m].v ? i : m), 0);
        const x = sx(s.start + k);
        const y = sy(seg[k].v);
        const lx = Math.max(l + 100, Math.min(W - r - 120, x));
        const al = alarmed(s);
        // labels sit in the band above the plot; a leader line drops from the label to the spike
        return (
          <g key={s.start}>
            <polyline points={`${x},${y - 8} ${x},${top - 12} ${lx},${top - 12}`} fill="none" class="ncm-leader" />
            <circle cx={x} cy={y} r={7} class="bad-fill" stroke="var(--bg)" stroke-width={2} />
            <text x={lx} y={top - 34} text-anchor="middle" class="bad-fill d-label" style={{ fontWeight: 600 }}>
              ✕ Unusual for this hour
            </text>
            <text x={lx} y={top - 18} text-anchor="middle" class={`${al ? 'muted' : 'warn-fill'} d-sub`} style={{ fontWeight: 600 }}>
              {al ? `Over ${FIXED}%: the fixed alarm fires too` : `Under ${FIXED}%: the fixed alarm stays silent`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function AiOps() {
  const wk = useWeek();
  const [night, day] = wk.peaks.map((v) => Math.round(v));
  const lines: Line[] = [
    { tone: 'ink', k: 'Normal range learned', text: 'The shaded band is what normal CPU looks like for each hour of the week, learned from the two weeks before.' },
    { tone: 'ink', k: 'Busy afternoons are normal', text: 'Weekday afternoons run hot every day, so they stay inside the band and raise nothing.' },
    { tone: 'bad', k: `Spike flagged ${SPIKES[0].when}`, text: `CPU jumps to ${night}% at 3 a.m., far above normal for that hour, so it is raised as an anomaly. A fixed ${FIXED}% alarm, set high enough to stay quiet on busy afternoons, misses it.` },
    { tone: 'bad', k: `Spike flagged ${SPIKES[1].when}`, text: `CPU jumps to ${day}% on a busy afternoon, above normal even for that hour, so it is flagged. It crosses ${FIXED}%, so the fixed alarm fires too, but only the learned band caught both.` },
  ];
  const starts = [0, DRAW_FROM, ...wk.flagAt];
  const clock = useClock({ rate: 1, duration: AI_END, keys: true, poster: AI_END, steps: paced(starts, lines.map((l) => [l.k, l.text])) });
  const t = clock.t;
  const hc = prog(t, DRAW_FROM, DRAW_FROM + DRAW_DUR) * (wk.pts.length - 1);
  const phase = phaseAt(starts, t);
  const flaggedNow = wk.flagged.filter((s) => s.start <= hc).length;
  const firedNow = wk.fixed.filter((s) => s.start <= hc).length;
  const line = lines[phase];
  return (
    <Show clock={clock}
      foot={
        <>
          <Follow tone={line.tone} k={line.k}>
            <p>{line.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Flagged as unusual', v: flaggedNow, tone: flaggedNow ? 'bad' : 'neutral' },
              { k: `Fixed ${FIXED}% alarm fired`, v: firedNow, tone: firedNow < flaggedNow ? 'warn' : 'neutral', sub: firedNow < flaggedNow ? 'missed the 3 a.m. spike' : undefined },
              { k: 'Learned from', v: '2 weeks', sub: 'of history, per hour' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <WeekChart wk={wk} hc={hc} t={t} />
      </div>
      <Legend
        items={[
          { color: 'var(--ink-line)', label: 'Normal for each hour (learned)' },
          { color: 'var(--text)', label: 'CPU this week' },
          { color: 'var(--s2)', dashed: true, label: `Fixed ${FIXED}% alarm` },
          { color: 'var(--bad)', label: 'Flagged as unusual' },
        ]}
      />
      <PlayBar
        clock={clock}
        label="Anomaly detection animation"
        fmt={() => (t < DRAW_FROM ? 'Learning' : hc >= wk.pts.length - 1 ? 'Week done' : `${WEEKDAYS[Math.min(6, Math.floor(hc / 24))]} ${hour12(Math.floor(hc) % 24)}`)}
        extra={<Illus why={"Example data. The band here is learned per hour of day (weekday or weekend) from the previous two weeks. Intelligent Operations uses its own machine-learned baselines, and also forecasts capacity runway and suggests right-sizing." + REPLATFORM} />}
      />
    </Show>
  );
}

// ───────────────────────── Self-Service ─────────────────────────
// One project, four requests in a row: one goes straight through, one is held by the optional
// approval policy, one is over the quota and blocked, and the same app re-ordered smaller fits.
// The requests, project and quota math are in engine/ncm.ts (SS_REQUESTS, runRequests); a unit
// test keeps their outcomes matched to these cards.
const APP_ROLES = ['Balancer', 'Web', 'App', 'Database'];

/** How each request's App team box names it, in SS_REQUESTS order. */
const SS_TEXT: { order: string }[] = [
  { order: 'orders: Linux VM' },
  { order: 'orders: 3-tier web app' },
  { order: 'orders: a second app' },
  { order: 're-orders it at size S' },
];

/** Each request with the project as it stands when that request arrives, and its steps on the shared timeline. */
const RUN = (() => {
  let at = 0;
  return runRequests(SS_PROJECT, SS_REQUESTS).map((x, i) => {
    const steps = requestSteps(SS_REQUESTS[i].item, x.v);
    const run = { ...SS_REQUESTS[i], ...SS_TEXT[i], ...x, steps, at, end: at + steps.reduce((s, y) => s + y.dur, 0) };
    at = run.end;
    return run;
  });
})();
type Run = (typeof RUN)[number];
const SS_END = RUN[RUN.length - 1].end;

const BOX = { req: { x: 12, w: 176 }, chk: { x: 258, w: 176 } } as const;
const BY = 112;
const BH = 80;
const LANE = BY + BH / 2;
const APR = { x: 470, y: 12, w: 190, h: 64 };
const DET = { a: 452, b: 678, y: APR.y + APR.h / 2 };
const CL = { x: 696, y: 12, w: 252, h: 286 };
const QY = 236;
const QW = 648;
const TILE = { w: 74, h: 60, dx: 80, dy: 68 };

type XY = [number, number];
const pt = (pts: XY[], f: number): XY => {
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
};
const reqR = BOX.req.x + BOX.req.w;
const chkR = BOX.chk.x + BOX.chk.w;
const TO_CHECK: XY[] = [[reqR, LANE], [BOX.chk.x, LANE]];
const TO_APPROVAL: XY[] = [[chkR, LANE], [DET.a, LANE], [DET.a, DET.y], [APR.x, DET.y]];
const FROM_APPROVAL: XY[] = [[APR.x + APR.w, DET.y], [DET.b, DET.y], [DET.b, LANE], [CL.x, LANE]];
const STRAIGHT: XY[] = [[chkR, LANE], [CL.x, LANE]];
const poly = (pts: XY[]) => pts.map(([x, y]) => `${x},${y}`).join(' ');

function Provision({ i, t }: { i: number; t: number }) {
  const r = RUN[i];
  const { p, d, v, steps, item } = r;
  const at = stepAt(steps, t - r.at);
  const id = steps[at.idx].id;
  const past = (s: ProvStep['id']) => {
    const k = steps.findIndex((x) => x.id === s);
    return k >= 0 && (at.idx > k || at.done);
  };
  const now = (s: ProvStep['id']) => !at.done && id === s;

  // the request token, drawn only while it travels
  let token: { at: XY; bad?: boolean } | null = null;
  const move = (pts: XY[], f: number, bad = false) => (f > 0 && f < 1 ? { at: pt(pts, ease(f)), bad } : null);
  if (now('policy')) token = move(TO_CHECK, prog(at.frac, 0, 0.55));
  else if (now('refused')) token = move([...TO_CHECK].reverse(), prog(at.frac, 0, 0.5), true);
  else if (now('approve')) token = move(TO_APPROVAL, prog(at.frac, 0, 0.35));
  else if (now('create')) token = move(v.needsApproval ? FROM_APPROVAL : STRAIGHT, prog(at.frac, 0, 0.3));

  const checked = past('policy');
  const refused = checked && !v.ok;
  const sentBack = refused && (past('refused') || (now('refused') && at.frac > 0.5));
  const checking = now('policy') && at.frac >= 0.55;
  const detour = v.ok && v.needsApproval && checked;
  const vmsShown = past('create') ? item.vms : now('create') ? Math.floor(prog(at.frac, 0.3, 1) * item.vms + 1e-9) : 0;
  const configFrac = past('config') ? 1 : now('config') ? at.frac : 0;
  const ready = past('ready') || (now('ready') && at.frac > 0.2);

  // every VM created so far, earlier requests' already running
  const tiles = RUN.slice(0, i + 1).flatMap((q, j) =>
    q.v.ok ? Array.from({ length: q.item.vms }, (_, k) => ({ role: q.item.multiVm ? APP_ROLES[k] : q.item.label, vcpu: q.d.vcpu / q.item.vms, mine: j === i, k })) : [],
  );

  const usedW = (p.used.vcpu / p.quota.vcpu) * QW;
  const addW = Math.min(QW - usedW, (d.vcpu / p.quota.vcpu) * QW);
  const overW = refused ? Math.min(28, ((p.used.vcpu + d.vcpu - p.quota.vcpu) / p.quota.vcpu) * QW) : 0;
  const aprStatus = !v.ok ? (checked ? 'Not reached' : 'Waiting') : !v.needsApproval ? 'Skipped: not above the limit' : past('approve') ? '✓ Approved' : now('approve') && at.frac > 0.35 ? 'Waiting for an admin' : 'Waiting';
  const aprCls = past('approve') ? 'ok-fill' : now('approve') && at.frac > 0.35 ? 'warn-fill' : 'muted';

  const box = (k: keyof typeof BOX, title: string, sub: string, status: string, statusCls: string) => (
    <g>
      <rect class="ss-box" x={BOX[k].x} y={BY} width={BOX[k].w} height={BH} />
      <text x={BOX[k].x + 14} y={BY + 24} class="ss-h">
        {title}
      </text>
      <text x={BOX[k].x + 14} y={BY + 43} class="muted d-sub">
        {sub}
      </text>
      <text x={BOX[k].x + 14} y={BY + 66} class={`${statusCls} d-label`} style={{ fontWeight: 600 }}>
        {status}
      </text>
    </g>
  );

  return (
    <svg class="diagram" viewBox={`0 0 ${W} 310`} role="img" aria-label={`Request ${i + 1} of ${RUN.length} from project ${p.label}: ${item.label} at size ${r.size}. ${v.ok ? `It fits the quota${v.needsApproval ? ', the optional approval policy holds it for an admin,' : ' and skips the optional approval,'} and it is created.` : 'It is over the quota: Prism Central blocks the provisioning action and shows the violation details and the reason.'}`}>
      <defs>
        <marker id="ss-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="ss-mk" />
        </marker>
      </defs>
      <line x1={reqR + 4} x2={BOX.chk.x - 6} y1={LANE} y2={LANE} class="ss-arrow" marker-end="url(#ss-ar)" />
      <line x1={chkR + 4} x2={CL.x - 6} y1={LANE} y2={LANE} class={`ss-arrow${refused || detour ? ' off' : ''}`} marker-end="url(#ss-ar)" />
      <text x={(chkR + CL.x) / 2} y={LANE + 20} text-anchor="middle" class="muted d-sub">
        no approval needed
      </text>

      {/* the optional approval policy: a detour, taken only by requests over its limit */}
      <polyline points={poly(TO_APPROVAL)} class={`ss-arrow${detour ? '' : ' off'}`} fill="none" />
      {/* only the detour in use draws its own way into the cluster; otherwise it stops where it meets the lane */}
      <polyline points={poly(detour ? [...FROM_APPROVAL.slice(0, 3), [CL.x - 6, LANE]] : FROM_APPROVAL.slice(0, 3))} class={`ss-arrow${detour ? '' : ' off'}`} fill="none" marker-end={detour ? 'url(#ss-ar)' : undefined} />
      <g class={detour ? '' : 'ss-dim'}>
        <rect class={`ss-box${detour ? '' : ' dashed'}`} x={APR.x} y={APR.y} width={APR.w} height={APR.h} />
        <text x={APR.x + 14} y={APR.y + 22} class="ss-h">
          Approval <tspan class="muted d-sub" style={{ fontWeight: 400 }}>· optional policy</tspan>
        </text>
        <text x={APR.x + 14} y={APR.y + 39} class="muted d-sub">
          only above {p.approvalAbove} vCPU
        </text>
        <text x={APR.x + 14} y={APR.y + 56} class={`${aprCls} d-label`} style={{ fontWeight: 600 }}>
          {aprStatus}
        </text>
      </g>

      {box('req', 'App team', `project ${p.label}`, sentBack ? '✕ Blocked' : r.order, sentBack ? 'bad-fill' : 'muted')}
      {box('chk', 'Quota and policy', 'checked first', checked ? (v.ok ? '✓ Fits the quota' : '✕ Over the quota') : checking ? 'Checking…' : 'Waiting', checked ? (v.ok ? 'ok-fill' : 'bad-fill') : checking ? 'ncm-ink' : 'muted')}

      {/* the cluster where the project's VMs land */}
      <rect class="node-box" x={CL.x} y={CL.y} width={CL.w} height={CL.h} />
      <text x={CL.x + 14} y={CL.y + 24} class="ss-h">
        Cluster
      </text>
      <text x={CL.x + 14} y={CL.y + 42} class={`${refused ? 'bad-fill' : 'muted'} d-sub`}>
        {refused ? 'nothing created for this request' : `project ${p.label}`}
      </text>
      {tiles.map((v2, n) => {
        const x = CL.x + 12 + (n % 3) * TILE.dx;
        const y = CL.y + 52 + Math.floor(n / 3) * TILE.dy;
        const shown = !v2.mine || v2.k < vmsShown;
        if (!shown) return null;
        const live = !v2.mine || ready;
        return (
          <g key={n}>
            <rect x={x} y={y} width={TILE.w} height={TILE.h} class={v2.mine && ready ? 'vm hl' : 'vm'} />
            <text class="d-sub" x={x + 8} y={y + 18} style={{ fontWeight: 600 }}>
              {v2.role}
            </text>
            <text x={x + 8} y={y + 33} class="mono muted d-fine">
              {v2.vcpu} vCPU
            </text>
            {!live && configFrac > 0 && (
              <>
                <rect x={x + 8} y={y + 44} width={TILE.w - 16} height={5} class="bg3" />
                <rect x={x + 8} y={y + 44} width={(TILE.w - 16) * configFrac} height={5} class="flow-fill" />
              </>
            )}
            {!live && configFrac === 0 && (
              <text x={x + 8} y={y + 50} class="muted d-fine">
                Deploying…
              </text>
            )}
            {live && (
              <text x={x + 8} y={y + 50} class="ok-fill d-fine" style={{ fontWeight: 600 }}>
                ✓ Running
              </text>
            )}
          </g>
        );
      })}
      {ready && (
        <text x={CL.x + 14} y={CL.y + CL.h - 12} class="ok-fill d-sub" style={{ fontWeight: 600 }}>
          ✓ Owner, project, categories set
        </text>
      )}

      {token && <rect x={token.at[0] - 13} y={token.at[1] - 9} width={26} height={18} rx={3} class={token.bad ? 'bad-fill' : 'ink-fill'} />}

      {/* the project's vCPU quota */}
      <text x={12} y={QY - 10} class="muted d-sub">
        Project {p.label} · vCPU quota
      </text>
      <rect x={12} y={QY} width={QW} height={18} class="bg3" />
      <rect x={12} y={QY} width={usedW} height={18} class="ss-used" />
      {checked && <rect x={12 + usedW} y={QY} width={addW} height={18} class={v.ok ? 'flow-fill' : 'bad-fill'} />}
      {refused && <rect x={12 + QW} y={QY} width={overW} height={18} class="ss-over" />}
      <line x1={12 + QW} x2={12 + QW} y1={QY - 6} y2={QY + 24} class="ss-limit" />
      <text x={12} y={QY + 40} class="mono d-label">
        {checked ? (v.ok ? `${p.used.vcpu} used + ${d.vcpu} for this request = ${v.after.vcpu} of ${p.quota.vcpu} vCPU` : `${p.used.vcpu} used, needs ${d.vcpu}, only ${p.quota.vcpu - p.used.vcpu} left of ${p.quota.vcpu}`) : `${p.used.vcpu} of ${p.quota.vcpu} vCPU used`}
      </text>
    </svg>
  );
}

function ssLine(r: Run, id: ProvStep['id']): Line {
  const { p, d, item } = r;
  const n = item.vms > 1 ? `${item.vms} VMs` : 'the VM';
  const left = p.quota.vcpu - p.used.vcpu;
  const L: Record<ProvStep['id'], Line> = {
    policy:
      r.size === 'S'
        ? { tone: 'ink', k: 'Re-ordered at size S', text: `The team orders the same app at size S: half the vCPU per VM, ${d.vcpu} vCPU in all. It is checked again before anything is created.` }
        : { tone: 'ink', k: 'Quota and policy checked', text: `Someone in project ${p.label} orders a ${item.label} from the catalog. Before anything is created, it is checked against the project’s quota and policy.` },
    approve: { tone: 'warn', k: 'Approval requested', text: `The app asks for ${d.vcpu} vCPU, over the ${p.approvalAbove} vCPU limit of the project’s approval policy, so an admin approves it first. Approval is optional: requests at or under the limit, or projects without the policy, skip it.` },
    create: { tone: 'flow', k: 'Deploying on the cluster', text: `The blueprint is deploying ${n} on the cluster, already inside the project${r.v.needsApproval ? '' : ', with no approval step and no ticket'}.` },
    config: { tone: 'flow', k: 'Install tasks run', text: 'Install and configuration tasks from the blueprint run inside the VMs.' },
    ready: { tone: 'ok', k: `${item.multiVm ? 'App' : 'VM'} is ready`, text: `The team gets a working ${item.multiVm ? 'application' : 'VM'} inside its quota, with owner, project and categories already set.` },
    refused: { tone: 'bad', k: 'Blocked, with the reason', text: `${p.label} has ${left} vCPU left and the app needs ${d.vcpu}. The quota check fails, so Prism Central blocks the provisioning action before anything is created and shows a notification with the violation details and the reason. Order a smaller size, free up VMs, or ask for a bigger quota.` },
  };
  return L[id];
}
const SS_LINES = RUN.flatMap((r) => r.steps.map((s) => ssLine(r, s.id)));
const SS_STARTS = RUN.flatMap((r) => r.steps.map((_, k) => r.at + r.steps.slice(0, k).reduce((a, x) => a + x.dur, 0)));
const SS_STEPS = paced(SS_STARTS, SS_LINES.map((l) => [l.k, l.text]));

function SelfService() {
  const clock = useClock({ rate: 1.5, duration: SS_END, keys: true, poster: RUN[1].at + 4, steps: SS_STEPS });
  const t = clock.t;
  const i = phaseAt(RUN.map((r) => r.at), t);
  const r = RUN[i];
  const line = SS_LINES[phaseAt(SS_STARTS, t)];
  const left = r.p.quota.vcpu - r.p.used.vcpu;
  const checked = t - r.at >= r.steps[0].dur;
  return (
    <Show clock={clock}
      license={{ v: r.item.multiVm ? 'NCM Ultimate' : 'NCM Pro', tip: r.item.multiVm ? TIER_TIP.Ultimate : TIER_TIP.Pro }}
      foot={
        <>
          <Follow tone={line.tone} k={line.k}>
            <p>{line.text}</p>
          </Follow>
          <Kpis
            items={[
              !checked
                ? { k: 'Project vCPU used', v: `${r.p.used.vcpu} of ${r.p.quota.vcpu}`, sub: `this request: ${r.d.vcpu}` }
                : r.v.ok
                  ? { k: 'Project vCPU after', v: `${r.v.after.vcpu} of ${r.p.quota.vcpu}`, tone: 'ok' }
                  : { k: 'Project vCPU left', v: `${left} of ${r.p.quota.vcpu}`, tone: 'bad', sub: `needs ${r.d.vcpu}` },
              { k: 'Approval', v: !checked ? '…' : !r.v.ok ? '—' : r.v.needsApproval ? 'Needed' : 'Not needed', sub: checked && r.v.ok && r.v.needsApproval ? `over ${r.p.approvalAbove} vCPU` : 'optional policy' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <Provision i={i} t={t} />
      </div>
      <Legend
        items={[
          { color: 'var(--s2)', label: 'vCPU already used' },
          { color: 'var(--flow)', label: 'This request' },
          { color: 'var(--bad)', label: 'Over the quota' },
          { color: 'var(--text)', label: 'Quota limit' },
        ]}
      />
      <PlayBar
        clock={clock}
        label="Self-service requests animation"
        extra={<Illus why={"Durations are compressed, and the quota bar shows vCPU only; the check also covers memory and storage. Approval is a policy you choose to add; requests at or under its limit, or in projects without it, skip it. Real provisioning time depends on the blueprint, image size and configuration tasks. Self-Service was formerly called Calm." + REPLATFORM} />}
      />
    </Show>
  );
}

// ───────────────────────── Cost ─────────────────────────
// One project, dev-test, runs hot. Cost Governance catches it with a budget alert, its savings
// recommendations cut the waste, and Self-Service quota and policies keep it from coming back.
const RATES = { vcpuMonth: 20, memGBMonth: 3, tbMonth: 40 };
const DEV: Usage = { project: 'dev-test', vcpu: 80, memGB: 320, tb: 12, budget: 4000 };
const PLANNED = monthlyCost(DEV, RATES);
const MONTH = 30;
const ALERT_AT = 0.5; // the alert threshold in this example
const HOT: Surge = { from: 5, factor: 2.5 }; // a load test leaves extra VMs running
const ALERT_DAY = crossDay(PLANNED, DEV.budget, 'warn', MONTH, HOT, ALERT_AT) ?? MONTH;
const FIX_DAY = Math.ceil(ALERT_DAY) + 2; // the owner acts on the savings recommendations
const GUARD_DAY = FIX_DAY + 5; // quota and policies in place
const LEFT_ALONE: Surge[] = [HOT];
const WITH_NCM: Surge[] = [HOT, { from: FIX_DAY, factor: 1 }, { from: GUARD_DAY, factor: 0.6 }];
const OVER_DAY = crossDay(PLANNED, DEV.budget, 'over', MONTH, LEFT_ALONE);
const ALONE_END = accrued(PLANNED, MONTH, MONTH, LEFT_ALONE);
const NCM_END = accrued(PLANNED, MONTH, MONTH, WITH_NCM);
const COST_STARTS = [0, HOT.from, ALERT_DAY, FIX_DAY, GUARD_DAY, MONTH + 0.01];
const Y_MAX = 7000;
const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;

/** What NCM does about it, in the order it acts. */
const GUARDS: Point[] = [
  { at: ALERT_DAY, tone: 'warn', k: 'Budget alerts', by: 'Cost Governance', text: 'A budget per team or project, with an automated overspend alert to its owner while there is still time to act.' },
  { at: FIX_DAY, tone: 'flow', k: 'Savings recommendations', by: 'Cost Governance', text: 'Finds idle and oversized VMs, so the owner knows exactly what to stop or right-size.' },
  { at: GUARD_DAY, tone: 'ok', k: 'Quotas and policies', by: 'Self-Service', text: 'A quota caps the CPU, memory and storage a project can deploy. Approval and scheduler policies hold big requests and stop apps at set times.' },
];

function SpendChart({ t }: { t: number }) {
  const H = 350;
  const l = 76;
  const r = 132;
  const top = 50;
  const b = 56;
  const day = Math.min(MONTH, t);
  const sx = (d: number) => l + (d / MONTH) * (W - l - r);
  const sy = (v: number) => top + (1 - v / Y_MAX) * (H - top - b);
  const path = (changes: Surge[], from: number, to: number) => {
    const ds: number[] = [];
    for (let d = from; d < to; d += 0.5) ds.push(d);
    ds.push(to);
    return ds.map((d, i) => `${i ? 'L' : 'M'}${sx(d).toFixed(1)} ${sy(accrued(PLANNED, d, MONTH, changes)).toFixed(1)}`).join(' ');
  };
  const spent = accrued(PLANNED, day, MONTH, WITH_NCM);
  const marks = GUARDS.map((g, i) => ({ ...g, i, x: sx(g.at), y: sy(accrued(PLANNED, g.at, MONTH, WITH_NCM)) })).filter((g) => t >= g.at);
  const hot = { x: sx(HOT.from), y: sy(accrued(PLANNED, HOT.from, MONTH)) };
  return (
    <svg
      class="diagram"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`dev-test spend over the month against its ${usd(DEV.budget)} budget. Left alone it would end at ${usd(ALONE_END)}; with the alert, the recommendations and the guardrails it ends at ${usd(NCM_END)}.`}
    >
      {[0, 1000, 2000, 3000, 4000, 5000, 6000, 7000].map((v) => (
        <g key={v}>
          <line x1={l} x2={sx(MONTH)} y1={sy(v)} y2={sy(v)} class={v ? 'ncm-grid' : 'line'} />
          <text x={l - 8} y={sy(v) + 4} text-anchor="end" class="mono muted d-fine">
            {v ? `$${v / 1000}k` : '$0'}
          </text>
        </g>
      ))}
      {[1, 5, 10, 15, 20, 25, 30].map((d) => (
        <text key={d} x={sx(d)} y={H - 30} text-anchor="middle" class="muted d-sub">
          Day {d}
        </text>
      ))}
      <text x={(l + sx(MONTH)) / 2} y={H - 8} text-anchor="middle" class="muted d-sub">
        Day of the month
      </text>
      <text transform={`translate(16 ${(top + H - b) / 2}) rotate(-90)`} text-anchor="middle" class="muted d-sub">
        Spend
      </text>
      {t < MONTH && <line x1={sx(day)} x2={sx(day)} y1={top} y2={H - b} class="ncm-cursor" />}
      <line x1={l} x2={sx(MONTH)} y1={sy(DEV.budget)} y2={sy(DEV.budget)} class="ss-limit" />
      <text x={l + 8} y={sy(DEV.budget) - 7} class="halo d-label" style={{ fontWeight: 600 }}>
        Budget {usd(DEV.budget)}
      </text>
      <line x1={l} x2={sx(MONTH)} y1={sy(DEV.budget * ALERT_AT)} y2={sy(DEV.budget * ALERT_AT)} class="ncm-fixed" />
      <text x={l + 8} y={sy(DEV.budget * ALERT_AT) - 7} class="muted halo d-sub">
        Alert at {ALERT_AT * 100}%
      </text>

      {t >= HOT.from && (
        <g style={{ opacity: prog(t, HOT.from, HOT.from + 1) }}>
          <path d={path(LEFT_ALONE, HOT.from, MONTH)} class="ncm-alone" />
          <text x={sx(MONTH) + 10} y={sy(ALONE_END) + 4} class="bad-fill d-label" style={{ fontWeight: 600 }}>
            Left alone
          </text>
          <text x={sx(MONTH) + 10} y={sy(ALONE_END) + 21} class="mono bad-fill d-sub">
            {usd(ALONE_END)}
          </text>
          <circle cx={hot.x} cy={hot.y} r={6} class="bad-fill" stroke="var(--bg)" stroke-width={2} />
          <polyline points={`${hot.x},${hot.y - 8} ${hot.x},${top - 14}`} fill="none" class="ncm-leader" />
          <text x={hot.x} y={top - 22} text-anchor="middle" class="bad-fill d-label" style={{ fontWeight: 600 }}>
            Runs hot from day {HOT.from}
          </text>
        </g>
      )}

      <path d={path(WITH_NCM, 0, day)} class="ncm-spend" />
      <circle cx={sx(day)} cy={sy(spent)} r={4} class="ncm-spend-dot" />
      {t >= MONTH && (
        <>
          <text x={sx(MONTH) + 10} y={sy(NCM_END) + 4} class="ok-fill d-label" style={{ fontWeight: 600 }}>
            With NCM
          </text>
          <text x={sx(MONTH) + 10} y={sy(NCM_END) + 21} class="mono ok-fill d-sub">
            {usd(NCM_END)}
          </text>
        </>
      )}
      {marks.map((g) => (
        <g key={g.k}>
          <circle cx={g.x} cy={g.y} r={10} class={`${g.tone}-fill`} stroke="var(--bg)" stroke-width={2} />
          <text x={g.x} y={g.y + 4.5} text-anchor="middle" class="ncm-n">
            {g.i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Cost() {
  const overPct = Math.round((ALONE_END / DEV.budget - 1) * 100);
  const lines: Line[] = [
    { tone: 'ink', k: 'Spend metered daily', text: `Cost Governance meters dev-test’s CPU, memory and storage every day at the rates you set, and tracks the total against its ${usd(DEV.budget)} budget for the month.` },
    { tone: 'bad', k: 'Spend runs hot', text: `On day ${HOT.from} a load test leaves extra VMs running, and dev-test starts spending at ${HOT.factor}× its normal daily rate. Left alone, it would pass its budget on day ${Math.ceil(OVER_DAY ?? MONTH)} and end the month at ${usd(ALONE_END)}, ${overPct}% over.` },
    { tone: 'warn', k: 'Budget alert sent', text: `Spend passes ${ALERT_AT * 100}% of the budget on day ${Math.ceil(ALERT_DAY)}, with ${MONTH - Math.ceil(ALERT_DAY)} days still to go. Cost Governance sends the owner an overspend alert now, not after the invoice.` },
    { tone: 'flow', k: 'Waste identified', text: 'Cost Governance lists the idle and oversized VMs. The owner stops the idle load-test VMs and right-sizes the oversized ones, and spend drops back to the planned rate.' },
    { tone: 'ok', k: 'Guardrails put in place', text: 'Self-Service keeps it from happening again: the project quota caps the CPU, memory and storage dev-test can deploy, an approval policy holds large requests for sign-off, and a scheduler policy stops dev-test apps at night and on weekends.' },
    { tone: 'ok', k: 'Month closes under budget', text: `dev-test closes the month at ${usd(NCM_END)} of its ${usd(DEV.budget)} budget instead of ${usd(ALONE_END)}. The alert caught it early, the recommendations cut the waste, and the quota and policies stop it coming back.` },
  ];
  const clock = useClock({ rate: 2, duration: MONTH + 1, keys: true, poster: MONTH + 1, steps: paced(COST_STARTS, lines.map((l) => [l.k, l.text])) });
  const t = clock.t;
  const day = Math.min(MONTH, t);
  const spent = accrued(PLANNED, day, MONTH, WITH_NCM);
  const pace = paceEnd(PLANNED, day, MONTH, WITH_NCM);
  const st = budgetState(spent, DEV.budget, ALERT_AT);
  const line = lines[phaseAt(COST_STARTS, t)];
  return (
    <Show clock={clock}
      license={{ v: 'NCM Pro', sub: 'approvals, schedules: Ultimate', tip: `${TIER_TIP.Pro} Approval and scheduler policies need NCM Ultimate.` }}
      side={<Points label="How NCM stops the overspend" items={GUARDS} t={t} until={MONTH} />}
      foot={
        <>
          <Follow tone={line.tone} k={line.k}>
            <p>{line.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'dev-test spend', v: usd(spent), tone: st === 'over' ? 'bad' : t > MONTH ? 'ok' : st === 'warn' ? 'warn' : 'neutral', sub: `of ${usd(DEV.budget)} budget` },
              { k: 'Month-end at this pace', v: usd(pace), tone: pace > DEV.budget ? 'bad' : 'ok', sub: pace > DEV.budget ? `${Math.round((pace / DEV.budget - 1) * 100)}% over budget` : 'under budget' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <SpendChart t={t} />
      </div>
      <Legend
        items={[
          { color: 'var(--text)', label: 'dev-test spend with NCM' },
          { color: 'var(--bad)', label: 'Left alone' },
        ]}
      />
      <PlayBar
        clock={clock}
        label="dev-test spend animation"
        fmt={(x) => (x > MONTH ? 'Month closed' : `Day ${Math.max(1, Math.ceil(x))} of ${MONTH}`)}
        extra={
          <Illus why={`Rates (${usd(RATES.vcpuMonth)} per vCPU, ${usd(RATES.memGBMonth)} per GB of memory, ${usd(RATES.tbMonth)} per TB a month), usage, the budget, the ${ALERT_AT * 100}% alert threshold and the savings are example figures. Cost Governance (formerly Beam) meters actual consumption at the rates you configure.${REPLATFORM}`} />
        }
      />
    </Show>
  );
}

// ───────────────────────── Security ─────────────────────────
type Base = 'hard' | 'reg';
type BaseCheck = Omit<Check, 'pass'> & { short: string; failsAtFirst: boolean };
const BASELINES: Record<Base, { label: string; name: string; checks: BaseCheck[]; drift: { id: string; text: string } }> = {
  hard: {
    label: 'Platform hardening',
    name: 'platform hardening',
    checks: [
      { id: 'pw', short: 'No default passwords', label: 'Default admin passwords changed', fix: 'Rotate the default credentials on hosts and CVMs.', sev: 'high', failsAtFirst: false },
      { id: 'dare', short: 'Encryption at rest', label: 'Data-at-rest encryption enabled', fix: 'Enable software encryption on the storage containers, with a key manager.', sev: 'high', failsAtFirst: true },
      { id: 'ssh', short: 'Password SSH off', label: 'Password SSH login disabled', fix: 'Switch cluster lockdown on and use key-based access.', sev: 'medium', failsAtFirst: true },
      { id: 'syslog', short: 'Logs sent to SIEM', label: 'Logs forwarded to the SIEM', fix: 'Add the remote syslog server for audit and system logs.', sev: 'medium', failsAtFirst: false },
      { id: 'ver', short: 'Supported release', label: 'Software on a supported release', fix: 'Plan an LCM upgrade to a supported release.', sev: 'low', failsAtFirst: true },
    ],
    drift: { id: 'ssh', text: 'Weeks later someone turns password SSH login back on to troubleshoot, and forgets to turn it off.' },
  },
  reg: {
    label: 'Card data (PCI)',
    name: 'card-data regulatory',
    checks: [
      { id: 'seg', short: 'Card data isolated', label: 'Cardholder VMs isolated by security policy', fix: 'Apply a Flow isolation policy to the PCI category.', sev: 'high', failsAtFirst: true },
      { id: 'mfa', short: 'Admin login via IdP', label: 'Admin access through the identity provider', fix: 'Remove local admin accounts and use directory or SAML login.', sev: 'high', failsAtFirst: false },
      { id: 'audit', short: 'Audit kept 12 months', label: 'Audit trail retained 12 months', fix: 'Raise log retention on the SIEM target.', sev: 'medium', failsAtFirst: true },
      { id: 'snap', short: 'DR policy in place', label: 'Protected by a DR policy', fix: 'Add the category to a protection policy.', sev: 'medium', failsAtFirst: false },
    ],
    drift: { id: 'mfa', text: 'Weeks later someone adds a local admin account for a contractor, outside the identity provider.' },
  },
};

const SCAN0 = 0.4;
const SCAN_EACH = 0.55;
const FIX_EACH = 1.5;
const RESCAN_EACH = 0.25;

type TileState = 'idle' | 'scan' | 'pass' | 'fail' | 'fixing' | 'fixed' | 'changed' | 'caught';

function secTimeline(base: Base) {
  const B = BASELINES[base];
  const n = B.checks.length;
  const scanEnd = SCAN0 + n * SCAN_EACH;
  const fails = B.checks.filter((c) => c.failsAtFirst);
  const fix0 = scanEnd + 1.6;
  const fixEnd = fix0 + fails.length * FIX_EACH;
  const drift = fixEnd + 1.6;
  const rescan = drift + 1.6;
  const caught = rescan + n * RESCAN_EACH;
  return { scanEnd, fix0, fixEnd, drift, rescan, caught, end: caught + 2.2, fails };
}

function tileState(base: Base, i: number, t: number, tl: ReturnType<typeof secTimeline>): TileState {
  const B = BASELINES[base];
  const c = B.checks[i];
  const s0 = SCAN0 + i * SCAN_EACH;
  if (t < s0) return 'idle';
  if (t < s0 + SCAN_EACH) return 'scan';
  const isDrift = c.id === B.drift.id;
  if (isDrift && t >= tl.drift) {
    const r = tl.rescan + i * RESCAN_EACH;
    return t >= r + RESCAN_EACH ? 'caught' : 'changed';
  }
  if (!c.failsAtFirst) return 'pass';
  const j = tl.fails.indexOf(c);
  const f0 = tl.fix0 + j * FIX_EACH;
  if (t < f0) return 'fail';
  if (t < f0 + FIX_EACH * 0.7) return 'fixing';
  return 'fixed';
}

const STATE_TEXT: Record<TileState, string> = {
  idle: 'Not scanned',
  scan: 'Scanning…',
  pass: 'Pass',
  fail: 'Fail',
  fixing: 'Fixing',
  fixed: 'Fixed',
  changed: 'Changed by hand',
  caught: 'Drift caught',
};
const STATE_ICON: Record<TileState, { icon: string; cls: string }> = {
  idle: { icon: 'gauge', cls: 'muted' },
  scan: { icon: 'search', cls: 'ink-text' },
  pass: { icon: 'ok', cls: 'ok-text' },
  fail: { icon: 'bad', cls: 'bad-text' },
  fixing: { icon: 'flow', cls: 'flow-text' },
  fixed: { icon: 'ok', cls: 'ok-text' },
  changed: { icon: 'warn', cls: 'warn-text' },
  caught: { icon: 'bad', cls: 'bad-text' },
};
const SEV_ICON: Record<Check['sev'], { icon: string; cls: string }> = {
  high: { icon: 'bad', cls: 'bad-text' },
  medium: { icon: 'warn', cls: 'warn-text' },
  low: { icon: 'info', cls: 'muted' },
};

function Compliance({ base, t, tl }: { base: Base; t: number; tl: ReturnType<typeof secTimeline> }) {
  const B = BASELINES[base];
  const n = B.checks.length;
  const states = B.checks.map((_, i) => tileState(base, i, t, tl));
  const scanned = t >= tl.scanEnd;
  const passing = (s: TileState) => s === 'pass' || s === 'fixed' || s === 'changed';
  const sc = score(B.checks.map((c, i) => ({ ...c, pass: passing(states[i]) })));
  const C = 2 * Math.PI * 70;
  const tot = B.checks.reduce((a, c) => a + SEV_WEIGHT[c.sev], 0);
  const arcCls = (s: TileState, sev: Check['sev']) =>
    s === 'idle' || s === 'scan' ? 'sec-arc-idle' : passing(s) ? 'ok-stroke' : s === 'fixing' ? 'flow-stroke' : sev === 'high' ? 'bad-stroke' : 'warn-stroke';
  let before = 0;
  return (
    <div class="ncm-sec">
      <div class="ncm-donut">
        <svg class="diagram" viewBox="0 0 200 236" role="img" aria-label={`Compliance scan against the ${B.name} baseline: ${n} checks, score ${scanned ? sc : 'not yet known'} of 100.`}>
          <circle cx={100} cy={100} r={70} fill="none" stroke="var(--track)" stroke-width={16} />
          {B.checks.map((c, i) => {
            const w = SEV_WEIGHT[c.sev];
            const off = before;
            before += w;
            return (
              <circle
                key={c.id}
                cx={100}
                cy={100}
                r={70}
                fill="none"
                class={arcCls(states[i], c.sev)}
                stroke-width={16}
                stroke-dasharray={`${(w / tot) * C - 4} ${C}`}
                stroke-dashoffset={-(off / tot) * C}
                transform="rotate(-90 100 100)"
              />
            );
          })}
          <text x={100} y={110} text-anchor="middle" class="mono d-display" style={{ fontWeight: 600 }}>
            {scanned ? sc : '—'}
          </text>
          <text x={100} y={132} text-anchor="middle" class="muted d-sub">
            score of 100
          </text>
          <text x={100} y={212} text-anchor="middle" class="muted d-fine">
            Each arc is one check,
          </text>
          <text x={100} y={228} text-anchor="middle" class="muted d-fine">
            sized by severity
          </text>
        </svg>
      </div>
      <div class="ncm-find">
        <table class="tbl">
          <caption>Example findings</caption>
          <thead>
            <tr>
              <th scope="col">Check</th>
              <th scope="col">Severity</th>
              <th scope="col">Status</th>
              <th scope="col">Fix</th>
            </tr>
          </thead>
          <tbody>
            {B.checks.map((c, i) => {
              const s = states[i];
              const st = STATE_ICON[s];
              const sv = SEV_ICON[c.sev];
              return (
                <tr key={c.id} class={s === 'fail' || s === 'caught' ? 'ncm-row-open' : s === 'fixing' ? 'ncm-row-fix' : ''}>
                  <th scope="row">{c.label}</th>
                  <td>
                    <span class={`ncm-ic ${sv.cls}`}>
                      <Icon name={sv.icon} />
                    </span>
                    {c.sev[0].toUpperCase() + c.sev.slice(1)}
                  </td>
                  <td class={`ncm-st ${st.cls}`}>
                    <span class="ncm-ic">
                      <Icon name={st.icon} />
                    </span>
                    {STATE_TEXT[s]}
                  </td>
                  <td class={s === 'pass' || s === 'fixed' || s === 'idle' || s === 'scan' ? 'muted' : ''}>{c.fix}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** What the compliance view shows at time t: phase, open findings, score and caption. */
function secView(base: Base, tl: ReturnType<typeof secTimeline>, t: number) {
  const B = BASELINES[base];
  const phase = phaseAt([0, tl.scanEnd, tl.fix0, tl.fixEnd, tl.drift, tl.caught], t);
  const states = B.checks.map((_, i) => tileState(base, i, t, tl));
  const open = states.filter((s) => s === 'fail' || s === 'caught' || s === 'fixing').length;
  const passing = (s: TileState) => s === 'pass' || s === 'fixed' || s === 'changed';
  const sc = score(B.checks.map((c, i) => ({ ...c, pass: passing(states[i]) })));
  // Each fix is its own step (its own heading), so every fix text gets its full reading time; after
  // the last fix lands, the last one stays on screen until the phase ends.
  const at = tl.fails.findIndex((c) => states[B.checks.indexOf(c)] === 'fixing' || states[B.checks.indexOf(c)] === 'fail');
  const fi = at < 0 ? tl.fails.length - 1 : at;
  const fixing = tl.fails[fi];
  const drifted = B.checks.find((c) => c.id === B.drift.id)!;
  const lines: Line[] = [
    { tone: 'ink', k: 'Settings are scanned', text: `Security Compliance compares the cluster’s settings with the ${B.name} baseline, one check at a time.` },
    { tone: 'warn', k: `${tl.fails.length} findings reported`, text: 'Each finding comes with a suggested fix and a severity. High-severity findings weigh most in the score.' },
    { tone: 'flow', k: `Finding ${fi + 1} of ${tl.fails.length} gets fixed`, text: `The suggested fix for “${fixing?.label}”: ${fixing?.fix} Some fixes are applied automatically, others need a change window or a decision.` },
    { tone: 'ok', k: 'Every check passes', text: 'The cluster is compliant: every check in the baseline passes.' },
    { tone: 'warn', k: 'A setting is changed', text: `${B.drift.text} Nothing has looked yet.` },
    { tone: drifted.sev === 'high' ? 'bad' : 'warn', k: 'Next scan catches drift', text: `The next scan catches “${drifted.label}” failing again, so compliance does not quietly decay between audits.` },
  ];
  return { phase, open, sc, line: lines[phase] };
}

function Security() {
  const [base, setBase] = useEnum<Base>('bl', 'hard', ['hard', 'reg']);
  const tl = useMemo(() => secTimeline(base), [base]);
  const steps = useMemo(() => stepsFrom(tl.end, (t) => secView(base, tl, t).line), [base, tl]);
  const clock = useClock({ rate: 1, duration: tl.end, keys: true, poster: tl.scanEnd + 0.8, steps });
  useRestartOn(clock, [base]);
  const t = clock.t;
  const { open, sc, line } = secView(base, tl, t);
  return (
    <Show clock={clock}
      license={{ v: 'NCM Ultimate', tip: TIER_TIP.Ultimate }}
      top={
        <Choice<Base>
          label="Baseline"
          value={base}
          onChange={setBase}
          options={(['hard', 'reg'] as Base[]).map((b) => ({ value: b, label: BASELINES[b].label }))}
        />
      }
      foot={
        <>
          <Follow tone={line.tone} k={line.k}>
            <p>{line.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Score', v: t >= tl.scanEnd ? sc : '—', tone: t < tl.scanEnd ? 'neutral' : sc === 100 ? 'ok' : 'warn', sub: 'of 100' },
              { k: 'Open findings', v: t >= tl.scanEnd ? open : '—', tone: t < tl.scanEnd ? 'neutral' : open ? 'warn' : 'ok' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <Compliance base={base} t={t} tl={tl} />
      </div>
      <Legend
        items={[
          { color: 'var(--ok)', label: 'Passing' },
          { color: 'var(--bad)', label: 'Failing, high severity' },
          { color: 'var(--warn)', label: 'Failing, medium or low severity' },
          { color: 'var(--flow)', label: 'Being fixed' },
          { color: 'var(--warn)', label: 'Changed by hand' },
        ]}
      />
      <PlayBar
        clock={clock}
        label="Compliance scan animation"
        extra={<Illus why={"Example checks. Security Compliance (formerly Security Central) ships its own checks and regulatory reports." + REPLATFORM} />}
      />
    </Show>
  );
}

// ───────────────────────── tabs ─────────────────────────
type TabId = 'ai' | 'ss' | 'cost' | 'sec';
const TABS: { id: TabId; label: string }[] = [
  { id: 'ai', label: 'AIOps' },
  { id: 'ss', label: 'Self-Service' },
  { id: 'cost', label: 'Cost' },
  { id: 'sec', label: 'Security' },
];

export default function Ncm() {
  const [tab, setTab] = useEnum<TabId>('tab', 'ai', ['ai', 'ss', 'cost', 'sec']);
  return (
    <Tabs label="Cloud Manager areas" value={tab} tabs={TABS} onChange={setTab}>
      {tab === 'ai' && <AiOps />}
      {tab === 'ss' && <SelfService />}
      {tab === 'cost' && <Cost />}
      {tab === 'sec' && <Security />}
    </Tabs>
  );
}
