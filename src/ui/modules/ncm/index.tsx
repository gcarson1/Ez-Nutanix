// Nutanix Cloud Manager (NCM): one tab per component (AIOps, Self-Service, Cost, SecOps).
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
  demand,
  evaluate,
  monthlyCost,
  paceEnd,
  requestSteps,
  score,
  SEV_WEIGHT,
  stepAt,
  stretches,
  withSpike,
  type CatalogItem,
  type Check,
  type Project,
  type ProvStep,
  type Surge,
  type Usage,
} from '../../../engine/ncm';
import { useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, ease, phaseAt, prog } from '../../components/show';
import './style.css';

type Line = { tone: Tone | 'ink'; k: string; text: string };

const TIER_TIP = {
  Pro: 'Needs NCM Pro or higher. Pro adds Cost Governance, the Self-Service marketplace, single-VM blueprints and runbooks.',
  Ultimate: 'Needs NCM Ultimate: multi-VM app blueprints, approvals and scheduling, and Security Compliance.',
} as const;

const W = 960;

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
  const H = 290;
  const l = 48;
  const r = 16;
  const top = 18;
  const b = 34;
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
          <line x1={l} x2={W - r} y1={sy(v)} y2={sy(v)} class="line" stroke-dasharray={v ? '2 4' : undefined} />
          <text x={l - 8} y={sy(v) + 4} text-anchor="end" class="mono muted" style={{ fontSize: '11px' }}>
            {v}%
          </text>
        </g>
      ))}
      {WEEKDAYS.map((d, i) => (
        <text key={d} x={sx(i * 24 + 12)} y={H - 10} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
          {d}
        </text>
      ))}
      <path d={`${hi} ${lo} Z`} class="ncm-band" style={{ opacity: prog(t, 0, DRAW_FROM) }} />
      <line x1={l} x2={W - r} y1={sy(FIXED)} y2={sy(FIXED)} class="ncm-fixed" />
      <text x={W - r} y={sy(FIXED) - 6} text-anchor="end" class="muted halo" style={{ fontSize: '12px' }}>
        A fixed {FIXED}% alarm
      </text>
      {t >= DRAW_FROM && <path d={line} class="ncm-cpu" />}
      {t >= DRAW_FROM && hc < n - 1 && <line x1={sx(hc)} x2={sx(hc)} y1={top} y2={H - b} class="ncm-cursor" />}
      {shown.map((s) => {
        const seg = pts.slice(s.start, s.end);
        const k = seg.reduce((m, p, i) => (p.v > seg[m].v ? i : m), 0);
        const x = sx(s.start + k);
        const y = sy(seg[k].v);
        const right = x < W / 2;
        return (
          <g key={s.start}>
            <circle cx={x} cy={y} r={7} class="bad-fill" stroke="var(--bg)" stroke-width={2} />
            <text x={right ? x + 14 : x - 14} y={y + 5} text-anchor={right ? 'start' : 'end'} class="bad-fill halo" style={{ fontSize: '13px', fontWeight: 600 }}>
              ✕ Unusual for this hour
            </text>
          </g>
        );
      })}
      {shown.map((s) => (
        <text key={`fx${s.start}`} x={sx(s.start) + 14} y={alarmed(s) ? sy(FIXED) - 22 : sy(FIXED) + 18} class={`${alarmed(s) ? 'muted' : 'warn-fill'} halo`} style={{ fontSize: '12.5px', fontWeight: 600 }}>
          {alarmed(s) ? `Over ${FIXED}%: the fixed alarm fires too` : `Under ${FIXED}%: the fixed alarm stays silent`}
        </text>
      ))}
    </svg>
  );
}

