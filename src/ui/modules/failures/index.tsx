// Failure Gauntlet: pick a failure (or click anything to break it), then watch detection,
// workload continuity and self-healing on a scrubbable timeline. Optional side-by-side
// runs of the same failure script on RF2 vs RF3, or with failure-domain awareness off vs on.
import type { ComponentChildren } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import '../cluster-lab/style.css';
import { useScenario } from '../../../state/scenario';
import { useEnum, useNum, useStr, setParams } from '../../../state/route';
import { createCluster, blockCount, type ClusterConfig, type ClusterState } from '../../../engine/cluster';
import { rfAllowed, blockAwareAllowed, rackAwareAllowed, type RF } from '../../../engine/rules';
import { deriveStatus, type ClusterStatus } from '../../../engine/status';
import { haReserveAllowed, haReserveHosts } from '../../../engine/rebuild';
import { rebuildEstimateHours } from '../../../engine/capacity';
import { decodeActs, encodeActs, scriptActs, describeAct, insights, scoreRun, type Act, type ScriptId } from '../../../engine/timeline';
import { useClock } from '../../components/clock';
import { Field, Seg, Toggle, Slider, Tip, Illus, PlayBar, Chip, Stat, fmtTB, fmtDur } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { go } from '../../shell/nav';
import { ClusterDiagram, type Sel } from '../cluster-lab/ClusterDiagram';
import { StatusRail, EventLog, healthTone, resiliencyLine } from '../cluster-lab/StatusRail';
import { Inspector } from '../cluster-lab/Inspector';
import { TimeStrip } from '../cluster-lab/TimeStrip';
import { ActionChips, DiagramLegend } from '../cluster-lab/index';
import { useMaybeTimeline, usePersistedTime, clockRate, fmtT, snap, HORIZON } from '../cluster-lab/sim';

interface Script {
  id: ScriptId;
  label: string;
  blurb: string;
  needs?: (c: ClusterConfig) => { why: string; patch: Partial<ClusterConfig> } | null;
}

const SCRIPTS: Script[] = [
  { id: 'disk', label: 'Drive failure', blurb: 'One drive dies. The copies it held are rebuilt from the other copies, with every node helping.' },
  {
    id: 'cvm',
    label: 'CVM only',
    blurb: 'The CVM stops for 15 minutes. The host and its VMs keep running; their I/O goes to other CVMs over the network, with some extra latency.',
  },
  { id: 'node', label: 'Node power-off', blurb: 'HA restarts its VMs on other hosts, and every surviving node helps re-protect its data.' },
  { id: 'partition', label: 'Network partition', blurb: 'One node loses its links to the others. The cluster treats it as failed: its VMs restart elsewhere.' },
  {
    id: 'block',
    label: 'Block failure',
    blurb: 'A whole chassis loses power. All data stays available only if copies were kept in different blocks.',
    needs: (c) => (c.nodesPerBlock < 2 ? { why: 'A block failure needs blocks that hold more than one node.', patch: { nodesPerBlock: 2 } } : null),
  },
  {
    id: 'rack',
    label: 'Rack failure',
    blurb: 'A rack goes dark. All data stays available only with rack awareness and enough racks.',
    needs: (c) => (c.racks < 2 ? { why: 'A rack failure needs the blocks spread over more than one rack.', patch: { racks: 3 } } : null),
  },
  { id: 'double', label: 'Two nodes at once', blurb: 'Two nodes fail together. RF2 keeps two copies, so some data loses both; RF3 keeps three.' },
  {
    id: 'second',
    label: 'Second failure during rebuild',
    blurb: 'A node fails, and 20 minutes into the rebuild a second one fails. This is the RF2 risk window.',
  },
  {
    id: 'full',
    label: 'Nearly full cluster',
    blurb: 'A node fails when drives are about 85% full. The survivors have no room for the missing copies.',
    needs: (c) => (c.fillPct < 80 ? { why: 'This scenario needs drives about 85% full.', patch: { fillPct: 85 } } : null),
  },
  {
    id: 'small',
    label: '3-node: too few survivors',
    blurb: 'A 3-node cluster loses a node. Data is re-protected on the two survivors, but metadata and configuration need 3 nodes to take another failure.',
    needs: (c) => (c.nodes !== 3 ? { why: 'This scenario uses a 3-node cluster.', patch: { nodes: 3, nodesPerBlock: 1, rf: 2, ft: 2, blockAware: false, racks: 1, rackAware: false, ecx: false } } : null),
  },
  {
    id: 'twonode',
    label: 'Two-node edge',
    blurb: 'One of two nodes fails. The Witness confirms it, the survivor runs in single-node mode and re-protects data on its own drives.',
    needs: (c) => (c.nodes !== 2 ? { why: 'This scenario uses a 2-node cluster.', patch: { nodes: 2, nodesPerBlock: 1, rf: 2, ft: 2, blockAware: false, racks: 1, rackAware: false, ecx: false, vmMemLoadPct: 40 } } : null),
  },
  { id: 'game', label: 'Gauntlet game', blurb: 'Random failures from a seeded sequence. Respond by bringing nodes back, replacing drives or adding a node. Scored on availability and self-healing.' },
  { id: 'free', label: 'Free play', blurb: 'No script. Click a node, CVM or drive to break it, several at once if you like.' },
];
const IDS = SCRIPTS.map((x) => x.id);

