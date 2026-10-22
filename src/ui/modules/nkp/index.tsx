// Kubernetes Platform (NKP): a Kubernetes version upgrade rolled across a fleet of clusters at
// the edge, in the data center and in the cloud, on a loop. Pick a healthy rollout or a canary
// that fails its health check. All rollout logic is in engine/nkp-upgrade.ts.
import { useMemo } from 'preact/hooks';
import { useEnum } from '../../../state/route';
import { stepsFrom, useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, ease, phaseAt } from '../../components/show';
import { FLEET, TIMING, clusterState, planRollout, waveGroups, type ClusterState, type ClusterStatus, type FleetCluster, type Plan } from '../../../engine/nkp-upgrade';
import './style.css';

type Run = 'ok' | 'fail';

const FROM = '1.34';
const TO = '1.35';
const GROUPS = waveGroups();
const WAVE_LABEL = ['Canary', 'Other edge sites', 'Data center', 'Public cloud'];
const WHERE: Record<FleetCluster['infra'], string> = { ahv: 'on AHV', vsphere: 'on vSphere', aws: 'on AWS' };
const SITE: Record<FleetCluster['site'], string> = { edge: 'Edge site', dc: 'Data center', cloud: 'Public cloud' };

const STATUS: Record<ClusterStatus, { tone: Tone; text: (s: ClusterState, c: FleetCluster) => string }> = {
  waiting: { tone: 'neutral', text: () => 'Waiting' },
  upgrading: { tone: 'flow', text: (s, c) => `→ Upgrading · node ${(s.current?.index ?? 0) + 1} of ${c.cp + c.workers}` },
  checking: { tone: 'warn', text: () => '… Health check' },
  done: { tone: 'ok', text: () => `✓ On ${TO}` },
  failed: { tone: 'bad', text: () => '✕ New node failed its check' },
  rolledBack: { tone: 'warn', text: () => `↺ Rolled back · still on ${FROM}` },
  halted: { tone: 'neutral', text: () => '■ Not started' },
};

// ── geometry ──
const W = 960;
const GAP = 28;
const COL_W = (W - GAP * 3) / 4;
const BAR_H = 46;
const HEAD_Y = 86;
const BOX_Y = 104;
const BOX_H = 112;
const BOX_GAP = 14;
const SQ = 20;
const SQ_GAP = 5;
const LEG_Y = BOX_Y + 2 * BOX_H + BOX_GAP + 30;
const H = LEG_Y + 14;
const colX = (w: number) => w * (COL_W + GAP);

/** Sim seconds per real second: slow through the canary so the node swap can be read, faster after. */
/** Sim seconds per real second at full speed. */
const RATE: Record<Run, number> = { ok: 400, fail: 80 };

function version(s: ClusterState): string {
  if (s.status === 'upgrading') return `${FROM} → ${TO}`;
  return s.status === 'checking' || s.status === 'done' ? TO : FROM;
}

