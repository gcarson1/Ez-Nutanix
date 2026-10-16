// Nutanix Central & multi-Prism-Central federation ("Prism Federation" on the slide).
// Overview: Prism Element -> Prism Central -> Nutanix Central, clusters registering.
// Federation: fleet dashboard, role-based visibility, alert roll-up, staggered fleet LCM, one API.
import { useMemo, useState } from 'preact/hooks';
import { Icon } from '../../components/Icon';
import { Chip, Field, Follow, Illus, PlayBar, Seg, Slider, Stat, Tip, Toggle, fmtTB, type Tone } from '../../components/controls';
import { useClock } from '../../components/clock';
import { useBool, useEnum, useNum, useStr } from '../../../state/route';
import { go } from '../../shell/nav';
import {
  CLUSTERS,
  DOMAINS,
  ROLES,
  can,
  canSee,
  planUpgrade,
  roleDef,
  rollupAlerts,
  runAt,
  totals,
  visibleClusters,
  type Fault,
  type FleetCluster,
  type Health,
  type Role,
  type RunState,
} from '../../../engine/fleet';
import './style.css';

const ALL_MASK = (1 << CLUSTERS.length) - 1;
const maskToIds = (m: number) => CLUSTERS.filter((_, i) => m & (1 << i)).map((c) => c.id);
const HEALTH_TONE: Record<Health, Tone> = { ok: 'ok', warn: 'warn', critical: 'bad' };
const HEALTH_WORD: Record<Health, string> = { ok: 'Healthy', warn: 'Warning', critical: 'Critical' };

function useRegistered(): [string[], number, (m: number) => void] {
  const [m, setM] = useNum('rg', ALL_MASK, 0, ALL_MASK);
  return [maskToIds(m), m, setM];
}

function fixedClusters(fix: boolean): FleetCluster[] {
  return CLUSTERS.map((c) => (fix && c.id === 'tor' ? { ...c, health: 'ok' as Health } : c));
}

// ───────────────────────── Overview ─────────────────────────
type Level = 'pe' | 'pc' | 'nc';
const LEVELS: { id: Level; label: string; where: string; scope: string; holds: string }[] = [
  {
    id: 'pe',
    label: 'Prism Element',
    where: 'Built into every cluster; runs on the cluster’s own Controller VMs (CVMs).',
    scope: 'One cluster.',
    holds: 'Cluster settings, storage containers, that cluster’s VMs, hosts, health and alerts.',
  },
  {
    id: 'pc',
    label: 'Prism Central',
    where: 'A separate appliance: one VM, or a three-VM scale-out deployment.',
    scope: 'Every cluster registered to it (a Prism Central “domain”). A cluster registers to one Prism Central.',
    holds: 'Multi-cluster features: v4 APIs, categories, projects, role-based access, Flow policies, DR, LCM across clusters, Cloud Manager features.',
  },
  {
    id: 'nc',
    label: 'Nutanix Central',
    where: 'Delivered as SaaS or deployed on-premises. The on-prem version supports up to 25 Prism Central domains.',
    scope: 'Many Prism Central domains, for example one per region.',
    holds: 'Fleet health, capacity and alerts across domains, federated identity and access, global projects and categories, fleet and license management, lifecycle of Nutanix services, the Marketplace. Hosts Cloud Manager (NCM) 2.x.',
  },
];

