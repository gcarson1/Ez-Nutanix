// LCM Rolling Upgrade: inventory, selection with dependency ordering, pre-checks that gate
// the run, then one node at a time with VMs moving, a live resiliency indicator and a flat
// workload-impact meter. All behavior comes from src/engine/lcm.ts.
import { useMemo } from 'preact/hooks';
import './style.css';
import { useScenario } from '../../../state/scenario';
import { useBool, useNum, useStr } from '../../../state/route';
import { useClock, fmtClock } from '../../components/clock';
import { Chip, Field, Follow, Illus, Legend, PlayBar, Seg, Slider, Stat, Tip, Toggle, fmtDur, type Tone } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { go } from '../../shell/nav';
import {
  ALL_COMPS,
  COMP,
  COMPONENTS,
  DEFAULT_MINUTES,
  FW_SINGLE_NODE,
  lcmStateAt,
  simulateLcm,
  type BatchId,
  type CompId,
  type LcmSim,
  type LcmView,
  type Resil,
} from '../../../engine/lcm';

const DEFAULT_SEL = 'aos,ahv,bmc,bios';
const RES_TONE: Record<Resil, Tone> = { ok: 'ok', reduced: 'warn', resync: 'warn', unavailable: 'bad', degraded: 'bad', offline: 'bad' };
const RES_WORD: Record<Resil, string> = {
  ok: 'Resiliency OK',
  reduced: 'Reduced',
  resync: 'Resyncing',
  unavailable: 'Data at risk',
  degraded: 'Not OK',
  offline: 'Planned outage',
};
const BATCH_SHORT: Record<BatchId, string> = { foundation: 'Foundation', aos: 'AOS', ahv: 'AHV', fw: 'Firmware', ncc: 'NCC' };