function ClusterBox({ c, s, x, y }: { c: FleetCluster; s: ClusterState; x: number; y: number }) {
  const st = STATUS[s.status];
  const total = c.cp + c.workers;
  const sx = (i: number) => x + 12 + i * (SQ + SQ_GAP);
  const sy = y + 52;
  const cur = s.current;
  const label = (i: number) => (i < c.cp ? 'C' : 'W');
  const squares = Array.from({ length: total }, (_, i) => {
    let cls = i < s.replaced ? 'new' : 'old';
    let op = 1;
    if (cur && i === cur.index && (cur.phase === 'drain' || cur.phase === 'remove')) cls = 'old drain';
    if (cur && i === cur.index && cur.phase === 'remove') op = 1 - cur.p;
    return (
      <g key={i} style={{ opacity: op }}>
        <rect class={`nkp-node ${cls}`} x={sx(i)} y={sy} width={SQ} height={SQ} />
        <text x={sx(i) + SQ / 2} y={sy + 14} text-anchor="middle" class={`nkp-nl${cls === 'new' ? ' on' : ''}`}>
          {label(i)}
        </text>
      </g>
    );
  });
  // The replacement node: joins at the end of the row, then slides into the old node's place.
  let surge = null;
  let pods = null;
  if (cur) {
    const p = cur.p;
    const endX = sx(total);
    let gx = endX;
    let cls = 'new';
    let op = 1;
    let mark = label(cur.index);
    if (cur.phase === 'join') {
      cls = 'joining';
      op = 0.35 + 0.65 * p;
    } else if (cur.phase === 'remove') gx = endX + (sx(cur.index) - endX) * ease(p);
    else if (cur.phase === 'fail' || cur.phase === 'back') {
      cls = 'failed';
      mark = '✕';
      if (cur.phase === 'back') op = 1 - p;
    }
    surge = (
      <g style={{ opacity: op }}>
        <rect class={`nkp-node ${cls}`} x={gx} y={sy} width={SQ} height={SQ} />
        <text x={gx + SQ / 2} y={sy + 14} text-anchor="middle" class={`nkp-nl${cls === 'new' || cls === 'failed' ? ' on' : ''}`}>
          {mark}
        </text>
      </g>
    );
    if (cur.phase === 'drain') {
      // Pods leave the draining node for the new one, under the row of nodes.
      pods = [0, 0.5].map((off) => {
        const q = (p * 2 + off) % 1;
        const k = ease(q);
        const px = sx(cur.index) + SQ / 2 + (endX - sx(cur.index)) * k;
        const py = sy + SQ + 5 + Math.sin(Math.PI * q) * 9;
        return <circle key={off} class="nkp-pod" cx={px} cy={py} r={3.5} />;
      });
    }
  }
  const off = s.status === 'halted';
  return (
    <g class={off ? 'nkp-off' : undefined}>
      <rect class={`nkp-box ${st.tone}`} x={x} y={y} width={COL_W} height={BOX_H} />
      <text x={x + 12} y={y + 22} style={{ fontWeight: 600, fontSize: '14px' }}>
        {c.name}
      </text>
      <text x={x + COL_W - 12} y={y + 22} text-anchor="end" class="mono" style={{ fontSize: '12.5px' }}>
        {version(s)}
      </text>
      <text x={x + 12} y={y + 40} class="muted" style={{ fontSize: '12px' }}>
        {SITE[c.site]} · {WHERE[c.infra]}
      </text>
      {squares}
      {surge}
      {pods}
      <text x={x + 12} y={y + 98} class={`nkp-st ${st.tone}`} style={{ fontSize: '12.5px', fontWeight: 600 }}>
        {st.text(s, c)}
      </text>
    </g>
  );
}

const LEGEND: { cls: string; label: string; w: number }[] = [
  { cls: 'old', label: `Node on ${FROM}`, w: 130 },
  { cls: 'new', label: `Node on ${TO}`, w: 130 },
  { cls: 'joining', label: 'New node joining', w: 150 },
  { cls: 'old drain', label: 'Old node draining', w: 150 },
  { cls: 'failed', label: 'Failed its health check', w: 190 },
];

