// What you clicked, and what you can do to it. Every action is added to the timeline at the
// current time, so it can be scrubbed past, undone, and shared in the link.
import type { ClusterState } from '../../../engine/cluster';
import { canRemoveNode } from '../../../engine/failures';
import type { Act } from '../../../engine/timeline';
import { Chip, Tip, fmtTB, type Tone } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { STATE_WORD, type Sel } from './ClusterDiagram';

export type InspectMode = 'lab' | 'gauntlet';

export function Inspector({
  s,
  sel,
  t,
  push,
  hlVm,
  setHlVm,
  setSel,
  mode,
}: {
  s: ClusterState;
  sel: Sel | null;
  t: number;
  push: (a: Act) => void;
  hlVm: number;
  setHlVm: (v: number) => void;
  setSel: (s: Sel | null) => void;
  mode: InspectMode;
}) {
  if (!sel) {
    return (
      <div class="follow ink cl-inspect" role="status">
        <div class="follow-k">Click to act</div>
        <p>
          Click a node, its <b>CVM</b> or one of its drives to {mode === 'lab' ? 'break it, remove it or move VMs to it' : 'break it'}. Click a small square (a VM) to follow its data. With the keyboard, Tab to a node or CVM and press Enter.
        </p>
      </div>
    );
  }
  const btn = (label: string, icon: string, a: Act | null, opts: { primary?: boolean; disabled?: boolean; title?: string } = {}) => (
    <button type="button" class={`btn${opts.primary ? ' primary' : ''}`} disabled={opts.disabled || !a} title={opts.title} onClick={() => a && push(a)}>
      <Icon name={icon} />
      {label}
    </button>
  );
  const close = (
    <button type="button" class="tbtn" onClick={() => setSel(null)} aria-label="Close">
      <Icon name="x" />
    </button>
  );

  if (sel.k === 'node' || sel.k === 'cvm') {
    const n = s.nodes[sel.id];
    if (!n) return null;
    const vms = s.vms.filter((v) => v.node === n.id);
    const disks = s.disks.filter((d) => d.node === n.id);
    let heldGB = 0;
    for (const it of s.items) for (const m of it.members) if (m.node === n.id) heldGB += it.memberGB;
    const up = n.state === 'up';
    const back = n.state === 'down' || n.state === 'cvm-down' || n.state === 'isolated';
    const rm = canRemoveNode(s, n.id);
    const hv = hlVm >= 0 ? s.vms[hlVm] : null;
    const isCvm = sel.k === 'cvm';
    return (
      <div class="follow ink cl-inspect" role="region" aria-label={`${isCvm ? 'CVM on ' : ''}${n.name} actions`}>
        <div class="cl-row">
          <div class="follow-k">
            {isCvm ? `CVM on ${n.name}` : n.name} · {STATE_WORD[n.state]}
          </div>
          {close}
        </div>
        <div class="cl-facts">
          <span>
            Block <b>{n.block + 1}</b>
          </span>
          {s.cfg.racks > 1 && (
            <span>
              Rack <b>{n.rack + 1}</b>
            </span>
          )}
          <span>
            VMs <b>{vms.length}</b>
          </span>
          <span>
            Drives <b>{disks.filter((d) => d.state === 'ok').length}</b>/{disks.length}
          </span>
          <span>
            Data held <b>{fmtTB(heldGB / 1000)}</b>
          </span>
          {n.zk && (
            <Tip text="This node runs one of the Zookeeper servers that hold cluster configuration. A majority of them must be up.">
              <span>Zookeeper</span>
            </Tip>
          )}
          {n.storageOnly && <span>Storage only</span>}
        </div>
        {isCvm ? (
          <p class="cl-sub" style={{ marginTop: 'var(--sp-2)' }}>
            The Controller VM runs the storage services for this host. If it stops, the host and its VMs keep running and their I/O is redirected to other CVMs over the network (the iSCSI redirector on AHV; called autopathing on ESXi and Hyper-V), with some extra latency.
          </p>
        ) : null}
        <div class="btns">
          {up && !isCvm && btn('Power off node', 'power', { t, k: 'fail', f: { kind: 'node', node: n.id } }, { primary: true })}
          {up && btn('Stop CVM only', 'cpu', { t, k: 'fail', f: { kind: 'cvm', node: n.id } }, { primary: isCvm })}
          {up && !isCvm && btn('Cut off network', 'net', { t, k: 'fail', f: { kind: 'partition', node: n.id } })}
          {up && !isCvm && s.cfg.nodesPerBlock > 1 && btn(`Fail block ${n.block + 1}`, 'server', { t, k: 'fail', f: { kind: 'block', block: n.block } })}
          {up && !isCvm && s.cfg.racks > 1 && btn(`Fail rack ${n.rack + 1}`, 'layers', { t, k: 'fail', f: { kind: 'rack', rack: n.rack } })}
          {back && btn(n.state === 'cvm-down' ? 'Restart CVM' : 'Bring node back', 'reset', { t, k: 'recover', node: n.id }, { primary: true })}
          {mode === 'lab' && up && !isCvm && btn('Remove gracefully', 'minus', rm.ok ? { t, k: 'remove', node: n.id } : null, { title: rm.reason })}
          {mode === 'lab' && up && !isCvm && hv && hv.node !== n.id && hv.state === 'running' && !n.storageOnly &&
            btn(`Migrate ${hv.name} here`, 'move', { t, k: 'migrate', vm: hv.id, to: n.id })}
        </div>
        {mode === 'lab' && up && !isCvm && !rm.ok && <div class="why">Remove: {rm.reason}</div>}
        {!isCvm && n.state !== 'removed' && (
          <div class="btns" role="group" aria-label={`Drives in ${n.name}`}>
            {disks.map((d) =>
              d.state === 'ok' ? (
                <button key={d.id} type="button" class="tbtn" disabled={!up && n.state !== 'cvm-down'} onClick={() => push({ t, k: 'fail', f: { kind: 'disk', disk: d.id } })}>
                  Fail drive {d.idx + 1}
                </button>
              ) : (
                <button key={d.id} type="button" class="tbtn" onClick={() => push({ t, k: 'replace', disk: d.id })}>
                  <Icon name="plus" />
                  Replace drive {d.idx + 1}
                </button>
              ),
            )}
          </div>
        )}
      </div>
    );
  }

  if (sel.k === 'disk') {
    const d = s.disks.find((x) => x.id === sel.id);
    if (!d) return null;
    const n = s.nodes[d.node];
    let used = 0;
    let copies = 0;
    for (const it of s.items)
      for (const m of it.members)
        if (m.disk === d.id) {
          used += it.memberGB;
          copies++;
        }
    return (
      <div class="follow ink cl-inspect" role="region" aria-label="Drive actions">
        <div class="cl-row">
          <div class="follow-k">
            Drive {d.idx + 1} in {n.name} · {d.tier.toUpperCase()} · {d.state === 'ok' ? 'healthy' : 'failed'}
          </div>
          {close}
        </div>
        <div class="cl-facts">
          <span>
            Size <b>{fmtTB(d.capGB / 1000, 2)}</b>
          </span>
          <span>
            Used <b>{d.state === 'ok' ? Math.round((used / d.capGB) * 100) : 0}%</b>
          </span>
          <span>
            Sampled copies <b>{copies}</b>
          </span>
        </div>
        <p class="cl-sub" style={{ marginTop: 'var(--sp-2)' }}>
          {d.state === 'ok'
            ? 'If this drive fails, the copies on it are gone, but each piece of data has another copy on a different node. Those copies are used to re-protect the data across the rest of the cluster.'
            : 'Replacing the drive adds empty capacity. Disk balancing then spreads data onto it over time.'}
        </p>
        <div class="btns">
          {d.state === 'ok'
            ? btn('Fail this drive', 'disk', n.state === 'up' || n.state === 'cvm-down' ? { t, k: 'fail', f: { kind: 'disk', disk: d.id } } : null, { primary: true })
            : btn('Replace drive', 'plus', { t, k: 'replace', disk: d.id }, { primary: true })}
        </div>
      </div>
    );
  }

  // VM
  const vm = s.vms[sel.id];
  if (!vm) return null;
  const items = s.items.filter((it) => it.vm === vm.id);
  const localItems = items.filter((it) => it.kind === 'rf' && it.members.some((m) => m.node === vm.node)).length;
  const rfItems = items.filter((it) => it.kind === 'rf').length;
  const targets = s.nodes.filter((x) => x.state === 'up' && !x.storageOnly && x.id !== vm.node);
  const vmTone: Tone = vm.state === 'running' ? 'ok' : vm.state === 'restarting' ? 'warn' : 'bad';
  return (
    <div class="follow ink cl-inspect" role="region" aria-label={`${vm.name} actions`}>
      <div class="cl-row">
        <div class="follow-k">
          {vm.name} on {s.nodes[vm.node].name}
        </div>
        {close}
      </div>
      <div class="cl-facts">
        <Chip tone={vmTone}>{vm.state === 'running' ? 'Running' : vm.state === 'restarting' ? 'Waiting for HA' : 'Not running'}</Chip>
        <span>
          Memory <b>{vm.memGB} GB</b>
        </span>
        <span>
          Data with a local copy{' '}
          <b>
            {localItems}/{rfItems}
          </b>
        </span>
      </div>
      <div class="btns">
        <button type="button" class={`btn${hlVm === vm.id ? '' : ' primary'}`} onClick={() => setHlVm(hlVm === vm.id ? -1 : vm.id)}>
          <Icon name="eye" />
          {hlVm === vm.id ? 'Stop highlighting' : 'Highlight its data'}
        </button>
      </div>
      {mode === 'lab' && vm.state === 'running' && (
        <>
          <p class="cl-sub" style={{ marginTop: 'var(--sp-3)' }}>
            Live-migrate it. The VM keeps running; its data stays put at first, so early reads cross the network, and hot data is copied to the new node as it is read.
          </p>
          <div class="btns" role="group" aria-label="Migrate to">
            {targets.slice(0, 16).map((x) => (
              <button key={x.id} type="button" class="tbtn" onClick={() => push({ t, k: 'migrate', vm: vm.id, to: x.id })}>
                <Icon name="move" />
                {x.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
