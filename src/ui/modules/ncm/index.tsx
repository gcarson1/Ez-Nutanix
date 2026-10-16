// Nutanix Cloud Manager (NCM): AIOps (Intelligent Operations), Self-Service, Cost Governance,
// Security Compliance. Each tab is a working mock with license tiers marked.
import { useMemo, useState } from 'preact/hooks';
import { Icon } from '../../components/Icon';
import { Chip, Field, Follow, Illus, PlayBar, Seg, Slider, Stat, Tip, Toggle, type Tone } from '../../components/controls';
import { useClock } from '../../components/clock';
import { useBool, useEnum, useNum } from '../../../state/route';
import {
  anomalyBand,
  budgetState,
  cpuSeries,
  demand,
  evaluate,
  limiting,
  maxVmsThatFit,
  monthlyCost,
  provSteps,
  rightsize,
  runway,
  score,
  stepAt,
  withSpike,
  type CatalogItem,
  type Check,
  type Project,
  type Resource,
  type Size,
  type Usage,
  type VmUsage,
} from '../../../engine/ncm';
import './style.css';

type Tier = 'Starter' | 'Pro' | 'Ultimate';
const TIER_TIP: Record<Tier, string> = {
  Starter: 'Included from NCM Starter: reporting, dashboards, capacity forecasting, right-sizing and low-code automation.',
  Pro: 'Needs NCM Pro or higher. Pro adds Cost Governance, Self-Service marketplace, single-VM blueprints and runbooks.',
  Ultimate: 'Needs NCM Ultimate: multi-VM app blueprints, approvals and scheduling, and Security Compliance.',
};
function TierTag({ t }: { t: Tier }) {
  return (
    <Tip text={TIER_TIP[t]}>
      <span class={`ncm-tier ${t.toLowerCase()}`}>NCM {t}{t !== 'Ultimate' ? '+' : ''}</span>
    </Tip>
  );
}

// ───────────────────────── AIOps ─────────────────────────
const DAYS = 21;
const LEARN = 14;
const K: Record<'tight' | 'normal' | 'wide', number> = { tight: 2, normal: 3, wide: 4.5 };

