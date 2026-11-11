// Kubernetes Platform, Cluster lifecycle tab: create a cluster from a definition (Cluster API), scale
// it with the built-in autoscaler, and heal it when a worker fails. Names, counts and times are
// examples; claims are in docs/facts.md (NKP-5, NKP-10 to NKP-12). Upgrading one cluster and air-gapped sites are in
// upgrade.tsx; the fleet-wide rollout is on LCM Rolling Upgrade's Kubernetes (NKP) tab.
import type { ComponentChildren } from 'preact';
import { buildHash, navigate, useEnum } from '../../../state/route';
import { Choice, prog } from '../../components/show';
import { Story, W, fly, pts, type Pt, type StoryStep } from '../ai/kit';
import { ControlPlane, Row, WK, Worker, type WorkerState } from './parts';
import { AirgapScene, UpgradeScene } from './upgrade';

const UPGRADE = { tab: 'k8s' };
/** The right-column pointer to the upgrade animation, which lives with the other rolling upgrades. */
const Upgrades = (
  <section>
    <h2 class="side-sec-h">Fleet-wide upgrades</h2>
    <p>
      Rolling one upgrade across a whole fleet, cluster by cluster, is animated on{' '}
      <a
        class="nk-link-a"
        href={buildHash('nci/lcm', UPGRADE)}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          navigate('nci/lcm', UPGRADE);
        }}
      >
        LCM Rolling Upgrade, Kubernetes (NKP)
      </a>
      .
    </p>
  </section>
);

// ── Create a cluster ─────────────────────────────────────────────────────────────────────────────
const CR_AT = [0, 5, 12, 18];
const CR_STEPS: StoryStep[] = [
  {
    tone: 'ink',
    k: 'Declare the cluster',
    text: 'You describe the cluster you want: its name, its Kubernetes version, and how many control plane and worker nodes it has. It is a definition of the result, not a script of steps.',
  },
  {
    tone: 'flow',
    k: 'Cluster API builds it',
    text: 'NKP uses the Kubernetes Cluster API for all lifecycle automation. Its management cluster reads the definition and creates the machines: three control plane nodes first, then the workers.',
  },
  {
    tone: 'ok',
    k: 'A cluster in minutes',
    text: 'The workload cluster comes up highly available, with persistent storage included. It stays managed by the management cluster, so scaling, upgrading and deleting it all work from the same definition.',
  },
  { tone: 'ok', k: 'The same way everywhere', text: 'The same approach creates clusters on Nutanix, on vSphere, in AWS, Azure or Google Cloud, or on servers and VMs you prepared yourself.' },
];
const SPEC = ['name: retail-prod', 'kubernetes: 1.36', 'control plane: 3 nodes', 'workers: 3 nodes', 'runs on: Nutanix (AHV)'];
const cpAt = (i: number) => 6.6 + i * 0.9;
const wkAt = (i: number) => 9.4 + i * 0.7;
const CR_READY = 12.2;
const TARGETS = ['Nutanix', 'vSphere', 'AWS', 'Azure', 'Google Cloud', 'Your own servers or VMs'];
const CR_IN: Pt[] = [
  [246, 117],
  [290, 117],
];
const CR_OUT: Pt[] = [
  [540, 117],
  [590, 117],
];

