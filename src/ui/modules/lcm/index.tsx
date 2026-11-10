// LCM Rolling Upgrade. Nutanix cluster tab: pick a scenario and watch a 4-node cluster update one node at a time
// on a loop: VMs move off live, the node updates and comes back, then the next one. In the
// failure scenario nothing hints at the failure until it happens. All behavior comes from
// src/engine/lcm.ts.
import { useMemo } from 'preact/hooks';
import './style.css';
import { useEnum } from '../../../state/route';
import { stepsFrom, useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, fmtDur, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, Tabs } from '../../components/show';
import { CvmBox, VmBox } from '../../components/parts';
import { K8sUpgrade } from './k8s';
import { COMP, DEFAULT_MINUTES, HA_RESTART_SEC, lcmStateAt, simulateLcm, type BatchId, type CompId, type LcmConfig, type LcmSim, type LcmView, type Resil } from '../../../engine/lcm';

type Scenario = 'healthy' | 'fail';
const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: 'healthy', label: 'Healthy cluster' },
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
const BATCH_WORD: Record<BatchId, string> = { foundation: 'Foundation', aos: 'AOS', ahv: 'AHV', fw: 'firmware', ncc: 'NCC' };

/** `sim` is what happens; `plan` is what LCM expects before anything goes wrong. */
interface Run {
  sim: LcmSim;
  plan: LcmSim;
}

function simFor(sc: Scenario): Run {
  const base: LcmConfig = { nodes: NODES, rf: 2, vms: NODES * 4, memLoadPct: 50, selected: SELECTED, minutes: DEFAULT_MINUTES, degraded: false, witness: true, vmsShutDown: false, fail: null, repairAt: null };
  const healthy = simulateLcm(base);
  if (sc !== 'fail') return { sim: healthy, plan: healthy };
  // Fail a node while LCM is bringing VMs back to the node it just finished, so only the failed
  // node is down: LCM holds, the node is repaired 40 minutes later, and LCM resumes.
  for (let t = Math.round(healthy.end * 0.55); t < healthy.end; t += 10) {
    const c = lcmStateAt(healthy, t).current;
    if (c && c.phase === 'return-vms') return { sim: simulateLcm({ ...base, fail: { at: t + 20, node: (c.node + 2) % NODES }, repairAt: t + 20 + 2400 }), plan: healthy };
  }
  return { sim: healthy, plan: healthy };
}

const PHASE_TEXT: Record<string, string> = {
  'cvm-down': 'Only its CVM restarts. VMs stay where they are; their storage traffic goes to the other CVMs for a moment.',
  'cvm-reboot': 'The CVM reboots into the new AOS version while the other CVMs serve this host’s VMs.',
  'cvm-up': 'The CVM is back and takes over its host’s storage traffic again.',
  resync: 'Data written while it was out catches up. LCM moves on only when every piece of data has both copies again.',
  evacuate: 'Its VMs move live to the other nodes. Nothing stops.',
  'enter-mm': 'The node is out of service and empty, so it can be updated safely.',
  update: 'The new AHV version is installed and the host reboots. The other three nodes run every VM.',
  'exit-mm': 'The node comes back into service.',
  'return-vms': 'VMs move back so their data is local again.',
};