function Hierarchy({ level, sel, reg, onCluster }: { level: Level; sel: string; reg: string[]; onCluster: (id: string) => void }) {
  const W = 920;
  const tileW = 164;
  const gap = 20;
  const x0 = (W - (CLUSTERS.length * tileW + (CLUSTERS.length - 1) * gap)) / 2;
  const cx = (i: number) => x0 + i * (tileW + gap);
  const domX = (d: string) => {
    const idx = CLUSTERS.map((c, i) => (c.domain === d ? i : -1)).filter((i) => i >= 0);
    const a = cx(idx[0]);
    const b = cx(idx[idx.length - 1]) + tileW;
    return { a, b, mid: (a + b) / 2 };
  };
  const selC = CLUSTERS.find((c) => c.id === sel) ?? CLUSTERS[0];
  const selIdx = CLUSTERS.indexOf(selC);
  const anyReg = (d: string) => CLUSTERS.some((c) => c.domain === d && reg.includes(c.id));

  // scope frame
  let fx = 8;
  let fy = 8;
  let fw = W - 16;
  let fh = 384;
  let flabel = 'Nutanix Central sees every registered cluster in every domain';
  if (level === 'pc') {
    const d = domX(selC.domain);
    fx = d.a - 12;
    fy = 112;
    fw = d.b - d.a + 24;
    fh = 280;
    flabel = `${DOMAINS.find((x) => x.id === selC.domain)!.name.split(' · ')[1]} Prism Central sees its registered clusters`;
  } else if (level === 'pe') {
    fx = cx(selIdx) - 10;
    fy = 222;
    fw = tileW + 20;
    fh = 170;
    flabel = `Prism Element sees only ${selC.name}`;
  }

  return (
    <svg class="diagram" viewBox={`0 0 ${W} 430`} role="group" aria-label="Prism Element, Prism Central and Nutanix Central hierarchy">
      {/* Nutanix Central */}
      <rect class="ink-fill" x={W / 2 - 230} y={22} width={460} height={58} rx={6} />
      <text x={W / 2} y={48} text-anchor="middle" style={{ fill: '#fff', fontWeight: 650, fontSize: '17px' }}>
        Nutanix Central
      </text>
      <text x={W / 2} y={68} text-anchor="middle" style={{ fill: 'rgba(255,255,255,.8)', fontSize: '12.5px' }}>
        SaaS or on-premises · federates Prism Central domains
      </text>
      {DOMAINS.map((d) => {
        const p = domX(d.id);
        const on = anyReg(d.id);
        return (
          <g key={d.id}>
            <path d={`M${W / 2} 80 V 100 H ${p.mid} V 122`} fill="none" class={on ? 'ink-stroke' : 'line'} stroke-width={on ? 2 : 1} stroke-dasharray={on ? undefined : '4 4'} />
            <rect x={p.mid - 140} y={122} width={280} height={52} rx={4} class="cen-pc" />
            <text x={p.mid} y={145} text-anchor="middle" style={{ fontWeight: 600, fontSize: '14.5px' }}>
              {d.name}
            </text>
            <text x={p.mid} y={163} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
              VM appliance · 1 or 3 VMs
            </text>
          </g>
        );
      })}
      {CLUSTERS.map((c, i) => {
        const x = cx(i);
        const r = reg.includes(c.id);
        const d = domX(c.domain);
        const isSel = c.id === sel;
        return (
          <g
            key={c.id}
            role="button"
            tabIndex={0}
            aria-label={`${c.name}, ${c.site}, ${r ? 'registered' : 'not registered'}`}
            onClick={() => onCluster(c.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onCluster(c.id))}
          >
            <path d={`M${x + tileW / 2} 232 V 206 H ${d.mid} V 174`} fill="none" class={r ? 'ink-stroke' : 'line'} stroke-width={r ? 2 : 1} stroke-dasharray={r ? undefined : '4 4'} />
            <rect class={`hit node-box${isSel ? ' sel' : ''}`} x={x} y={232} width={tileW} height={150} rx={4} style={{ opacity: r ? 1 : 0.55 }} />
            <text x={x + 12} y={256} style={{ fontWeight: 650, fontSize: '14px' }}>
              {c.name}
            </text>
            <text x={x + 12} y={274} class="muted" style={{ fontSize: '11.5px' }}>
              {c.site}
            </text>
            {Array.from({ length: Math.min(c.nodes, 8) }, (_, n) => (
              <rect key={n} class="cvm" x={x + 12 + n * 17} y={288} width={13} height={18} />
            ))}
            <text x={x + 12} y={324} class="muted" style={{ fontSize: '11.5px' }}>
              {c.nodes} nodes · {c.kind === 'edge' ? 'edge site' : 'data center'}
            </text>
            <rect x={x + 12} y={334} width={tileW - 24} height={22} class="bg3" />
            <text x={x + tileW / 2} y={349} text-anchor="middle" class="mono" style={{ fontSize: '11px' }}>
              Prism Element
            </text>
            <text x={x + tileW / 2} y={374} text-anchor="middle" class={r ? (c.health === 'ok' ? 'ok-fill' : 'warn-fill') : 'muted'} style={{ fontSize: '11.5px', fontWeight: 600 }}>
              {r ? (c.health === 'ok' ? '✓ Registered · healthy' : '⚠ Registered · warning') : '+ Click to register'}
            </text>
          </g>
        );
      })}
      <rect x={fx} y={fy} width={fw} height={fh} rx={8} fill="none" class="cen-scope" />
      <text
        x={fx + fw / 2 < 220 ? fx : fx + fw / 2 > W - 220 ? fx + fw : fx + fw / 2}
        y={fy + fh + 26}
        text-anchor={fx + fw / 2 < 220 ? 'start' : fx + fw / 2 > W - 220 ? 'end' : 'middle'}
        class="halo" style={{ fontWeight: 600, fontSize: '13px', fill: 'var(--ink-fg)' }}>
        {flabel}
      </text>
    </svg>
  );
}