export default function Lcm() {
  const { cfg: sc, set } = useScenario();
  const [selStr, setSelStr] = useStr('sel', DEFAULT_SEL);
  const [aosm, setAosm] = useNum('aosm', DEFAULT_MINUTES.aos, 5, 60);
  const [ahvm, setAhvm] = useNum('ahvm', DEFAULT_MINUTES.ahv, 10, 90);
  const [fwm, setFwm] = useNum('fwm', DEFAULT_MINUTES.fw, 15, 120);
  const [rsm, setRsm] = useNum('rsm', DEFAULT_MINUTES.resync, 1, 30);
  const [deg, setDeg] = useBool('deg', false);
  const [wit, setWit] = useBool('wit', true);
  const [off, setOff] = useBool('off', false);
  const [fa, setFa] = useNum('fa', -1);
  const [fn, setFn] = useNum('fn', -1);
  const [fr, setFr] = useNum('fr', -1);

  const nodes = sc.nodes;
  const rf = (sc.rf === 3 && nodes >= 5 ? 3 : 2) as 2 | 3;
  const vms = Math.min(sc.vms, nodes * 6);
  const selected = selStr.split(',').filter((s): s is CompId => (ALL_COMPS as string[]).includes(s));

  const sim = useMemo(
    () =>
      simulateLcm({
        nodes,
        rf,
        vms,
        memLoadPct: sc.vmMemLoadPct,
        selected,
        minutes: { aos: aosm, ahv: ahvm, fw: fwm, resync: rsm },
        degraded: deg,
        witness: wit,
        vmsShutDown: off,
        fail: fa >= 0 && fn >= 0 ? { at: fa, node: fn } : null,
        repairAt: fr >= 0 ? fr : null,
      }),
    [nodes, rf, vms, sc.vmMemLoadPct, selStr, aosm, ahvm, fwm, rsm, deg, wit, off, fa, fn, fr],
  );
  const clock = useClock({ rate: Math.max(1, sim.end / 60), duration: sim.end, stepSize: Math.max(1, sim.end / 60), keys: true });
  const view = lcmStateAt(sim, clock.t);
  const series = useMemo(() => impactSeries(sim), [sim]);

  const clearFail = () => {
    setFa(-1);
    setFn(-1);
    setFr(-1);
  };
  const toggleComp = (id: CompId) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelStr(ALL_COMPS.filter((c) => s.has(c)).join(',') || 'none');
    clearFail();
  };
  const started = !sim.blocked && clock.t >= sim.csegs[0].end;
  const failActive = sim.failNode !== null;
  const breakWhy = nodes < 2
    ? 'A single-node cluster has no other node to fail.'
    : sim.blocked
      ? 'The upgrade has not started: pre-checks failed.'
      : !started
        ? 'Press Play first; the failure is injected at the current point in the upgrade.'
        : view.done
          ? 'The upgrade has finished. Scrub back to a point mid-upgrade.'
          : failActive
            ? null
            : null;
  const doBreak = () => {
    const cur = view.current?.node ?? -1;
    let f = cur >= 0 ? (cur + Math.max(1, Math.floor(nodes / 2))) % nodes : nodes - 1;
    if (f === cur) f = (f + 1) % nodes;
    setFn(f);
    setFa(Math.round(clock.t));
    setFr(-1);
  };
  const canRepair = failActive && sim.repairAt === null && clock.t > (sim.unhealthy?.[0] ?? 0);

  return (
    <>
      <FlowStrip sim={sim} view={view} />
      <div class="lab lcm-lab">
        <aside class="ctl" aria-label="Upgrade settings">
          <Field label="Nodes" tip="Cluster size from the shared scenario. Upgrades run one node at a time, so total time grows with node count." value={nodes} note={smallNote(nodes)}>
            <Slider value={nodes} min={1} max={32} label="Nodes" onChange={(v) => (set({ nodes: v }), clearFail())} />
          </Field>
          <Field label="Replication factor" tip="RF2 keeps two copies of data and tolerates one node out; RF3 keeps three and tolerates two." why={nodes < 5 ? 'RF3 needs at least 5 nodes.' : null}>
            <Seg
              label="Replication factor"
              value={rf}
              onChange={(v) => (set({ rf: v, ft: v }), clearFail())}
              options={[
                { value: 2, label: 'RF2' },
                { value: 3, label: 'RF3', disabled: nodes < 5 },
              ]}
            />
          </Field>
          <Field
            label="Updates to apply"
            tip="Choose what LCM should update. LCM adds dependencies for you and orders the work."
            why={nodes === 1 ? FW_SINGLE_NODE : null}
            note={sim.selection.added.map((a) => a.why).join(' ') || undefined}
          >
            <div class="toggles">
              {COMPONENTS.map((c) => {
                const fwBlocked = nodes === 1 && c.kind === 'firmware';
                const auto = sim.selection.added.some((a) => a.id === c.id);
                return (
                  <Toggle key={c.id} on={sim.selection.selected.includes(c.id) || auto} disabled={fwBlocked || auto} onChange={() => toggleComp(c.id)} title={fwBlocked ? FW_SINGLE_NODE : auto ? 'Added by LCM as a dependency' : c.tip}>
                    {c.label}
                  </Toggle>
                );
              })}
            </div>
          </Field>
          <Field label="VM memory load" tip="How full the hosts are. To take one host out, the others must have room for its VMs." value={`${sc.vmMemLoadPct}%`}>
            <Slider value={sc.vmMemLoadPct} min={10} max={95} label="VM memory load" onChange={(v) => (set({ vmMemLoadPct: v }), clearFail())} />
          </Field>
          <Field label="Inject a degraded cluster" tip="Simulates a failed drive whose data is still being re-protected, so data resiliency is not OK.">
            <Toggle on={deg} onChange={(v) => (setDeg(v), clearFail(), clock.reset())}>
              Degraded cluster
            </Toggle>
          </Field>
          {nodes === 2 && (
            <Field label="Witness" tip="A small VM at a separate site. Two-node clusters need it registered for LCM and any node maintenance.">
              <Toggle on={wit} onChange={(v) => (setWit(v), clock.reset())}>
                Witness registered
              </Toggle>
            </Field>
          )}
          {nodes === 1 && (
            <Field label="Guest VMs" tip="A single node has nowhere to move VMs, and its storage goes offline while the CVM is down.">
              <Toggle on={off} onChange={(v) => (setOff(v), clock.reset())}>
                I shut down all guest VMs
              </Toggle>
            </Field>
          )}
          <Field label="Break something mid-upgrade" tip="Fails a different node while the upgrade runs. LCM should stop and wait, not take another node down." why={breakWhy}>
            <div class="hstack">
              {!failActive ? (
                <button type="button" class="btn" disabled={!!breakWhy} onClick={doBreak}>
                  <Icon name="power" />
                  Fail another node now
                </button>
              ) : (
                <>
                  <button type="button" class="btn" disabled={!canRepair} onClick={() => setFr(Math.round(clock.t))} title={canRepair ? 'Bring the failed node back' : 'Already repaired, or scrub past the failure first'}>
                    <Icon name="rebuild" />
                    Repair N{(sim.failNode ?? 0) + 1}
                  </button>
                  <button type="button" class="tbtn" onClick={clearFail}>
                    Clear failure
                  </button>
                </>
              )}
            </div>
          </Field>
          <Field label="Per-node time" tip="Rough times per node, adjustable. There are no current official figures; defaults follow older Nutanix-employee estimates." note={<Illus why="Durations are assumptions, not measurements. Real times depend on hardware, load, VM count and version." />}>
            <div class="lcm-durs">
              <DurRow label="AOS" v={aosm} min={5} max={60} set={setAosm} />
              <DurRow label="AHV" v={ahvm} min={10} max={90} set={setAhvm} />
              <DurRow label="Firmware" v={fwm} min={15} max={120} set={setFwm} />
              <DurRow label="Resync wait" v={rsm} min={1} max={30} set={setRsm} />
            </div>
          </Field>
        </aside>

        <section class="stage" aria-label="Rolling upgrade">
          <PlayBar clock={clock} label="Upgrade timeline" />
          <div class="diagram-scroll">
            <UpgradeDiagram sim={sim} view={view} />
          </div>
          <Legend
            items={[
              { color: 'var(--ink)', label: 'CVM running' },
              { color: 'var(--warn)', label: 'Out of service for the upgrade' },
              { color: 'var(--bad)', label: 'Failed, or VM off' },
              { color: 'var(--flow)', label: 'Current step · VM moving' },
              { color: 'var(--warn)', dashed: true, label: 'LCM waiting' },
            ]}
          />
          <Outcome sim={sim} view={view} />
        </section>

        <aside class="rail" aria-label="Live status">
          <div class="side-sec">
            <div class="eyebrow">
              <Tip text="Whether every piece of data has its full set of copies, and how many more node failures the cluster could absorb right now." detail="LCM moves to the next node only when Data Resiliency is back to Normal.">
                Data resiliency
              </Tip>
            </div>
            <div style={{ marginTop: 'var(--sp-2)' }}>
              <Chip lg tone={RES_TONE[view.resiliency.state]}>
                {RES_WORD[view.resiliency.state]}
              </Chip>
            </div>
            <p class="small lcm-res-text">{view.resiliency.text}</p>
            <Stat k="Nodes out of service" v={view.nodes.filter((n) => n.out || n.failed).length} />
            <Stat k="Failures tolerable now" v={view.resiliency.tolerable} tone={view.resiliency.tolerable > 0 ? 'ok' : 'warn'} />
          </div>
          <div class="side-sec">
            <div class="eyebrow">Now</div>
            <p class="lcm-now">{nowText(sim, view)}</p>
          </div>
          <div class="side-sec">
            <div class="eyebrow">
              <Tip text="Cumulative VM downtime and time with data possibly unavailable. A planned rolling upgrade on three or more nodes keeps it flat at zero.">Workload impact</Tip>
            </div>
            <div class="bignum" style={{ marginTop: 'var(--sp-2)' }}>
              {Math.round(view.impact.vmDownMin + view.impact.unavailMin)}
              <small>impact-minutes</small>
            </div>
            <ImpactMeter series={series} t={clock.t} end={sim.end} />
            <Stat k="Live migrations" v={view.impact.migrations} tip="VMs moved off and back while staying online." />
            <Stat k="VM downtime" v={`${Math.round(view.impact.vmDownMin)} VM-min`} tone={view.impact.vmDownMin > 0 ? 'bad' : 'ok'} />
            <Stat k="Data unavailable" v={`${Math.round(view.impact.unavailMin)} min`} tone={view.impact.unavailMin > 0 ? 'bad' : 'ok'} />
          </div>
          <div class="side-sec">
            <div class="eyebrow">Event log</div>
            <ul class="events" aria-live="polite">
              {view.events
                .slice(-14)
                .reverse()
                .map((e, i) => (
                  <li key={`${e.t}-${i}`}>
                    <span class="t">{fmtClock(e.t)}</span>
                    <Icon name={e.kind === 'ok' ? 'ok' : e.kind === 'bad' ? 'bad' : e.kind === 'warn' ? 'warn' : e.kind === 'flow' ? 'flow' : 'info'} />
                    <span class={e.kind === 'bad' ? 'bad-text' : e.kind === 'warn' ? 'warn-text' : ''}>{e.text}</span>
                  </li>
                ))}
            </ul>
          </div>
        </aside>
      </div>

      <div class="cols-3 lcm-panels">
        <Inventory sim={sim} />
        <PreChecks sim={sim} />
        <Plan sim={sim} />
      </div>
      <SmallClusters nodes={nodes} />
    </>
  );
}

