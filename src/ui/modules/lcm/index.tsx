// LCM Rolling Upgrade: pick a scenario and watch a 4-node cluster update one node at a time
// on a loop: VMs move off live, the node updates and comes back, then the next one. All
// behavior comes from src/engine/lcm.ts.
import { useMemo } from 'preact/hooks';
import './style.css';
import { useEnum } from '../../../state/route';
import { stepsFrom, useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, fmtDur, type Tone } from '../../components/controls';
import { Choice, Kpis, Show } from '../../components/show';
import { COMP, DEFAULT_MINUTES, lcmStateAt, simulateLcm, type BatchId, type CompId, type LcmConfig, type LcmSim, type LcmView, type Resil } from '../../../engine/lcm';

type Scenario = 'healthy' | 'degraded' | 'fail';
const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: 'healthy', label: 'Healthy cluster' },
  { value: 'degraded', label: 'Cluster already degraded' },
  { value: 'fail', label: 'A node fails mid-upgrade' },
];
const NODES = 4;
const SELECTED: CompId[] = ['aos', 'ahv'];
const PROTECTION: Record<Resil, { v: string; tone: Tone }> = {
  ok: { v: 'Full', tone: 'ok' },
  reduced: { v: 'Reduced', tone: 'warn' },
  resync: { v: 'Catching up', tone: 'warn' },
  unavailable: { v: 'At risk', tone: 'bad' },
  degraded: { v: 'Not OK', tone: 'bad' },
  offline: { v: 'Offline', tone: 'bad' },
};
const BATCH_SHORT: Record<BatchId, string> = { foundation: 'Foundation', aos: 'AOS', ahv: 'AHV', fw: 'Firmware', ncc: 'NCC' };

function simFor(sc: Scenario): LcmSim {
  const base: LcmConfig = { nodes: NODES, rf: 2, vms: NODES * 4, memLoadPct: 50, selected: SELECTED, minutes: DEFAULT_MINUTES, degraded: sc === 'degraded', witness: true, vmsShutDown: false, fail: null, repairAt: null };
  const healthy = simulateLcm(base);
  if (sc !== 'fail') return healthy;
  // Fail a node while LCM is bringing VMs back to the node it just finished, so only the failed
  // node is down: LCM pauses, the node is repaired 40 minutes later, and LCM resumes.
  for (let t = Math.round(healthy.end * 0.55); t < healthy.end; t += 10) {
    const c = lcmStateAt(healthy, t).current;
    if (c && c.phase === 'return-vms') return simulateLcm({ ...base, fail: { at: t + 20, node: (c.node + 2) % NODES }, repairAt: t + 20 + 2400 });
  }
  return healthy;
}

const PHASE_TEXT: Record<string, string> = {
  'cvm-down': 'Only its controller VM restarts. VMs stay where they are; their storage traffic goes to the other controllers for a moment.',
  'cvm-reboot': 'The controller VM reboots into the new AOS version while the other controllers serve this host’s VMs.',
  'cvm-up': 'The controller VM is back and takes over its host’s storage traffic again.',
  resync: 'Data written while it was out catches up. LCM moves on only when every piece of data has both copies again.',
  evacuate: 'Its VMs move live to the other nodes. Nothing stops.',
  'enter-mm': 'The node is out of service and empty, so it can be updated safely.',
  update: 'The new AHV version is installed and the host reboots. The other three nodes run every VM.',
  'exit-mm': 'The node comes back into service.',
  'return-vms': 'VMs move back so their data is local again.',
};