function Overview() {
  const [level, setLevel] = useEnum<Level>('lv', 'nc', ['pe', 'pc', 'nc']);
  const [sel, setSel] = useStr('cl', 'nyc');
  const [reg, mask, setMask] = useRegistered();
  const L = LEVELS.find((l) => l.id === level)!;
  const selC = CLUSTERS.find((c) => c.id === sel) ?? CLUSTERS[0];
  const scopeList = level === 'pe' ? [selC] : level === 'pc' ? CLUSTERS.filter((c) => c.domain === selC.domain && reg.includes(c.id)) : CLUSTERS.filter((c) => reg.includes(c.id));
  const t = totals(scopeList);
  const onCluster = (id: string) => {
    const i = CLUSTERS.findIndex((c) => c.id === id);
    if (!(mask & (1 << i))) setMask(mask | (1 << i));
    setSel(id);
  };
  const selReg = reg.includes(selC.id);
  return (
    <>
      <div class="lab">
        <div class="ctl">
          <Field label="Look through" tip="Pick a console to see what it can manage. Click a cluster to choose which one.">
            <Seg label="Console" value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l.id, label: l.label }))} />
          </Field>
          <Field label="Registration" tip="A cluster appears in Prism Central (and in Nutanix Central above it) only after it is registered. Prism Element works either way.">
            <div class="hstack">
              <button type="button" class="btn" onClick={() => setMask(0)} disabled={mask === 0}>
                Start unregistered
              </button>
              <button type="button" class="tbtn" onClick={() => setMask(ALL_MASK)} disabled={mask === ALL_MASK}>
                Register all
              </button>
            </div>
            <p class="field-note">Click a dashed cluster in the diagram to register it.</p>
          </Field>
          <Field label="Selected cluster" value={selC.name}>
            <p class="small muted">{selC.site}</p>
            {selReg ? (
              <button type="button" class="tbtn" onClick={() => setMask(mask & ~(1 << CLUSTERS.indexOf(selC)))}>
                Unregister from Prism Central
              </button>
            ) : (
              <button type="button" class="btn primary" onClick={() => onCluster(selC.id)}>
                Register to {DOMAINS.find((d) => d.id === selC.domain)!.name}
              </button>
            )}
          </Field>
        </div>
        <div class="stage">
          <div class="diagram-scroll">
            <Hierarchy level={level} sel={selC.id} reg={reg} onCluster={onCluster} />
          </div>
          <Follow tone="ink" k={L.label}>
            <p>
              <strong>Runs:</strong> {L.where}
            </p>
            <p>
              <strong>Sees:</strong> {L.scope}
            </p>
            <p class="rest">{L.holds}</p>
          </Follow>
        </div>
        <div class="rail">
          <div class="side-sec">
            <div class="eyebrow">In view from {L.label}</div>
            <Stat k="Clusters" v={t.clusters} />
            <Stat k="Nodes" v={t.nodes} />
            <Stat k="Capacity used" v={`${fmtTB(t.usedTB, 0)} of ${fmtTB(t.capTB, 0)}`} />
            <div class="hstack" style={{ marginTop: 'var(--sp-2)' }}>
              {t.clusters ? (
                <Chip tone={HEALTH_TONE[t.worst]}>{t.worst === 'ok' ? 'All healthy' : 'Needs attention'}</Chip>
              ) : (
                <Chip tone="neutral">Nothing registered</Chip>
              )}
            </div>
            {level === 'pe' && !selReg && <p class="field-note" style={{ marginTop: 'var(--sp-2)' }}>Prism Element manages its own cluster whether or not it is registered.</p>}
            {level !== 'pe' && mask !== ALL_MASK && (
              <p class="field-note" style={{ marginTop: 'var(--sp-2)' }}>
                {CLUSTERS.length - reg.length} cluster(s) are not registered, so they are invisible from here.
              </p>
            )}
          </div>
          <div class="side-sec">
            <div class="eyebrow">Next</div>
            <button type="button" class="btn" onClick={() => go('central', { tab: 'fed' })}>
              Fleet operations <Icon name="arrow" />
            </button>
          </div>
        </div>
      </div>
      <h2 class="sec-h">Three consoles, three scopes</h2>
      <div class="cen-tblwrap">
        <table class="tbl">
          <thead>
            <tr>
              <th />
              {LEVELS.map((l) => (
                <th key={l.id}>{l.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="muted">Where it runs</td>
              {LEVELS.map((l) => (
                <td key={l.id}>{l.where}</td>
              ))}
            </tr>
            <tr>
              <td class="muted">What it manages</td>
              {LEVELS.map((l) => (
                <td key={l.id}>{l.scope}</td>
              ))}
            </tr>
            <tr>
              <td class="muted">What lives there</td>
              {LEVELS.map((l) => (
                <td key={l.id}>{l.holds}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p class="field-note" style={{ marginTop: 'var(--sp-3)' }}>
        “Prism Federation” on the platform slide is a label for this multi-Prism-Central federation under Nutanix Central (API, alerts, LCM, identity). It is not a separately sold product.
      </p>
    </>
  );
}

// ───────────────────────── Federation ─────────────────────────
const STATE_LABEL: Record<RunState, string> = { queued: 'Queued', running: 'Upgrading', done: 'Done', blocked: 'Blocked by pre-check', paused: 'Paused', held: 'Held' };
const STATE_TONE: Record<RunState, Tone> = { queued: 'neutral', running: 'flow', done: 'ok', blocked: 'warn', paused: 'bad', held: 'neutral' };

const fmtHM = (min: number) => {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

function Gantt({ plan, run, list, t }: { plan: ReturnType<typeof planUpgrade>; run: ReturnType<typeof runAt>; list: FleetCluster[]; t: number }) {
  const W = 920;
  const left = 150;
  const rowH = 44;
  const top = 40;
  const total = Math.max(plan.total, 1);
  const sx = (m: number) => left + (m / total) * (W - left - 20);
  const rows = run.entries;
  const H = top + rows.length * rowH + 40;
  const step = total > 900 ? 240 : total > 400 ? 120 : 60;
  const ticks: number[] = [];
  for (let m = 0; m <= total; m += step) ticks.push(m);
  const byId = new Map(list.map((c) => [c.id, c]));
  return (
    <svg class="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Staggered fleet upgrade timeline, one row per cluster">
      {ticks.map((m) => (
        <g key={m}>
          <line x1={sx(m)} x2={sx(m)} y1={top - 8} y2={H - 30} class="line" stroke-dasharray="2 4" />
          <text x={sx(m)} y={H - 12} text-anchor="middle" class="mono muted" style={{ fontSize: '11px' }}>
            {fmtHM(m)}
          </text>
        </g>
      ))}
      {Array.from({ length: plan.waves }, (_, w) => {
        const es = plan.entries.filter((e) => e.wave === w);
        const a = Math.min(...es.map((e) => e.start));
        return (
          <text key={w} x={sx(a) + 2} y={top - 14} class="muted" style={{ fontSize: '11.5px', fontWeight: 600 }}>
            {w === 0 && plan.entries.filter((e) => e.wave === 0).length === 1 && plan.waves > 1 ? 'Wave 1 · canary' : `Wave ${w + 1}`}
          </text>
        );
      })}
      {rows.map((e, i) => {
        const y = top + i * rowH;
        const c = byId.get(e.cluster)!;
        const x1 = sx(e.start);
        const x2 = Math.max(sx(e.end), x1 + 8);
        const cls = e.state === 'done' ? 'ok-fill' : e.state === 'running' ? 'flow-fill' : e.state === 'paused' ? 'bad-fill' : e.state === 'blocked' ? 'warn-fill' : 'bg3';
        const per = e.nodes ? (x2 - x1) / e.nodes : 0;
        const doneW = e.state === 'running' || e.state === 'paused' ? per * e.nodesDone : e.state === 'done' ? x2 - x1 : 0;
        return (
          <g key={e.cluster}>
            <text x={0} y={y + 18} style={{ fontWeight: 600, fontSize: '13px' }}>
              {c.name}
            </text>
            <text x={0} y={y + 34} class="muted" style={{ fontSize: '11px' }}>
              {e.blocked ? 'pre-check failed' : `${e.nodes} nodes, one at a time`}
            </text>
            <rect x={x1} y={y + 6} width={x2 - x1} height={26} class={e.state === 'held' || e.state === 'queued' ? 'bg3' : 'bg2'} stroke="var(--s2)" stroke-dasharray={e.state === 'held' ? '4 3' : undefined} />
            {doneW > 0 && <rect x={x1} y={y + 6} width={doneW} height={26} class={cls} style={{ opacity: e.state === 'done' ? 0.75 : 0.9 }} />}
            {e.state === 'running' && <rect x={x1 + doneW} y={y + 6} width={per} height={26} class="flow-fill" style={{ opacity: 0.35 }} />}
            {!e.blocked &&
              Array.from({ length: e.nodes - 1 }, (_, n) => <line key={n} x1={x1 + per * (n + 1)} x2={x1 + per * (n + 1)} y1={y + 6} y2={y + 32} stroke="var(--bg)" stroke-width={1.5} />)}
            <text x={e.state === 'held' || x2 > W - 170 ? x1 + 8 : x2 + 8} y={y + 24} class="halo" style={{ fontSize: '12px', fontWeight: 600, fill: `var(--${STATE_TONE[e.state] === 'neutral' ? 'muted' : STATE_TONE[e.state]})` }}>
              {e.state === 'blocked' ? `⚠ ${e.blocked}` : e.state === 'paused' ? '✕ Paused: node failure' : e.state === 'held' ? 'Held' : e.state === 'done' ? '✓' : ''}
            </text>
          </g>
        );
      })}
      <line x1={sx(Math.min(t, total))} x2={sx(Math.min(t, total))} y1={top - 6} y2={H - 30} stroke="var(--text)" stroke-width={1.5} />
    </svg>
  );
}

function Federation() {
  const [role, setRole] = useEnum<Role>('role', 'fleet', ['fleet', 'emea', 'app', 'audit']);
  const [wave, setWave] = useNum('wv', 2, 1, 4);
  const [canary, setCanary] = useBool('cn', true);
  const [perNode, setPerNode] = useNum('pn', 30, 10, 90);
  const [soak, setSoak] = useNum('sk', 60, 0, 240);
  const [fix, setFix] = useBool('fx', false);
  const [reg] = useRegistered();
  const [fault, setFault] = useState<Fault | null>(null);
  const [acked, setAcked] = useState<string[]>([]);

  const list = useMemo(() => fixedClusters(fix), [fix]);
  const vis = visibleClusters(role, reg, list);
  const canUp = can(role, 'upgrade');
  const plan = useMemo(() => planUpgrade(vis, { waveSize: wave, canary, perNodeMin: perNode, soakMin: soak }), [vis.map((c) => c.id + c.health).join(), wave, canary, perNode, soak]);
  const clock = useClock({ rate: Math.max(30, plan.total / 14), duration: Math.max(plan.total, 1), stepSize: perNode, keys: true });
  const run = runAt(plan, vis, clock.t, fault);
  const tot = totals(vis);
  const alerts = rollupAlerts(role, reg, undefined, list);
  const R = roleDef(role);
  const hidden = reg.length - vis.length;
  const runningNow = run.entries.find((e) => e.state === 'running');
  const allDone = run.entries.length > 0 && run.entries.every((e) => e.state === 'done');
  const blockedAny = run.entries.find((e) => e.state === 'blocked');
  const paused = run.entries.find((e) => e.state === 'paused');

  let status: { tone: Tone | 'ink'; k: string; text: string };
  if (!canUp) status = { tone: 'warn', k: 'Not allowed for this role', text: `${R.label} cannot start upgrades. The plan below is read-only; switch to Fleet admin or Regional operator.` };
  else if (!vis.length) status = { tone: 'warn', k: 'Nothing to upgrade', text: 'No registered clusters are visible to this role. Register clusters on the Overview tab.' };
  else if (paused) status = { tone: 'bad', k: 'Paused, not compounded', text: `A node failed in ${CLUSTERS.find((c) => c.id === paused.cluster)!.name} mid-upgrade. LCM stops on that cluster instead of taking another node out, and no later wave starts. Fix the node, then resume.` };
  else if (blockedAny) status = { tone: 'warn', k: 'Pre-check blocked a cluster', text: `${CLUSTERS.find((c) => c.id === blockedAny.cluster)!.name}: ${blockedAny.blocked}. LCM will not start there, and the plan holds later waves until it is cleared.` };
  else if (allDone) status = { tone: 'ok', k: 'Fleet upgraded', text: `${vis.length} clusters in ${plan.waves} waves, ${fmtHM(plan.total)} end to end. Inside every cluster, one node at a time with workloads running.` };
  else if (runningNow) status = { tone: 'flow', k: 'Rolling', text: `Wave ${runningNow.wave + 1}: clusters in the same wave upgrade in parallel; inside each cluster LCM takes one node at a time and waits for resiliency to return to OK.` };
  else status = { tone: 'ink', k: 'Ready', text: 'Press Play to run the plan. Early waves are small so a problem shows up on few clusters.' };

  return (
    <>
      <div class="lab">
        <div class="ctl">
          <Field label="Signed in as" tip="Identity comes from your directory or identity provider; roles and scopes decide which clusters, alerts and actions each person sees." value={R.label}>
            <Seg label="Role" value={role} onChange={(r) => (setRole(r), setFault(null), clock.reset())} options={ROLES.map((r) => ({ value: r.id, label: r.label }))} />
            <p class="field-note">{R.who}</p>
          </Field>
          <Field label="Clusters per wave" value={wave} tip="After the first wave, how many clusters upgrade at the same time." why={!canUp ? 'This role cannot start upgrades.' : null}>
            <Seg label="Wave size" value={wave} onChange={(v) => (setWave(v), clock.reset())} options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n), disabled: !canUp }))} />
          </Field>
          <Field label="Canary first" tip="Upgrade one low-risk cluster alone first, and watch it before touching production.">
            <Toggle on={canary} onChange={(v) => (setCanary(v), clock.reset())} disabled={!canUp}>
              Start with one canary cluster
            </Toggle>
          </Field>
          <Field label="Minutes per node" value={perNode} tip="How long one node takes: move VMs off, upgrade, return, resync.">
            <Slider label="Minutes per node" value={perNode} min={10} max={90} step={5} onChange={(v) => (setPerNode(v), clock.reset())} />
            <div class="hstack">
              <Illus why="Per-node time depends on components, firmware, VM load and data to resync. Pick your own assumption." />
            </div>
          </Field>
          <Field label="Soak between waves" value={`${soak} min`} tip="Time to watch the finished wave before the next one starts.">
            <Slider label="Soak minutes" value={soak} min={0} max={240} step={15} onChange={(v) => (setSoak(v), clock.reset())} />
          </Field>
          <Field label="Pre-check" tip="LCM checks health and data resiliency first and will not start on a cluster that fails.">
            <Toggle on={fix} onChange={(v) => (setFix(v), clock.reset())}>
              Clear the TOR-STORE-12 warning
            </Toggle>
          </Field>
          <Field label="Break something" why={!runningNow && !fault ? 'Available while a cluster is upgrading.' : null}>
            <div class="hstack">
              <button
                type="button"
                class="btn"
                disabled={!runningNow || !!fault}
                onClick={() => runningNow && (setFault({ cluster: runningNow.cluster, at: clock.t }), clock.pause())}
              >
                <Icon name="power" /> Fail a node mid-upgrade
              </button>
              {fault && (
                <button type="button" class="tbtn" onClick={() => setFault(null)}>
                  Repair and resume
                </button>
              )}
            </div>
          </Field>
        </div>
        <div class="stage">
          <div class="spread">
            <h2 class="sec-h" style={{ margin: 0 }}>
              Fleet dashboard
            </h2>
            <span class="small muted">
              {tot.clusters} clusters · {tot.nodes} nodes · {fmtTB(tot.usedTB, 0)} of {fmtTB(tot.capTB, 0)} used
              {hidden > 0 && ` · ${hidden} hidden by role`}
            </span>
          </div>
          <div class="cen-fleet">
            {list
              .filter((c) => reg.includes(c.id))
              .map((c) => {
                const seen = canSee(role, c);
                const e = run.entries.find((x) => x.cluster === c.id);
                if (!seen)
                  return (
                    <div class="cen-tile hidden" key={c.id}>
                      <Icon name="lock" />
                      <span>Not in this role’s scope</span>
                    </div>
                  );
                const pct = (c.usedTB / c.capTB) * 100;
                return (
                  <div class="cen-tile" key={c.id}>
                    <div class="spread">
                      <strong>{c.name}</strong>
                      <Chip tone={HEALTH_TONE[c.health]}>{HEALTH_WORD[c.health]}</Chip>
                    </div>
                    <div class="small muted">
                      {c.site} · {DOMAINS.find((d) => d.id === c.domain)!.region}
                    </div>
                    <div class="mrow-top" style={{ marginTop: 'var(--sp-2)' }}>
                      <span class="small">Storage</span>
                      <span class={`pct${pct > 80 ? ' warn-text' : ''}`}>{pct.toFixed(0)}%</span>
                    </div>
                    <div class="meter">
                      <span style={{ width: `${pct}%`, background: pct > 80 ? 'var(--warn)' : undefined }} />
                    </div>
                    {e && (
                      <div class="small" style={{ marginTop: 'var(--sp-2)' }}>
                        <Chip tone={STATE_TONE[e.state]}>{STATE_LABEL[e.state]}</Chip>{' '}
                        {(e.state === 'running' || e.state === 'paused') && (
                          <span class="mono">
                            {e.nodesDone}/{e.nodes} nodes
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          <h2 class="sec-h">
            Staggered fleet upgrade <Illus why="Waves, canary and soak time show a common way to plan multi-cluster upgrades. Exact scheduling options depend on the LCM and Prism Central version." />
          </h2>
          <div class="diagram-scroll">
            <Gantt plan={plan} run={run} list={vis} t={clock.t} />
          </div>
          <PlayBar clock={clock} label="Fleet upgrade" fmt={(m) => `T+${fmtHM(m)}`} />
          <Follow tone={status.tone} k={status.k}>
            <p>{status.text}</p>
          </Follow>
        </div>
        <div class="rail">
          <div class="side-sec">
            <div class="eyebrow">Alerts, rolled up</div>
            {!alerts.length && <p class="small muted">No alerts in this role’s scope.</p>}
            <ul class="cen-alerts">
              {alerts.map((a) => {
                const c = CLUSTERS.find((x) => x.id === a.cluster)!;
                const isAck = acked.includes(a.id);
                return (
                  <li key={a.id} class={isAck ? 'ack' : ''}>
                    <Chip tone={a.severity === 'critical' ? 'bad' : a.severity === 'warning' ? 'warn' : 'neutral'}>{a.severity}</Chip>
                    <div>
                      <div>{a.text}</div>
                      <div class="small muted">{c.name}</div>
                    </div>
                    {can(role, 'ack') && !isAck && (
                      <button type="button" class="tbtn" onClick={() => setAcked([...acked, a.id])}>
                        Ack
                      </button>
                    )}
                    {isAck && <span class="small ok-text">✓</span>}
                  </li>
                );
              })}
            </ul>
            {!can(role, 'ack') && alerts.length > 0 && <p class="field-note">This role can see alerts but not acknowledge them.</p>}
          </div>
          <div class="side-sec">
            <div class="eyebrow">
              <Tip text="Automation uses the same Prism Central v4 APIs everywhere, and the same role-based access applies to API calls as to the console.">One API surface</Tip>
            </div>
            <pre class="cen-code">
              {`GET /api/vmm/v4.0/ahv/config/vms
Authorization: <${R.label} token>

→ VMs from ${vis.length ? vis.map((c) => c.name).join(', ') : 'no clusters'}`}
            </pre>
            <div class="hstack">
              <Illus why="Request shape based on the Prism Central v4 API. Check the API reference for the exact version, namespace and fields." />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Central() {
  const [tab, setTab] = useEnum<'ov' | 'fed'>('tab', 'ov', ['ov', 'fed']);
  return (
    <>
      <div class="tabs" role="tablist" aria-label="Views">
        <button type="button" role="tab" aria-selected={tab === 'ov'} onClick={() => setTab('ov')}>
          Overview
        </button>
        <button type="button" role="tab" aria-selected={tab === 'fed'} onClick={() => setTab('fed')}>
          Federation: API, Alerts, LCM, IAM
        </button>
      </div>
      {tab === 'ov' ? <Overview /> : <Federation />}
    </>
  );
}