function FleetDiagram({ run, plan, states, t }: { run: Run; plan: Plan; states: Map<string, ClusterState>; t: number }) {
  const wave = phaseAt(plan.waves, t);
  const cyc = (t / (RATE[run] * 1.8)) % 1;
  const legend = LEGEND.filter((l) => (run === 'fail' ? l.cls !== 'new' && l.cls !== 'old drain' : l.cls !== 'failed'));
  return (
    <svg class="diagram nkp-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A fleet of ${FLEET.length} Kubernetes clusters upgraded from ${FROM} to ${TO} in waves: one canary edge cluster, the other edge sites, the data center, then the cloud. Inside each cluster a new node joins before an old one drains and leaves.${run === 'fail' ? ' Here the canary’s new node fails its health check, so the rollout stops and the canary stays on the old version.' : ''}`}>
      <defs>
        <marker id="nkp-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" class="nkp-mk" />
        </marker>
      </defs>
      <rect class="ink-fill" x={0} y={0} width={W} height={BAR_H} />
      <text x={W / 2} y={29} text-anchor="middle" style={{ fill: '#fff', fontWeight: 600, fontSize: '15px' }}>
        NKP fleet management · Kubernetes {FROM} → {TO}, one wave at a time
      </text>
      {GROUPS.map((g, w) => {
        const cx = colX(w) + COL_W / 2;
        const halted = !Number.isFinite(plan.clusters.find((p) => p.id === g[0].id)!.start);
        const doneW = g.every((c) => states.get(c.id)!.status === 'done');
        const active = !halted && !doneW && w === wave && t < plan.end;
        const tone = doneW ? 'ok' : active ? 'flow' : halted && plan.haltAt !== null && t >= plan.haltAt ? 'off' : 'neutral';
        return (
          <g key={w}>
            <line x1={cx} y1={BAR_H} x2={cx} y2={HEAD_Y - 18} class={active ? 'flow-stroke' : 'line'} stroke-width={active ? 2 : 1.25} stroke-dasharray={active ? '4 3' : undefined} />
            {active && <circle cx={cx} cy={BAR_H + (HEAD_Y - 18 - BAR_H) * cyc} r={4} class="flow-fill" />}
            <text x={cx} y={HEAD_Y} text-anchor="middle" class={`nkp-head ${tone}`}>
              {doneW ? '✓ ' : ''}
              {w + 1} · {WAVE_LABEL[w]}
            </text>
            {w < GROUPS.length - 1 && <line x1={colX(w) + COL_W + 4} y1={HEAD_Y - 5} x2={colX(w + 1) - 6} y2={HEAD_Y - 5} class="nkp-arrow" marker-end="url(#nkp-ar)" />}
            {g.map((c, i) => (
              <ClusterBox key={c.id} c={c} s={states.get(c.id)!} x={colX(w)} y={BOX_Y + i * (BOX_H + BOX_GAP)} />
            ))}
          </g>
        );
      })}
      {legend.map((l, i) => {
        const lx = legend.slice(0, i).reduce((n, it) => n + it.w, 0);
        return (
          <g key={l.label}>
            <rect class={`nkp-node ${l.cls}`} x={lx} y={LEG_Y - 11} width={14} height={14} />
            <text x={lx + 20} y={LEG_Y} class="muted" style={{ fontSize: '12px' }}>
              {l.label}
            </text>
          </g>
        );
      })}
      <text x={W} y={LEG_Y} text-anchor="end" class="muted" style={{ fontSize: '12px' }}>
        C = control plane · W = worker
      </text>
    </svg>
  );
}

function caption(run: Run, plan: Plan, t: number, wave: number): { tone: Tone | 'ink'; k: string; text: string } {
  const canary = FLEET.find((c) => c.id === GROUPS[0][0].id)!.name;
  const canaryText = `One small edge cluster, ${canary}, goes first. A new node on ${TO} joins and is checked, then one old node drains so its apps move over, and leaves. Control plane first, then workers.`;
  if (run === 'fail') {
    if (t < plan.haltAt!) return { tone: 'flow', k: 'Canary first', text: canaryText };
    if (t < plan.end) return { tone: 'bad', k: 'Health check failed', text: `The new ${TO} node in ${canary} fails its health check. The rollout stops here, before any old node is drained.` };
    return { tone: 'warn', k: 'Stopped and rolled back', text: `The failed node is removed. The old nodes never left, so ${canary} is still on ${FROM} and serving. The other ${FLEET.length - 1} clusters were never touched.` };
  }
  if (t >= plan.end) return { tone: 'ok', k: 'Fleet upgraded', text: `All ${FLEET.length} clusters are on ${TO}, rolled out from one place. No cluster ever had more than one node out of service, so apps kept running.` };
  if (wave === 0) {
    const checking = t >= plan.clusters.find((p) => p.wave === 0)!.nodesEnd;
    return checking ? { tone: 'warn', k: 'Health check', text: `${canary} is fully on ${TO}. Its health check has to pass before any other cluster is touched.` } : { tone: 'flow', k: 'Canary first', text: canaryText };
  }
  const text = [
    '',
    'The canary passed, so the other edge sites go next. Clusters in the same wave upgrade side by side.',
    'Bigger clusters take longer, but it is still one node at a time, so each cluster keeps all but one node serving.',
    'Clusters in the public cloud are upgraded the same way, from the same place.',
  ][wave];
  return { tone: 'flow', k: `Wave ${wave + 1}: ${WAVE_LABEL[wave].toLowerCase()}`, text };
}