function caption(sim: LcmSim, v: LcmView): { tone: Tone | 'ink'; k: string; text: string } {
  const [failAt, healthyAt] = sim.unhealthy ?? [Infinity, Infinity];
  const failed = `N${(sim.failNode ?? 0) + 1}`;
  if (v.done)
    return sim.unhealthy
      ? { tone: 'ok', k: 'Upgrade completes', text: 'Every node is updated. The only VM downtime came from the failure, when its VMs restarted on other nodes, not from the upgrade.' }
      : { tone: 'ok', k: 'Upgrade completes', text: `All ${NODES} nodes are updated, one at a time, and every VM kept running the whole way.` };
  if (v.t >= failAt && v.t < failAt + HA_RESTART_SEC)
    return { tone: 'bad', k: `${failed} fails`, text: `No warning: ${failed} just went down. HA restarts its VMs on the other nodes, and the cluster starts rebuilding the missing data copies right away.` };
  if (v.paused)
    return sim.repairAt !== null && v.t >= sim.repairAt
      ? { tone: 'warn', k: `${failed} rejoins`, text: `${failed} is repaired and rejoins. Its data catches up, and LCM still holds until every piece of data has both copies again.` }
      : { tone: 'warn', k: 'LCM holds', text: `The upgrade pauses, the cluster does not. LCM takes no other node down while ${failed} is out, so every VM keeps running on the healthy nodes until ${failed} is repaired.` };
  if (v.current) {
    const name = v.nodes[v.current.node].name;
    const what = PHASE_TEXT[v.current.phase] ?? v.current.label;
    if (v.t >= failAt && v.t < healthyAt) return { tone: 'warn', k: `LCM finishes ${name}`, text: `LCM completes the node it was already on, then goes no further while ${failed} is out.` };
    if (v.current === sim.segs.find((s) => s.start >= healthyAt)) return { tone: 'flow', k: `LCM resumes on ${name}`, text: what };
    return { tone: 'flow', k: `${name} updates ${BATCH_WORD[v.current.batch]}`, text: what };
  }
  if (v.cluster?.kind === 'precheck') return { tone: 'ink', k: 'Pre-checks run', text: 'Before touching anything, LCM checks health, data protection, free room for VMs and connectivity.' };
  return { tone: 'ink', k: 'Next node starts', text: 'One node at a time: LCM moves on only when the last node is fully back.' };
}

function ClusterUpgrade() {
  const [sc, setSc] = useEnum<Scenario>('sc', 'healthy', SCENARIOS.map((s) => s.value));
  const { sim, plan } = useMemo(() => simFor(sc), [sc]);
  // About 22 seconds per loop at full speed, slower where a caption needs it. The upgrade is
  // done exactly at sim.end, so a short tail after it gives the closing caption its reading time.
  const end = sim.end + sim.end / 22;
  const steps = useMemo(() => stepsFrom(end, (t) => caption(sim, lcmStateAt(sim, t))), [sim, end]);
  // With reduced motion the still frame is the second batch, or LCM holding after the failure.
  const poster = sim.unhealthy ? sim.unhealthy[0] + HA_RESTART_SEC + 600 : (sim.visits[NODES]?.start ?? 0) + 400;
  const clock = useClock({ rate: sim.end / 22, duration: end, keys: true, poster, steps });
  useRestartOn(clock, [sc]);
  const view = lcmStateAt(sim, clock.t);
  const line = caption(sim, view);
  // An unplanned failure starts a rebuild of the lost copies at once; a planned upgrade does not.
  const prot = view.resiliency.state === 'reduced' && view.nodes.some((n) => n.failed) ? { v: 'Rebuilding', tone: 'warn' as Tone } : PROTECTION[view.resiliency.state];
  const down = Math.round(view.impact.vmDownMin);

  return (
    <Show clock={clock}
      top={<Choice<Scenario> label="What happens" value={sc} onChange={setSc} options={SCENARIOS} />}
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
        <UpgradeDiagram sim={sim} plan={plan} view={view} />
      </div>
      <Legend
        items={[
          { color: 'var(--ink)', label: 'Controller VM (CVM) running' },
          { color: 'var(--warn)', label: 'Out of service for the update' },
          { color: 'var(--flow)', label: 'Node being updated · VM moving' },
          ...(sc === 'fail'
            ? [
                { color: 'var(--bad)', label: 'Failed' },
                { color: 'var(--warn)', label: 'LCM holding' },
              ]
            : []),
        ]}
      />
      <PlayBar
        clock={clock}
        label="Upgrade animation"
        extra={<Illus why="A four-node cluster with 16 VMs, played back far faster than real time. The timeline uses older, unofficial per-node estimates (about 15 minutes for AOS and 25 for AHV); real times depend on the cluster, its load and the release." />}
      />
    </Show>
  );
}

const STAGES = ['Inventory and framework update', 'Pre-checks', 'Download and stage', 'Upgrade'];
const STAGE_W = [270, 130, 200, 140];

/** A part's version as a small tag: the installed version, then old to new while it updates, then the new one. */
function VerTag({ x, y, w, name, from, to, done, now }: { x: number; y: number; w: number; name: string; from: string; to: string; done: boolean; now: boolean }) {
  return (
    <g class={`ver${done ? ' new' : now ? ' now' : ''}`}>
      <rect x={x} y={y} width={w} height={22} rx={4} />
      <text x={x + 8} y={y + 15} class="d-fine">
        {done ? `✓ ${name} ${to}` : now ? `${from} → ${to}` : `${name} ${from}`}
      </text>
    </g>
  );
}

