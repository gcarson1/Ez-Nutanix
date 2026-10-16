// Live status in plain words: how many more failures the cluster can take, self-healing,
// capacity and VMs. It explains the idea; it does not imitate the Prism console.
import type { ClusterState } from '../../../engine/cluster';
import type { ClusterStatus } from '../../../engine/status';
import { insights } from '../../../engine/timeline';
import { Chip, Stat, Illus, fmtTB, type Tone } from '../../components/controls';

function resiliencyLine(st: ClusterStatus): { tone: Tone; text: string } {
  if (st.resiliency === 'Cluster down') return { tone: 'bad', text: 'Cluster down: too few nodes left to agree on its configuration' };
  if (st.resiliency === 'Data unavailable') return { tone: 'bad', text: 'Some data has no copy online' };
  const n = st.tolerable;
  return { tone: st.resiliency === 'OK' ? 'ok' : 'warn', text: n > 0 ? `Can take ${n} more ${st.domain} failure${n === 1 ? '' : 's'}` : `Cannot take another ${st.domain} failure yet` };
}

export function StatusRail({ s, st }: { s: ClusterState; st: ClusterStatus }) {
  const ins = insights(s);
  const present = s.nodes.filter((n) => n.state !== 'removed').length;
  const r = resiliencyLine(st);
  const heal = st.selfHeal;
  const healTone: Tone = heal.state === 'blocked' ? 'bad' : heal.state === 'rebuilding' || heal.state === 'waiting' ? 'flow' : 'ok';
  const healWord =
    heal.state === 'idle' ? 'Every copy in place' : heal.state === 'complete' ? 'Healed' : heal.state === 'waiting' ? 'About to start' : heal.state === 'rebuilding' ? 'Re-creating copies' : 'Cannot heal';
  const [why, fix] = (heal.reason || '').split(' Fix: ');
  return (
    <aside class="rail cl-rail" aria-label="Cluster status">
      <section class="side-sec" aria-live="polite">
        <h3>Protection</h3>
        <div class={`bigline ${r.tone}-text`}>{r.text}</div>
        {ins.lostForGood > 0 && <Stat k="Data lost for good" v={`${ins.lostForGood} pieces`} tone="bad" tip="Every copy sat on drives that failed, so there is nothing left to copy from." />}
      </section>
      <section class="side-sec">
        <h3>Self-healing</h3>
        <Chip tone={healTone}>{healWord}</Chip>
        {heal.state !== 'idle' && (
          <>
            <div class={`meter thick${healTone === 'ok' ? '' : ` ${healTone === 'flow' ? 'warn' : healTone}`}`} role="progressbar" aria-valuenow={Math.round(heal.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${Math.round(heal.progress * 100)}%` }} />
            </div>
            <Stat k="Copies restored" v={`${Math.round(heal.progress * 100)}%`} />
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
          k="Room to heal after a failure"
          v={st.rebuildCapacity ? 'Yes' : 'No'}
          tone={st.rebuildCapacity ? 'ok' : 'warn'}
          tip="Whether the nodes left after losing the largest failure domain would have enough free space to re-create every missing copy."
        />
        {!st.rebuildCapacity && st.rebuildCapacityReason && <p class="cl-sub">{st.rebuildCapacityReason}</p>}
      </section>
      <section class="side-sec">
        <h3>Capacity</h3>
        <Stat k="Raw" v={fmtTB(st.capacity.rawTB)} tip="Every drive in the cluster added up." />
        <Stat k="Used" v={`${Math.round(st.capacity.usedPct)}%`} tone={st.capacity.usedPct > 85 ? 'bad' : st.capacity.usedPct > 75 ? 'warn' : undefined} tip="Share of the working drives that holds data, copies included." />
      </section>
      <section class="side-sec">
        <h3>VMs</h3>
        <Stat k="Running" v={`${ins.vmsRunning} of ${s.vms.length}`} tone={ins.vmsRunning < s.vms.length ? 'warn' : 'ok'} />
        {ins.vmsRestarting > 0 && <Stat k="Restarting on another node" v={ins.vmsRestarting} tone="warn" />}
        {ins.vmsFailed > 0 && <Stat k="Could not restart" v={ins.vmsFailed} tone="bad" />}
        <Stat k="Storage controllers up" v={`${st.cvmsUp} of ${present}`} tone={st.cvmsUp < present ? 'warn' : 'ok'} tip="Every node runs one controller VM (CVM). Together they are the storage controller." />
        <Stat
          k="Data read locally"
          tip="Share of each VM's data that has a copy on the node where the VM runs now. Local reads skip the network."
          v={
            <>
              {Math.round(ins.localityPct)}% <Illus why="Measured on a sample of each VM's data." />
            </>
          }
        />
      </section>
    </aside>
  );
}