type Cmp = 'off' | 'rf' | 'aware';

// ── phases: failure → detection → workloads → re-protection → outcome ──
type PhaseState = 'done' | 'now' | 'todo' | 'bad' | 'warn';
interface Phase {
  k: string;
  v: string;
  st: PhaseState;
}

function phasesFor(s: ClusterState, st: ClusterStatus, acts: Act[], t: number): Phase[] {
  const fails = acts.filter((a) => a.k === 'fail' && a.t <= t + 1e-9).sort((a, b) => a.t - b.t);
  const next = acts.filter((a) => a.k === 'fail' && a.t > t).sort((a, b) => a.t - b.t)[0];
  if (!fails.length) {
    return [
      { k: 'Failure', v: next ? `${describeAct(next)} at ${fmtT(next.t)}. Press Play.` : 'Click a node, CVM or drive to break it.', st: 'now' },
      { k: 'Detection', v: 'Heartbeats and I/O errors reveal what failed.', st: 'todo' },
      { k: 'Workloads', v: 'VMs keep running or are restarted by HA.', st: 'todo' },
      { k: 'Re-protection', v: 'Missing copies are rebuilt across the cluster.', st: 'todo' },
      { k: 'Outcome', v: 'Back to full resiliency, or a clear reason why not.', st: 'todo' },
    ];
  }
  const f = fails[fails.length - 1] as Extract<Act, { k: 'fail' }>;
  const out: Phase[] = [{ k: 'Failure', v: `${describeAct(f)} at ${fmtT(f.t)}${fails.length > 1 ? ` (${fails.length} failures so far)` : ''}.`, st: 'done' }];
  const detected = f.f.kind === 'disk' || s.events.some((e) => e.kind === 'detect' && e.t >= f.t);
  out.push({
    k: 'Detection',
    v: f.f.kind === 'disk' ? 'The storage service sees the drive errors at once and marks it offline.' : detected ? 'Heartbeats stopped; the cluster marked it down.' : 'Waiting for missed heartbeats…',
    st: detected ? 'done' : 'now',
  });
  const recs = (s.ha || []).filter((r) => r.failedAt >= f.t - 1e-9 || r.restartedAt === null);
  const waiting = recs.filter((r) => r.restartedAt === null && !r.failed).length;
  const failedVms = s.vms.filter((v) => v.state === 'failed').length;
  let work: Phase;
  if (f.f.kind === 'disk') work = { k: 'Workloads', v: 'No VM impact: reads use the other copy.', st: 'done' };
  else if (f.f.kind === 'cvm') work = { k: 'Workloads', v: 'VMs keep running on the host. Their I/O is served by other CVMs over the network.', st: 'done' };
  else if (failedVms) work = { k: 'Workloads', v: `${failedVms} VM${failedVms === 1 ? '' : 's'} could not restart: no host had enough free memory.`, st: 'bad' };
  else if (waiting) work = { k: 'Workloads', v: `HA is restarting VMs: ${recs.length - waiting} of ${recs.length} back.`, st: 'now' };
  else work = { k: 'Workloads', v: recs.length ? `HA restarted ${recs.length} VM${recs.length === 1 ? '' : 's'} on other hosts.` : 'No VMs were running there.', st: 'done' };
  if (!detected) work.st = 'todo';
  out.push(work);
  const heal = st.selfHeal;
  let rp: Phase;
  if (st.items.unavailable > 0) rp = { k: 'Re-protection', v: `${st.items.unavailable} sampled items have no copy online. Nothing can rebuild them until a copy returns.`, st: 'bad' };
  else if (heal.state === 'blocked') rp = { k: 'Re-protection', v: `Stuck at ${Math.round(heal.progress * 100)}%: ${(heal.reason || '').split(' Fix:')[0]}`, st: 'bad' };
  else if (heal.state === 'rebuilding') rp = { k: 'Re-protection', v: `${Math.round(heal.progress * 100)}% re-protected. ${fmtTB(heal.remainingGB / 1000)} still to copy.`, st: 'now' };
  else if (heal.state === 'waiting') rp = { k: 'Re-protection', v: 'About to start.', st: 'now' };
  else rp = { k: 'Re-protection', v: 'Every item has its full set of copies.', st: 'done' };
  out.push(rp);
  let oc: Phase;
  const r = resiliencyLine(st);
  if (st.resiliency === 'OK') oc = { k: 'Outcome', v: `Resiliency OK. ${r.text}.`, st: 'done' };
  else if (st.resiliency === 'Data unavailable' || st.resiliency === 'Cluster down') oc = { k: 'Outcome', v: `${r.text}. Bring a failed node back to restore access.`, st: 'bad' };
  else if (st.protectionLimit) oc = { k: 'Outcome', v: st.protectionLimit, st: 'warn' };
  else if (heal.state === 'blocked') oc = { k: 'Outcome', v: (heal.reason || '').split(' Fix: ')[1] ? `Fix: ${(heal.reason || '').split(' Fix: ')[1]}` : 'Cannot self-heal.', st: 'warn' };
  else oc = { k: 'Outcome', v: 'Not yet: resiliency is Critical until re-protection finishes.', st: 'todo' };
  out.push(oc);
  // mark the first unfinished step as "now"
  const firstOpen = out.findIndex((p) => p.st === 'now' || p.st === 'todo');
  if (firstOpen >= 0 && out[firstOpen].st === 'todo') out[firstOpen].st = 'now';
  return out;
}