function AnomalyChart({ pts }: { pts: ReturnType<typeof anomalyBand> }) {
  const view = pts.slice(LEARN * 24);
  const W = 900;
  const H = 260;
  const l = 44;
  const r = 12;
  const t = 16;
  const b = 34;
  const sx = (i: number) => l + (i / (view.length - 1)) * (W - l - r);
  const sy = (v: number) => t + (1 - v / 100) * (H - t - b);
  const hiPath = view.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)} ${sy(Math.min(100, p.hi)).toFixed(1)}`).join(' ');
  const loPath = view
    .map((p, i) => ({ p, i }))
    .reverse()
    .map(({ p, i }) => `L${sx(i).toFixed(1)} ${sy(Math.max(0, p.lo)).toFixed(1)}`)
    .join(' ');
  const line = view.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)} ${sy(p.v).toFixed(1)}`).join(' ');
  const mean = view.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)} ${sy(p.mean).toFixed(1)}`).join(' ');
  const outs = view.map((p, i) => ({ p, i })).filter((x) => x.p.out);
  return (
    <svg class="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`CPU usage over 7 days with a learned normal band; ${outs.length} points flagged as anomalies`}>
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={l} x2={W - r} y1={sy(v)} y2={sy(v)} class="line" stroke-dasharray={v ? '2 4' : undefined} />
          <text x={l - 8} y={sy(v) + 4} text-anchor="end" class="mono muted" style={{ fontSize: '11px' }}>
            {v}%
          </text>
        </g>
      ))}
      {Array.from({ length: 7 }, (_, d) => (
        <text key={d} x={sx(d * 24 + 12)} y={H - 12} text-anchor="middle" class="muted" style={{ fontSize: '11.5px' }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]}
        </text>
      ))}
      <path d={`${hiPath} ${loPath} Z`} class="ncm-band" />
      <path d={mean} fill="none" class="ink-stroke" stroke-width={1} stroke-dasharray="4 3" style={{ opacity: 0.7 }} />
      <path d={line} fill="none" stroke="var(--text)" stroke-width={1.6} />
      {outs.map(({ p, i }) => (
        <g key={i}>
          <circle cx={sx(i)} cy={sy(p.v)} r={5} class="bad-fill" stroke="var(--bg)" stroke-width={1.5} />
        </g>
      ))}
      {outs.length > 0 && (
        <text x={Math.min(W - 150, sx(outs[0].i) + 10)} y={Math.max(28, sy(outs[0].p.v) - 10)} class="halo bad-fill" style={{ fontSize: '12.5px', fontWeight: 600 }}>
          ✕ Outside normal band
        </text>
      )}
    </svg>
  );
}

const RES: Resource[] = [
  { id: 'cpu', label: 'CPU', unit: 'vCPU', cap: 960, used: 610, growthPerDay: 1.2, perVm: 4 },
  { id: 'mem', label: 'Memory', unit: 'GB', cap: 6144, used: 4100, growthPerDay: 6, perVm: 16 },
  { id: 'sto', label: 'Storage', unit: 'TB', cap: 180, used: 112, growthPerDay: 0.12, perVm: 0.2 },
];

const VMS: VmUsage[] = [
  { name: 'sql-prod-01', vcpu: 16, memGB: 128, cpuPeak: 38, memPeak: 64 },
  { name: 'web-03', vcpu: 8, memGB: 16, cpuPeak: 12, memPeak: 30 },
  { name: 'build-agent-2', vcpu: 4, memGB: 8, cpuPeak: 97, memPeak: 70 },
  { name: 'old-reporting', vcpu: 4, memGB: 16, cpuPeak: 1, memPeak: 6 },
  { name: 'app-12', vcpu: 4, memGB: 16, cpuPeak: 62, memPeak: 66 },
  { name: 'vdi-gold', vcpu: 8, memGB: 32, cpuPeak: 22, memPeak: 41 },
];
const VERDICT: Record<string, { tone: Tone; w: string }> = {
  over: { tone: 'flow', w: 'Over-provisioned' },
  under: { tone: 'warn', w: 'Constrained' },
  inactive: { tone: 'neutral', w: 'Inactive' },
  ok: { tone: 'ok', w: 'Right-sized' },
};

function AiOps() {
  const [sens, setSens] = useEnum<'tight' | 'normal' | 'wide'>('k', 'normal', ['tight', 'normal', 'wide']);
  const [spike, setSpike] = useBool('sp', true);
  const [spAt, setSpAt] = useNum('sa', 4 * 24 + 2, 0, 7 * 24 - 4);
  const [spSize, setSpSize] = useNum('sz', 40, 5, 70);
  const [add, setAdd] = useNum('add', 20, 0, 150);
  const [apply, setApply] = useBool('ap', false);
  const pts = useMemo(() => {
    const base = cpuSeries(DAYS, 11);
    return anomalyBand(spike ? withSpike(base, LEARN * 24 + spAt, spSize) : base, K[sens], LEARN);
  }, [sens, spike, spAt, spSize]);
  const outs = pts.filter((p) => p.out).length;
  const rw = runway(RES, add);
  const lim = limiting(RES, add);
  const fit = maxVmsThatFit(RES);
  const recs = VMS.map((v) => ({ v, r: rightsize(v) }));
  const freed = recs.reduce((s, { v, r }) => s + (r.verdict === 'over' ? v.vcpu - r.vcpu : r.verdict === 'inactive' ? v.vcpu : 0), 0);
  const freedMem = recs.reduce((s, { v, r }) => s + (r.verdict === 'over' ? v.memGB - r.memGB : r.verdict === 'inactive' ? v.memGB : 0), 0);
  const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][Math.floor(spAt / 24)];
  return (
    <>
      <div class="lab">
        <div class="ctl">
          <Field label="Band width" tip="How far from the learned normal a value must be before it is flagged. Narrow catches more and is noisier." value={`±${K[sens]}σ`}>
            <Seg label="Band width" value={sens} onChange={setSens} options={[{ value: 'tight', label: 'Tight' }, { value: 'normal', label: 'Normal' }, { value: 'wide', label: 'Wide' }]} />
          </Field>
          <Field label="Inject a CPU spike">
            <Toggle on={spike} onChange={setSpike}>
              Spike on {dayName} {String(spAt % 24).padStart(2, '0')}:00
            </Toggle>
          </Field>
          <Field label="When" value={`${dayName} ${String(spAt % 24).padStart(2, '0')}:00`} why={!spike ? 'Turn the spike on first.' : null}>
            <Slider label="Spike time" value={spAt} min={0} max={7 * 24 - 4} onChange={setSpAt} />
          </Field>
          <Field label="Size" value={`+${spSize} pts`} why={!spike ? 'Turn the spike on first.' : null}>
            <Slider label="Spike size" value={spSize} min={5} max={70} onChange={setSpSize} />
            <p class="field-note">A small spike in the busy afternoon can stay inside the band; the same spike at 3 a.m. is flagged.</p>
          </Field>
        </div>
        <div class="stage">
          <div class="spread">
            <h2 class="sec-h" style={{ margin: 0 }}>
              Anomaly detection
            </h2>
            <span class="hstack">
              <Illus why="Mock data. The band here is learned per hour of day (weekday or weekend) from the previous two weeks. Intelligent Operations uses its own machine-learned baselines." />
            </span>
          </div>
          <p class="small muted">VM CPU over the last week. The shaded band is what “normal” looks like for each hour, learned from the two weeks before.</p>
          <div class="diagram-scroll">
            <AnomalyChart pts={pts} />
          </div>
          <div class="legend">
            <span>
              <i class="sw" style={{ background: 'var(--ink-soft)', border: '1px solid var(--ink-line)' }} />
              Learned normal band
            </span>
            <span>
              <i class="sw" style={{ background: 'var(--text)', height: '2px' }} />
              Observed
            </span>
            <span>
              <i class="sw" style={{ background: 'var(--bad)', borderRadius: '50%' }} />
              Anomaly
            </span>
          </div>
          <Follow tone={outs ? 'bad' : 'ok'} k={outs ? `${outs} point(s) flagged` : 'Within normal'}>
            <p>
              {outs
                ? 'The value left the band for this time of day, so it is raised as an anomaly. A fixed threshold set high enough to stay quiet on busy afternoons would miss a spike like this at night.'
                : 'Nothing left the learned band. Busy afternoons are expected, so they do not raise alerts.'}
            </p>
          </Follow>
        </div>
        <div class="rail">
          <div class="side-sec">
            <div class="eyebrow">Licensing</div>
            <p class="small">
              Part of <strong>Intelligent Operations</strong>, the AIOps component of NCM.
            </p>
            <p class="small muted" style={{ marginTop: 'var(--sp-2)' }}>
              Capacity forecasting and right-sizing: <TierTag t="Starter" />
            </p>
            <p class="small muted" style={{ marginTop: 'var(--sp-2)' }}>
              ML self-tuning and SQL Server monitoring: <TierTag t="Pro" />
            </p>
            <p class="field-note" style={{ marginTop: 'var(--sp-2)' }}>
              Tier for each capability changes over releases; check the current NCM feature matrix.
            </p>
          </div>
        </div>
      </div>

      <div class="cols-2" style={{ marginTop: 'var(--sp-8)' }}>
        <div>
          <h2 class="sec-h">
            Capacity runway <TierTag t="Starter" />
          </h2>
          <Field label="What if I add VMs?" value={`${add} VMs`} tip="Each added VM: 4 vCPU, 16 GB memory, 200 GB storage." note={<>Fits right now: up to {fit} more VMs of this size.</>}>
            <Slider label="VMs to add" value={add} min={0} max={150} step={5} onChange={setAdd} />
          </Field>
          <div class="ncm-runway">
            {RES.map((r) => {
              const d = rw.find((x) => x.id === r.id)!.days;
              const shown = Math.min(d, 365);
              const tone: Tone = d <= 0 ? 'bad' : d < 90 ? 'warn' : 'ok';
              return (
                <div class="mrow" key={r.id}>
                  <div class="mrow-top">
                    <span>
                      {r.label}
                      {r.id === lim && <span class="small muted"> · limits first</span>}
                    </span>
                    <span class={`pct ${tone}-text`}>{d <= 0 ? 'Out now' : d > 365 ? '> 1 year' : `${Math.floor(d)} days`}</span>
                  </div>
                  <div class="meter thick">
                    <span style={{ width: `${(shown / 365) * 100}%`, background: `var(--${tone})` }} />
                  </div>
                  <span class="mrow-sub">
                    {(r.used + add * r.perVm).toFixed(r.id === 'sto' ? 1 : 0)} of {r.cap} {r.unit} usable after HA reserve · grows {r.growthPerDay} {r.unit}/day
                  </span>
                </div>
              );
            })}
          </div>
          <div class="hstack" style={{ marginTop: 'var(--sp-2)' }}>
            <Illus why="Straight-line growth for clarity. The product forecasts from observed trends and seasonality." />
          </div>
        </div>
        <div>
          <h2 class="sec-h">
            Right-sizing <TierTag t="Starter" />
          </h2>
          <div class="ncm-tblwrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>VM</th>
                  <th class="num">Now</th>
                  <th class="num">Peak CPU / mem</th>
                  <th>Finding</th>
                  <th class="num">Suggest</th>
                </tr>
              </thead>
              <tbody>
                {recs.map(({ v, r }) => (
                  <tr key={v.name}>
                    <td class="mono">{v.name}</td>
                    <td class="num">
                      {v.vcpu} vCPU · {v.memGB} GB
                    </td>
                    <td class="num">
                      {v.cpuPeak}% / {v.memPeak}%
                    </td>
                    <td>
                      <Chip tone={VERDICT[r.verdict].tone}>{VERDICT[r.verdict].w}</Chip>
                    </td>
                    <td class="num">{r.verdict === 'inactive' ? 'Review / power off' : r.verdict === 'ok' ? '—' : `${r.vcpu} vCPU · ${r.memGB} GB`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div class="hstack" style={{ marginTop: 'var(--sp-3)' }}>
            <Toggle on={apply} onChange={setApply}>
              Apply the suggestions
            </Toggle>
          </div>
          {apply && (
            <Follow tone="ok" k="Reclaimed">
              <p>
                {freed} vCPU and {freedMem} GB memory freed for new workloads. The constrained VM gets more instead of less.
              </p>
            </Follow>
          )}
        </div>
      </div>
    </>
  );
}

// ───────────────────────── Self-Service ─────────────────────────
const CATALOG: CatalogItem[] = [
  { id: 'linux', label: 'Linux VM', vms: 1, vcpu: 4, memGB: 8, diskGB: 100, multiVm: false },
  { id: 'win', label: 'Windows VM', vms: 1, vcpu: 4, memGB: 16, diskGB: 150, multiVm: false },
  { id: 'app', label: '3-tier web app', vms: 4, vcpu: 4, memGB: 16, diskGB: 200, multiVm: true },
];
const PROJECTS: Project[] = [
  { id: 'web', label: 'web-shop', quota: { vcpu: 48, memGB: 192, diskGB: 3000 }, used: { vcpu: 28, memGB: 96, diskGB: 1400 }, approvalAbove: 8 },
  { id: 'data', label: 'data-team', quota: { vcpu: 32, memGB: 128, diskGB: 2000 }, used: { vcpu: 26, memGB: 100, diskGB: 1700 }, approvalAbove: 8 },
];

function QuotaBar({ label, used, add, quota, unit }: { label: string; used: number; add: number; quota: number; unit: string }) {
  const over = used + add > quota;
  return (
    <div class="mrow" style={{ padding: 'var(--sp-2) 0' }}>
      <div class="mrow-top">
        <span>{label}</span>
        <span class={`pct${over ? ' bad-text' : ''}`}>
          {used + add} / {quota} {unit}
        </span>
      </div>
      <div class="ncm-qbar">
        <span style={{ width: `${Math.min(100, (used / quota) * 100)}%` }} />
        <span class={over ? 'over' : 'add'} style={{ left: `${Math.min(100, (used / quota) * 100)}%`, width: `${Math.min(100 - (used / quota) * 100, (add / quota) * 100)}%` }} />
      </div>
    </div>
  );
}

function SelfService() {
  const [itemId, setItem] = useEnum<'linux' | 'win' | 'app'>('it', 'linux', ['linux', 'win', 'app']);
  const [size, setSize] = useEnum<Size>('sz', 'M', ['S', 'M', 'L']);
  const [proj, setProj] = useEnum<'web' | 'data'>('pj', 'web', ['web', 'data']);
  const [tier, setTier] = useEnum<'Pro' | 'Ultimate'>('tr', 'Ultimate', ['Pro', 'Ultimate']);
  const [started, setStarted] = useState(false);
  const item = CATALOG.find((c) => c.id === itemId)!;
  const p = PROJECTS.find((x) => x.id === proj)!;
  const blockedByTier = item.multiVm && tier === 'Pro';
  const d = demand(item, size);
  const v = evaluate(p, d, tier === 'Ultimate');
  const steps = provSteps(item, v.needsApproval);
  const total = steps.reduce((s, x) => s + x.dur, 0);
  const clock = useClock({ rate: 1, duration: total, stepSize: 1, keys: true });
  const at = stepAt(steps, clock.t);
  const can = v.ok && !blockedByTier;
  const reset = () => {
    setStarted(false);
    clock.reset();
  };
  const change = <T,>(fn: (x: T) => void) => (x: T) => {
    fn(x);
    reset();
  };
  const live = started && can;
  const done = live && at.done;
  const vmsUp = live ? (at.done ? item.vms : steps[at.idx].id === 'create' ? Math.max(0, Math.floor(((clock.t - steps.slice(0, at.idx).reduce((s, x) => s + x.dur, 0)) / steps[at.idx].dur) * item.vms)) : steps.findIndex((s) => s.id === 'create') < at.idx ? item.vms : 0) : 0;

  return (
    <div class="lab">
      <div class="ctl">
        <Field label="Catalog item" tip="Items in the marketplace are published from blueprints: what to deploy and how to configure it.">
          <Seg
            label="Catalog item"
            value={itemId}
            onChange={change(setItem)}
            options={CATALOG.map((c) => ({ value: c.id as 'linux' | 'win' | 'app', label: c.label }))}
          />
        </Field>
        <Field label="Size" value={`${d.vcpu} vCPU · ${d.memGB} GB`}>
          <Seg label="Size" value={size} onChange={change(setSize)} options={(['S', 'M', 'L'] as Size[]).map((s) => ({ value: s, label: s }))} />
        </Field>
        <Field label="Project" tip="Projects group people, quotas and the infrastructure they may use.">
          <Seg label="Project" value={proj} onChange={change(setProj)} options={PROJECTS.map((x) => ({ value: x.id as 'web' | 'data', label: x.label }))} />
        </Field>
        <Field label="License tier" tip="Changes what the catalog may offer." why={blockedByTier ? 'Multi-VM app blueprints need NCM Ultimate.' : null}>
          <Seg label="Tier" value={tier} onChange={change(setTier)} options={[{ value: 'Pro', label: 'NCM Pro' }, { value: 'Ultimate', label: 'NCM Ultimate' }]} />
        </Field>
        <Field label="Request" why={!v.ok ? 'Over the project quota. Pick a smaller size or another project.' : null}>
          <button
            type="button"
            class="btn primary"
            disabled={!can || live}
            onClick={() => {
              setStarted(true);
              clock.seek(0);
              clock.play();
            }}
          >
            Request {item.label}
          </button>
        </Field>
      </div>
      <div class="stage">
        <h2 class="sec-h">
          {item.label} in project {p.label} {item.multiVm ? <TierTag t="Ultimate" /> : <TierTag t="Pro" />}
        </h2>
        <svg class="diagram" viewBox="0 0 900 190" role="img" aria-label={`${item.vms} VM(s) being provisioned`}>
          <rect class="frame" x={1} y={1} width={898} height={188} rx={4} />
          <text x={16} y={26} class="muted" style={{ fontSize: '12px', letterSpacing: '0.08em' }}>
            PROJECT {p.label.toUpperCase()} · CLUSTER NYC-PROD
          </text>
          {Array.from({ length: item.vms }, (_, i) => {
            const up = i < vmsUp;
            const role = item.multiVm ? ['Load balancer', 'Web', 'App', 'Database'][i] : item.label;
            const x = 24 + i * 214;
            return (
              <g key={i}>
                <rect x={x} y={48} width={196} height={112} rx={4} class={up ? 'vm hl' : 'vm'} stroke-dasharray={up ? undefined : '5 4'} style={{ opacity: up ? 1 : 0.6 }} />
                <text x={x + 14} y={76} style={{ fontWeight: 600, fontSize: '14px' }}>
                  {role}
                </text>
                <text x={x + 14} y={98} class="muted mono" style={{ fontSize: '11.5px' }}>
                  {Math.max(1, item.vcpu * ({ S: 0.5, M: 1, L: 2 } as const)[size])} vCPU · {Math.max(1, item.memGB * ({ S: 0.5, M: 1, L: 2 } as const)[size])} GB
                </text>
                <text x={x + 14} y={140} class={up ? (done ? 'ok-fill' : 'flow-fill') : 'muted'} style={{ fontSize: '12.5px', fontWeight: 600 }}>
                  {up ? (done ? '✓ Running, configured' : '→ Configuring') : 'Not created'}
                </text>
              </g>
            );
          })}
        </svg>
        <ol class="ncm-steps">
          {steps.map((s, i) => {
            const st = !live ? 'todo' : at.done || i < at.idx ? 'done' : i === at.idx ? 'now' : 'todo';
            return (
              <li key={s.id} class={st}>
                <span class="ic" aria-hidden="true">
                  {st === 'done' ? '✓' : st === 'now' ? '→' : String(i + 1)}
                </span>
                {s.label}
                {s.id === 'approve' && <Illus why="Approval is granted automatically after a few seconds in this demo." />}
              </li>
            );
          })}
        </ol>
        {live && <PlayBar clock={clock} label="Provisioning" scrub={false} fmt={(t) => `${t.toFixed(0)} s`} />}
        {live && (
          <button type="button" class="tbtn" onClick={reset}>
            New request
          </button>
        )}
        <Follow tone={!v.ok || blockedByTier ? 'bad' : done ? 'ok' : live ? 'flow' : 'ink'} k={!v.ok ? 'Request refused' : blockedByTier ? 'Not in this tier' : done ? 'Ready' : live ? 'Provisioning' : 'Ready to request'}>
          {!v.ok ? (
            <ul>
              {v.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : blockedByTier ? (
            <p>Multi-VM application blueprints are an NCM Ultimate feature. Single-VM items work in Pro.</p>
          ) : done ? (
            <p>The requester gets a working {item.multiVm ? 'application' : 'VM'} without a ticket, inside the quota, with ownership and categories already set.</p>
          ) : (
            <p>
              {v.needsApproval ? `This request is over ${p.approvalAbove} vCPU, so the project’s approval policy adds an approval step. ` : ''}Quota and policy are checked before anything is created.
            </p>
          )}
        </Follow>
        <p class="field-note" style={{ marginTop: 'var(--sp-3)' }}>
          Durations are compressed for the demo. <Illus why="Real provisioning time depends on the blueprint, image size and configuration tasks." />
        </p>
      </div>
      <div class="rail">
        <div class="side-sec">
          <div class="eyebrow">Project quota: {p.label}</div>
          <QuotaBar label="vCPU" used={p.used.vcpu} add={live || !v.ok ? d.vcpu : 0} quota={p.quota.vcpu} unit="" />
          <QuotaBar label="Memory" used={p.used.memGB} add={live || !v.ok ? d.memGB : 0} quota={p.quota.memGB} unit="GB" />
          <QuotaBar label="Storage" used={p.used.diskGB} add={live || !v.ok ? d.diskGB : 0} quota={p.quota.diskGB} unit="GB" />
        </div>
        <div class="side-sec">
          <div class="eyebrow">By tier</div>
          <p class="small">
            <TierTag t="Pro" /> Marketplace, single-VM blueprints, runbooks.
          </p>
          <p class="small" style={{ marginTop: 'var(--sp-2)' }}>
            <TierTag t="Ultimate" /> Multi-VM app blueprints, approvals and scheduling.
          </p>
          <p class="field-note" style={{ marginTop: 'var(--sp-2)' }}>Self-Service was formerly called Calm.</p>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Cost ─────────────────────────
const USAGE: Usage[] = [
  { project: 'web-shop', vcpu: 180, memGB: 720, tb: 22, budget: 9000 },
  { project: 'data-team', vcpu: 240, memGB: 1900, tb: 85, budget: 15000 },
  { project: 'vdi', vcpu: 400, memGB: 1600, tb: 40, budget: 14000 },
  { project: 'dev-test', vcpu: 120, memGB: 480, tb: 18, budget: 4000 },
];

function Cost() {
  const [cpuR, setCpuR] = useNum('rc', 20, 5, 60);
  const [memR, setMemR] = useNum('rm', 3, 1, 10);
  const [tbR, setTbR] = useNum('rt', 40, 10, 150);
  const [growth, setGrowth] = useNum('gr', 0, -30, 60);
  const rates = { vcpuMonth: cpuR, memGBMonth: memR, tbMonth: tbR };
  const rows = USAGE.map((u) => {
    const g = 1 + growth / 100;
    const cost = monthlyCost({ ...u, vcpu: u.vcpu * g, memGB: u.memGB * g, tb: u.tb * g }, rates);
    return { u, cost, st: budgetState(cost, u.budget) };
  });
  const max = Math.max(...rows.map((r) => Math.max(r.cost, r.u.budget)));
  const W = 900;
  const l = 110;
  const rowH = 50;
  const sx = (v: number) => (v / max) * (W - l - 120);
  const toneOf = (s: string): Tone => (s === 'over' ? 'bad' : s === 'warn' ? 'warn' : 'ok');
  const total = rows.reduce((s, r) => s + r.cost, 0);
  return (
    <div class="lab">
      <div class="ctl">
        <Field label="Rate: vCPU per month" value={`$${cpuR}`} tip="You set the unit rates, so showback reflects your own cost model.">
          <Slider label="vCPU rate" value={cpuR} min={5} max={60} onChange={setCpuR} />
        </Field>
        <Field label="Rate: GB memory per month" value={`$${memR}`}>
          <Slider label="Memory rate" value={memR} min={1} max={10} onChange={setMemR} />
        </Field>
        <Field label="Rate: TB storage per month" value={`$${tbR}`}>
          <Slider label="Storage rate" value={tbR} min={10} max={150} step={5} onChange={setTbR} />
        </Field>
        <Field label="Usage change this month" value={`${growth > 0 ? '+' : ''}${growth}%`} tip="What if every project grows (or shrinks) by this much?">
          <Slider label="Usage change" value={growth} min={-30} max={60} step={5} onChange={setGrowth} />
        </Field>
        <div class="hstack" style={{ marginTop: 'var(--sp-3)' }}>
          <Illus why="Rates, usage and budgets are made-up examples. Cost Governance meters actual consumption and uses the rates you configure." />
        </div>
      </div>
      <div class="stage">
        <h2 class="sec-h">
          Showback by project <TierTag t="Pro" />
        </h2>
        <div class="diagram-scroll">
          <svg class="diagram" viewBox={`0 0 ${W} ${rows.length * rowH + 30}`} role="img" aria-label="Monthly cost against budget for each project">
            {rows.map((r, i) => {
              const y = 10 + i * rowH;
              return (
                <g key={r.u.project}>
                  <text x={0} y={y + 20} style={{ fontWeight: 600, fontSize: '13.5px' }}>
                    {r.u.project}
                  </text>
                  <rect x={l} y={y + 4} width={sx(r.cost)} height={24} class={`${r.st === 'over' ? 'bad' : r.st === 'warn' ? 'warn' : 'ok'}-fill`} style={{ opacity: 0.8 }} />
                  <line x1={l + sx(r.u.budget)} x2={l + sx(r.u.budget)} y1={y} y2={y + 32} stroke="var(--text)" stroke-width={2} />
                  <text x={l + sx(r.u.budget) + 4} y={y + 42} class="muted" style={{ fontSize: '11px' }}>
                    budget ${r.u.budget.toLocaleString()}
                  </text>
                  <text x={l + Math.max(sx(r.cost), sx(r.u.budget)) + 10} y={y + 21} class="mono" style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    ${Math.round(r.cost).toLocaleString()}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div class="ncm-tblwrap" style={{ marginTop: 'var(--sp-4)' }}>
        <table class="tbl">
          <thead>
            <tr>
              <th>Project</th>
              <th class="num">vCPU</th>
              <th class="num">Memory</th>
              <th class="num">Storage</th>
              <th class="num">Cost / month</th>
              <th>Budget</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const g = 1 + growth / 100;
              return (
                <tr key={r.u.project}>
                  <td>{r.u.project}</td>
                  <td class="num">{Math.round(r.u.vcpu * g)}</td>
                  <td class="num">{Math.round(r.u.memGB * g)} GB</td>
                  <td class="num">{(r.u.tb * g).toFixed(1)} TB</td>
                  <td class="num">${Math.round(r.cost).toLocaleString()}</td>
                  <td>
                    <Chip tone={toneOf(r.st)}>{r.st === 'over' ? 'Over budget' : r.st === 'warn' ? '80%+ used' : 'On track'}</Chip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <Follow tone={rows.some((r) => r.st === 'over') ? 'bad' : rows.some((r) => r.st === 'warn') ? 'warn' : 'ok'} k="Budget alerts">
          <p>
            {rows.filter((r) => r.st !== 'ok').length
              ? `${rows.filter((r) => r.st !== 'ok').map((r) => r.u.project).join(', ')} crossed a budget threshold, so the owners get an alert before the month closes, not after.`
              : 'Every project is under 80% of its budget.'}
          </p>
        </Follow>
      </div>
      <div class="rail">
        <div class="side-sec">
          <div class="eyebrow">This month</div>
          <div class="bignum">${Math.round(total / 1000)}k</div>
          <Stat k="Projects over budget" v={rows.filter((r) => r.st === 'over').length} tone={rows.some((r) => r.st === 'over') ? 'bad' : 'ok'} />
        </div>
        <div class="side-sec">
          <div class="eyebrow">Where the cost data lives</div>
          <p class="small">
            In NCM 2.0 (2026), Cost Governance runs fully on-premises, inside your own data center, with no separate SaaS portal. Metering, budgets and chargeback stay on infrastructure you control.
          </p>
          <p class="field-note" style={{ marginTop: 'var(--sp-2)' }}>Cost Governance was formerly called Beam.</p>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── SecOps ─────────────────────────
const BASELINES: Record<'hard' | 'reg', Omit<Check, 'pass'>[]> = {
  hard: [
    { id: 'pw', label: 'Default admin passwords changed', fix: 'Rotate the default credentials on hosts and CVMs.', sev: 'high' },
    { id: 'dare', label: 'Data-at-rest encryption enabled', fix: 'Enable software encryption on the storage containers, with a key manager.', sev: 'high' },
    { id: 'ssh', label: 'Password SSH login disabled', fix: 'Switch cluster lockdown on and use key-based access.', sev: 'medium' },
    { id: 'syslog', label: 'Logs forwarded to the SIEM', fix: 'Add the remote syslog server for audit and system logs.', sev: 'medium' },
    { id: 'ver', label: 'Software on a supported release', fix: 'Plan an LCM upgrade to a supported release.', sev: 'low' },
  ],
  reg: [
    { id: 'seg', label: 'Cardholder VMs isolated by security policy', fix: 'Apply a Flow isolation policy to the PCI category.', sev: 'high' },
    { id: 'mfa', label: 'Admin access through the identity provider', fix: 'Remove local admin accounts and use directory or SAML login.', sev: 'high' },
    { id: 'audit', label: 'Audit trail retained 12 months', fix: 'Raise log retention on the SIEM target.', sev: 'medium' },
    { id: 'snap', label: 'Protected by a DR policy', fix: 'Add the category to a protection policy.', sev: 'medium' },
  ],
};
const INITIAL_FAIL = new Set(['dare', 'ssh', 'ver', 'seg', 'audit']);

function SecOps() {
  const [base, setBase] = useEnum<'hard' | 'reg'>('bl', 'hard', ['hard', 'reg']);
  const [scanned, setScanned] = useState(false);
  const [fixed, setFixed] = useState<string[]>([]);
  const checks: Check[] = BASELINES[base].map((c) => ({ ...c, pass: !INITIAL_FAIL.has(c.id) || fixed.includes(c.id) }));
  const sc = score(checks);
  const fails = checks.filter((c) => !c.pass);
  return (
    <div class="lab">
      <div class="ctl">
        <Field label="Baseline" tip="A baseline is the list of settings your policy requires. Findings are measured against it.">
          <Seg label="Baseline" value={base} onChange={(b) => (setBase(b), setScanned(false))} options={[{ value: 'hard', label: 'Platform hardening' }, { value: 'reg', label: 'Regulatory (card data)' }]} />
        </Field>
        <Field label="Scan">
          <div class="hstack">
            <button type="button" class="btn primary" onClick={() => setScanned(true)}>
              <Icon name="search" /> {scanned ? 'Re-scan' : 'Scan the cluster'}
            </button>
            {fixed.length > 0 && (
              <button type="button" class="tbtn" onClick={() => (setFixed([]), setScanned(false))}>
                Reset
              </button>
            )}
          </div>
        </Field>
        <div class="hstack" style={{ marginTop: 'var(--sp-3)' }}>
          <Illus why="Example checks written for this demo. Security Compliance ships its own checks and regulatory reports." />
        </div>
      </div>
      <div class="stage">
        <h2 class="sec-h">
          Compliance against the baseline <TierTag t="Ultimate" />
        </h2>
        {!scanned ? (
          <p class="lede">Run a scan to compare the cluster with the {base === 'hard' ? 'hardening' : 'regulatory'} baseline.</p>
        ) : (
          <ul class="ncm-checks">
            {checks.map((c) => (
              <li key={c.id} class={c.pass ? 'pass' : 'fail'}>
                <Chip tone={c.pass ? 'ok' : c.sev === 'high' ? 'bad' : 'warn'}>{c.pass ? 'Pass' : `Fail · ${c.sev}`}</Chip>
                <div>
                  <div class="t">{c.label}</div>
                  {!c.pass && <div class="small muted">Suggested fix: {c.fix}</div>}
                </div>
                {!c.pass && (
                  <button type="button" class="btn" onClick={() => setFixed([...fixed, c.id])}>
                    Remediate
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {scanned && (
          <Follow tone={fails.length ? 'warn' : 'ok'} k={fails.length ? `${fails.length} finding(s)` : 'Compliant'}>
            <p>
              {fails.length
                ? 'Each finding comes with a suggested remediation. Some can be applied automatically, others need a change window or a decision.'
                : 'Every check passes. Keep scanning: drift happens when settings are changed by hand.'}
            </p>
          </Follow>
        )}
      </div>
      <div class="rail">
        <div class="side-sec">
          <div class="eyebrow">Score</div>
          <svg class="diagram" viewBox="0 0 200 200" role="img" aria-label={scanned ? `Compliance score ${sc} of 100` : 'Not scanned yet'} style={{ maxWidth: '12rem' }}>
            <circle cx={100} cy={100} r={80} fill="none" stroke="var(--track)" stroke-width={16} />
            {scanned &&
              checks.map((c, i) => {
                const w = { high: 3, medium: 2, low: 1 } as const;
                const tot = checks.reduce((a, b) => a + w[b.sev], 0);
                const before = checks.slice(0, i).reduce((a, b) => a + w[b.sev], 0);
                const C = 2 * Math.PI * 80;
                return (
                  <circle
                    key={c.id}
                    cx={100}
                    cy={100}
                    r={80}
                    fill="none"
                    class={c.pass ? 'ok-stroke' : c.sev === 'high' ? 'bad-stroke' : 'warn-stroke'}
                    stroke-width={16}
                    stroke-dasharray={`${(w[c.sev] / tot) * C - 3} ${C}`}
                    stroke-dashoffset={-(before / tot) * C}
                    transform="rotate(-90 100 100)"
                  />
                );
              })}
            <text x={100} y={108} text-anchor="middle" class="mono" style={{ fontSize: '40px', fontWeight: 600 }}>
              {scanned ? sc : '—'}
            </text>
            <text x={100} y={132} text-anchor="middle" class="muted" style={{ fontSize: '13px' }}>
              of 100
            </text>
          </svg>
          <p class="field-note">Each arc is one check, sized by severity (high 3, medium 2, low 1). Green passes, amber and red fail.</p>
        </div>
        <div class="side-sec">
          <div class="eyebrow">What it is</div>
          <p class="small">Security Compliance (formerly Security Central) monitors configuration against baselines and regulatory frameworks, suggests remediation, and helps plan network security policies.</p>
        </div>
      </div>
    </div>
  );
}

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