function UpgradeDiagram({ sim, plan, view }: { sim: LcmSim; plan: LcmSim; view: LcmView }) {
  const W = 820;
  const n = sim.cfg.nodes;
  const stripY = 20;
  const railY = 88;
  const railH = 34;
  // Until a node fails the rail shows LCM's plan, so nothing gives the failure away. From the
  // failure on it shows the new plan, with LCM holding.
  const failAt = sim.unhealthy?.[0] ?? Infinity;
  const hit = view.t >= failAt;
  const rail = hit ? sim : plan;
  const end = rail.end || 1;
  const X = (t: number) => 10 + (Math.min(t, end) / end) * (W - 20);

  // Stages before the rolling part. The simulation starts at the pre-checks, so Inventory is already done.
  const preEnd = sim.csegs[0].end;
  const stageEnd = sim.csegs.find((c) => c.kind === 'stage')?.end ?? preEnd;
  const stageNow = view.done ? 5 : view.t < preEnd ? 2 : view.t < stageEnd ? 3 : 4;

  const perRow = n <= 4 ? n : n <= 16 ? 4 : 8;
  const rows = Math.ceil(n / perRow);
  const gap = 14;
  const nodeW = Math.min(240, (W - 20 - gap * (perRow - 1)) / perRow);
  const rowW = perRow * nodeW + (perRow - 1) * gap;
  const x0 = (W - rowW) / 2;
  const vmW = 38;
  const vmH = 20;
  const vmGap = 4;
  const vmCols = Math.max(1, Math.floor((nodeW - 20 + vmGap) / (vmW + vmGap)));
  const maxVmRows = Math.max(1, ...Array.from({ length: n }, (_, i) => Math.ceil(view.vms.filter((v) => v.node === i).length / vmCols)));
  const vmTop = 108;
  const nodeH = vmTop + Math.min(4, maxVmRows) * (vmH + vmGap) + 6;
  const top = railY + railH + 54;
  const H = top + rows * (nodeH + gap) + 22;
  const nodePos = (i: number) => ({ x: x0 + (i % perRow) * (nodeW + gap), y: top + Math.floor(i / perRow) * (nodeH + gap) });

  // VM slots per node
  const slotOf = new Map<number, { x: number; y: number }>();
  for (let i = 0; i < n; i++) {
    const here = view.vms.filter((v) => v.node === i);
    const p = nodePos(i);
    here.forEach((v, k) => {
      slotOf.set(v.id, { x: p.x + 10 + (k % vmCols) * (vmW + vmGap), y: p.y + vmTop + Math.min(3, Math.floor(k / vmCols)) * (vmH + vmGap) });
    });
  }

  const failX = hit ? X(failAt) : null;
  const repairX = sim.repairAt !== null && view.t >= sim.repairAt ? X(sim.repairAt) : null;
  const playX = X(view.t);
  const batchSpans = rail.batches.map((b) => {
    const segs = b.scope === 'cluster' ? rail.csegs.filter((c) => c.batch === b.id) : [...rail.csegs.filter((c) => c.batch === b.id), ...rail.segs.filter((s) => s.batch === b.id)];
    if (!segs.length) return null;
    return { b, a: Math.min(...segs.map((s) => s.start)), z: Math.max(...segs.map((s) => s.end)) };
  });

  let sx = 10;
  return (
    <svg class="diagram lcm-dia" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: `${W}px` }} role="img" aria-label={`Rolling upgrade of ${n} nodes. ${view.resiliency.text}`}>
      <text x={10} y={13} class="d-sub muted">
        Stages of an LCM run
      </text>
      {STAGES.map((name, i) => {
        const x = sx;
        sx += STAGE_W[i] + 20;
        const st = i + 1 < stageNow ? 'lcm-done' : i + 1 === stageNow ? 'lcm-now' : 'lcm-todo';
        return (
          <g key={name}>
            <rect x={x} y={stripY} width={STAGE_W[i]} height={30} rx={4} class={st} />
            <text x={x + 10} y={stripY + 19} class={`d-sub ${st === 'lcm-todo' ? '' : 'lcm-on-ink'}`}>
              {st === 'lcm-done' ? '✓ ' : `${i + 1} · `}
              {name}
            </text>
          </g>
        );
      })}
      <text x={10} y={railY - 22} class="d-sub muted">
        The Upgrade stage, one node at a time
      </text>
      <text x={W - 10} y={railY - 22} text-anchor="end" class="d-fine muted">
        Component order follows dependencies; AOS then AHV is this example
      </text>
      {/* batch labels */}
      {batchSpans.map(
        (s) =>
          s && (
            <g key={s.b.id}>
              <line x1={X(s.a)} x2={X(s.a)} y1={railY - 6} y2={railY + railH + 4} class="lcm-tick" />
              {X(s.z) - X(s.a) > 46 && (
                <text x={X(s.a) + 4} y={railY - 4} class="d-sub">
                  {BATCH_SHORT[s.b.id]}
                </text>
              )}
            </g>
          ),
      )}
      <rect x={10} y={railY} width={W - 20} height={railH} class="bg2" stroke="var(--line-2)" />
      {rail.csegs.map((c, i) => {
        if (c.kind !== 'wait') return <rect key={`c${i}`} x={X(c.start)} y={railY + 1} width={Math.max(1, X(c.end) - X(c.start))} height={railH - 2} class={view.t >= c.end ? 'lcm-done' : view.t >= c.start ? 'lcm-now' : 'bg3'} />;
        // The hold grows as it happens: how long it lasts depends on the repair.
        if (view.t < c.start) return null;
        const a = X(c.start);
        const z = X(Math.min(view.t, c.end));
        return (
          <g key={`c${i}`}>
            <rect x={a} y={railY + 1} width={Math.max(2, z - a)} height={railH - 2} class="lcm-wait" />
            {z - a > 70 && (
              <text x={a + 6} y={railY + railH / 2 + 4} class="d-sub warn-fill">
                LCM holds
              </text>
            )}
          </g>
        );
      })}
      {rail.visits.map((v, i) => {
        const a = X(v.start);
        const z = X(v.end);
        const st = view.t >= v.end ? 'lcm-done' : view.t >= v.start ? 'lcm-now' : 'lcm-todo';
        return (
          <g key={`v${i}`}>
            <rect x={a + 0.5} y={railY + 1} width={Math.max(1, z - a - 1)} height={railH - 2} class={st} />
            {z - a > 22 && (
              <text x={(a + z) / 2} y={railY + railH / 2 + 4} text-anchor="middle" class={`d-sub ${st === 'lcm-todo' ? '' : 'lcm-on-ink'}`}>
                N{v.node + 1}
              </text>
            )}
          </g>
        );
      })}
      {rail.segs
        .filter((s) => s.aborted && view.t >= s.start)
        .map((s, i) => (
          <rect key={`ab${i}`} x={X(s.start)} y={railY + 1} width={Math.max(2, X(s.end) - X(s.start))} height={railH - 2} class="lcm-wait" />
        ))}
      {failX !== null && (
        <g>
          <line x1={failX} x2={failX} y1={railY - 8} y2={railY + railH + 18} class="bad-stroke" stroke-width={2} />
          <text x={Math.min(failX + 4, W - 120)} y={railY + railH + 16} class="d-sub bad-fill">
            ✕ N{(sim.failNode ?? 0) + 1} failed
          </text>
        </g>
      )}
      {repairX !== null && (
        <g>
          <line x1={repairX} x2={repairX} y1={railY - 8} y2={railY + railH + 18} class="ok-stroke" stroke-width={2} />
          <text x={Math.min(repairX + 4, W - 120)} y={railY + railH + 16} class="d-sub ok-fill">
            ✓ N{(sim.failNode ?? 0) + 1} repaired
          </text>
        </g>
      )}
      <line x1={playX} x2={playX} y1={railY - 10} y2={railY + railH + 6} stroke="var(--text)" stroke-width={2} />
      <text x={10} y={railY + railH + 20} class="d-fine muted">
        0:00
      </text>
      <text x={W - 10} y={railY + railH + 20} text-anchor="end" class="d-fine muted">
        {fmtDur(rail.end / 3600)}
        {rail.pausedAt !== null ? ' (paused)' : ''}
      </text>

      {/* nodes */}
      {view.nodes.map((nd) => {
        const p = nodePos(nd.id);
        const hasAhv = sim.batches.some((b) => b.id === 'ahv');
        const hasAos = sim.batches.some((b) => b.id === 'aos');
        const hasFw = sim.batches.some((b) => b.id === 'fw');
        const fwDone = nd.done.includes('fw');
        const cvmState = nd.failed ? 'down' : nd.out ? 'warn' : undefined;
        const word = nd.failed ? 'FAILED' : nd.phase === 'idle' ? 'In service' : phaseWord(nd.phase);
        const boxCls = nd.failed ? 'down' : nd.out ? 'warn' : nd.phase !== 'idle' ? 'sel' : '';
        const busy = nd.phase !== 'idle';
        const statusCls = nd.failed ? 'bad-fill' : nd.out ? 'warn-fill' : busy ? 'flow-fill' : 'muted';
        const mark = nd.failed ? '✕ ' : nd.out ? '⚠ ' : busy ? '→ ' : '';
        const cvmIo = nd.phase === 'cvm-down' || nd.phase === 'cvm-reboot' || nd.phase === 'cvm-up';
        const rolling = view.current && view.current.node === nd.id ? view.current.batch : null;
        const tagX = p.x + 72;
        const tagW = nodeW - 82;
        return (
          <g key={nd.id}>
            <rect x={p.x} y={p.y} width={nodeW} height={nodeH} class={`node-box ${boxCls}`} />
            <text x={p.x + 10} y={p.y + 22} class="d-title">
              {nd.name}
            </text>
            <text x={p.x + 10} y={p.y + 40} class={`d-sub ${statusCls}`}>
              {mark}
              {word}
            </text>
            {(hasFw || cvmIo) && (
              <text x={p.x + nodeW - 10} y={p.y + 22} text-anchor="end" class={`d-fine ${cvmIo && sim.cfg.nodes > 1 ? 'flow-fill' : 'muted'}`}>
                {cvmIo && sim.cfg.nodes > 1 ? 'I/O → other CVMs' : fwDone ? '✓ firmware' : 'firmware pending'}
              </text>
            )}
            <CvmBox x={p.x + 10} y={p.y + 50} w={56} h={22} state={cvmState} />
            {hasAos && <VerTag x={tagX} y={p.y + 50} w={tagW} name="AOS" from={COMP.aos.from} to={COMP.aos.to} done={nd.done.includes('aos')} now={rolling === 'aos'} />}
            <rect x={p.x + 10} y={p.y + 78} width={56} height={22} rx={4} class="bg3" stroke="var(--line-2)" />
            <text x={p.x + 38} y={p.y + 93} text-anchor="middle" class="d-fine">
              AHV host
            </text>
            {hasAhv && <VerTag x={tagX} y={p.y + 78} w={tagW} name="AHV" from={COMP.ahv.from} to={COMP.ahv.to} done={nd.done.includes('ahv')} now={rolling === 'ahv'} />}
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
          const fx = f.x + nodeW / 2 - vmW / 2;
          const fy = f.y + vmTop + 4;
          const p = v.moving.kind === 'restart' ? 1 : v.moving.p;
          x = fx + (dest.x - fx) * p;
          y = fy + (dest.y - fy) * p;
        }
        return <VmBox key={v.id} x={x} y={y} w={vmW} h={vmH} name={`VM${v.id + 1}`} state={v.state === 'off' ? 'down' : v.state === 'restarting' ? 'warn' : undefined} hl={!!v.moving && v.state === 'running'} />;
      })}
      {view.vms
        .filter((v) => v.moving && v.moving.kind === 'migrate')
        .slice(0, 4)
        .map((v) => {
          const f = nodePos(v.moving!.from);
          const d = slotOf.get(v.id)!;
          return <line key={`m${v.id}`} x1={f.x + nodeW / 2} y1={f.y + vmTop + 10} x2={d.x + vmW / 2} y2={d.y + vmH / 2} class="xfer" stroke-dasharray="4 3" />;
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

type TabId = 'nci' | 'k8s';
const TABS: { id: TabId; label: string }[] = [
  { id: 'nci', label: 'Nutanix cluster' },
  { id: 'k8s', label: 'Kubernetes (NKP)' },
];

export default function Lcm() {
  const [tab, setTab] = useEnum<TabId>('tab', 'nci', ['nci', 'k8s']);
  return (
    <Tabs label="What is upgraded" value={tab} tabs={TABS} onChange={setTab}>
      {tab === 'nci' ? <ClusterUpgrade /> : <K8sUpgrade />}
    </Tabs>
  );
}
