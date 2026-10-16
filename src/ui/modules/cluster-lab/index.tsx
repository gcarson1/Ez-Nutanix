// Cluster & DSF Lab: build a cluster, watch data spread across every node's drives, then add,
// remove and break things on a timeline you can scrub back and forth.
import { useMemo, useState } from 'preact/hooks';
import './style.css';
import { useScenario } from '../../../state/scenario';
import { useBool, useNum, useStr, setParams } from '../../../state/route';
import { normalizeConfig, blockCount, type ClusterConfig, type Media } from '../../../engine/cluster';
import { rfAllowed, ecAllowed, blockAwareAllowed, rackAwareAllowed, edgeAdvisory, ecStrip, MIN_NODES, type RF } from '../../../engine/rules';
import { decodeActs, encodeActs, describeAct, type Act } from '../../../engine/timeline';
import { Field, Seg, Toggle, Slider, Tip, Illus, Legend, PlayBar, Chip, fmtTB } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { go } from '../../shell/nav';
import { ClusterDiagram, type Sel } from './ClusterDiagram';
import { StatusRail } from './StatusRail';
import { Inspector } from './Inspector';
import { TimeStrip } from './TimeStrip';
import { useRun, usePersistedTime, fmtT, snap } from './sim';

const TB_OPTS = [1.92, 3.84, 7.68, 15.36];

export function ActionChips({
  acts,
  t,
  onRemove,
  onSeek,
  onClear,
  locked = 0,
}: {
  acts: Act[];
  t: number;
  onRemove: (i: number) => void;
  onSeek: (t: number) => void;
  onClear?: () => void;
  /** The first `locked` actions belong to a script and cannot be removed. */
  locked?: number;
}) {
  const order = acts.map((a, i) => ({ a, i })).sort((p, q) => p.a.t - q.a.t);
  return (
    <div class="cl-acts" role="list" aria-label="Actions on the timeline">
      {!acts.length && <span class="cl-sub">No actions yet: the timeline shows a healthy cluster.</span>}
      {order.map(({ a, i }) => (
        <span key={i} class={`cl-act${a.t > t ? ' future' : ''}`} role="listitem">
          <button type="button" style={{ padding: 0 }} onClick={() => onSeek(a.t)} title="Jump to this moment">
            <span class="t">{fmtT(a.t)}</span> {describeAct(a)}
          </button>
          {i >= locked ? (
            <button type="button" aria-label={`Remove: ${describeAct(a)}`} title="Remove from the timeline" onClick={() => onRemove(i)}>
              <Icon name="x" />
            </button>
          ) : (
            <span style={{ width: 'var(--sp-2)' }} />
          )}
        </span>
      ))}
      {onClear && acts.length > locked && (
        <button type="button" class="tbtn" onClick={onClear}>
          <Icon name="reset" />
          Clear timeline
        </button>
      )}
    </div>
  );
}

export function DiagramLegend({ ecx }: { ecx: boolean }) {
  return (
    <>
      <Legend
        items={[
          { color: 'var(--ink)', label: 'Copy local to its VM' },
          { color: 'var(--s2)', label: ecx ? 'Other copy or EC-X data' : 'Copy on another node' },
          ...(ecx ? [{ color: 'var(--flow)', label: 'EC-X parity' }] : []),
          { color: 'var(--warn)', label: 'Under-replicated (one copy short)' },
          { color: 'var(--bad)', label: 'No copy online' },
          { color: 'var(--s2)', label: 'Copy on an offline node', dashed: true },
        ]}
      />
      <Legend
        items={[
          { color: 'var(--flow)', label: 'Rebuild copy (line)' },
          { color: 'var(--s2)', label: 'Disk balancing', dashed: true },
          { color: 'var(--ink-fg)', label: 'Localize after a move', dashed: true },
          { color: 'var(--warn)', label: 'HA restart', dashed: true },
          { color: 'var(--flow)', label: 'I/O redirected', dashed: true },
        ]}
      />
    </>
  );
}