function caption(sc: Scenario, sim: LcmSim, v: LcmView): { tone: Tone | 'ink'; k: string; text: string } {
  if (sim.blocked) return { tone: 'bad', k: 'LCM will not start', text: 'A drive has failed and its data is still being re-protected. The pre-checks catch it, so LCM changes nothing until the cluster is healthy again.' };
  if (v.done)
    return sc === 'fail'
      ? { tone: 'ok', k: 'Upgrade complete', text: 'Every node is updated. The only VM downtime came from the failure, when its VMs restarted on other nodes, not from the upgrade.' }
      : { tone: 'ok', k: 'Upgrade complete', text: `All ${NODES} nodes are updated, one at a time, and every VM kept running the whole way.` };
  if (v.paused) return { tone: 'warn', k: 'LCM waits', text: `Another node failed. LCM finished the node it was on and now waits, taking no other node down until data is fully protected again.${sim.repairAt !== null && v.t >= sim.repairAt ? ' The node is back; data is catching up.' : ''}` };
  if (v.current) {
    const name = v.nodes[v.current.node].name;
    return { tone: 'flow', k: `${name} · ${BATCH_SHORT[v.current.batch]}`, text: PHASE_TEXT[v.current.phase] ?? v.current.label };
  }
  if (v.cluster?.kind === 'precheck') return { tone: 'ink', k: 'Pre-checks', text: 'Before touching anything, LCM checks health, data protection, free room for VMs and connectivity.' };
  return { tone: 'ink', k: 'Next node', text: 'One node at a time: LCM moves on only when the last node is fully back.' };
}

function phaseLabel(sim: LcmSim, v: LcmView): string {
  if (sim.blocked) return 'Pre-checks failed';
  if (v.done) return 'Done';
  if (v.paused) return 'Waiting';
  if (v.current) return `${v.nodes[v.current.node].name} · ${BATCH_SHORT[v.current.batch]}`;
  return 'Pre-checks';
}

