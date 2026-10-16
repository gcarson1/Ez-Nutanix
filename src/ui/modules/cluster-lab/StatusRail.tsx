// Live status in the terms an admin sees in Prism: cluster health, data resiliency,
// capacity, rebuild capacity, self-heal progress, quorum, VMs and the event log.
import type { ClusterState, SimEvent } from '../../../engine/cluster';
import type { ClusterStatus } from '../../../engine/status';
import { computeCapacity } from '../../../engine/capacity';
import { insights } from '../../../engine/timeline';
import { Chip, Stat, Tip, Illus, fmtTB, type Tone } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { fmtT } from './sim';

export function healthTone(h: ClusterStatus['health']): Tone {
  return h === 'OK' ? 'ok' : h === 'Warning' ? 'warn' : 'bad';
}

export function resiliencyLine(st: ClusterStatus): { tone: Tone; text: string } {
  const dom = st.domain;
  if (st.resiliency === 'Cluster down') return { tone: 'bad', text: 'Cluster down: configuration quorum lost' };
  if (st.resiliency === 'Data unavailable') return { tone: 'bad', text: 'Some data has no copy online' };
  const n = st.tolerable;
  const text = `Can tolerate ${n} more ${dom} failure${n === 1 ? '' : 's'}`;
  return { tone: st.resiliency === 'OK' ? 'ok' : 'warn', text };
}

const EV_ICON: Record<SimEvent['kind'], string> = {
  failure: 'bad',
  detect: 'eye',
  ha: 'power',
  rebuild: 'rebuild',
  ok: 'ok',
  info: 'info',
  warn: 'warn',
  loss: 'bad',
  recover: 'check',
};
const EV_TONE: Record<SimEvent['kind'], string> = {
  failure: 'bad-text',
  detect: 'warn-text',
  ha: 'warn-text',
  rebuild: 'flow-text',
  ok: 'ok-text',
  info: 'muted',
  warn: 'warn-text',
  loss: 'bad-text',
  recover: 'ok-text',
};

export function EventLog({ events, max = 14 }: { events: SimEvent[]; max?: number }) {
  const list = events.slice(-max).reverse();
  if (!list.length) return <p class="cl-sub">No events yet. Break something, add a node or migrate a VM.</p>;
  return (
    <ol class="events" aria-label="Event log, newest first">
      {list.map((e, i) => (
        <li key={`${e.t}-${i}`}>
          <span class="t">{fmtT(e.t)}</span>
          <span class={EV_TONE[e.kind]}>
            <Icon name={EV_ICON[e.kind]} />
          </span>
          <span>{e.text}</span>
        </li>
      ))}
    </ol>
  );
}

export function HealthBlock({ st }: { st: ClusterStatus }) {
  const r = resiliencyLine(st);
  return (
    <>
      <div class="cl-row">
        <Chip tone={healthTone(st.health)} lg>
          {st.health}
        </Chip>
        <Tip
          align="right"
          text="Cluster health rolls up every alert. Critical means data is not fully protected right now; Warning means it is protected but something needs attention."
        >
          <span class="cl-sub">Cluster health</span>
        </Tip>
      </div>
      <div class={`bigline ${r.tone}-text`}>{r.text}</div>
      <div class="cl-sub" style={{ marginTop: 'var(--sp-1)' }}>
        <Tip
          text="Data resiliency is the number of further failures the cluster can absorb right now without losing access to data. It is the lowest of the values below."
          detail="Data counts copies of each extent group across failure domains. Metadata (a Cassandra-based ring) and cluster configuration (Zookeeper) are kept in 3 copies at redundancy factor 2 and 5 at redundancy factor 3, and need a majority to stay available."
        >
          Data resiliency: {st.resiliency}
        </Tip>
      </div>
      {st.components.map((c) => (
        <Stat key={c.name} k={c.name} v={c.tolerable < 0 ? 'lost' : `${c.tolerable} more`} tone={c.tolerable < 0 ? 'bad' : c.tolerable === 0 ? 'warn' : 'ok'} />
      ))}
    </>
  );
}