export default function ClusterLab() {
  const { cfg, set } = useScenario();
  const [ev, setEv] = useStr('ev', '');
  const [hlVm, setHlVm] = useNum('vm', -1, -1, 199);
  const [mix, setMix] = useNum('mix', 30, 0, 100);
  const [xf, setXf] = useBool('xf', true);
  const acts = useMemo(() => decodeActs(ev), [ev]);
  const { sim, clock, state: s, st, slow } = useRun(cfg, acts, ev);
  usePersistedTime(clock);
  const [sel, setSel] = useState<Sel | null>(null);

  const now = snap(clock.t);
  const push = (a: Act) => setEv(encodeActs([...acts, a]));
  const change = (patch: Partial<ClusterConfig>) => {
    const n = normalizeConfig({ ...cfg, ...patch });
    set({ ...patch, ft: n.ft, rf: n.rf, ecx: n.ecx, blockAware: n.blockAware, rackAware: n.rackAware });
    setParams({ ev: null, at: null, vm: null });
    setSel(null);
    clock.reset();
  };

  const blocks = blockCount(cfg);
  const rf3 = rfAllowed(3, cfg.nodes);
  const ec = ecAllowed(cfg.rf, cfg.nodes);
  const ba = blockAwareAllowed(cfg.ft, blocks, cfg.ecx);
  const ra = rackAwareAllowed(cfg.ft, Math.min(cfg.racks, blocks), cfg.ecx);
  const edge = edgeAdvisory(cfg.nodes);
  const strip = cfg.ecx ? ecStrip(s.domain === 'block' ? blocks : s.domain === 'rack' ? Math.min(cfg.racks, blocks) : cfg.nodes, cfg.rf) : null;
  const present = s.nodes.filter((n) => n.state !== 'removed').length;
  const cvms = s.nodes.filter((n) => n.state === 'up' || n.state === 'removing').length;
  const lastEv = s.events[s.events.length - 1];
  const vmOptions = s.vms.slice(0, 200);

  const diagram = useMemo(
    () => <ClusterDiagram s={s} hlVm={hlVm} sel={sel} onSel={(x) => (x.k === 'vm' ? (setSel(x), setHlVm(x.id)) : setSel(x))} showXfer={xf} />,
    [s, hlVm, sel, xf],
  );

  return (
    <div class="lab">
      <div class="ctl" aria-label="Cluster setup">
        <Field
          label="Nodes"
          value={cfg.nodes}
          tip="A node is one server: hypervisor, a Controller VM (CVM) and local drives. Every node you add brings its own CVM, so storage controller capacity grows with the cluster."
          note={edge ?? (cfg.nodes < MIN_NODES[2] ? undefined : `${cfg.nodes} nodes · ${cfg.nodes} CVMs · ${blocks} block${blocks === 1 ? '' : 's'}`)}
        >
          <Slider value={cfg.nodes} min={1} max={32} onChange={(v) => change({ nodes: v })} label="Nodes" />
        </Field>
        <Field label="Nodes per block" tip="A block is one chassis that holds 1, 2 or 4 nodes. Nodes in a block can share power and cooling, so a block can fail as a unit." value={cfg.nodesPerBlock}>
          <Seg
            label="Nodes per block"
            value={cfg.nodesPerBlock}
            options={[1, 2, 4].map((v) => ({ value: v, label: String(v) }))}
            onChange={(v) => change({ nodesPerBlock: v as 1 | 2 | 4 })}
          />
        </Field>
        <Field
          label="Block awareness"
          tip="Keep the copies of each piece of data in different blocks, so a whole block can fail without losing access to data."
          detail="Needs at least 3 blocks at redundancy factor 2 and 5 at redundancy factor 3 (4 and 6 with erasure coding). Without enough blocks, the cluster places copies on different nodes instead."
          why={
            cfg.blockAware && s.domain !== 'block' && s.domain !== 'rack'
              ? `Turned on but not in effect: ${ba.reason ?? 'not enough blocks.'} Copies are kept on different nodes instead, so some may share a block.`
              : !ba.ok
                ? ba.reason
                : cfg.nodesPerBlock === 1 && cfg.blockAware
                  ? 'With one node per block, a block failure is a node failure, so this changes nothing.'
                  : null
          }
        >
          <Toggle on={cfg.blockAware} disabled={!ba.ok && !cfg.blockAware} onChange={(v) => change({ blockAware: v })}>
            Keep copies in different blocks
          </Toggle>
        </Field>
        <Field label="Racks" value={cfg.racks} tip="Blocks are spread across this many racks, round-robin. Rack awareness is set up by the administrator, who tells the cluster which rack each block is in.">
          <Slider value={cfg.racks} min={1} max={8} onChange={(v) => change({ racks: v })} label="Racks" />
        </Field>
        <Field
          label="Rack awareness"
          tip="Keep copies in different racks, so a rack (for example its power or top-of-rack switches) can fail without losing access to data."
          why={
            cfg.rackAware && s.domain !== 'rack'
              ? `Turned on but not in effect: ${ra.reason ?? 'not enough racks.'} Copies are kept apart by ${s.domain} instead, so some may share a rack.`
              : !ra.ok && cfg.racks > 1
                ? ra.reason
                : null
          }
        >
          <Toggle on={cfg.rackAware} disabled={!ra.ok && !cfg.rackAware} onChange={(v) => change({ rackAware: v })}>
            Keep copies in different racks
          </Toggle>
        </Field>
        <Field
          label="Cluster redundancy factor"
          tip="How many failures the cluster itself is built to tolerate. It sets how many copies of metadata and configuration are kept: 3 at factor 2, 5 at factor 3."
          why={!rf3.ok ? rf3.reason : null}
        >
          <Seg
            label="Cluster redundancy factor"
            value={cfg.ft}
            options={[
              { value: 2, label: 'RF2 · 1 failure' },
              { value: 3, label: 'RF3 · 2 failures', disabled: !rf3.ok, title: rf3.reason },
            ]}
            onChange={(v) => change({ ft: v as RF, rf: v === 2 ? 2 : cfg.rf })}
          />
        </Field>
        <Field
          label="Container replication factor"
          tip="How many copies of user data a storage container keeps. RF2 keeps 2 copies on different nodes; RF3 keeps 3."
          detail="This is a separate setting from the cluster redundancy factor. A redundancy factor 3 cluster can hold both RF2 and RF3 containers."
          why={cfg.ft !== 3 ? 'RF3 containers need a cluster at redundancy factor 3 (5 or more nodes).' : null}
        >
          <Seg
            label="Container replication factor"
            value={cfg.rf}
            options={[
              { value: 2, label: 'RF2 · 2 copies' },
              { value: 3, label: 'RF3 · 3 copies', disabled: cfg.ft !== 3 },
            ]}
            onChange={(v) => change({ rf: v as RF })}
          />
        </Field>
        <Field
          label="Erasure coding (EC-X)"
          tip="Replaces full copies of write-cold data with data and parity pieces spread across nodes, which uses less space. Hot data keeps full copies."
          detail="EC-X is applied after the fact by background jobs, only to data that has not been overwritten for a while."
          why={!ec.ok ? ec.reason : null}
          note={strip ? `Strip ${strip.data}/${strip.parity}: ${strip.data} data + ${strip.parity} parity pieces on different ${s.domain}s.` : undefined}
        >
          <Toggle on={cfg.ecx} disabled={!ec.ok} onChange={(v) => change({ ecx: v })}>
            EC-X on write-cold data ({cfg.coldPct}% here)
          </Toggle>
        </Field>
        <Field label="Media" tip="All-NVMe, all-flash (SSD) or hybrid. In hybrid nodes hot data lives on SSD and cold data on HDD.">
          <Seg
            label="Media"
            value={cfg.media}
            options={[
              { value: 'nvme', label: 'All-NVMe' },
              { value: 'flash', label: 'All-flash' },
              { value: 'hybrid', label: 'Hybrid' },
            ]}
            onChange={(v) => change({ media: v as Media })}
          />
        </Field>
        <Field label="Drives per node" value={cfg.drivesPerNode} note={cfg.media === 'hybrid' ? 'Hybrid nodes here use about one SSD per three drives (at least 2) and HDD for the rest.' : undefined}>
          <Slider value={cfg.drivesPerNode} min={cfg.media === 'hybrid' ? 4 : 2} max={24} onChange={(v) => change({ drivesPerNode: v })} label="Drives per node" />
        </Field>
        <Field label="Drive size" value={`${cfg.driveTB} TB`}>
          <Seg label="Drive size" value={cfg.driveTB} options={TB_OPTS.map((v) => ({ value: v, label: String(v) }))} onChange={(v) => change({ driveTB: v })} />
        </Field>
        <Field label="Capacity used" value={`${cfg.fillPct}%`} tip="How full the drives are. Self-healing needs free space on the survivors, so a nearly full cluster cannot re-protect itself.">
          <Slider value={cfg.fillPct} min={5} max={90} onChange={(v) => change({ fillPct: v })} label="Capacity used" />
        </Field>
        <Field label="VMs" value={cfg.vms}>
          <Slider value={cfg.vms} min={0} max={200} step={4} onChange={(v) => change({ vms: v })} label="VMs" />
        </Field>
        <Field
          label="Workload mix"
          value={mix < 34 ? 'Random-heavy' : mix > 66 ? 'Sequential-heavy' : 'Mixed'}
          tip="Bursty random writes land in the OpLog (a fast write buffer) and drain later. Large sequential writes skip the OpLog and go straight to the extent store. Either way, every write keeps its RF copies."
          note={
            <>
              <div class="cl-mix" aria-hidden="true">
                <span class="op" style={{ width: `${100 - mix}%` }} />
                <span class="ex" style={{ width: `${mix}%` }} />
              </div>
              About {100 - mix}% of writes go through the OpLog first <Illus why="A simple split for discussion, not a measurement. Real behavior depends on how much write I/O is outstanding per vDisk (sequential above about 1.5 MB)." />{' '}
              <button type="button" class="tbtn" onClick={() => go('nci/datapath')}>
                See the write path <Icon name="arrow" />
              </button>
            </>
          }
        >
          <Slider value={mix} min={0} max={100} step={5} onChange={setMix} label="Workload mix, random to sequential" />
        </Field>
        <Field
          label="Data locality"
          tip="One copy of every write lands on the node where the VM runs, so reads stay local. After a VM moves, hot data is copied to its new node as it is read."
          note={!cfg.locality ? 'Off (illustrative): copies are spread with no local bias, so most reads cross the network.' : undefined}
        >
          <Toggle on={cfg.locality} onChange={(v) => change({ locality: v })}>
            Keep a copy local to each VM
          </Toggle>
        </Field>
        <div class="field">
          <button type="button" class="tbtn" onClick={() => change({ seed: cfg.seed + 1 })}>
            <Icon name="reset" />
            Shuffle data layout
          </button>
          <span class="field-note">Changing the setup restarts the timeline.</span>
        </div>
      </div>

      <div class="stage">
        <PlayBar
          clock={clock}
          scrub={false}
          fmt={fmtT}
          label="Cluster timeline"
          extra={
            slow ? (
              <Chip tone="neutral" icon="eye">
                Slowed down
              </Chip>
            ) : undefined
          }
        />
        <TimeStrip
          samples={sim.tl.samples}
          duration={sim.duration}
          computed={sim.computed}
          t={clock.t}
          acts={acts}
          events={sim.tl.frontState.events}
          onSeek={(v) => {
            clock.pause();
            clock.seek(v);
          }}
        />
        <div class="cl-row" style={{ marginTop: 'var(--sp-2)' }}>
          <ActionChips
            acts={acts}
            t={clock.t}
            onRemove={(i) => setEv(encodeActs(acts.filter((_, j) => j !== i)))}
            onSeek={(v) => {
              clock.pause();
              clock.seek(v);
            }}
            onClear={() => {
              setEv('');
              clock.reset();
            }}
          />
          <button type="button" class="btn" disabled={present >= 32} onClick={() => push({ t: now, k: 'add' })}>
            <Icon name="plus" />
            Add a node
          </button>
        </div>
        <p class="cl-sub" style={{ marginTop: 'var(--sp-2)' }}>
          Time runs slowly for a couple of minutes after each action so detection and restarts can be followed, then speeds up. <Illus why="Times are simulated from a sample of a few hundred data items. Detection, restart and rebuild timings are simplified; rebuild speed follows the per-node throughput assumption (1 TB per hour per node unless changed in the Failure Gauntlet)." />
        </p>

        <div class="diagram-scroll" style={{ marginTop: 'var(--sp-3)' }}>
          {diagram}
        </div>
        <DiagramLegend ecx={cfg.ecx} />
        <div class="cl-row" style={{ marginTop: 'var(--sp-3)', justifyContent: 'flex-start' }}>
          <label class="hstack" style={{ gap: 'var(--sp-2)', fontSize: 'var(--fs-13)' }}>
            <Tip text="Dim everything except one VM's data to see where its copies live: one copy on its own node, the others spread across the cluster.">
              <span>Follow a VM</span>
            </Tip>
            <select class="input cl-select" style={{ width: 'auto' }} value={hlVm} onChange={(e) => setHlVm(Number((e.target as HTMLSelectElement).value))}>
              <option value={-1}>None</option>
              {vmOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} (on {s.nodes[v.node].name})
                </option>
              ))}
            </select>
          </label>
          <Toggle on={xf} onChange={setXf}>
            Show data movement
          </Toggle>
        </div>

        <Inspector s={s} sel={sel} t={now} push={push} hlVm={hlVm} setHlVm={setHlVm} setSel={setSel} mode="lab" />

        {lastEv && (
          <div class={`follow ${lastEv.kind === 'ok' || lastEv.kind === 'recover' ? 'good' : lastEv.kind === 'loss' || lastEv.kind === 'failure' ? 'bad' : lastEv.kind === 'info' ? 'ink' : 'warn'}`} role="status" aria-live="polite">
            <div class="follow-k">Latest · {fmtT(lastEv.t)}</div>
            <p>{lastEv.text}</p>
          </div>
        )}
        <div class="follow ink">
          <div class="follow-k">Scale-out</div>
          <p>
            {present} node{present === 1 ? '' : 's'}, {cvms} CVM{cvms === 1 ? '' : 's'} serving I/O, {fmtTB(st.capacity.rawTB)} raw. Each node added brings its own CVM along with its drives, so storage controller capacity and raw capacity grow together, and rebuilds get more helpers.{' '}
            <button type="button" class="tbtn" onClick={() => go('nci/failures')}>
              Break things in the Failure Gauntlet <Icon name="arrow" />
            </button>
          </p>
        </div>
      </div>

      <StatusRail s={s} st={st} />
    </div>
  );
}