const PH_ICON: Record<PhaseState, string> = { done: 'ok', now: 'rebuild', todo: 'info', bad: 'bad', warn: 'warn' };

function Phases({ list }: { list: Phase[] }) {
  return (
    <ol class="cl-phases" aria-label="What is happening">
      {list.map((p) => (
        <li key={p.k} class={p.st} aria-current={p.st === 'now' ? 'step' : undefined}>
          <span class="k">
            <Icon name={PH_ICON[p.st]} />
            {p.k}
          </span>
          <div class="v">{p.v}</div>
        </li>
      ))}
    </ol>
  );
}

function HaTable({ s }: { s: ClusterState }) {
  const recs = (s.ha || []).slice(-14);
  if (!recs.length) return <p class="cl-sub">No host has failed yet, so HA has nothing to restart. A drive or CVM failure never needs a VM restart.</p>;
  const t0 = recs[0].failedAt;
  return (
    <table class="tbl cl-ha-tbl">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>VM</th>
          <th>Was on</th>
          <th>Restarted on</th>
          <th class="num">After failure</th>
        </tr>
      </thead>
      <tbody>
        {recs.map((r) => (
          <tr key={`${r.vm}-${r.failedAt}`}>
            <td class="num">{r.order}</td>
            <td>{s.vms[r.vm]?.name}</td>
            <td>{s.nodes[r.from]?.name}</td>
            <td class={r.failed && r.restartedAt === null ? 'bad-text' : r.restartedAt === null ? 'warn-text' : ''}>
              {r.restartedAt !== null && r.to !== null ? s.nodes[r.to].name : r.failed ? 'Could not restart' : 'Waiting'}
            </td>
            <td class="num">{r.restartedAt !== null ? `${Math.round(r.restartedAt - (r.failedAt ?? t0))} s` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CompareRail({ a, b, sa, sb, la, lb }: { a: ClusterState; b: ClusterState; sa: ClusterStatus; sb: ClusterStatus; la: string; lb: string }) {
  const ia = insights(a);
  const ib = insights(b);
  const row = (k: string, va: ComponentChildren, vb: ComponentChildren) => (
    <tr>
      <td>{k}</td>
      <td class="num">{va}</td>
      <td class="num">{vb}</td>
    </tr>
  );
  return (
    <aside class="rail cl-rail" aria-label="Side-by-side status">
      <section class="side-sec">
        <h3>Same failure, two setups</h3>
        <table class="tbl">
          <thead>
            <tr>
              <th />
              <th class="num">{la}</th>
              <th class="num">{lb}</th>
            </tr>
          </thead>
          <tbody>
            {row('Health', <Chip tone={healthTone(sa.health)}>{sa.health}</Chip>, <Chip tone={healthTone(sb.health)}>{sb.health}</Chip>)}
            {row('Can tolerate now', sa.tolerable, sb.tolerable)}
            {row('Items unavailable', <span class={sa.items.unavailable ? 'bad-text' : ''}>{sa.items.unavailable}</span>, <span class={sb.items.unavailable ? 'bad-text' : ''}>{sb.items.unavailable}</span>)}
            {row('Lost every copy', ia.lostForGood, ib.lostForGood)}
            {row('Under-replicated', sa.items.under, sb.items.under)}
            {row('Re-protected', `${Math.round(sa.selfHeal.progress * 100)}%`, `${Math.round(sb.selfHeal.progress * 100)}%`)}
            {row('VMs running', `${ia.vmsRunning}/${a.vms.length}`, `${ib.vmsRunning}/${b.vms.length}`)}
            {row('Usable copies kept', a.cfg.rf === 3 ? '3' : '2', b.cfg.rf === 3 ? '3' : '2')}
          </tbody>
        </table>
      </section>
      <section class="side-sec">
        <h3>{la}: event log</h3>
        <EventLog events={a.events} max={8} />
      </section>
      <section class="side-sec">
        <h3>{lb}: event log</h3>
        <EventLog events={b.events} max={8} />
      </section>
    </aside>
  );
}

export default function Failures() {
  const { cfg, set } = useScenario();
  const [sc, setSc] = useEnum<ScriptId>('sc', 'node', IDS);
  const [ev, setEv] = useStr('ev', '');
  const [cmp, setCmp] = useEnum<Cmp>('cmp', 'off', ['off', 'rf', 'aware']);
  const [gs] = useNum('gs', 1, 1, 1e6);
  const [raid, setRaid] = useNum('raid', 0.5, 0.1, 3);
  const [sel, setSel] = useState<Sel | null>(null);
  const [hlVm, setHlVm] = useState(-1);

  const blocks = blockCount(cfg);
  const rf3 = rfAllowed(3, cfg.nodes);
  const awareTarget = cfg.racks > 1 ? 'rack' : 'block';
  const awareCheck = awareTarget === 'rack' ? rackAwareAllowed(cfg.ft, Math.min(cfg.racks, blocks), cfg.ecx) : blockAwareAllowed(cfg.ft, blocks, cfg.ecx);
  const awareWhy = cfg.nodesPerBlock === 1 && cfg.racks === 1 ? 'With one node per block and one rack, there is no larger failure domain to compare.' : !awareCheck.ok ? awareCheck.reason : null;
  const cmpOn: Cmp = cmp === 'rf' && !rf3.ok ? 'off' : cmp === 'aware' && awareWhy ? 'off' : cmp;

  const cfgA: ClusterConfig = cmpOn === 'rf' ? { ...cfg, rf: 2, ft: 2 } : cmpOn === 'aware' ? { ...cfg, blockAware: false, rackAware: false } : cfg;
  const cfgB: ClusterConfig | null =
    cmpOn === 'rf' ? { ...cfg, rf: 3, ft: 3, ecx: false } : cmpOn === 'aware' ? { ...cfg, blockAware: awareTarget === 'block', rackAware: awareTarget === 'rack' } : null;
  const la = cmpOn === 'rf' ? 'RF2' : cmpOn === 'aware' ? 'Awareness off' : '';
  const lb = cmpOn === 'rf' ? 'RF3' : cmpOn === 'aware' ? `${awareTarget === 'rack' ? 'Rack' : 'Block'} awareness on` : '';

  const keyA = JSON.stringify(cfgA);
  const s0 = useMemo(() => createCluster(cfgA), [keyA]);
  const scriptA = useMemo(() => scriptActs(sc, s0, gs), [sc, s0, gs]);
  const userActs = useMemo(() => decodeActs(ev), [ev]);
  const acts = useMemo(() => [...scriptA, ...userActs], [scriptA, userActs]);
  const actKey = `${sc}|${gs}|${encodeActs(scriptA)}|${ev}`;

  const A = useMaybeTimeline(cfgA, acts, actKey)!;
  const B = useMaybeTimeline(cfgB, acts, actKey);
  const duration = Math.max(A.duration, B?.duration ?? 0);
  const tRef = useRef(0);
  const rate = clockRate(tRef.current, acts);
  const clock = useClock({ rate: rate.rate, duration, stepSize: 30, keys: true });
  tRef.current = clock.t;
  usePersistedTime(clock);
  const sA = useMemo(() => A.tl.at(clock.t), [A.tl, clock.t]);
  const stA = useMemo(() => deriveStatus(sA), [sA]);
  const sB = useMemo(() => (B ? B.tl.at(clock.t) : null), [B?.tl, clock.t]);
  const stB = useMemo(() => (sB ? deriveStatus(sB) : null), [sB]);

  const now = snap(clock.t);
  const push = (a: Act) => setEv(encodeActs([...userActs, a]));
  const reset = () => {
    setParams({ ev: null, at: null });
    setSel(null);
    clock.reset();
  };
  const change = (patch: Partial<ClusterConfig>) => {
    set(patch);
    reset();
  };
  const script = SCRIPTS.find((x) => x.id === sc)!;
  const need = script.needs?.(cfg) ?? null;

  // HA reservation
  const haChk = haReserveAllowed(s0);
  const haHosts = haReserveHosts(s0.cfg);

  // rebuild estimate for the first failure in the script
  const firstFail = acts.filter((a) => a.k === 'fail').sort((a, b) => a.t - b.t)[0];
  const est = useMemo(() => {
    if (!firstFail) return null;
    const s1 = A.tl.at(firstFail.t);
    const st1 = deriveStatus(s1);
    const survivors = s1.nodes.filter((n) => n.state === 'up').length;
    return { dataTB: st1.selfHeal.remainingGB / 1000, survivors };
  }, [A.tl, firstFail?.t]);
  const evs = A.tl.frontState.events;
  const started = firstFail ? evs.find((e) => e.kind === 'rebuild' && e.t >= firstFail.t) : undefined;
  const finished = started ? evs.find((e) => e.kind === 'ok' && /Re-protection complete/.test(e.text) && e.t >= started.t) : undefined;
  const estH = est ? rebuildEstimateHours(est.dataTB, est.survivors, cfg.rebuildTBph) : null;
  // A node or CVM coming back makes its copies usable again, which ends re-protection early.
  const cutShort = started && finished ? acts.some((a) => a.k === 'recover' && a.t >= started.t && a.t <= finished.t) : false;

  // many-to-many vs one spare drive, for one failed drive of this cluster
  const driveDataTB = (cfg.driveTB * cfg.fillPct) / 100;
  const dsfH = rebuildEstimateHours(driveDataTB, Math.max(1, cfg.nodes - 1), cfg.rebuildTBph);
  const raidH = rebuildEstimateHours(driveDataTB, 1, raid);
  const maxH = Math.max(dsfH, raidH);

  // game score
  const score = sc === 'game' ? scoreRun(A.tl.samples, Math.min(clock.t, A.computed)) : null;

  const diagramA = useMemo(
    () => <ClusterDiagram s={sA} sel={sel} hlVm={hlVm} compact={!!cfgB} onSel={(x) => (x.k === 'vm' ? (setSel(x), setHlVm(x.id)) : setSel(x))} label={cfgB ? `${la} cluster` : undefined} />,
    [sA, sel, hlVm, !!cfgB, la],
  );
  const diagramB = useMemo(() => (sB ? <ClusterDiagram s={sB} compact label={`${lb} cluster`} onSel={(x) => setSel(x)} sel={sel} hlVm={hlVm} /> : null), [sB, sel, hlVm, lb]);

  return (
    <div class="lab">
      <div class="ctl" aria-label="Failure scenario">
        <Field label="Scenario" tip="Each scenario is a short failure script. It plays on the cluster set up below, and you can add more failures by clicking.">
          <div class="cl-scn" role="group" aria-label="Scenarios">
            {SCRIPTS.map((x, i) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={sc === x.id}
                onClick={() => {
                  setSc(x.id);
                  reset();
                }}
              >
                <span class="n">{String(i + 1).padStart(2, '0')}</span>
                {x.label}
              </button>
            ))}
          </div>
        </Field>
        <Field
          label="Compare side by side"
          tip="Run the same failure script on two setups at once, on one clock."
          why={cmp === 'rf' && !rf3.ok ? `${rf3.reason} Add nodes to compare.` : cmp === 'aware' && awareWhy ? awareWhy : null}
        >
          <Seg
            label="Compare"
            value={cmp}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'rf', label: 'RF2 vs RF3', disabled: !rf3.ok, title: rf3.reason },
              { value: 'aware', label: 'Awareness', disabled: !!awareWhy, title: awareWhy ?? undefined },
            ]}
            onChange={(v) => {
              setCmp(v as Cmp);
              setSel(null);
            }}
          />
        </Field>
        <Field label="Nodes" value={cfg.nodes}>
          <Slider value={cfg.nodes} min={2} max={32} onChange={(v) => change({ nodes: v })} label="Nodes" />
        </Field>
        <Field label="Nodes per block" value={cfg.nodesPerBlock}>
          <Seg label="Nodes per block" value={cfg.nodesPerBlock} options={[1, 2, 4].map((v) => ({ value: v, label: String(v) }))} onChange={(v) => change({ nodesPerBlock: v as 1 | 2 | 4 })} />
        </Field>
        <Field label="Racks" value={cfg.racks}>
          <Slider value={cfg.racks} min={1} max={8} onChange={(v) => change({ racks: v })} label="Racks" />
        </Field>
        <Field
          label="Failure domain awareness"
          tip="Keep copies of each piece of data in different blocks (or racks), so a whole block or rack can fail without losing access."
          why={
            cmpOn === 'aware'
              ? 'Set by the comparison: off on the left, on on the right.'
              : cfg.blockAware && s0.domain !== 'block' && s0.domain !== 'rack'
                ? `Block awareness is on but not in effect. ${blockAwareAllowed(cfg.ft, blocks, cfg.ecx).reason ?? ''}`
                : cfg.rackAware && s0.domain !== 'rack'
                  ? `Rack awareness is on but not in effect. ${rackAwareAllowed(cfg.ft, Math.min(cfg.racks, blocks), cfg.ecx).reason ?? ''}`
                  : null
          }
          note={`Copies are kept apart by ${s0.domain}.`}
        >
          <div class="toggles">
            <Toggle on={cfg.blockAware} disabled={cmpOn === 'aware'} onChange={(v) => change({ blockAware: v })}>
              Block
            </Toggle>
            <Toggle on={cfg.rackAware} disabled={cmpOn === 'aware' || cfg.racks < 2} onChange={(v) => change({ rackAware: v })}>
              Rack
            </Toggle>
          </div>
        </Field>
        <Field label="Redundancy" tip="RF2 keeps 2 copies and tolerates 1 failure. RF3 keeps 3 and tolerates 2. Both the cluster and its container are set together here." why={cmpOn === 'rf' ? 'Set by the comparison: RF2 on the left, RF3 on the right.' : !rf3.ok ? rf3.reason : null}>
          <Seg
            label="Redundancy"
            value={cfg.rf}
            options={[
              { value: 2, label: 'RF2', disabled: cmpOn === 'rf' },
              { value: 3, label: 'RF3', disabled: !rf3.ok || cmpOn === 'rf', title: rf3.reason },
            ]}
            onChange={(v) => change({ rf: v as RF, ft: v as RF })}
          />
        </Field>
        <Field label="Capacity used" value={`${cfg.fillPct}%`} tip="Self-healing needs free space on the survivors. Push this up to see a cluster that cannot re-protect itself.">
          <Slider value={cfg.fillPct} min={5} max={90} onChange={(v) => change({ fillPct: v })} label="Capacity used" />
        </Field>
        <Field label="VM memory load" value={`${cfg.vmMemLoadPct}%`} tip="How much of the hosts’ memory the VMs use. HA can only restart VMs where there is free memory.">
          <Slider value={cfg.vmMemLoadPct} min={10} max={95} onChange={(v) => change({ vmMemLoadPct: v })} label="VM memory load" />
        </Field>
        <Field
          label="HA memory reservation"
          tip="Without it, HA restarts are best effort: VMs restart if some host has free memory. With it, memory is held back so restarts after a host failure are guaranteed."
          detail={`The reservation is one host's worth of memory when every container is RF2, and two hosts' worth when the cluster or any container is RF3, sized by the largest host. Here: ${haHosts === 1 ? 'one host' : 'two hosts'}.`}
          why={!haChk.ok ? haChk.reason : null}
          note={cfg.haReserve && haChk.ok ? `Holding ${haHosts === 1 ? 'one host' : 'two hosts'}’ worth of memory back.` : 'Off: best-effort restarts.'}
        >
          <Toggle on={cfg.haReserve && haChk.ok} disabled={!haChk.ok && !cfg.haReserve} onChange={(v) => change({ haReserve: v })}>
            Guarantee restarts
          </Toggle>
        </Field>
        <Field
          label="Rebuild throughput per node"
          value={`${cfg.rebuildTBph.toFixed(1)} TB/h`}
          tip="How fast each surviving node can copy data during re-protection. An assumption to adjust, not a measured value."
          note={<Illus why="Real rebuild speed depends on drives, network, CPU, how busy the cluster is and the software version. 1 TB per hour per node is a round number for discussion." />}
        >
          <Slider value={cfg.rebuildTBph} min={0.2} max={5} step={0.1} onChange={(v) => change({ rebuildTBph: Math.round(v * 10) / 10 })} label="Rebuild throughput per node" />
        </Field>
      </div>

      <div class="stage">
        <div class="cl-row" style={{ alignItems: 'baseline' }}>
          <h2 class="sec-h" style={{ margin: 0 }}>
            {script.label}
          </h2>
          {cfgB && (
            <span class="cl-sub">
              Comparing {la} and {lb} · same script, same clock
            </span>
          )}
        </div>
        <p class="lede" style={{ marginTop: 'var(--sp-1)' }}>
          {script.blurb}
        </p>
        {need && (
          <div class="follow warn" role="note">
            <div class="follow-k">Setup needed</div>
            <p>
              {need.why}{' '}
              <button type="button" class="btn primary" onClick={() => change(need.patch)}>
                Apply suggested setup
              </button>
            </p>
          </div>
        )}
        {sc === 'game' && score && (
          <div class="follow ink" role="status" aria-live="polite">
            <div class="follow-k">Gauntlet game · round {gs}</div>
            <div class="cl-score">
              <div>
                <div class="bignum">
                  {score.points}
                  <small>/ 100</small>
                </div>
                <div class="cl-sub">{clock.t >= duration ? 'Final score' : 'Score so far'}</div>
              </div>
              <Stat k="Data available" v={`${score.dataPct.toFixed(0)}%`} tone={score.dataPct < 100 ? 'bad' : 'ok'} />
              <Stat k="VMs running" v={`${score.vmPct.toFixed(0)}%`} tone={score.vmPct < 99 ? 'warn' : 'ok'} />
              <Stat k="Fully re-protected" v={score.healed ? 'Yes' : 'Not yet'} tone={score.healed ? 'ok' : 'warn'} />
              <button
                type="button"
                class="btn"
                onClick={() => {
                  setParams({ gs: gs + 1, ev: null, at: null });
                  clock.reset();
                }}
              >
                <Icon name="reset" />
                New round
              </button>
            </div>
            <p class="rest">
              Failures arrive on their own. Respond by bringing a node back, replacing a drive or adding capacity (click a node or drive). Score: 50% for time with all data available, 30% for VMs running, 20% for ending fully re-protected. <Illus why="A teaching game. The failure sequence comes from a seeded random generator, so the same round number always gives the same failures." />
            </p>
          </div>
        )}

        <PlayBar clock={clock} scrub={false} fmt={fmtT} label="Failure timeline" extra={rate.slow && clock.playing ? <Chip tone="neutral" icon="eye">Slowed down</Chip> : undefined} />
        <TimeStrip
          samples={A.tl.samples}
          duration={duration}
          computed={A.computed}
          t={clock.t}
          acts={acts}
          events={evs}
          label={cfgB ? `Timeline (${la})` : 'Timeline'}
          onSeek={(v) => {
            clock.pause();
            clock.seek(v);
          }}
        />
        {B && (
          <TimeStrip
            samples={B.tl.samples}
            duration={duration}
            computed={B.computed}
            t={clock.t}
            acts={acts}
            events={B.tl.frontState.events}
            label={`Timeline (${lb})`}
            onSeek={(v) => {
              clock.pause();
              clock.seek(v);
            }}
          />
        )}
        <ActionChips
          acts={acts}
          t={clock.t}
          locked={scriptA.length}
          onRemove={(i) => setEv(encodeActs(userActs.filter((_, j) => j !== i - scriptA.length)))}
          onSeek={(v) => {
            clock.pause();
            clock.seek(v);
          }}
          onClear={() => setEv('')}
        />

        <Phases list={phasesFor(sA, stA, acts, clock.t)} />

        {cfgB && sB && stB ? (
          <div class="cl-cmp" style={{ marginTop: 'var(--sp-4)' }}>
            {[
              { s: sA, st: stA, l: la, d: diagramA },
              { s: sB, st: stB, l: lb, d: diagramB },
            ].map((x) => (
              <div key={x.l}>
                <h3>
                  {x.l}
                  <Chip tone={healthTone(x.st.health)}>{x.st.health}</Chip>
                  <span class={`cl-sub ${resiliencyLine(x.st).tone}-text`}>{resiliencyLine(x.st).text}</span>
                </h3>
                <div class="diagram-scroll">{x.d}</div>
                {x.st.items.unavailable > 0 && (
                  <p class="cl-sub bad-text" style={{ marginTop: 'var(--sp-1)' }}>
                    {x.st.items.unavailable} sampled items have no copy online.
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div class="diagram-scroll" style={{ marginTop: 'var(--sp-4)' }}>
            {diagramA}
          </div>
        )}
        <DiagramLegend ecx={cfg.ecx} />

        <Inspector s={sA} sel={sel} t={now} push={push} hlVm={hlVm} setHlVm={setHlVm} setSel={setSel} mode="gauntlet" />
        {cfgB && sel && <p class="cl-sub">Actions apply to both sides, so the comparison stays fair.</p>}

        {(stA.selfHeal.state === 'blocked' || stA.protectionLimit) && (
          <div class="follow bad" role="status">
            <div class="follow-k">{stA.selfHeal.state === 'blocked' ? 'Cannot self-heal' : 'Protected, but not re-protectable'}</div>
            <p>{stA.selfHeal.state === 'blocked' ? stA.selfHeal.reason : stA.protectionLimit}</p>
            <p class="rest">The cluster reports this plainly instead of showing “rebuilding” forever. Nothing is silently healed: data with no surviving copy stays unavailable until a copy comes back.</p>
          </div>
        )}

        <div class="cols-2" style={{ marginTop: 'var(--sp-6)' }}>
          <div>
            <h3 class="sec-h">
              <Tip text="When a host fails, AHV HA restarts its VMs on the remaining hosts. Restarts begin about a minute after the failure and are typically done within about two minutes.">
                HA restart order
              </Tip>{' '}
              <Illus why="The sim restarts VMs from a simple queue, on the host with the most free memory. The real scheduler weighs more factors." />
            </h3>
            <HaTable s={sA} />
            <p class="cl-sub" style={{ marginTop: 'var(--sp-2)' }}>
              {cfg.haReserve && haChk.ok
                ? `Reservation on: memory for ${haHosts === 1 ? 'one host' : 'two hosts'} is held back, so these restarts are guaranteed.`
                : 'Reservation off: restarts are best effort. Raise the VM memory load to see VMs that cannot restart, then turn the reservation on.'}
            </p>
          </div>
          <div>
            <h3 class="sec-h">
              <Tip
                text="Every surviving node is both a source and a target, so the rebuild runs in parallel across the cluster. A traditional RAID rebuild writes everything into one spare drive."
                detail="Estimate = data to re-protect ÷ (surviving nodes × per-node throughput). RAID-style = the same data ÷ one spare drive's write rate."
              >
                Rebuild: many-to-many vs one spare
              </Tip>{' '}
              <Illus why="Illustrative, not a measurement. Both rates are assumptions you can change; real numbers depend on hardware, load and version." />
            </h3>
            <p class="cl-sub">One failed drive holding {fmtTB(driveDataTB, 2)}:</p>
            <div class="cl-bars">
              <div class="cl-bar">
                <div class="lbl">
                  <span>DSF: {Math.max(1, cfg.nodes - 1)} nodes × {cfg.rebuildTBph.toFixed(1)} TB/h</span>
                  <b>{fmtDur(dsfH)}</b>
                </div>
                <div class="track">
                  <span class="dsf" style={{ width: `${Math.max(1, (dsfH / maxH) * 100)}%` }} />
                </div>
              </div>
              <div class="cl-bar">
                <div class="lbl">
                  <span>RAID-style: 1 spare drive × {raid.toFixed(1)} TB/h</span>
                  <b>{fmtDur(raidH)}</b>
                </div>
                <div class="track">
                  <span class="raid" style={{ width: `${Math.max(1, (raidH / maxH) * 100)}%` }} />
                </div>
              </div>
            </div>
            <Field label="Spare drive write rate" value={`${raid.toFixed(1)} TB/h`}>
              <Slider value={raid} min={0.1} max={3} step={0.1} onChange={(v) => setRaid(Math.round(v * 10) / 10)} label="Spare drive write rate" />
            </Field>
            {est && est.dataTB > 0 && (
              <div class="follow flow">
                <div class="follow-k">This scenario</div>
                <p>
                  {fmtTB(est.dataTB)} to re-protect ÷ ({est.survivors} survivors × {cfg.rebuildTBph.toFixed(1)} TB/h) ≈ <b>{fmtDur(estH ?? Infinity)}</b>.
                  {finished && started
                    ? cutShort
                      ? ` In the simulation, protection was restored after ${fmtDur((finished.t - started.t) / 3600)} because the failed part came back and its copies counted again.`
                      : ` The simulation finished in ${fmtDur((finished.t - started.t) / 3600)}.`
                    : ''}
                </p>
                <p class="rest">
                  A long rebuild is a longer window in which a second failure hurts. That is what RF3 and awareness settings are for.{' '}
                  {cfg.rf === 2 && rf3.ok && cmpOn !== 'rf' && (
                    <button type="button" class="tbtn" onClick={() => setCmp('rf')}>
                      Compare with RF3 <Icon name="arrow" />
                    </button>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
        <p class="cl-sub" style={{ marginTop: 'var(--sp-5)' }}>
          Want to build the cluster in detail first?{' '}
          <button type="button" class="tbtn" onClick={() => go('nci/cluster')}>
            Open the Cluster & DSF Lab <Icon name="arrow" />
          </button>{' '}
          <Illus why={`Simulated from a sample of a few hundred data items over up to ${HORIZON / 3600} hours. Detection, HA and rebuild timings are simplified from documented behavior.`} />
        </p>
      </div>

      {cfgB && sB && stB ? <CompareRail a={sA} b={sB} sa={stA} sb={stB} la={la} lb={lb} /> : <StatusRail s={sA} st={stA} />}
    </div>
  );
}