export function StatusRail({ s, st, events = true }: { s: ClusterState; st: ClusterStatus; events?: boolean }) {
  const ins = insights(s);
  const present = s.nodes.filter((n) => n.state !== 'removed').length;
  const cap = computeCapacity({
    nodes: present,
    drivesPerNode: s.cfg.drivesPerNode,
    driveTB: s.cfg.driveTB,
    rf: s.cfg.rf,
    ecx: s.cfg.ecx,
    coldPct: s.cfg.coldPct,
    reserve: 'none',
    nodesPerBlock: s.cfg.nodesPerBlock,
    blockAware: s.cfg.blockAware,
    dataReduction: 1,
    systemOverheadPct: 0,
  });
  const heal = st.selfHeal;
  const healTone: Tone = heal.state === 'blocked' ? 'bad' : heal.state === 'rebuilding' || heal.state === 'waiting' ? 'warn' : 'ok';
  const healWord =
    heal.state === 'idle' ? 'Fully protected' : heal.state === 'complete' ? 'Re-protected' : heal.state === 'waiting' ? 'Waiting to start' : heal.state === 'rebuilding' ? 'Rebuilding' : 'Cannot self-heal';
  const [why, fix] = (heal.reason || '').split(' Fix: ');
  return (
    <aside class="rail cl-rail" aria-label="Cluster status">
      <section class="side-sec" aria-live="polite">
        <HealthBlock st={st} />
      </section>
      <section class="side-sec">
        <h3>Self-healing</h3>
        <Chip tone={healTone}>{healWord}</Chip>
        {heal.state !== 'idle' && (
          <>
            <div class={`meter thick${healTone === 'ok' ? '' : ` ${healTone}`}`} role="progressbar" aria-valuenow={Math.round(heal.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${Math.round(heal.progress * 100)}%` }} />
            </div>
            <Stat k="Re-protected" v={`${Math.round(heal.progress * 100)}%`} />
            <Stat k="Still to copy" v={fmtTB(heal.remainingGB / 1000)} />
          </>
        )}
        {heal.state === 'blocked' && (
          <p class="reason">
            <b class="bad-text">Why:</b> {why}
            {fix && (
              <>
                <br />
                <b>Fix:</b> {fix}
              </>
            )}
          </p>
        )}
        <Stat
          k="Rebuild capacity available"
          v={st.rebuildCapacity ? 'Yes' : 'No'}
          tone={st.rebuildCapacity ? 'ok' : 'warn'}
          tip="Whether the cluster could fully re-protect itself after losing its largest failure domain, given free space and the number of domains left."
        />
        {!st.rebuildCapacity && st.rebuildCapacityReason && <p class="cl-sub">{st.rebuildCapacityReason}</p>}
        <Stat k="Data items" v={`${st.items.healthy} ok · ${st.items.under} under · ${st.items.unavailable} unavail.`} />
        {ins.lostForGood > 0 && <Stat k="Lost every copy" v={`${ins.lostForGood} items`} tone="bad" tip="Every copy sat on drives that failed. Rebuild cannot recreate data that has no surviving copy." />}
      </section>
      <section class="side-sec">
        <h3>Capacity</h3>
        <Stat k="Raw" v={fmtTB(st.capacity.rawTB)} tip="Sum of every drive in the cluster." />
        <Stat
          k="Usable (logical)"
          v={`≈ ${fmtTB(cap.usableTB)}`}
          tip={`Raw divided by the protection overhead (${cap.blendedOverhead.toFixed(2)}x here). Before any rebuild reserve or data reduction.`}
        />
        <Stat k="Physical used" v={`${Math.round(st.capacity.usedPct)}% of online drives`} tone={st.capacity.usedPct > 85 ? 'bad' : st.capacity.usedPct > 75 ? 'warn' : undefined} />
        <Stat k="Free on online drives" v={fmtTB(st.capacity.freeTB)} />
      </section>
      <section class="side-sec">
        <h3>Services and VMs</h3>
        <Stat k="CVMs up" v={`${st.cvmsUp} of ${present}`} tone={st.cvmsUp < present ? 'warn' : 'ok'} tip="Every node runs one Controller VM. Together they are the storage controller." />
        <Stat
          k={st.zk.witness ? 'Config quorum (with Witness)' : 'Zookeeper quorum'}
          v={`${st.zk.alive} of ${st.zk.total} ${st.zk.quorum ? '· OK' : '· LOST'}`}
          tone={st.zk.quorum ? (st.zk.alive < st.zk.total ? 'warn' : 'ok') : 'bad'}
          tip="Cluster configuration lives in Zookeeper on 3 nodes (5 at redundancy factor 3). A majority must be up. Two-node clusters use a Witness at another site as the tie-breaker."
        />
        <Stat k="VMs running" v={`${ins.vmsRunning} of ${s.vms.length}`} tone={ins.vmsRunning < s.vms.length ? 'warn' : 'ok'} />
        {ins.vmsRestarting > 0 && <Stat k="Waiting for HA restart" v={ins.vmsRestarting} tone="warn" />}
        {ins.vmsFailed > 0 && <Stat k="Could not restart" v={ins.vmsFailed} tone="bad" />}
        <Stat
          k="VM data read locally"
          v={
            <>
              {Math.round(ins.localityPct)}% <Illus why="Share of each VM's sampled replicated data that has a copy on the node where the VM runs now. Reads of local data skip the network." />
            </>
          }
        />
      </section>
      {events && (
        <section class="side-sec">
          <h3>Event log</h3>
          <EventLog events={s.events} />
        </section>
      )}
    </aside>
  );
}