function DurRow({ label, v, min, max, set }: { label: string; v: number; min: number; max: number; set: (n: number) => void }) {
  return (
    <label class="lcm-dur">
      <span class="spread small">
        <span>{label}</span>
        <span class="mono">{v} min</span>
      </span>
      <Slider value={v} min={min} max={max} label={`${label} minutes per node`} onChange={set} />
    </label>
  );
}

function smallNote(n: number): string | undefined {
  if (n === 1) return 'Single node: AOS and AHV only, with all guest VMs shut down first. No firmware through LCM.';
  if (n === 2) return 'Two nodes: needs a registered Witness. The cluster stays up but each node takes longer to resync.';
  if (n === 3) return 'Three nodes is the usual minimum for a normal rolling upgrade. With RF2, no spare tolerance while a node is out.';
  return undefined;
}

// ── the UI flow strip: where we are in the LCM workflow ──
function FlowStrip({ sim, view }: { sim: LcmSim; view: LcmView }) {
  const preEnd = sim.csegs[0].end;
  const stage = sim.blocked ? (view.t >= preEnd ? 2 : 2) : view.t < preEnd ? 2 : view.done ? 6 : 5;
  const steps = ['Inventory', 'Select updates', 'Pre-checks', 'View Upgrade Plan', 'Apply Updates', 'Node by node', 'Done'];
  return (
    <ol class="lcm-flow" aria-label="LCM workflow">
      {steps.map((s, i) => {
        const st = sim.blocked && i === 2 ? 'bad' : i < stage ? 'done' : i === stage ? 'now' : 'todo';
        return (
          <li key={s} class={`lcm-flow-${st}`} aria-current={i === stage ? 'step' : undefined}>
            <span class="n">{st === 'done' ? <Icon name="check" /> : st === 'bad' ? <Icon name="x" /> : i + 1}</span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}

function nowText(sim: LcmSim, v: LcmView): string {
  if (sim.blocked) return `LCM will not start. ${sim.blockReasons[0] ?? ''}`;
  if (v.done) return 'All selected updates are complete.';
  if (v.paused) return `Paused. Data resiliency is not Normal, so LCM waits and takes no other node out of service.${sim.repairAt === null ? ' Repair the failed node to continue.' : ''}`;
  if (v.current) return `${v.nodes[v.current.node].name} · ${BATCH_SHORT[v.current.batch]}: ${v.current.label}`;
  if (v.cluster) return v.cluster.label + (v.cluster.kind === 'precheck' ? ': health, resiliency, capacity and connectivity.' : '.');
  if (v.t === 0) return 'Press Play (Space) to apply the updates.';
  return 'Between steps.';
}

// ── impact meter ──
function impactSeries(sim: LcmSim): [number, number][] {
  const out: [number, number][] = [];
  const N = 80;
  for (let i = 0; i <= N; i++) {
    const t = (sim.end * i) / N;
    const v = lcmStateAt(sim, t);
    out.push([t, v.impact.vmDownMin + v.impact.unavailMin]);
  }
  return out;
}

function ImpactMeter({ series, t, end }: { series: [number, number][]; t: number; end: number }) {
  const W = 260;
  const H = 56;
  const max = Math.max(10, ...series.map((s) => s[1]));
  const x = (tt: number) => (end ? (tt / end) * W : 0);
  const y = (v: number) => H - 4 - (v / max) * (H - 10);
  const pts = series.filter((s) => s[0] <= t);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const bad = last && last[1] > 0;
  return (
    <svg class="lcm-meter" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={bad ? 'Workload impact has risen' : 'Workload impact is flat at zero'}>
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} class="lcm-axis" />
      <line x1={x(t)} x2={x(t)} y1={0} y2={H} class="lcm-axis dash" />
      {d && <path d={d} class={bad ? 'lcm-line-bad' : 'lcm-line-ok'} fill="none" stroke-width={3} />}
    </svg>
  );
}

// ── main diagram: progress rail + nodes with VMs ──
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
  const batchSpans = sim.batches.map((b) => {
    const segs = b.scope === 'cluster' ? sim.csegs.filter((c) => c.batch === b.id) : [...sim.csegs.filter((c) => c.batch === b.id), ...sim.segs.filter((s) => s.batch === b.id)];
    if (!segs.length) return null;
    return { b, a: Math.min(...segs.map((s) => s.start)), z: Math.max(...segs.map((s) => s.end)) };
  });

  return (
    <svg class="diagram lcm-dia" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rolling upgrade of ${n} nodes. ${view.resiliency.text}`}>
      <text x={10} y={13} class="muted lcm-cap">
        PROGRESS RAIL · ONE NODE AT A TIME
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
        <rect key={`c${i}`} x={X(c.start)} y={railY + 1} width={Math.max(1, X(c.end) - X(c.start))} height={railH - 2} class={c.kind === 'wait' ? 'lcm-wait' : view.t >= c.end ? 'lcm-done' : view.t >= c.start ? 'lcm-now' : 'bg3'} />
      ))}
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
        const word = nd.failed ? 'FAILED' : nd.phase === 'idle' ? 'In service' : phaseWord(nd.phase);
        const boxCls = nd.failed ? 'down' : nd.out ? 'warn' : nd.phase !== 'idle' ? 'sel' : '';
        const busy = nd.phase !== 'idle';
        const statusCls = nd.failed ? 'bad-fill' : nd.out ? 'warn-fill' : busy ? 'flow-fill' : 'muted';
        const mark = nd.failed ? '✕ ' : nd.out ? '⚠ ' : busy ? '→ ' : '';
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

// ── outcome blocks under the diagram ──
function Outcome({ sim, view }: { sim: LcmSim; view: LcmView }) {
  if (sim.blocked) {
    return (
      <Follow tone="bad" k="LCM blocked the upgrade">
        <ul class="lcm-list">
          {sim.blockReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p class="rest">Nothing was changed. Fix the cause, run the pre-checks again, then apply.</p>
      </Follow>
    );
  }
  if (view.paused) {
    return (
      <Follow tone="warn" k="LCM paused, not compounding the problem">
        <p>
          A different node failed during the upgrade. LCM finishes bringing the node it was working on back into service, then waits. It takes no other node down until data resiliency is Normal again.
          <Illus why="Inferred from documented behavior: LCM waits until a problem is resolved and moves to the next node only when Data Resiliency is Normal. No document describes this exact scenario." />
        </p>
        {sim.unavailable.length > 0 && (
          <p class="rest bad-text">
            With {sim.cfg.nodes === 2 ? 'two nodes' : 'RF2'}, an upgrade node and a failed node out at the same time is more than the cluster tolerates, so some data may have been unavailable until a node returned. LCM updates have no automatic rollback.
          </p>
        )}
        {sim.repairAt === null && <p class="rest">Use “Repair” in the controls to bring the failed node back and watch LCM resume.</p>}
      </Follow>
    );
  }
  if (view.done) {
    const total = (sim.doneAt ?? sim.end) - 0;
    const rows = sim.selection.selected.map((id) => COMP[id]);
    return (
      <Follow tone={view.impact.vmDownMin + view.impact.unavailMin > 0 ? 'warn' : 'ok'} k="Upgrade complete">
        <table class="tbl lcm-sum">
          <thead>
            <tr>
              <th>Component</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.label}</td>
                <td class="mono">{c.from}</td>
                <td class="mono">{c.to}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          {sim.cfg.nodes} node{sim.cfg.nodes === 1 ? '' : 's'} in {fmtDur(total / 3600)} <Illus why="Total time comes from the per-node assumptions in the controls." />. {view.impact.migrations} live migrations.{' '}
          {sim.cfg.nodes === 1
            ? `VMs were off for the whole upgrade (${Math.round(view.impact.vmDownMin)} VM-minutes): a single node has nowhere to move them.`
            : view.impact.vmDownMin + view.impact.unavailMin > 0
              ? `Workload impact came from the unplanned failure, not from the upgrade: ${Math.round(view.impact.vmDownMin)} VM-minutes of downtime.`
              : 'No VM downtime: every VM live-migrated and stayed online.'}
        </p>
      </Follow>
    );
  }
  return null;
}

function Inventory({ sim }: { sim: LcmSim }) {
  return (
    <div>
      <h2 class="sec-h">1 · Inventory</h2>
      <p class="small muted">LCM scans what is installed and what is available.</p>
      <table class="tbl">
        <thead>
          <tr>
            <th>Component</th>
            <th>Installed</th>
            <th>Available</th>
          </tr>
        </thead>
        <tbody>
          {COMPONENTS.map((c) => {
            const on = sim.selection.selected.includes(c.id);
            return (
              <tr key={c.id} class={on ? '' : 'lcm-dim'}>
                <td>
                  {on ? <Icon name="check" /> : null} <Tip text={c.tip}>{c.label}</Tip>
                </td>
                <td class="mono">{c.from}</td>
                <td class="mono">{c.to}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p class="field-note" style={{ marginTop: 'var(--sp-2)' }}>
        AOS 7.6 and AHV 11.2 are the July 2026 releases. “Installed / newer” are placeholders for versions that vary by cluster. <Illus why="Version labels are examples. Your inventory shows the exact versions for your hardware and software." />
      </p>
    </div>
  );
}

function PreChecks({ sim }: { sim: LcmSim }) {
  return (
    <div>
      <h2 class="sec-h">2 · Pre-checks</h2>
      <p class="small muted">If any check fails, nothing runs.</p>
      <ul class="lcm-checks">
        {sim.checks.map((c) => (
          <li key={c.id} class={c.ok ? '' : 'bad'}>
            <span class={c.ok ? 'ok-text' : 'bad-text'}>
              <Icon name={c.ok ? 'ok' : 'bad'} />
            </span>
            <span>
              <Tip text={c.detail} detail={c.simulated ? 'Simulated check: a stand-in for the maintenance-mode capacity requirement, not a named LCM pre-check.' : `Check name: ${c.name}`}>
                {c.label}
              </Tip>
              <span class="sr-only">{c.ok ? ' passed' : ' failed'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Plan({ sim }: { sim: LcmSim }) {
  return (
    <div>
      <h2 class="sec-h">3 · Upgrade plan</h2>
      <p class="small muted">The order this run uses, and why.</p>
      {sim.batches.length === 0 ? (
        <p class="muted">Nothing selected.</p>
      ) : (
        <ol class="lcm-plan">
          {sim.batches.map((b) => (
            <li key={b.id}>
              <strong>{b.label}</strong> <span class="small muted">({b.comps.map((c) => COMP[c].label).join(', ')}) · {b.scope === 'cluster' ? 'cluster-wide, no node out' : b.scope === 'cvm' ? 'one CVM at a time, VMs stay put' : 'one host at a time, VMs move'}</span>
              <div class="small">{b.why}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SmallClusters({ nodes }: { nodes: number }) {
  const items = [
    { k: '1 node', on: nodes === 1, t: 'AOS and AHV upgrade through LCM, but you shut all guest VMs down first: the only CVM and host go down and storage is offline meanwhile. LCM does not do firmware here, and the host is never put into maintenance mode.' },
    { k: '2 nodes', on: nodes === 2, t: 'Works much like a larger cluster and stays up, but needs a registered Witness. Each node takes longer because data resyncs as the cluster moves between single-node and two-node state.' },
    { k: '3+ nodes', on: nodes >= 3, t: 'The normal rolling upgrade. On a 3-node RF2 cluster there is no spare fault tolerance while a node is out, which is why LCM insists resiliency is OK first.' },
  ];
  return (
    <>
      <h2 class="sec-h">Small clusters and Prism Central</h2>
      <div class="cols-3 lcm-small-grid">
        {items.map((i) => (
          <div key={i.k} class={`lcm-card${i.on ? ' on' : ''}`}>
            <div class="eyebrow">
              {i.k}
              {i.on ? ' · this cluster' : ''}
            </div>
            <p class="small">{i.t}</p>
          </div>
        ))}
      </div>
      <p class="field-note" style={{ marginTop: 'var(--sp-3)' }}>
        Prism Central itself upgrades only through LCM (Admin Center › LCM › Prism Central Cluster). It can also run LCM for registered clusters on AOS 7.0.1.6 or later with pc.7.3 or later, and upgrade different clusters in parallel; inside each cluster nodes still go one at a time.{' '}
        <button type="button" class="tbtn" onClick={() => go('central')}>
          Fleet view in Nutanix Central <Icon name="arrow" />
        </button>
      </p>
    </>
  );
}
