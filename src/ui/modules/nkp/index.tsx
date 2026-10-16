// Kubernetes Platform (NKP): a fleet of clusters across data center, edge and cloud, and a
// Kubernetes version upgrade rolled across it. All rollout logic is in engine/nkp-upgrade.ts.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useBool, useEnum } from '../../../state/route';
import { useClock, fmtClock } from '../../components/clock';
import { Chip, Field, Follow, Illus, PlayBar, Seg, Stat, Tip, Toggle, type Tone } from '../../components/controls';
import { Icon } from '../../components/Icon';
import {
  FLEET,
  TIMING,
  clusterState,
  editionNeeded,
  events,
  planRollout,
  type ClusterState,
  type ClusterStatus,
  type Edition,
  type FleetCluster,
  type Site,
  type Strategy,
} from '../../../engine/nkp-upgrade';
import './style.css';

const FROM = '1.34';
const TO = '1.35';

const SITES: { id: Site; label: string }[] = [
  { id: 'dc', label: 'Data center' },
  { id: 'edge', label: 'Edge sites' },
  { id: 'cloud', label: 'Public cloud' },
];

const INFRA_LABEL: Record<FleetCluster['infra'], string> = {
  nci: 'NKP on NCI (AHV)',
  vsphere: 'NKP on vSphere',
  aws: 'NKP-built on AWS',
  eks: 'Attached Amazon EKS',
};

const ED_LABEL: Record<Edition, string> = { starter: 'Starter', pro: 'Pro', ultimate: 'Ultimate' };

const STATUS: Record<ClusterStatus, { tone: Tone; word: string; mark: string }> = {
  waiting: { tone: 'neutral', word: 'Waiting', mark: '·' },
  upgrading: { tone: 'flow', word: 'Upgrading', mark: '→' },
  checking: { tone: 'warn', word: 'Health check', mark: '…' },
  done: { tone: 'ok', word: `On ${TO}`, mark: '✓' },
  failed: { tone: 'bad', word: 'Check failed', mark: '✕' },
  halted: { tone: 'neutral', word: 'Not started', mark: '■' },
  skipped: { tone: 'neutral', word: 'Not in rollout', mark: '–' },
};

const PHASE_SHORT = { join: 'new one joining', drain: 'draining', remove: 'leaving' } as const;

function versionOf(s: ClusterState, c: FleetCluster): string {
  if (c.attached) return 'provider-managed';
  if (s.status === 'done' || s.status === 'failed' || s.status === 'checking') return TO;
  if (s.status === 'upgrading') return `${FROM} → ${TO}`;
  return FROM;
}

const COL_W = 300;
const GAP = 24;
const BOX_H = 114;
const BOX_GAP = 12;
const TOP = 96;
const SQ = 22;
const SQ_GAP = 4;

function ClusterBox({ c, s, x, y, edition }: { c: FleetCluster; s: ClusterState; x: number; y: number; edition: Edition }) {
  const st = STATUS[s.status];
  const total = c.cp + c.workers;
  const off = s.status === 'skipped';
  const squares = [];
  for (let i = 0; i < total; i++) {
    const role = i < c.cp ? 'C' : 'W';
    let cls = 'nkp-node old';
    if (c.attached) cls = 'nkp-node ext';
    else if (i < s.replaced) cls = 'nkp-node new';
    else if (s.current && i === s.current.index) cls = `nkp-node old ${s.current.phase}`;
    squares.push(
      <g key={i}>
        <rect class={cls} x={x + 12 + i * (SQ + SQ_GAP)} y={y + 46} width={SQ} height={SQ} />
        <text x={x + 12 + i * (SQ + SQ_GAP) + SQ / 2} y={y + 61} text-anchor="middle" class={`mono nkp-nl${cls.includes('new') ? ' on' : ''}`}>
          {role}
        </text>
      </g>,
    );
  }
  // Surge node: the replacement that joins before the old node leaves.
  if (s.current) {
    const i = total;
    const joining = s.current.phase === 'join';
    squares.push(
      <g key="surge">
        <rect class={`nkp-node ${joining ? 'joining' : 'new'}`} x={x + 12 + i * (SQ + SQ_GAP)} y={y + 46} width={SQ} height={SQ} />
        <text x={x + 12 + i * (SQ + SQ_GAP) + SQ / 2} y={y + 61} text-anchor="middle" class={`mono nkp-nl${joining ? '' : ' on'}`}>
          +
        </text>
      </g>,
    );
  }
  const need = editionNeeded(c);
  const sub = off ? (c.attached && edition === 'ultimate' ? 'Upgraded by the cloud provider' : `Needs NKP ${ED_LABEL[need]}`) : s.current ? `Node ${s.current.index + 1}/${total} · ${s.current.role === 'cp' ? 'control plane' : 'worker'} · ${PHASE_SHORT[s.current.phase]}` : '';
  return (
    <g class={off ? 'nkp-off' : ''}>
      <rect class={`nkp-box ${st.tone}`} x={x} y={y} width={COL_W} height={BOX_H} />
      <text x={x + 12} y={y + 22} style={{ fontWeight: 600, fontSize: '15px' }}>
        {c.name}
      </text>
      <text x={x + COL_W - 12} y={y + 22} text-anchor="end" class="mono" style={{ fontSize: '13px' }}>
        {versionOf(s, c)}
      </text>
      <text x={x + 12} y={y + 38} class="muted" style={{ fontSize: '12px' }}>
        {INFRA_LABEL[c.infra]}
      </text>
      {squares}
      <text x={x + 12} y={y + 86} class={`nkp-st ${st.tone}`} style={{ fontSize: '12.5px', fontWeight: 600 }}>
        {st.mark} {st.word}
      </text>
      <text x={x + 12} y={y + 103} class="muted" style={{ fontSize: '11.5px' }}>
        {sub}
      </text>
    </g>
  );
}