export default function Lcm() {
  const [sc, setSc] = useEnum<Scenario>('sc', 'healthy', SCENARIOS.map((s) => s.value));
  const sim = useMemo(() => simFor(sc), [sc]);
  // About 22 seconds per loop at full speed (6 when the pre-checks stop it), slower where a caption needs it.
  // The upgrade is done exactly at sim.end, so a short tail after it gives the closing caption its reading time.
  const end = sim.end + (sim.blocked ? 0 : sim.end / 22);
  const steps = useMemo(() => stepsFrom(end, (t) => caption(sc, sim, lcmStateAt(sim, t))), [sc, sim, end]);
  const clock = useClock({ rate: sim.end / (sim.blocked ? 6 : 22), duration: end, keys: true, poster: sim.blocked ? sim.end : (sim.visits[NODES]?.start ?? 0) + 400, steps });
  useRestartOn(clock, [sc]);
  const view = lcmStateAt(sim, clock.t);
  const line = caption(sc, sim, view);
  const prot = PROTECTION[view.resiliency.state];
  const down = Math.round(view.impact.vmDownMin);

  return (
    <Show
      top={<Choice<Scenario> label="Scenario" value={sc} onChange={setSc} options={SCENARIOS} />}
      foot={
        <>
          <Follow tone={line.tone} k={line.k}>
            <p>{line.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Nodes out of service', v: view.nodes.filter((n) => n.out || n.failed).length, tone: view.nodes.some((n) => n.failed) ? 'bad' : undefined },
              { k: 'Data protection', v: prot.v, tone: prot.tone, tip: 'Whether every piece of data has both of its copies (RF2). LCM takes the next node out only when this is Full.' },
              { k: 'VMs moved live', v: view.impact.migrations },
              { k: 'VM downtime', v: down ? `${down} VM-min` : 'None', tone: down ? 'bad' : 'ok' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <UpgradeDiagram sim={sim} view={view} />
      </div>
      <Legend
        items={[
          { color: 'var(--ink)', label: 'Controller VM running' },
          { color: 'var(--warn)', label: 'Out of service for the update' },
          { color: 'var(--bad)', label: 'Failed' },
          { color: 'var(--flow)', label: 'Node being updated · VM moving' },
          { color: 'var(--warn)', dashed: true, label: 'LCM waiting' },
        ]}
      />
      <PlayBar
        clock={clock}
        label="Upgrade animation"
        fmt={() => phaseLabel(sim, view)}
        extra={<Illus why="The times on the timeline use older, unofficial per-node estimates (about 15 minutes for AOS and 25 for AHV). Real times depend on the cluster, its load and the release." />}
      />
    </Show>
  );
}

function UpgradeDiagram({ sim, view }: { sim: LcmSim; view: LcmView }) {
  const W = 820;
  const n = sim.cfg.nodes;
  const railY = 40;
  const railH = 34;
  const end = sim.end || 1;
  const X = (t: number) => 10 + (Math.min(t, end) / end) * (W - 20);

  const perRow = n <= 4 ? n : n <= 16 ? 4 : 8;
  const rows = Math.ceil(n / perRow);
  const gap = 14;
  const nodeW = Math.min(240, (W - 20 - gap * (perRow - 1)) / perRow);
  const compact = nodeW < 150;
  const rowW = perRow * nodeW + (perRow - 1) * gap;
  const x0 = (W - rowW) / 2;
  const vmSize = compact ? 11 : 16;
  const vmGap = compact ? 4 : 6;
  const vmCols = Math.max(1, Math.floor((nodeW - 20 + vmGap) / (vmSize + vmGap)));
  const maxVmRows = Math.max(1, ...Array.from({ length: n }, (_, i) => Math.ceil(view.vms.filter((v) => v.node === i).length / vmCols)));
  const nodeH = (compact ? 70 : 122) + Math.min(4, maxVmRows) * (vmSize + vmGap) + 6;
  const top = railY + railH + 54;
  const H = top + rows * (nodeH + gap) + 22;
  const nodePos = (i: number) => ({ x: x0 + (i % perRow) * (nodeW + gap), y: top + Math.floor(i / perRow) * (nodeH + gap) });

  // VM slots per node
  const vmTop = compact ? 64 : 116;
  const slotOf = new Map<number, { x: number; y: number }>();
  for (let i = 0; i < n; i++) {
    const here = view.vms.filter((v) => v.node === i);
    const p = nodePos(i);
    here.forEach((v, k) => {
      slotOf.set(v.id, { x: p.x + 10 + (k % vmCols) * (vmSize + vmGap), y: p.y + vmTop + Math.min(3, Math.floor(k / vmCols)) * (vmSize + vmGap) });
    });
  }

  const failX = sim.unhealthy ? X(sim.unhealthy[0]) : null;
  const playX = X(view.t);
  const stopped = sim.blocked && view.t >= sim.end * 0.7;
  const batchSpans = sim.batches.map((b) => {
    const segs = b.scope === 'cluster' ? sim.csegs.filter((c) => c.batch === b.id) : [...sim.csegs.filter((c) => c.batch === b.id), ...sim.segs.filter((s) => s.batch === b.id)];
    if (!segs.length) return null;
    return { b, a: Math.min(...segs.map((s) => s.start)), z: Math.max(...segs.map((s) => s.end)) };
  });

  return (
    <svg class="diagram lcm-dia" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rolling upgrade of ${n} nodes. ${view.resiliency.text}`}>
      <text x={10} y={13} class="muted lcm-cap">
        ONE NODE AT A TIME
      </text>
      {/* batch labels */}
      {batchSpans.map(
        (s) =>
          s && (
            <g key={s.b.id}>
              <line x1={X(s.a)} x2={X(s.a)} y1={railY - 6} y2={railY + railH + 4} class="lcm-tick" />
              {X(s.z) - X(s.a) > 46 && (
                <text x={X(s.a) + 4} y={railY - 4} class="lcm-small">
                  {BATCH_SHORT[s.b.id]}
                </text>
              )}
            </g>
          ),
      )}
      <rect x={10} y={railY} width={W - 20} height={railH} class="bg2" stroke="var(--line-2)" />
      {sim.csegs.map((c, i) => (
        <rect key={`c${i}`} x={X(c.start)} y={railY + 1} width={Math.max(1, X(c.end) - X(c.start))} height={railH - 2} class={stopped ? 'lcm-stop' : c.kind === 'wait' ? 'lcm-wait' : view.t >= c.end ? 'lcm-done' : view.t >= c.start ? 'lcm-now' : 'bg3'} />
      ))}
      {stopped && (
        <text x={W / 2} y={railY + railH / 2 + 5} text-anchor="middle" class="lcm-small lcm-on-ink">
          ✕ Pre-checks failed: nothing is changed
        </text>
      )}
      {sim.visits.map((v, i) => {
        const a = X(v.start);
        const z = X(v.end);
        const st = view.t >= v.end ? 'lcm-done' : view.t >= v.start ? 'lcm-now' : 'lcm-todo';
        return (
          <g key={`v${i}`}>
            <rect x={a + 0.5} y={railY + 1} width={Math.max(1, z - a - 1)} height={railH - 2} class={st} />
            {z - a > 22 && (
              <text x={(a + z) / 2} y={railY + railH / 2 + 5} text-anchor="middle" class={`lcm-small ${st === 'lcm-todo' ? '' : 'lcm-on-ink'}`}>
                N{v.node + 1}
              </text>
            )}
          </g>
        );
      })}
      {sim.segs
        .filter((s) => s.aborted)
        .map((s, i) => (
          <rect key={`ab${i}`} x={X(s.start)} y={railY + 1} width={Math.max(2, X(s.end) - X(s.start))} height={railH - 2} class="lcm-wait" />
        ))}
      {failX !== null && (
        <g>
          <line x1={failX} x2={failX} y1={railY - 8} y2={railY + railH + 18} class="bad-stroke" stroke-width={2} />
          <text x={Math.min(failX + 4, W - 120)} y={railY + railH + 16} class="lcm-small bad-fill">
            ✕ N{(sim.failNode ?? 0) + 1} failed
          </text>
        </g>
      )}
      {sim.repairAt !== null && (
        <g>
          <line x1={X(sim.repairAt)} x2={X(sim.repairAt)} y1={railY - 8} y2={railY + railH + 18} class="ok-stroke" stroke-width={2} />
        </g>
      )}
      <line x1={playX} x2={playX} y1={railY - 10} y2={railY + railH + 6} stroke="var(--text)" stroke-width={2} />
      <text x={10} y={railY + railH + 20} class="lcm-small muted">
        0:00
      </text>
      <text x={W - 10} y={railY + railH + 20} text-anchor="end" class="lcm-small muted">
        {fmtDur(sim.end / 3600)}
        {sim.pausedAt !== null ? ' (paused)' : ''}
      </text>

      {/* nodes */}
      {view.nodes.map((nd) => {
        const p = nodePos(nd.id);
        const ahvDone = nd.done.includes('ahv');
        const aosDone = nd.done.includes('aos');
        const fwDone = nd.done.includes('fw');
        const hasAhv = sim.batches.some((b) => b.id === 'ahv');
        const hasAos = sim.batches.some((b) => b.id === 'aos');
        const hasFw = sim.batches.some((b) => b.id === 'fw');
        const cvmState = nd.failed ? 'down' : nd.out ? 'warn' : '';
        const drive = sim.cfg.degraded && nd.id === 1;
        const word = nd.failed ? 'FAILED' : drive ? 'A drive failed' : nd.phase === 'idle' ? 'In service' : phaseWord(nd.phase);
        const boxCls = nd.failed ? 'down' : nd.out ? 'warn' : nd.phase !== 'idle' ? 'sel' : '';
        const busy = nd.phase !== 'idle';
        const statusCls = nd.failed || drive ? 'bad-fill' : nd.out ? 'warn-fill' : busy ? 'flow-fill' : 'muted';
        const mark = nd.failed || drive ? '✕ ' : nd.out ? '⚠ ' : busy ? '→ ' : '';
        const cvmTxt = compact ? 'CVM' : `CVM${hasAos ? ` · AOS ${aosDone ? COMP.aos.to : COMP.aos.from}` : ''}${nd.failed || nd.out ? ' · down' : ''}`;
        const hostTxt = compact
          ? hasAhv ? `AHV ${ahvDone ? COMP.ahv.to : COMP.ahv.from}` : 'AHV'
          : `${hasAhv ? `AHV ${ahvDone ? COMP.ahv.to : COMP.ahv.from}` : 'AHV host'}${nodeW >= 220 && (nd.phase === 'enter-mm' || nd.phase === 'update' || nd.phase === 'exit-mm') ? (sim.cfg.nodes === 1 ? ' · rebooting' : ' · maintenance') : ''}`;
        const cvmIo = nd.phase === 'cvm-down' || nd.phase === 'cvm-reboot' || nd.phase === 'cvm-up';
        return (
          <g key={nd.id}>
            <rect x={p.x} y={p.y} width={nodeW} height={nodeH} class={`node-box ${boxCls}`} />
            <text x={p.x + 10} y={p.y + 22} class="lcm-node-name">
              {nd.name}
            </text>
            <text x={p.x + 10} y={p.y + (compact ? 38 : 42)} class={`lcm-small ${statusCls}`}>
              {mark}
              {word}
            </text>
            {!compact && (
              <>
                <rect x={p.x + 10} y={p.y + 52} width={nodeW - 20} height={26} class={`cvm ${cvmState}`} />
                <text x={p.x + 18} y={p.y + 70} class={`lcm-small ${cvmState === 'warn' ? 'lcm-on-warn' : 'lcm-on-ink'}`}>
                  {cvmTxt}
                </text>
                <rect x={p.x + 10} y={p.y + 82} width={nodeW - 20} height={24} class="bg3" stroke="var(--line-2)" />
                <text x={p.x + 18} y={p.y + 99} class="lcm-small">
                  {hostTxt}
                </text>
              </>
            )}
            {compact && (
              <>
                <rect x={p.x + 10} y={p.y + 46} width={(nodeW - 24) / 2} height={12} class={`cvm ${cvmState}`} />
                <rect x={p.x + 14 + (nodeW - 24) / 2} y={p.y + 46} width={(nodeW - 24) / 2} height={12} class="bg3" stroke="var(--line-2)" />
              </>
            )}
            {!compact && (hasFw || cvmIo) && (
              <text x={p.x + nodeW - 10} y={p.y + 22} text-anchor="end" class={`lcm-small ${cvmIo && sim.cfg.nodes > 1 ? 'flow-fill' : 'muted'}`}>
                {cvmIo && sim.cfg.nodes > 1 ? 'I/O → other CVMs' : fwDone ? '✓ firmware' : 'firmware pending'}
              </text>
            )}
          </g>
        );
      })}
      {/* AOS: the host’s storage I/O goes to Stargate on other CVMs while its CVM reboots */}
      {view.current && sim.cfg.nodes > 1 && (view.current.phase === 'cvm-down' || view.current.phase === 'cvm-reboot' || view.current.phase === 'cvm-up') && (() => {
        const a = nodePos(view.current!.node);
        const others = [1, 2].map((k) => (view.current!.node + k) % n).filter((o, i, arr) => o !== view.current!.node && arr.indexOf(o) === i);
        return others.map((o) => {
          const b = nodePos(o);
          return <path key={`io${o}`} d={`M${a.x + nodeW / 2} ${a.y + nodeH - 4} C ${a.x + nodeW / 2} ${a.y + nodeH + 12}, ${b.x + nodeW / 2} ${b.y + nodeH + 12}, ${b.x + nodeW / 2} ${b.y + nodeH - 4}`} class="xfer" stroke-dasharray="5 4" />;
        });
      })()}
      {/* VMs */}
      {view.vms.map((v) => {
        const dest = slotOf.get(v.id);
        if (!dest) return null;
        let { x, y } = dest;
        if (v.moving) {
          const f = nodePos(v.moving.from);
          const fx = f.x + nodeW / 2 - vmSize / 2;
          const fy = f.y + vmTop + 4;
          const p = v.moving.kind === 'restart' ? 1 : v.moving.p;
          x = fx + (dest.x - fx) * p;
          y = fy + (dest.y - fy) * p;
        }
        const cls = v.state === 'off' ? 'vm failed' : v.state === 'restarting' ? 'vm restart' : v.moving ? 'vm hl' : 'vm';
        return <rect key={v.id} x={x} y={y} width={vmSize} height={vmSize} class={cls} />;
      })}
      {view.vms
        .filter((v) => v.moving && v.moving.kind === 'migrate')
        .slice(0, 4)
        .map((v) => {
          const f = nodePos(v.moving!.from);
          const d = slotOf.get(v.id)!;
          return <line key={`m${v.id}`} x1={f.x + nodeW / 2} y1={f.y + vmTop + 10} x2={d.x + vmSize / 2} y2={d.y + vmSize / 2} class="xfer" stroke-dasharray="4 3" />;
        })}
    </svg>
  );
}

function phaseWord(p: string): string {
  switch (p) {
    case 'evacuate':
      return 'VMs moving off';
    case 'enter-mm':
      return 'Maintenance';
    case 'update':
      return 'Updating';
    case 'exit-mm':
      return 'Coming back';
    case 'return-vms':
      return 'VMs returning';
    case 'cvm-down':
    case 'cvm-reboot':
      return 'CVM rebooting';
    case 'cvm-up':
      return 'CVM services up';
    case 'resync':
      return 'Resyncing';
    default:
      return p;
  }
}