function AiOps() {
  const wk = useWeek();
  const clock = useClock({ rate: 1, duration: AI_END, keys: true, poster: AI_END, stops: [DRAW_FROM, ...wk.flagAt] });
  const t = clock.t;
  const hc = prog(t, DRAW_FROM, DRAW_FROM + DRAW_DUR) * (wk.pts.length - 1);
  const phase = phaseAt([0, DRAW_FROM, ...wk.flagAt], t);
  const flaggedNow = wk.flagged.filter((s) => s.start <= hc).length;
  const firedNow = wk.fixed.filter((s) => s.start <= hc).length;
  const [night, day] = wk.peaks.map((v) => Math.round(v));
  const lines: Line[] = [
    { tone: 'ink', k: 'Normal, learned', text: 'The shaded band is what normal CPU looks like for each hour of the week, learned from the two weeks before.' },
    { tone: 'ink', k: 'Busy afternoons are normal', text: 'Weekday afternoons run hot every day, so they stay inside the band and raise nothing.' },
    { tone: 'bad', k: `Flagged ${SPIKES[0].when}`, text: `CPU jumps to ${night}% at 3 a.m., far above normal for that hour, so it is raised as an anomaly. A fixed ${FIXED}% alarm, set high enough to stay quiet on busy afternoons, misses it.` },
    { tone: 'bad', k: `Flagged ${SPIKES[1].when}`, text: `CPU jumps to ${day}% on a busy afternoon, above normal even for that hour, so it is flagged too. This one crosses ${FIXED}%, so the fixed alarm fires as well. Only the learned band caught both.` },
  ];
  const line = lines[phase];
  return (
    <Show
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
          { color: 'var(--bad)', label: 'Flagged as unusual' },
        ]}
      />
      <PlayBar
        clock={clock}
        label="Anomaly detection animation"
        fmt={() => (t < DRAW_FROM ? 'Learning' : hc >= wk.pts.length - 1 ? 'Week done' : `${WEEKDAYS[Math.min(6, Math.floor(hc / 24))]} ${String(Math.floor(hc) % 24).padStart(2, '0')}:00`)}
        extra={<Illus why="Mock data. The band here is learned per hour of day (weekday or weekend) from the previous two weeks. Intelligent Operations uses its own machine-learned baselines, and also forecasts capacity runway and suggests right-sizing." />}
      />
    </Show>
  );
}

// ───────────────────────── Self-Service ─────────────────────────
const LINUX: CatalogItem = { id: 'linux', label: 'Linux VM', vms: 1, vcpu: 4, memGB: 8, diskGB: 100, multiVm: false };
const APP: CatalogItem = { id: 'app', label: '3-tier web app', vms: 4, vcpu: 4, memGB: 16, diskGB: 200, multiVm: true };
const WEB: Project = { id: 'web', label: 'web-shop', quota: { vcpu: 48, memGB: 192, diskGB: 3000 }, used: { vcpu: 28, memGB: 96, diskGB: 1400 }, approvalAbove: 8 };
const DATA: Project = { id: 'data', label: 'data-team', quota: { vcpu: 32, memGB: 128, diskGB: 2000 }, used: { vcpu: 26, memGB: 100, diskGB: 1700 }, approvalAbove: 8 };
const APP_ROLES = ['Load balancer', 'Web', 'App', 'Database'];

type Req = 'vm' | 'app' | 'over';
const REQS: Record<Req, { item: CatalogItem; project: Project; label: string }> = {
  vm: { item: LINUX, project: WEB, label: 'Linux VM' },
  app: { item: APP, project: WEB, label: '3-tier web app' },
  over: { item: APP, project: DATA, label: 'App over quota' },
};
const STEP_WORD: Record<ProvStep['id'], string> = { policy: 'Check', approve: 'Approval', create: 'Create', config: 'Configure', ready: 'Ready', refused: 'Sent back' };

const BOX = { req: { x: 12, w: 176 }, chk: { x: 258, w: 176 }, apr: { x: 504, w: 156 } } as const;
const BY = 40;
const BH = 88;
const CL = { x: 696, y: 12, w: 252, h: 262 };
const QY = 190;
const QW = 648;