function useNarrow(px = 700): boolean {
  const q = typeof matchMedia !== 'undefined' ? matchMedia(`(max-width: ${px}px)`) : null;
  const [n, setN] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return;
    const on = () => setN(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return n;
}

const LEGEND = [
  { cls: 'nkp-node old', label: `Node on ${FROM}` },
  { cls: 'nkp-node new', label: `Node on ${TO}` },
  { cls: 'nkp-node joining', label: 'New node joining' },
  { cls: 'nkp-node old drain', label: 'Old node draining' },
];

function FleetDiagram({ states, edition, narrow }: { states: Map<string, ClusterState>; edition: Edition; narrow: boolean }) {
  const fleetOn = edition === 'ultimate';
  const W = narrow ? COL_W : COL_W * 3 + GAP * 2;
  // Box positions: three site columns side by side, or stacked on a phone.
  const pos = new Map<string, { x: number; y: number }>();
  const heads: { site: (typeof SITES)[number]; x: number; y: number }[] = [];
  let y = TOP;
  let bottom = TOP;
  SITES.forEach((site, col) => {
    const list = FLEET.filter((c) => c.site === site.id);
    const x = narrow ? 0 : col * (COL_W + GAP);
    const y0 = narrow ? y : TOP;
    heads.push({ site, x, y: y0 });
    list.forEach((c, i) => pos.set(c.id, { x, y: y0 + i * (BOX_H + BOX_GAP) }));
    const end = y0 + list.length * (BOX_H + BOX_GAP);
    bottom = Math.max(bottom, end);
    y = end + 34;
  });
  const legendRows = narrow ? 3 : 1;
  const H = bottom + 10 + legendRows * 22;
  const title = fleetOn ? (narrow ? 'NKP fleet management' : 'NKP fleet management: one place for versions, policy and apps') : 'No fleet view in this edition';
  const subtitle = fleetOn
    ? narrow
      ? 'versions, policy and apps in one place'
      : 'Upgrades driven through Cluster API, one node at a time per cluster'
    : narrow
      ? 'fleet management is in NKP Ultimate'
      : 'Fleet management is part of NKP Ultimate; each cluster is upgraded as its own task';
  const legendItems = [...LEGEND.map((l) => ({ ...l, w: 150 })), { cls: '', label: 'C = control plane · W = worker', w: 220 }];
  return (
    <svg class="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Fleet of Kubernetes clusters across data center, edge and cloud, with upgrade status for each cluster">
      <rect class={fleetOn ? 'ink-fill' : 'bg3'} x={0} y={0} width={W} height={48} stroke={fleetOn ? 'none' : 'var(--line-2)'} />
      <text x={W / 2} y={21} text-anchor="middle" style={{ fontWeight: 600, fontSize: '15px', fill: fleetOn ? '#fff' : undefined }}>
        {title}
      </text>
      <text x={W / 2} y={39} text-anchor="middle" style={{ fontSize: '12px', fill: fleetOn ? 'rgba(255,255,255,.8)' : 'var(--muted)' }}>
        {subtitle}
      </text>
      {heads.map(({ site, x, y: hy }) => (
        <g key={site.id}>
          {!narrow && <line x1={x + COL_W / 2} y1={48} x2={x + COL_W / 2} y2={hy - 22} class="line" stroke-dasharray={fleetOn ? undefined : '3 4'} />}
          <text x={x} y={hy - 8} class="muted" style={{ fontSize: '12px', letterSpacing: '0.08em' }}>
            {site.label.toUpperCase()}
          </text>
        </g>
      ))}
      {FLEET.map((c) => {
        const p = pos.get(c.id)!;
        return <ClusterBox key={c.id} c={c} s={states.get(c.id)!} x={p.x} y={p.y} edition={edition} />;
      })}
      {legendItems.map((l, i) => {
        const perRow = narrow ? 2 : 5;
        const row = Math.floor(i / perRow);
        const colI = i % perRow;
        const lx = narrow ? colI * 150 : legendItems.slice(0, i).reduce((n, it) => n + it.w, 0);
        const ly = bottom + 20 + row * 22;
        return (
          <g key={l.label}>
            {l.cls && <rect class={l.cls} x={lx} y={ly - 11} width={14} height={14} />}
            <text x={lx + (l.cls ? 20 : 0)} y={ly} style={{ fontSize: '12px' }} class="muted">
              {l.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Nkp() {
  const [edition, setEdition] = useEnum<Edition>('ed', 'ultimate', ['starter', 'pro', 'ultimate']);
  const [strategy, setStrategy] = useEnum<Strategy>('st', 'waves', ['serial', 'waves']);
  const [canaryFails, setCanaryFails] = useBool('cf', false);
  const plan = useMemo(() => planRollout({ edition, strategy, canaryFails }), [edition, strategy, canaryFails]);
  const duration = Math.max(plan.end, 1);
  // Pace by the full rollout, so a halted one plays at the same speed.
  const fullEnd = useMemo(() => planRollout({ edition, strategy, canaryFails: false }).end, [edition, strategy]);
  const clock = useClock({ rate: Math.max(fullEnd, 1) / 40, duration, stepSize: TIMING.node / 2, keys: true });
  useEffect(() => clock.reset(), [edition, strategy, canaryFails]);

  const narrow = useNarrow();
  const t = clock.t;
  const states = new Map(FLEET.map((c, i) => [c.id, clusterState(c, plan.clusters[i], t, plan)]));
  const list = [...states.values()];
  const inRollout = plan.clusters.filter((p) => p.wave >= 0).length;
  const done = list.filter((s) => s.status === 'done').length;
  const busy = list.filter((s) => s.status === 'upgrading' || s.status === 'checking').length;
  const draining = list.reduce((n, s) => n + s.unavailable, 0);
  const failed = list.some((s) => s.status === 'failed');
  const finished = t >= plan.end && !plan.halted;
  const log = events(plan, FLEET, t, FROM, TO).slice().reverse();
  const canaryName = FLEET.find((c) => plan.clusters.find((p) => p.id === c.id)?.wave === 0)?.name ?? 'the first cluster';

  return (
    <div class="lab">
      <div class="ctl">
        <Field
          label="NKP edition"
          tip="The edition decides where NKP can deploy clusters and whether you get fleet management."
          detail="Starter: NCI (AHV) only. Pro: adds vSphere, pre-provisioned bare metal and public cloud. Ultimate: adds fleet management, including attaching EKS and AKS clusters. Check current licensing for details."
          value={ED_LABEL[edition]}
          note={edition === 'starter' ? 'Starter is included with NCI Pro and Ultimate and runs on AHV only.' : edition === 'pro' ? 'Pro reaches vSphere and public cloud. Fleet management needs Ultimate.' : 'Ultimate adds fleet management across all sites, including attached cloud clusters.'}
        >
          <Seg label="NKP edition" value={edition} onChange={setEdition} options={(['starter', 'pro', 'ultimate'] as Edition[]).map((e) => ({ value: e, label: ED_LABEL[e] }))} />
        </Field>
        <Field
          label="Rollout plan"
          tip="The order clusters are upgraded in. Both plans start with one small canary cluster."
          detail="A canary is a low-risk cluster upgraded first so problems show up before the rest of the fleet is touched. This ordering is a common practice, shown here as an example."
          value={strategy === 'waves' ? 'Waves' : 'One at a time'}
          note={strategy === 'waves' ? 'Canary, then remaining edge sites, then data center, then cloud. Clusters in a wave upgrade side by side.' : 'One cluster at a time. Slower, smallest blast radius.'}
        >
          <Seg
            label="Rollout plan"
            value={strategy}
            onChange={setStrategy}
            options={[
              { value: 'waves', label: 'Waves' },
              { value: 'serial', label: 'One at a time' },
            ]}
          />
        </Field>
        <Field label="What-if" tip="Make the canary fail its post-upgrade health check, to see the rollout stop.">
          <Toggle on={canaryFails} onChange={setCanaryFails}>
            Canary fails its health check
          </Toggle>
        </Field>
        <Field label="Kubernetes version" tip="Kubernetes upgrades go one minor version at a time." detail={`The versions here are an example. NKP 2.18 (July 2026) ships Kubernetes 1.35; the versions offered depend on the NKP release.`}>
          <span class="mono nkp-ver">
            {FROM} → {TO} <Illus why="Example versions. Node replacement times are illustrative; real times depend on node size, workloads and pod disruption rules." />
          </span>
        </Field>
      </div>

      <div class="stage">
        <div class={narrow ? 'nkp-narrow' : 'diagram-scroll'}>
          <FleetDiagram states={states} edition={edition} narrow={narrow} />
        </div>
        <PlayBar clock={clock} label="Fleet upgrade controls" fmt={(s) => `${fmtClock(s)} sim`} />
        {failed ? (
          <Follow tone="bad" k="Rollout stopped">
            <p>
              {canaryName} is on {TO} but failed its health check. Nothing else was touched: every other cluster is still on {FROM} and serving normally. Investigate the canary, then decide whether to continue.
            </p>
          </Follow>
        ) : finished ? (
          <Follow tone="ok" k="Fleet upgraded">
            <p>
              {done} of {inRollout} clusters in the rollout are on {TO}. No cluster ever had more than one node out of service, so workloads kept running throughout.
              {edition === 'ultimate' && ' The attached EKS cluster keeps following Amazon’s upgrade process.'}
            </p>
          </Follow>
        ) : t === 0 ? (
          <Follow tone="ink" k="Press Play">
            <p>
              Upgrade the fleet from Kubernetes {FROM} to {TO}. Inside each cluster, a new node at the new version joins, one old node is drained so its pods move, and then it is removed. Control-plane nodes go first, then workers.
            </p>
          </Follow>
        ) : (
          <Follow tone="flow" k="Rolling">
            <p>
              {busy} cluster{busy === 1 ? '' : 's'} upgrading right now, {draining} node{draining === 1 ? '' : 's'} draining across the whole fleet. Each cluster always keeps all but one node serving.
            </p>
          </Follow>
        )}
      </div>

      <div class="rail">
        <div class="side-sec">
          <div class="spread" style={{ marginBottom: 'var(--sp-3)' }}>
            <strong>Fleet</strong>
            {failed ? <Chip tone="bad">Halted</Chip> : finished ? <Chip tone="ok">Complete</Chip> : t > 0 ? <Chip tone="flow">Rolling</Chip> : <Chip tone="neutral">Ready</Chip>}
          </div>
          <Stat k={`Clusters on ${TO}`} v={`${done} / ${inRollout}`} tone={finished ? 'ok' : 'neutral'} />
          <Stat k="Upgrading now" v={busy} />
          <Stat k="Nodes draining now" v={draining} tip="Nodes cordoned and draining across the fleet at this moment. Never more than one per cluster." />
          <Stat k="Not in this rollout" v={FLEET.length - inRollout} tip="Clusters this edition does not cover, or attached clusters whose provider runs the upgrade." />
        </div>
        <div class="side-sec">
          <strong>Events</strong>
          <ul class="events" style={{ marginTop: 'var(--sp-2)' }}>
            {log.map((e, i) => (
              <li key={i}>
                <span class="t">{fmtClock(e.t)}</span>
                <span class={`${e.tone}-text`}>
                  <Icon name={e.tone === 'ok' ? 'ok' : e.tone === 'bad' ? 'bad' : e.tone === 'warn' ? 'warn' : e.tone === 'flow' ? 'flow' : 'info'} />
                </span>
                <span>{e.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div class="side-sec">
          <strong>Also set from one place</strong>
          <ul class="nkp-list">
            <li>
              <Tip text="Platform apps (monitoring, logging, service mesh and others) deployed to many clusters from a catalog.">Platform apps</Tip>
            </li>
            <li>
              <Tip text="Access control and multitenancy across clusters, so teams see only their workspaces.">Access and tenancy</Tip>
            </li>
            <li>
              <Tip text="Flow Network Security microsegmentation extends from VMs to containers on NKP.">Flow microsegmentation</Tip>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