function CreateScene({ top }: { top: ComponentChildren }) {
  return (
    <Story
      steps={CR_STEPS}
      at={CR_AT}
      end={24}
      poster={23}
      label="Creating a cluster"
      top={top}
      side={Upgrades}
      why="An example definition with times compressed; a real one is a set of Kubernetes resources. Deploying beyond Nutanix AHV needs NKP Pro or Ultimate."
      legend={[
        { color: 'var(--flow)', label: 'The definition, and each machine being created' },
        { color: 'var(--ok)', label: 'Ready' },
      ]}
      kpis={(t) => {
        const cp = [0, 1, 2].filter((i) => t >= cpAt(i) + 0.6).length;
        const wk = [0, 1, 2].filter((i) => t >= wkAt(i) + 0.6).length;
        return [
          { k: 'Control plane nodes', v: `${cp} of 3`, tone: cp === 3 ? 'ok' : undefined },
          { k: 'Worker nodes', v: `${wk} of 3`, tone: wk === 3 ? 'ok' : undefined },
          { k: 'Cluster', v: t >= CR_READY ? 'Ready' : t >= cpAt(0) ? 'Being created' : 'Not created', tone: t >= CR_READY ? 'ok' : undefined, sub: t >= CR_READY ? 'highly available' : undefined },
          { k: 'Lifecycle by', v: 'Cluster API', sub: 'create, scale, upgrade, delete' },
        ];
      }}
    >
      {(t, phase) => {
        const spec = fly(t, 5.4, 6.2, CR_IN);
        const made = (at: number) => prog(t, at, at + 0.6);
        const ready = t >= CR_READY;
        let cx = 16;
        return (
          <svg
            class="diagram nk-svg"
            viewBox={`0 0 ${W} 296`}
            role="img"
            aria-label="A cluster definition goes to the NKP management cluster, where Cluster API creates three control plane nodes and three workers as a ready workload cluster with persistent storage. The same definition can target Nutanix, vSphere, public clouds or your own servers."
          >
            <rect class="ai-box" x={16} y={28} width={230} height={178} rx={6} />
            <text class="d-label" x={28} y={50} style={{ fontWeight: 600 }}>
              Cluster definition
            </text>
            {SPEC.map((l, i) => (
              <text key={l} class="d-sub mono" x={28} y={76 + i * 20}>
                {l}
              </text>
            ))}
            <text class="d-fine muted" x={28} y={194}>
              the result you want, not the steps
            </text>
            <polyline points={pts(CR_IN)} class="ai-wire" />
            <rect class="ai-ep" x={290} y={28} width={250} height={178} rx={8} />
            <text class="ai-site-t" x={304} y={50}>
              NKP management cluster
            </text>
            <text class="d-sub muted" x={304} y={68}>
              runs Cluster API
            </text>
            <Row x={304} y={100} label="Reads the definition" on={t >= 6.2} />
            <Row x={304} y={126} label="Creates the machines" on={t >= cpAt(0) && !ready} />
            <Row x={304} y={152} label="Keeps them as declared" on={ready} tone="ok" />
            <polyline points={pts(CR_OUT)} class="ai-wire" />
            <rect class={`nk-isl${ready ? ' ok' : ''}`} x={590} y={28} width={354} height={250} rx={6} />
            <text class="d-label" x={604} y={50} style={{ fontWeight: 600 }}>
              retail-prod
            </text>
            <text class={`d-sub ${ready ? 'ok-fill' : 'muted'}`} x={930} y={50} text-anchor="end" style={{ fontWeight: ready ? 600 : 400 }}>
              {ready ? '✓ ready, highly available' : t >= cpAt(0) ? 'being created' : 'not created yet'}
            </text>
            {[
              { l: 'Control plane', y: 82, at: cpAt, name: 'control plane' },
              { l: 'Workers', y: 148, at: wkAt, name: 'worker' },
            ].map((row) => (
              <g key={row.l}>
                <text class="d-fine muted" x={604} y={row.y - 6}>
                  {row.l}
                </text>
                {[0, 1, 2].map((i) => (
                  <g key={i} style={{ opacity: 0.2 + 0.8 * made(row.at(i)) }}>
                    <rect class={`nk-wk${made(row.at(i)) > 0 && made(row.at(i)) < 1 ? ' new' : ''}`} x={604 + i * 112} y={row.y} width={104} height={36} rx={4} />
                    <text class="d-fine" x={656 + i * 112} y={row.y + 22} text-anchor="middle">
                      {row.name} {i + 1}
                    </text>
                  </g>
                ))}
              </g>
            ))}
            <g style={{ opacity: 0.25 + 0.75 * prog(t, CR_READY + 0.3, CR_READY + 0.9) }}>
              <rect class="nk-chip ok" x={604} y={208} width={326} height={30} rx={4} />
              <text class="d-sub ok-fill" x={616} y={228} style={{ fontWeight: 600 }}>
                {t >= CR_READY + 0.9 ? '✓ persistent storage included' : 'persistent storage'}
              </text>
            </g>
            {phase === 3 && (
              <g>
                <text class="muted ai-cap" x={16} y={236}>
                  The same definition can target
                </text>
                {TARGETS.map((name, i) => {
                  const w = name.length * 6.6 + 22;
                  const x = cx;
                  cx += w + 8;
                  return (
                    <g key={name} style={{ opacity: prog(t, CR_AT[3] + 0.3 + i * 0.25, CR_AT[3] + 0.7 + i * 0.25) }}>
                      <rect class={`nk-chip${i === 0 ? ' ok' : ''}`} x={x} y={246} width={w} height={28} rx={4} />
                      <text class="d-sub" x={x + w / 2} y={265} text-anchor="middle" style={{ fontWeight: i === 0 ? 600 : 400 }}>
                        {name}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}
            {spec && <circle cx={spec[0]} cy={spec[1]} r={6} class="ai-req" />}
            {[0, 1, 2]
              .flatMap((i) => [cpAt(i), wkAt(i)])
              .map((at, k) => {
                const p = fly(t, at - 0.5, at, CR_OUT);
                return p && <circle key={k} cx={p[0]} cy={p[1]} r={6} class="ai-req" />;
              })}
          </svg>
        );
      }}
    </Story>
  );
}

// ── the cluster drawn for scaling and healing ────────────────────────────────────────────────────
interface Wk {
  name: string;
  state: WorkerState;
  pods: number;
  lost?: number;
  opacity?: number;
  status?: string;
}
const wkX = (i: number) => 250 + i * (WK.w + 16);

function ClusterView({
  label,
  status,
  tone,
  workers,
  tray,
  actor,
  actorOn,
  note,
}: {
  label: string;
  status: string;
  tone?: 'ok' | 'warn' | 'bad';
  workers: (Wk | null)[];
  tray: { label: string; n: number };
  actor: string;
  actorOn: boolean;
  note: string;
}) {
  return (
    <svg class="diagram nk-svg" viewBox={`0 0 ${W} 300`} role="img" aria-label={label}>
      <text class="d-label" x={16} y={26} style={{ fontWeight: 600 }}>
        {note}
      </text>
      <rect class="nk-isl" x={16} y={40} width={928} height={244} rx={6} />
      <text class="d-label" x={32} y={64} style={{ fontWeight: 600 }}>
        retail-prod
      </text>
      <text class={`d-sub ${tone ? `${tone}-fill` : 'muted'}`} x={928} y={64} text-anchor="end" style={{ fontWeight: tone ? 600 : 400 }}>
        {status}
      </text>
      <ControlPlane x={32} y={100} />
      <rect class="nk-chip" x={32} y={150} width={180} height={62} rx={4} />
      <text class={`d-fine ${tray.n ? 'warn-fill' : 'muted'}`} x={42} y={168} style={{ fontWeight: tray.n ? 600 : 400 }}>
        {tray.n ? `${tray.label}: ${tray.n}` : `${tray.label}: none`}
      </text>
      {Array.from({ length: tray.n }, (_, i) => (
        <circle key={i} cx={52 + i * 26} cy={192} r={9} class="nk-pod wait" />
      ))}
      <rect class={`nk-chip${actorOn ? ' ok' : ''}`} x={32} y={226} width={180} height={30} rx={4} />
      <text class={`d-fine${actorOn ? ' ok-fill' : ' muted'}`} x={42} y={245} style={{ fontWeight: actorOn ? 600 : 400 }}>
        {actorOn ? `● ${actor}: at work` : actor}
      </text>
      <text class="d-fine muted" x={wkX(0)} y={92}>
        Workers
      </text>
      {workers.map((w, i) =>
        w ? (
          <Worker key={w.name} x={wkX(i)} y={100} name={w.name} state={w.state} pods={w.pods} lost={w.lost} opacity={w.opacity} status={w.status} />
        ) : (
          <rect key={i} class="nk-slot" x={wkX(i)} y={100} width={WK.w} height={WK.h} rx={5} />
        ),
      )}
    </svg>
  );
}

// ── Scale with demand ────────────────────────────────────────────────────────────────────────────
const SC_AT = [0, 5, 10, 16];
const SC_STEPS: StoryStep[] = [
  { tone: 'ink', k: 'Three workers, room to spare', text: 'The cluster runs nine pods on three worker nodes. Each worker has room for a few more, so new pods start at once.' },
  { tone: 'warn', k: 'Demand rises: pods have to wait', text: 'Five more pods are asked for. Three fit and fill the workers, and the last two have nowhere to run, so they wait.' },
  { tone: 'flow', k: 'The autoscaler adds a worker', text: 'NKP’s built-in Cluster Autoscaler scales the cluster out on demand. It adds a fourth worker, and the waiting pods start there.' },
  {
    tone: 'ok',
    k: 'Demand falls: the extra worker goes',
    text: 'When the pods finish, the autoscaler scales the cluster back in and removes the worker that is no longer needed, so capacity follows demand in both directions.',
  },
];
const SC = { arrive: [5.5, 5.9, 6.3, 6.7, 7.1], add: 10.8, ready: 12.6, land: [13.0, 13.4], leave: [16.5, 16.7, 16.9, 17.1, 17.3, 17.5], drain: 18.3, gone: 19.5 };

function ScaleScene({ top }: { top: ComponentChildren }) {
  const state = (t: number) => {
    const arrived = SC.arrive.filter((a) => t >= a).length;
    const landed = SC.land.filter((a) => t >= a).length;
    const left = SC.leave.filter((a) => t >= a).length;
    // nine to start; three arrivals fill the workers; the autoscaled worker takes the two that waited
    const base = [3, 3, 3].map((n, i) => n + (arrived > i ? 1 : 0));
    const w4 = landed;
    // six pods finish: both on worker 4, then one or two from the others
    const done = [Math.min(2, Math.max(0, left - 2)), Math.max(0, Math.min(1, left - 4)), Math.max(0, Math.min(1, left - 5)), Math.min(2, left)];
    const pods = [base[0] - done[0], base[1] - done[1], base[2] - done[2], w4 - done[3]];
    const waiting = Math.max(0, arrived - 3) - landed;
    const has4 = t >= SC.add && t < SC.gone;
    return { pods, waiting, has4, total: pods.reduce((a, b) => a + b, 0) };
  };
  return (
    <Story
      steps={SC_STEPS}
      at={SC_AT}
      end={22}
      poster={14.5}
      label="Autoscaling a cluster"
      top={top}
      side={Upgrades}
      why="Example numbers: four pods per worker and one extra worker. Real pods differ in size, and the autoscaler works within the minimum and maximum you set for each group of workers. Times are compressed."
      legend={[
        { color: 'var(--flow)', label: 'Running pod' },
        { color: 'var(--warn)', label: 'Pod waiting for room' },
      ]}
      kpis={(t) => {
        const s = state(t);
        return [
          { k: 'Worker nodes', v: s.has4 ? 4 : 3, sub: t >= SC.add && t < SC.ready ? 'one starting' : t >= SC.drain && t < SC.gone ? 'one being removed' : undefined },
          { k: 'Pods running', v: s.total },
          { k: 'Pods waiting', v: s.waiting, tone: s.waiting ? 'warn' : undefined },
          { k: 'Cluster Autoscaler', v: 'Built in', sub: 'scales out and back in' },
        ];
      }}
    >
      {(t) => {
        const s = state(t);
        const w4: Wk | null = s.has4 ? { name: 'worker-4', state: t < SC.ready ? 'new' : t >= SC.drain ? 'leaving' : 'ok', pods: s.pods[3], opacity: t >= SC.drain ? 1 - 0.7 * prog(t, SC.drain, SC.gone) : 1 } : null;
        const acting = (t >= SC.add - 0.5 && t < SC.land[1] + 0.4) || (t >= SC.drain - 0.3 && t < SC.gone);
        return (
          <ClusterView
            label="A cluster with three workers. More pods arrive than fit, so two wait. The Cluster Autoscaler adds a fourth worker and they start there. When demand falls, it removes the extra worker."
            note={`Demand: ${s.total + s.waiting} pods`}
            status={s.waiting ? `${s.waiting} pods waiting for room` : 'every pod is running'}
            tone={s.waiting ? 'warn' : 'ok'}
            workers={[...[0, 1, 2].map((i): Wk => ({ name: `worker-${i + 1}`, state: 'ok', pods: s.pods[i] })), w4]}
            tray={{ label: 'Waiting for room', n: s.waiting }}
            actor="Cluster Autoscaler"
            actorOn={acting}
          />
        );
      }}
    </Story>
  );
}

// ── Self-heal ────────────────────────────────────────────────────────────────────────────────────
const HL_AT = [0, 5, 10, 15];
const HL_STEPS: StoryStep[] = [
  { tone: 'ink', k: 'A healthy cluster', text: 'Three workers run seven pods. The definition says three workers, and the management cluster keeps watching that it stays true.' },
  { tone: 'bad', k: 'A worker fails', text: 'Worker 2 stops responding, a failed host or a crashed machine. The three pods that were running on it are gone.' },
  { tone: 'flow', k: 'Kubernetes restarts the pods', text: 'Kubernetes starts replacements for the lost pods on the workers that are still healthy, so the applications are back at full strength within moments.' },
  {
    tone: 'ok',
    k: 'The failed machine is replaced',
    text: 'The cluster is still one worker short of its definition. NKP’s self-healing removes the failed machine and creates a new one, with nobody paged to rebuild it.',
  },
];
const HL = { fail: 5.6, restart: [10.6, 11.0, 11.4], remove: 15.5, add: 16.0, ready: 17.8 };

function HealScene({ top }: { top: ComponentChildren }) {
  const restarted = (t: number) => HL.restart.filter((a) => t >= a).length;
  return (
    <Story
      steps={HL_STEPS}
      at={HL_AT}
      end={21}
      poster={20}
      label="Self-healing a cluster"
      top={top}
      side={Upgrades}
      why="An example failure with times compressed. Restarting pods on healthy nodes is standard Kubernetes for workloads with several replicas; replacing the machine is how Cluster API keeps a cluster as declared."
      legend={[
        { color: 'var(--flow)', label: 'Running pod' },
        { color: 'var(--bad)', label: 'Failed worker and its lost pods' },
      ]}
      kpis={(t) => {
        const failed = t >= HL.fail;
        const ready = failed && t < HL.ready ? 2 : 3;
        const pods = failed ? 4 + restarted(t) : 7;
        return [
          { k: 'Workers ready', v: `${ready} of 3`, tone: ready === 3 ? 'ok' : 'bad', sub: 'three declared' },
          { k: 'Pods running', v: `${pods} of 7`, tone: pods === 7 ? 'ok' : 'bad' },
          { k: 'Failed machine', v: !failed ? 'None' : t < HL.remove ? 'Worker 2' : t < HL.ready ? 'Being replaced' : 'Replaced', tone: failed && t < HL.ready ? 'warn' : undefined },
          { k: 'People paged', v: 0 },
        ];
      }}
    >
      {(t, phase) => {
        const failed = t >= HL.fail;
        const r = restarted(t);
        const w2: Wk | null =
          t < HL.remove + 0.5
            ? {
                name: 'worker-2',
                state: failed ? 'bad' : 'ok',
                pods: failed ? 0 : 3,
                lost: failed && phase === 1 ? 3 : 0,
                opacity: 1 - prog(t, HL.remove, HL.remove + 0.5),
                status: failed && phase >= 2 ? '✕ failed' : undefined,
              }
            : null;
        const w4: Wk | null = t >= HL.add ? { name: 'worker-4', state: t < HL.ready ? 'new' : 'ok', pods: 0 } : null;
        const pods = failed ? 4 + r : 7;
        return (
          <ClusterView
            label="A cluster with three workers. One worker fails and its pods are lost. Kubernetes restarts them on the healthy workers, then the failed machine is removed and a new worker is created so the cluster matches its definition again."
            note="Declared: 3 workers"
            status={!failed ? '✓ healthy' : pods < 7 ? `${7 - pods} pods lost` : t < HL.ready ? 'apps back, one worker short' : '✓ healthy again'}
            tone={!failed || t >= HL.ready ? 'ok' : pods < 7 ? 'bad' : 'warn'}
            workers={[{ name: 'worker-1', state: 'ok', pods: 2 + Math.min(2, r) }, w2, { name: 'worker-3', state: 'ok', pods: 2 + Math.max(0, r - 2) }, w4]}
            tray={{ label: 'Pods to restart', n: failed ? 3 - r : 0 }}
            actor="Cluster API"
            actorOn={t >= HL.remove && t < HL.ready + 0.6}
          />
        );
      }}
    </Story>
  );
}

// ── the tab ──────────────────────────────────────────────────────────────────────────────────────
type Life = 'create' | 'scale' | 'upgrade' | 'heal' | 'airgap';
const LIVES: { value: Life; label: string }[] = [
  { value: 'create', label: 'Create' },
  { value: 'scale', label: 'Scale' },
  { value: 'upgrade', label: 'Upgrade' },
  { value: 'heal', label: 'Self-heal' },
  { value: 'airgap', label: 'Air-gapped' },
];

export default function LifecycleView() {
  const [life, setLife] = useEnum<Life>('l', 'create', ['create', 'scale', 'upgrade', 'heal', 'airgap']);
  const top = <Choice<Life> label="Lifecycle" value={life} onChange={setLife} options={LIVES} />;
  if (life === 'scale') return <ScaleScene key="scale" top={top} />;
  if (life === 'upgrade') return <UpgradeScene key="upgrade" top={top} side={Upgrades} />;
  if (life === 'airgap') return <AirgapScene key="airgap" top={top} side={Upgrades} />;
  if (life === 'heal') return <HealScene key="heal" top={top} />;
  return <CreateScene key="create" top={top} />;
}