function Provision({ req, t, steps, v }: { req: Req; t: number; steps: ProvStep[]; v: ReturnType<typeof evaluate> }) {
  const { item, project: p } = REQS[req];
  const at = stepAt(steps, t);
  const id = steps[at.idx].id;
  const idx = (s: ProvStep['id']) => steps.findIndex((x) => x.id === s);
  const past = (s: ProvStep['id']) => idx(s) >= 0 && (at.idx > idx(s) || at.done);
  const now = (s: ProvStep['id']) => !at.done && id === s;
  const d = demand(item, 'M');
  const tokenY = BY + BH / 2;

  // the request token, drawn only while it travels along an arrow
  let token: { x: number; bad?: boolean } | null = null;
  const right = (k: keyof typeof BOX) => BOX[k].x + BOX[k].w;
  const move = (a: number, b: number, f: number, bad = false) => (f > 0 && f < 1 ? { x: a + (b - a) * ease(f), bad } : null);
  if (now('policy')) token = move(right('req'), BOX.chk.x, prog(at.frac, 0, 0.55));
  else if (now('refused')) token = move(BOX.chk.x, right('req'), prog(at.frac, 0, 0.5), true);
  else if (now('approve')) token = move(right('chk'), BOX.apr.x, prog(at.frac, 0, 0.35));
  else if (now('create')) token = move(v.needsApproval ? right('apr') : right('chk'), CL.x, prog(at.frac, 0, 0.3));

  const checked = past('policy');
  const refused = checked && !v.ok;
  const checking = now('policy') && at.frac >= 0.55;
  const vmsShown = past('create') ? item.vms : now('create') ? Math.floor(prog(at.frac, 0.3, 1) * item.vms + 1e-9) : 0;
  const configFrac = past('config') ? 1 : now('config') ? at.frac : 0;
  const ready = past('ready') || (now('ready') && at.frac > 0.2);

  const usedW = (p.used.vcpu / p.quota.vcpu) * QW;
  const addW = Math.min(QW - usedW, (d.vcpu / p.quota.vcpu) * QW);
  const overW = refused ? Math.min(28, ((p.used.vcpu + d.vcpu - p.quota.vcpu) / p.quota.vcpu) * QW) : 0;

  const box = (k: keyof typeof BOX, title: string, sub: string, status: string, cls: string, statusCls: string, dashed = false) => (
    <g class={cls}>
      <rect class={`ss-box${dashed ? ' dashed' : ''}`} x={BOX[k].x} y={BY} width={BOX[k].w} height={BH} />
      <text x={BOX[k].x + 14} y={BY + 26} class="ss-h">
        {title}
      </text>
      <text x={BOX[k].x + 14} y={BY + 46} class="muted" style={{ fontSize: '12px' }}>
        {sub}
      </text>
      <text x={BOX[k].x + 14} y={BY + 72} class={statusCls} style={{ fontSize: '12.5px', fontWeight: 600 }}>
        {status}
      </text>
    </g>
  );

  return (
    <svg class="diagram" viewBox={`0 0 ${W} 290`} role="img" aria-label={`${item.label} requested by project ${p.label}: ${v.ok ? `checked against quota${v.needsApproval ? ', approved' : ''}, created and configured` : 'refused at the quota check'}.`}>
      <defs>
        <marker id="ss-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="ss-mk" />
        </marker>
      </defs>
      {[
        [BOX.req.x + BOX.req.w, BOX.chk.x],
        [BOX.chk.x + BOX.chk.w, BOX.apr.x],
        [BOX.apr.x + BOX.apr.w, CL.x],
      ].map(([a, b], i) => (
        <line key={i} x1={a + 4} x2={b - 6} y1={tokenY} y2={tokenY} class={`ss-arrow${refused && i > 0 ? ' off' : ''}`} marker-end="url(#ss-ar)" />
      ))}

      {box('req', 'App team', `project ${p.label}`, refused && (now('refused') ? at.frac > 0.5 : true) ? '✕ Sent back' : `orders: ${item.label}`, '', refused && (at.done || at.frac > 0.5) ? 'bad-fill' : 'muted')}
      {box(
        'chk',
        'Quota and policy',
        'checked first',
        checked ? (v.ok ? '✓ Fits the quota' : '✕ Over the quota') : checking ? 'Checking…' : 'Waiting',
        '',
        checked ? (v.ok ? 'ok-fill' : 'bad-fill') : checking ? 'ncm-ink' : 'muted',
      )}
      {box(
        'apr',
        'Approval',
        `${d.vcpu} vCPU, limit ${p.approvalAbove}`,
        refused ? 'Not reached' : !v.needsApproval ? 'Not needed' : past('approve') ? '✓ Approved' : now('approve') && at.frac > 0.35 ? 'Waiting for an admin' : 'Waiting',
        refused ? 'ss-dim' : '',
        !v.needsApproval ? 'muted' : past('approve') ? 'ok-fill' : now('approve') && at.frac > 0.35 ? 'warn-fill' : 'muted',
        !v.needsApproval,
      )}

      {/* the cluster where the VMs land */}
      <g class={refused ? 'ss-dim' : ''}>
        <rect class="node-box" x={CL.x} y={CL.y} width={CL.w} height={CL.h} />
        <text x={CL.x + 14} y={CL.y + 24} class="ss-h">
          Cluster
        </text>
        <text x={CL.x + 14} y={CL.y + 42} class="muted" style={{ fontSize: '12px' }}>
          {refused ? 'nothing created' : `${item.vms} VM${item.vms > 1 ? 's' : ''} from the blueprint`}
        </text>
        {Array.from({ length: item.vms }, (_, k) => {
          const col = k % 2;
          const row = Math.floor(k / 2);
          const x = CL.x + 12 + col * 118;
          const y = CL.y + 56 + row * 80;
          const shown = k < vmsShown;
          const role = item.multiVm ? APP_ROLES[k] : item.label;
          return (
            <g key={k} style={{ opacity: shown ? 1 : 0.35 }}>
              <rect x={x} y={y} width={110} height={70} class={shown && ready ? 'vm hl' : 'vm'} stroke-dasharray={shown ? undefined : '4 3'} />
              <text x={x + 10} y={y + 22} style={{ fontSize: '12.5px', fontWeight: 600 }}>
                {role}
              </text>
              <text x={x + 10} y={y + 40} class="mono muted" style={{ fontSize: '11px' }}>
                {item.vcpu} vCPU · {item.memGB} GB
              </text>
              {shown && !ready && configFrac > 0 && (
                <>
                  <rect x={x + 10} y={y + 52} width={90} height={6} class="bg3" />
                  <rect x={x + 10} y={y + 52} width={90 * configFrac} height={6} class="flow-fill" />
                </>
              )}
              {shown && ready && (
                <text x={x + 10} y={y + 60} class="ok-fill" style={{ fontSize: '11.5px', fontWeight: 600 }}>
                  ✓ Running
                </text>
              )}
              {shown && configFrac === 0 && (
                <text x={x + 10} y={y + 60} class="muted" style={{ fontSize: '11.5px' }}>
                  Created
                </text>
              )}
            </g>
          );
        })}
        {ready && (
          <text x={CL.x + 14} y={CL.y + CL.h - 14} class="ok-fill" style={{ fontSize: '12px', fontWeight: 600 }}>
            ✓ Owner, project, categories set
          </text>
        )}
      </g>

      {token && <rect x={token.x - 13} y={tokenY - 9} width={26} height={18} rx={3} class={token.bad ? 'bad-fill' : 'ink-fill'} />}

      {/* the project's vCPU quota */}
      <text x={12} y={QY - 10} class="muted" style={{ fontSize: '12px' }}>
        Project {p.label} · vCPU quota
      </text>
      <rect x={12} y={QY} width={QW} height={18} class="bg3" />
      <rect x={12} y={QY} width={usedW} height={18} class="ss-used" />
      {checked && <rect x={12 + usedW} y={QY} width={addW} height={18} class={v.ok ? 'flow-fill' : 'bad-fill'} />}
      {refused && <rect x={12 + QW} y={QY} width={overW} height={18} class="ss-over" />}
      <line x1={12 + QW} x2={12 + QW} y1={QY - 6} y2={QY + 24} class="ss-limit" />
      <text x={12} y={QY + 40} class="mono" style={{ fontSize: '12.5px' }}>
        {checked ? (v.ok ? `${p.used.vcpu} used + ${d.vcpu} for this request = ${v.after.vcpu} of ${p.quota.vcpu} vCPU` : `${p.used.vcpu} used, needs ${d.vcpu}, only ${p.quota.vcpu - p.used.vcpu} left of ${p.quota.vcpu}`) : `${p.used.vcpu} of ${p.quota.vcpu} vCPU used`}
      </text>
    </svg>
  );
}