export default function Nkp() {
  const [run, setRun] = useEnum<Run>('ro', 'ok', ['ok', 'fail']);
  const plan = useMemo(() => planRollout({ canaryFails: run === 'fail' }), [run]);
  const tail = run === 'fail' ? 3 * 80 : 400;
  const poster = run === 'fail' ? plan.haltAt! + 0.2 * TIMING.node : plan.waves[2] + 2.5 * TIMING.node;
  // Each caption gets time to be read, so the rollout runs slowly through the canary and faster after.
  const steps = useMemo(() => stepsFrom(plan.end + tail, (t) => caption(run, plan, t, phaseAt(plan.waves, t))), [run, plan, tail]);
  const clock = useClock({ rate: RATE[run], duration: plan.end + tail, keys: true, poster, steps });
  useRestartOn(clock, [run]);
  const t = clock.t;

  const states = new Map(FLEET.map((c, i) => [c.id, clusterState(c, plan.clusters[i], t, plan)]));
  const list = [...states.values()];
  const done = list.filter((s) => s.status === 'done').length;
  const out = list.reduce((n, s) => n + s.unavailable, 0);
  const wave = phaseAt(plan.waves, t);
  const cap = caption(run, plan, t, wave);
  const stopped = plan.haltAt !== null && t >= plan.haltAt;
  const word = run === 'fail' ? (t < plan.haltAt! ? 'Canary' : t < plan.end ? 'Check failed' : 'Rolled back') : t >= plan.end ? 'Done' : WAVE_LABEL[wave];

  return (
    <Show
      top={
        <Choice<Run>
          label="Rollout"
          value={run}
          onChange={setRun}
          options={[
            { value: 'ok', label: 'Healthy rollout' },
            { value: 'fail', label: 'Canary fails' },
          ]}
        />
      }
      foot={
        <>
          <Follow tone={cap.tone} k={cap.k}>
            <p>{cap.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: `Clusters on ${TO}`, v: `${done} of ${FLEET.length}`, tone: done === FLEET.length ? 'ok' : undefined },
              { k: 'Nodes out of service', v: out, tip: 'Nodes draining or leaving right now, across the whole fleet. Never more than one per cluster.' },
              { k: 'Rollout', v: stopped ? 'Stopped' : t >= plan.end ? 'Complete' : 'Running', tone: stopped ? 'bad' : t >= plan.end ? 'ok' : 'flow' },
              { k: 'Apps', v: 'Running', tone: 'ok', tip: 'Each cluster keeps all but one node serving while it upgrades, and a failed new node never takes an old one out.' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <FleetDiagram run={run} plan={plan} states={states} t={t} />
      </div>
      <PlayBar
        clock={clock}
        label="Fleet upgrade animation"
        fmt={() => word}
        extra={<Illus why="Example versions and timings. Fleet management is in NKP Ultimate. Upgrading a canary first, then waves, is a common practice shown as an example. Inside a cluster, a new node joins before an old one leaves, as in a Cluster API rolling update." />}
      />
    </Show>
  );
}
