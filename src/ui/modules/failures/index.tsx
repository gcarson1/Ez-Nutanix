// Failure Gauntlet: pick a failure and RF2 or RF3, and watch one fixed 8-node cluster detect
// it, keep VMs running and heal itself, on a loop you can scrub. The Cluster & DSF Lab covers
// the everyday cases (VM failover, drive failure, planned shutdown) on a 4-node cluster.
import { useMemo, useRef } from 'preact/hooks';
import '../cluster-lab/style.css';
import { useScenario } from '../../../state/scenario';
import { useEnum } from '../../../state/route';
import { createCluster, DEFAULT_CONFIG, type ClusterConfig, type ClusterState } from '../../../engine/cluster';
import { deriveStatus, type ClusterStatus } from '../../../engine/status';
import { describeAct, insights, scriptActs, type Act, type ScriptId } from '../../../engine/timeline';
import type { RF } from '../../../engine/rules';
import { useClock, useRestartOn, useStepKey } from '../../components/clock';
import { Follow, Illus, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show } from '../../components/show';
import { ClusterDiagram } from '../cluster-lab/ClusterDiagram';
import { TimeStrip } from '../cluster-lab/TimeStrip';
import { DiagramLegend } from '../cluster-lab/legend';
import { useMaybeTimeline, fmtT } from '../cluster-lab/sim';

type Pick = 'disk' | 'cvm' | 'node' | 'block' | 'double' | 'full';
const PICKS: { id: Pick; label: string; blurb: string }[] = [
  { id: 'disk', label: 'Drive', blurb: 'One drive dies. Its copies are rebuilt from the other copies, with every node helping.' },
  { id: 'cvm', label: 'Controller VM', blurb: 'One CVM stops for 15 minutes. The host and its VMs keep running; their I/O goes to other CVMs.' },
  { id: 'node', label: 'Node', blurb: 'A whole node powers off. HA restarts its VMs on other hosts and every other node helps re-protect its data.' },
  { id: 'block', label: 'Block (chassis)', blurb: 'A chassis holding two nodes loses power. Copies were kept in different blocks, so data stays available.' },
  { id: 'double', label: 'Two nodes at once', blurb: 'Two nodes fail together. RF2 keeps two copies, so some data loses both; RF3 keeps three.' },
  { id: 'full', label: 'Nearly full cluster', blurb: 'A node fails when drives are about 85% full. The survivors have no room to re-create every missing copy.' },
];

/** One fixed, presentable cluster: 8 nodes in 4 blocks, block-aware. */
function clusterFor(pick: Pick, rf: RF): ClusterConfig {
  return { ...DEFAULT_CONFIG, nodes: 8, nodesPerBlock: 2, blockAware: true, racks: 1, rackAware: false, rf, ft: rf, ecx: false, vms: 24, fillPct: pick === 'full' ? 85 : 45, haReserve: false };
}

/** Sim seconds per real second: slow around a failure so detection and HA can be read, fast afterwards. */
function rateAt(t: number, acts: Act[], duration: number): number {
  const near = acts.some((a) => t >= a.t - 20 && t < a.t + 150);
  return near ? 12 : Math.max(150, duration / 14);
}

type Line = { tone: Tone | 'ink'; k: string; text: string };

/** One line saying what is happening now. */
function nowLine(s: ClusterState, st: ClusterStatus, acts: Act[], t: number, blurb: string): Line {
  const fails = acts.filter((a) => a.k === 'fail' && a.t <= t + 1e-9);
  if (!fails.length) return { tone: 'ink', k: 'Healthy cluster', text: blurb };
  const f = fails[fails.length - 1] as Extract<Act, { k: 'fail' }>;
  const detected = f.f.kind === 'disk' || s.events.some((e) => e.kind === 'detect' && e.t >= f.t);
  if (!detected) return { tone: 'bad', k: 'Failure', text: `${describeAct(f)}. The cluster is waiting for missed heartbeats to confirm it.` };
  if (st.resiliency === 'Data unavailable' || st.resiliency === 'Cluster down')
    return { tone: 'bad', k: 'Data unavailable', text: `${st.items.unavailable} sampled pieces of data lost every copy. They come back only when a failed node returns. This is what a third copy (RF3) protects against.` };
  const waiting = (s.ha || []).filter((r) => r.restartedAt === null && !r.failed).length;
  if (waiting) return { tone: 'warn', k: 'HA restarts', text: `HA is restarting the VMs that ran there on other hosts: ${waiting} still to go.` };
  const heal = st.selfHeal;
  if (heal.state === 'blocked') return { tone: 'bad', k: 'Cannot self-heal', text: (heal.reason || 'The survivors have no room for the missing copies.').split(' Fix:')[0] + ' Data stays available, with fewer copies, until capacity is added.' };
  if (heal.state === 'rebuilding' || heal.state === 'waiting')
    return { tone: 'flow', k: 'Self-healing', text: `Every surviving node is re-creating missing copies at once: ${Math.round(heal.progress * 100)}% done. VMs keep running.` };
  if (st.protectionLimit) return { tone: 'warn', k: 'Protected, with a limit', text: st.protectionLimit };
  return { tone: 'ok', k: 'Protected again', text: f.f.kind === 'cvm' ? 'The CVM is back and its copies count again. Nothing had to be rebuilt.' : 'Every piece of data has its full set of copies again, without anyone touching the cluster.' };
}