function SelfService() {
  const [req, setReq] = useEnum<Req>('rq', 'app', ['vm', 'app', 'over']);
  const { item, project: p } = REQS[req];
  const d = demand(item, 'M');
  const v = evaluate(p, d, true);
  const steps = useMemo(() => requestSteps(item, v), [req]);
  const total = steps.reduce((s, x) => s + x.dur, 0);
  const clock = useClock({ rate: 1.5, duration: total, keys: true, poster: total, stops: steps.map((_, i) => steps.slice(0, i).reduce((s, x) => s + x.dur, 0)) });
  useRestartOn(clock, [req]);
  const at = stepAt(steps, clock.t);
  const id = steps[at.idx].id;
  const left = p.quota.vcpu - p.used.vcpu;
  const LINES: Record<ProvStep['id'], Line> = {
    policy: { tone: 'ink', k: 'Checking quota and policy', text: `The ${p.label} team orders a ${item.label} from the catalog. Before anything is created, it is checked against the project’s quota and policy.` },
    approve: { tone: 'warn', k: 'Waiting for approval', text: `The app asks for ${d.vcpu} vCPU, over the project’s ${p.approvalAbove} vCPU approval limit, so a project admin approves it first.` },
    create: { tone: 'flow', k: 'Creating from the blueprint', text: `The blueprint creates ${item.vms > 1 ? `${item.vms} VMs` : 'the VM'} on the cluster, already inside the project.` },
    config: { tone: 'flow', k: 'Configuring', text: 'Install and configuration tasks from the blueprint run inside the VMs.' },
    ready: { tone: 'ok', k: 'Ready, no ticket', text: `The team gets a working ${item.multiVm ? 'application' : 'VM'} inside its quota, with owner, project and categories already set.` },
    refused: { tone: 'bad', k: 'Sent back', text: `${p.label} has ${left} vCPU left and the app needs ${d.vcpu}. The request is refused before anything is created, and the reason goes back to the team.` },
  };
  const line = LINES[id];
  return (
    <Show
      top={<Choice<Req> label="Request" value={req} onChange={setReq} options={(['vm', 'app', 'over'] as Req[]).map((r) => ({ value: r, label: REQS[r].label }))} />}
      foot={
        <>
          <Follow tone={line.tone} k={line.k}>
            <p>{line.text}</p>
          </Follow>
          <Kpis
            items={[
              v.ok
                ? { k: 'Project vCPU after', v: `${v.after.vcpu} of ${p.quota.vcpu}`, tone: 'ok' }
                : { k: 'Project vCPU left', v: `${left} of ${p.quota.vcpu}`, tone: 'bad', sub: `needs ${d.vcpu}` },
              { k: 'Approval', v: !v.ok ? '—' : v.needsApproval ? 'Needed' : 'Not needed', sub: v.ok && v.needsApproval ? `over ${p.approvalAbove} vCPU` : undefined },
              { k: 'License', v: item.multiVm ? 'NCM Ultimate' : 'NCM Pro', tip: item.multiVm ? TIER_TIP.Ultimate : TIER_TIP.Pro },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <Provision req={req} t={clock.t} steps={steps} v={v} />
      </div>
      <PlayBar
        clock={clock}
        label="Self-service request animation"
        fmt={() => STEP_WORD[id]}
        extra={<Illus why="Durations are compressed. Real provisioning time depends on the blueprint, image size and configuration tasks. Self-Service was formerly called Calm." />}
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
const GUARDS: { at: number; tone: Tone; k: string; by: string; text: string }[] = [
  { at: ALERT_DAY, tone: 'warn', k: 'Budget alerts', by: 'Cost Governance', text: 'A budget per team or project, with an automated overspend alert to its owner while there is still time to act.' },
  { at: FIX_DAY, tone: 'flow', k: 'Savings recommendations', by: 'Cost Governance', text: 'Finds idle and oversized VMs, so the owner knows exactly what to stop or right-size.' },
  { at: GUARD_DAY, tone: 'ok', k: 'Quotas and policies', by: 'Self-Service', text: 'A quota caps the CPU, memory and storage a project can deploy. Approval and scheduler policies hold big requests and stop apps at set times.' },
];

function Guards({ t }: { t: number }) {
  const now = phaseAt([-1, ...GUARDS.map((g) => g.at)], t) - 1;
  return (
    <div class="ncm-guards">
      <span class="choice-l">How NCM stops the overspend</span>
      <ol>
        {GUARDS.map((g, i) => (
          <li key={g.k} class={`${t >= g.at ? `on ${g.tone}` : ''}${i === now && t <= MONTH ? ' now' : ''}`}>
            <span class="n">{i + 1}</span>
            <b>{g.k}</b>
            <span class="by">{g.by}</span>
            <p>{g.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SpendChart({ t }: { t: number }) {
  const H = 300;
  const l = 56;
  const r = 132;
  const top = 18;
  const b = 34;
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
          <line x1={l} x2={sx(MONTH)} y1={sy(v)} y2={sy(v)} class="line" stroke-dasharray={v ? '2 4' : undefined} />
          <text x={l - 8} y={sy(v) + 4} text-anchor="end" class="mono muted" style={{ fontSize: '11px' }}>
            {v ? `$${v / 1000}k` : '$0'}
          </text>
        </g>
      ))}
      {[1, 5, 10, 15, 20, 25, 30].map((d) => (
        <text key={d} x={sx(d)} y={H - 10} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
          Day {d}
        </text>
      ))}
      <line x1={l} x2={sx(MONTH)} y1={sy(DEV.budget)} y2={sy(DEV.budget)} class="ss-limit" />
      <text x={l + 8} y={sy(DEV.budget) - 7} class="halo" style={{ fontSize: '12.5px', fontWeight: 600 }}>
        Budget {usd(DEV.budget)}
      </text>
      <line x1={l} x2={sx(MONTH)} y1={sy(DEV.budget * ALERT_AT)} y2={sy(DEV.budget * ALERT_AT)} class="ncm-fixed" />
      <text x={l + 8} y={sy(DEV.budget * ALERT_AT) - 7} class="muted halo" style={{ fontSize: '12px' }}>
        Alert at {ALERT_AT * 100}%
      </text>

      {t >= HOT.from && (
        <g style={{ opacity: prog(t, HOT.from, HOT.from + 1) }}>
          <path d={path(LEFT_ALONE, HOT.from, MONTH)} class="ncm-alone" />
          <text x={sx(MONTH) + 10} y={sy(ALONE_END) + 4} class="bad-fill" style={{ fontSize: '12.5px', fontWeight: 600 }}>
            Left alone
          </text>
          <text x={sx(MONTH) + 10} y={sy(ALONE_END) + 21} class="mono bad-fill" style={{ fontSize: '12px' }}>
            {usd(ALONE_END)}
          </text>
          <circle cx={hot.x} cy={hot.y} r={6} class="bad-fill" stroke="var(--bg)" stroke-width={2} />
          <text x={hot.x + 12} y={hot.y + 20} class="bad-fill halo" style={{ fontSize: '12.5px', fontWeight: 600 }}>
            Runs hot from day {HOT.from}
          </text>
        </g>
      )}

      <path d={path(WITH_NCM, 0, day)} class="ncm-spend" />
      {t < MONTH && <line x1={sx(day)} x2={sx(day)} y1={top} y2={H - b} class="ncm-cursor" />}
      <circle cx={sx(day)} cy={sy(spent)} r={4} class="ncm-spend-dot" />
      {t >= MONTH && (
        <>
          <text x={sx(MONTH) + 10} y={sy(NCM_END) + 4} class="ok-fill" style={{ fontSize: '12.5px', fontWeight: 600 }}>
            With NCM
          </text>
          <text x={sx(MONTH) + 10} y={sy(NCM_END) + 21} class="mono ok-fill" style={{ fontSize: '12px' }}>
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
  const clock = useClock({ rate: 2, duration: MONTH + 1, keys: true, poster: MONTH + 1, stops: COST_STARTS });
  const t = clock.t;
  const day = Math.min(MONTH, t);
  const spent = accrued(PLANNED, day, MONTH, WITH_NCM);
  const pace = paceEnd(PLANNED, day, MONTH, WITH_NCM);
  const st = budgetState(spent, DEV.budget, ALERT_AT);
  const overPct = Math.round((ALONE_END / DEV.budget - 1) * 100);
  const lines: Line[] = [
    { tone: 'ink', k: 'Metered every day', text: `Cost Governance meters dev-test’s CPU, memory and storage every day at the rates you set, and tracks the total against its ${usd(DEV.budget)} budget for the month.` },
    { tone: 'bad', k: 'Running hot', text: `On day ${HOT.from} a load test leaves extra VMs running, and dev-test starts spending ${HOT.factor} times its normal daily rate. Left alone, it would pass its budget on day ${Math.ceil(OVER_DAY ?? MONTH)} and end the month at ${usd(ALONE_END)}, ${overPct}% over.` },
    { tone: 'warn', k: '1 · Budget alert', text: `Spend passes ${ALERT_AT * 100}% of the budget on day ${Math.ceil(ALERT_DAY)}, with ${MONTH - Math.ceil(ALERT_DAY)} days still to go. Cost Governance sends the owner an overspend alert now, not after the invoice.` },
    { tone: 'flow', k: '2 · Savings recommendations', text: 'Cost Governance lists the idle and oversized VMs. The owner stops the idle load-test VMs and right-sizes the oversized ones, and spend drops back to the planned rate.' },
    { tone: 'ok', k: '3 · Quotas and policies', text: 'Self-Service keeps it from happening again: the project quota caps the CPU, memory and storage dev-test can deploy, an approval policy holds large requests for sign-off, and a scheduler policy stops dev-test apps at night and on weekends.' },
    { tone: 'ok', k: 'Under budget', text: `dev-test closes the month at ${usd(NCM_END)} of its ${usd(DEV.budget)} budget instead of ${usd(ALONE_END)}. The alert caught it early, the recommendations cut the waste, and the quota and policies stop it coming back.` },
  ];
  const line = lines[phaseAt(COST_STARTS, t)];
  return (
    <Show
      top={<Guards t={t} />}
      foot={
        <>
          <Follow tone={line.tone} k={line.k}>
            <p>{line.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'dev-test spend', v: usd(spent), tone: st === 'over' ? 'bad' : t > MONTH ? 'ok' : st === 'warn' ? 'warn' : 'neutral', sub: `of ${usd(DEV.budget)} budget` },
              { k: 'Month-end at this pace', v: usd(pace), tone: pace > DEV.budget ? 'bad' : 'ok', sub: pace > DEV.budget ? `${Math.round((pace / DEV.budget - 1) * 100)}% over budget` : 'under budget' },
              { k: 'License', v: 'NCM Pro', sub: 'approvals, schedules: Ultimate', tip: `${TIER_TIP.Pro} Approval and scheduler policies need NCM Ultimate.` },
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
          <Illus why={`Rates (${usd(RATES.vcpuMonth)} per vCPU, ${usd(RATES.memGBMonth)} per GB of memory, ${usd(RATES.tbMonth)} per TB a month), usage, the budget, the ${ALERT_AT * 100}% alert threshold and the savings are made-up examples. Cost Governance (formerly Beam) meters actual consumption at the rates you configure.`} />
        }
      />
    </Show>
  );
}

// ───────────────────────── SecOps ─────────────────────────
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
  pass: '✓ Pass',
  fail: '✕ Fail',
  fixing: '→ Fixing',
  fixed: '✓ Fixed',
  changed: '⚠ Changed by hand',
  caught: '✕ Drift caught',
};

function Compliance({ base, t, tl }: { base: Base; t: number; tl: ReturnType<typeof secTimeline> }) {
  const B = BASELINES[base];
  const n = B.checks.length;
  const states = B.checks.map((_, i) => tileState(base, i, t, tl));
  const scanned = t >= tl.scanEnd;
  const passing = (s: TileState) => s === 'pass' || s === 'fixed' || s === 'changed';
  const sc = score(B.checks.map((c, i) => ({ ...c, pass: passing(states[i]) })));
  const cols = n > 4 ? 3 : 2;
  const X0 = 290;
  const gap = 16;
  const tw = (W - X0 - 8 - gap * (cols - 1)) / cols;
  const th = 104;
  const H = 270;
  const C = 2 * Math.PI * 92;
  const tot = B.checks.reduce((a, c) => a + SEV_WEIGHT[c.sev], 0);
  const arcCls = (s: TileState, sev: Check['sev']) =>
    s === 'idle' || s === 'scan' ? 'sec-arc-idle' : passing(s) ? 'ok-stroke' : s === 'fixing' ? 'flow-stroke' : sev === 'high' ? 'bad-stroke' : 'warn-stroke';
  const tileCls = (s: TileState, sev: Check['sev']) =>
    s === 'scan' ? 'sec-tile scan' : s === 'fail' || s === 'caught' ? `sec-tile ${sev === 'high' ? 'bad' : 'warn'}` : s === 'fixing' ? 'sec-tile fix' : s === 'changed' ? 'sec-tile changed' : passing(s) ? 'sec-tile ok' : 'sec-tile';
  const textCls = (s: TileState, sev: Check['sev']) =>
    s === 'idle' ? 'muted' : s === 'changed' ? 'warn-fill' : s === 'scan' ? 'ncm-ink' : s === 'fixing' ? 'flow-fill' : passing(s) ? 'ok-fill' : sev === 'high' ? 'bad-fill' : 'warn-fill';
  let before = 0;
  return (
    <svg class="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Compliance scan against the ${B.name} baseline: ${n} checks, score ${scanned ? sc : 'not yet known'} of 100.`}>
      <circle cx={130} cy={128} r={92} fill="none" stroke="var(--track)" stroke-width={18} />
      {B.checks.map((c, i) => {
        const w = SEV_WEIGHT[c.sev];
        const off = before;
        before += w;
        return (
          <circle
            key={c.id}
            cx={130}
            cy={128}
            r={92}
            fill="none"
            class={arcCls(states[i], c.sev)}
            stroke-width={18}
            stroke-dasharray={`${(w / tot) * C - 4} ${C}`}
            stroke-dashoffset={-(off / tot) * C}
            transform="rotate(-90 130 128)"
          />
        );
      })}
      <text x={130} y={140} text-anchor="middle" class="mono" style={{ fontSize: '44px', fontWeight: 600 }}>
        {scanned ? sc : '—'}
      </text>
      <text x={130} y={164} text-anchor="middle" class="muted" style={{ fontSize: '13px' }}>
        score of 100
      </text>
      <text x={130} y={H - 8} text-anchor="middle" class="muted" style={{ fontSize: '11.5px' }}>
        Each arc is one check, sized by severity
      </text>
      {B.checks.map((c, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = X0 + col * (tw + gap);
        const y = 12 + row * (th + 16);
        const s = states[i];
        const scanF = s === 'scan' ? prog(t, SCAN0 + i * SCAN_EACH, SCAN0 + (i + 1) * SCAN_EACH) : 0;
        return (
          <g key={c.id}>
            <rect class={tileCls(s, c.sev)} x={x} y={y} width={tw} height={th} />
            <text x={x + 14} y={y + 28} style={{ fontSize: '14px', fontWeight: 600 }}>
              {c.short}
            </text>
            <text x={x + 14} y={y + 47} class="muted" style={{ fontSize: '11.5px' }}>
              {c.sev} severity
            </text>
            <text x={x + 14} y={y + 80} class={textCls(s, c.sev)} style={{ fontSize: '13px', fontWeight: 600 }}>
              {STATE_TEXT[s]}
            </text>
            {s === 'scan' && <rect x={x} y={y + th - 4} width={tw * scanF} height={4} class="ink-fill" />}
          </g>
        );
      })}
    </svg>
  );
}

function SecOps() {
  const [base, setBase] = useEnum<Base>('bl', 'hard', ['hard', 'reg']);
  const B = BASELINES[base];
  const tl = useMemo(() => secTimeline(base), [base]);
  const clock = useClock({ rate: 1, duration: tl.end, keys: true, poster: tl.scanEnd + 0.8, stops: [tl.scanEnd, tl.fix0, tl.fixEnd, tl.drift, tl.caught] });
  useRestartOn(clock, [base]);
  const t = clock.t;
  const phase = phaseAt([0, tl.scanEnd, tl.fix0, tl.fixEnd, tl.drift, tl.caught], t);
  const states = B.checks.map((_, i) => tileState(base, i, t, tl));
  const open = states.filter((s) => s === 'fail' || s === 'caught' || s === 'fixing').length;
  const passing = (s: TileState) => s === 'pass' || s === 'fixed' || s === 'changed';
  const sc = score(B.checks.map((c, i) => ({ ...c, pass: passing(states[i]) })));
  const fixing = tl.fails.find((c) => states[B.checks.indexOf(c)] === 'fixing') ?? tl.fails.find((c) => states[B.checks.indexOf(c)] === 'fail');
  const drifted = B.checks.find((c) => c.id === B.drift.id)!;
  const lines: Line[] = [
    { tone: 'ink', k: 'Scanning', text: `Security Compliance compares the cluster’s settings with the ${B.name} baseline, one check at a time.` },
    { tone: 'warn', k: `${tl.fails.length} findings`, text: 'Each finding comes with a suggested fix and a severity. High-severity findings weigh most in the score.' },
    { tone: 'flow', k: `Fixing: ${fixing?.label ?? ''}`, text: `${fixing?.fix ?? ''} Some fixes are applied automatically, others need a change window or a decision.` },
    { tone: 'ok', k: 'Compliant', text: 'Every check in the baseline passes.' },
    { tone: 'warn', k: 'Changed by hand', text: `${B.drift.text} Nothing has looked yet.` },
    { tone: drifted.sev === 'high' ? 'bad' : 'warn', k: 'Drift caught', text: `The next scan catches “${drifted.label}” failing again, so compliance does not quietly decay between audits.` },
  ];
  const line = lines[phase];
  return (
    <Show
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
              { k: 'License', v: 'NCM Ultimate', tip: TIER_TIP.Ultimate },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <Compliance base={base} t={t} tl={tl} />
      </div>
      <PlayBar
        clock={clock}
        label="Compliance scan animation"
        fmt={() => ['Scanning', 'Findings', 'Fixing', 'Compliant', 'Drift', 'Caught'][phase]}
        extra={<Illus why="Example checks written for this demo. Security Compliance (formerly Security Central) ships its own checks and regulatory reports." />}
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
  { id: 'sec', label: 'SecOps' },
];

export default function Ncm() {
  const [tab, setTab] = useEnum<TabId>('tab', 'ai', ['ai', 'ss', 'cost', 'sec']);
  return (
    <>
      <div class="tabs" role="tablist" aria-label="Cloud Manager areas">
        {TABS.map((t) => (
          <button type="button" role="tab" key={t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'ai' && <AiOps />}
      {tab === 'ss' && <SelfService />}
      {tab === 'cost' && <Cost />}
      {tab === 'sec' && <SecOps />}
    </>
  );
}