export default function Failures() {
  const { cfg: shared, set } = useScenario();
  const rf: RF = shared.rf === 3 ? 3 : 2;
  const [pick, setPick] = useEnum<Pick>('sc', 'node', PICKS.map((p) => p.id));
  const def = PICKS.find((p) => p.id === pick)!;

  const cfg = useMemo(() => clusterFor(pick, rf), [pick, rf]);
  const s0 = useMemo(() => createCluster(cfg), [cfg]);
  const acts = useMemo(() => scriptActs(pick === 'full' ? 'full' : (pick as ScriptId), s0), [pick, s0]);
  const actKey = `${pick}|${rf}`;
  const run = useMaybeTimeline(cfg, acts, actKey)!;
  const duration = run.duration;
  const tRef = useRef(0);
  const clock = useClock({ rate: rateAt(tRef.current, acts, duration), duration, keys: true, poster: Math.min(duration, 900) });
  tRef.current = clock.t;
  useRestartOn(clock, [pick, rf]);

  const s = useMemo(() => run.tl.at(clock.t), [run.tl, clock.t]);
  const st = useMemo(() => deriveStatus(s), [s]);
  const ins = insights(s);
  const line = nowLine(s, st, acts, clock.t, def.blurb);
  useStepKey(clock, line.k);
  const heal = st.selfHeal;
  const healed = heal.state === 'rebuilding' || heal.state === 'waiting' || heal.state === 'blocked' ? Math.round(heal.progress * 100) : Math.round((st.items.healthy / Math.max(1, st.items.total)) * 100);
  const diagram = useMemo(() => <ClusterDiagram s={s} compact />, [s]);

  return (
    <Show
      top={
        <>
          <Choice<Pick> label="What fails" value={pick} onChange={setPick} options={PICKS.map((p) => ({ value: p.id, label: p.label }))} />
          <Choice<RF>
            label="Protection"
            value={rf}
            onChange={(v) => set({ rf: v, ft: v, ecx: false })}
            options={[
              { value: 2, label: 'RF2 · 2 copies' },
              { value: 3, label: 'RF3 · 3 copies' },
            ]}
          />
        </>
      }
      foot={
        <>
          <Follow tone={line.tone} k={line.k}>
            <p>{line.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Can take another failure', v: st.tolerable > 0 && !st.items.unavailable ? 'Yes' : 'Not yet', tone: st.tolerable > 0 && !st.items.unavailable ? 'ok' : 'warn' },
              { k: 'VMs running', v: `${ins.vmsRunning} of ${s.vms.length}`, tone: ins.vmsRunning < s.vms.length ? 'warn' : 'ok' },
              { k: 'Data available', v: st.items.unavailable ? 'Some lost' : 'All', tone: st.items.unavailable ? 'bad' : 'ok' },
              { k: 'Copies restored', v: `${healed}%`, tone: healed < 100 ? 'flow' : 'ok' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">{diagram}</div>
      <DiagramLegend ecx={false} />
      <PlayBar clock={clock} scrub={false} fmt={fmtT} label="Failure animation" extra={<Illus why="Simulated from a sample of a few hundred data items on an 8-node, 4-block cluster. Detection, HA and rebuild timings are simplified from documented behavior; time runs slowly around the failure and fast afterwards." />} />
      <TimeStrip
        samples={run.tl.samples}
        duration={duration}
        computed={run.computed}
        t={clock.t}
        acts={acts}
        events={run.tl.frontState.events}
        label="Health over time (drag to scrub)"
        onSeek={(v) => {
          clock.pause();
          clock.seek(v);
        }}
      />
    </Show>
  );
}
