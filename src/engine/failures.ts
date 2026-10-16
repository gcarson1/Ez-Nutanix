// Actions that change the cluster: failures, recoveries, adding/removing nodes, migrating VMs.
// Every action returns a new state (inputs are never mutated) so a timeline can be replayed.
import type { ClusterState, NodeState, SimEvent, SimNode } from './cluster';
import { makeNode, makeDisks, assignZookeeper } from './cluster';
import { MIN_NODES } from './rules';
import { storageLive } from './placement';
import { itemState } from './status';

/** Illustrative timings (sim seconds). Real values depend on AOS version; see docs/facts.md. */
export const TIMING = {
  /**
   * Host failure until AHV HA starts restarting VMs elsewhere: the Acropolis leader notices
   * at about 20 s, then waits a 40 s timeout (facts: TIM-1).
   */
  haDetectS: 60,
  /** Spacing between successive VM restarts in the sim's restart queue. */
  haStaggerS: 5,
  /** Restarts are spread over at most this long, so all finish by about 120 s (facts: TIM-1). */
  haWindowS: 55,
  /** Time to boot a restarted VM. */
  vmBootS: 45,
  /** Detection only: re-protection starts as soon as the failure is detected (facts: TIM-2). */
  rebuildDelayS: 5,
  /** Two-node cluster: the survivor switches to single-node mode in about 30 to 60 s (facts: EDGE-3). */
  singleNodeModeS: 45,
  /** Two-node cluster: a returning node must be stable for 15 minutes before resync (facts: EDGE-3). */
  twoNodeRejoinS: 15 * 60,
  /** After this long down, a CVM is detached from the metadata ring and its share re-replicated. */
  detachS: 30 * 60,
  /** Short resync when a CVM returns (writes made while it was away are brought up to date). */
  resyncS: 120,
};

export type Failure =
  | { kind: 'node'; node: number }
  | { kind: 'cvm'; node: number }
  | { kind: 'partition'; node: number }
  | { kind: 'disk'; disk: string }
  | { kind: 'block'; block: number }
  | { kind: 'rack'; rack: number };

export function clone(state: ClusterState): ClusterState {
  return {
    ...state,
    nodes: state.nodes.map((n) => ({ ...n })),
    disks: state.disks.map((d) => ({ ...d })),
    items: state.items.map((it) => ({ ...it, members: it.members.map((m) => ({ ...m })) })),
    vms: state.vms.map((v) => ({ ...v })),
    events: state.events.slice(),
    transfers: state.transfers.slice(),
    rebuild: { ...state.rebuild },
    ha: state.ha ? state.ha.slice() : [],
  };
}

function log(s: ClusterState, kind: SimEvent['kind'], text: string) {
  s.events.push({ t: s.time, kind, text });
}

function takeDown(s: ClusterState, n: SimNode, st: NodeState) {
  if (n.state === 'removed') return;
  const wasLive = storageLive(n);
  n.state = st;
  if (wasLive || n.downSince === null) n.downSince = s.time;
  n.detectedAt = null;
  // VMs: a powered-off or isolated host loses its VMs; HA restarts them on survivors.
  // A CVM-only failure leaves the hypervisor and its VMs running (I/O is autopathed).
  if (st === 'down' || st === 'isolated') {
    let order = 0;
    const queued = (s.ha || []).filter((r) => r.restartedAt === null && !r.failed).length;
    for (const vm of s.vms) {
      if (vm.node !== n.id || vm.state !== 'running') continue;
      vm.state = 'restarting';
      vm.restartAt = s.time + TIMING.haDetectS + Math.min(order * TIMING.haStaggerS, TIMING.haWindowS);
      (s.ha ||= []).push({ vm: vm.id, from: n.id, order: queued + order + 1, failedAt: s.time, dueAt: vm.restartAt, to: null, restartedAt: null, failed: false });
      order++;
    }
  }
}

export function applyFailure(state: ClusterState, f: Failure): ClusterState {
  const s = clone(state);
  switch (f.kind) {
    case 'node': {
      const n = s.nodes[f.node];
      if (!n || n.state === 'removed' || n.state === 'down') return state;
      takeDown(s, n, 'down');
      log(s, 'failure', `${n.name} powered off. Its VMs stop; its CVM and drives drop out of the storage cluster.`);
      break;
    }
    case 'cvm': {
      const n = s.nodes[f.node];
      if (!n || n.state !== 'up') return state;
      takeDown(s, n, 'cvm-down');
      log(s, 'failure', `${n.name} CVM stopped. The host and its VMs keep running; their I/O is redirected to other CVMs.`);
      break;
    }
    case 'partition': {
      const n = s.nodes[f.node];
      if (!n || n.state !== 'up') return state;
      takeDown(s, n, 'isolated');
      log(s, 'failure', `${n.name} lost its network links to the rest of the cluster.`);
      break;
    }
    case 'disk': {
      const d = s.disks.find((x) => x.id === f.disk);
      if (!d || d.state === 'failed') return state;
      d.state = 'failed';
      log(s, 'failure', `Drive ${d.idx + 1} in ${s.nodes[d.node].name} failed. Copies on it are gone; other copies remain.`);
      // Data on a failed drive is permanently lost from that drive.
      for (const it of s.items) it.members = it.members.filter((m) => m.disk !== d.id);
      break;
    }
    case 'block': {
      const hit = s.nodes.filter((n) => n.block === f.block && n.state !== 'removed' && n.state !== 'down');
      if (!hit.length) return state;
      hit.forEach((n) => takeDown(s, n, 'down'));
      log(s, 'failure', `Block ${f.block + 1} lost power: ${hit.map((n) => n.name).join(', ')} down together.`);
      break;
    }
    case 'rack': {
      const hit = s.nodes.filter((n) => n.rack === f.rack && n.state !== 'removed' && n.state !== 'down');
      if (!hit.length) return state;
      hit.forEach((n) => takeDown(s, n, 'down'));
      log(s, 'failure', `Rack ${f.rack + 1} lost power: ${hit.length} nodes down together.`);
      break;
    }
  }
  if (s.rebuild.startedAt === null) s.rebuild.doneGB = 0;
  s.rebuild.blocked = null;
  // Say so plainly when the failure leaves some data with no copy online.
  const before = state.items.reduce((a, it) => a + (itemState(state, it) === 'unavailable' ? 1 : 0), 0);
  const after = s.items.reduce((a, it) => a + (itemState(s, it) === 'unavailable' ? 1 : 0), 0);
  if (after > before) {
    const gone = s.items.filter((it) => it.members.length < it.need).length;
    log(
      s,
      'loss',
      `${after - before} sampled data item${after - before === 1 ? '' : 's'} now ${after - before === 1 ? 'has' : 'have'} no copy online: that data is unavailable${
        gone ? `, and ${gone} lost every copy for good` : ' until a failed node returns'
      }.`,
    );
  }
  return s;
}

/** Bring a powered-off, CVM-down or isolated node back. Its surviving copies count again. */
export function recoverNode(state: ClusterState, nodeId: number): ClusterState {
  const n = state.nodes[nodeId];
  if (!n || n.state === 'up' || n.state === 'removed' || n.state === 'removing') return state;
  const s = clone(state);
  const node = s.nodes[nodeId];
  const prev = node.state;
  node.state = 'up';
  node.downSince = null;
  node.detached = false;
  node.upSince = s.time;
  // If its Zookeeper role moved away while it was detached and the ensemble is short, it rejoins.
  const present = s.nodes.filter((x) => x.state !== 'removed');
  const want = Math.min(s.cfg.ft === 3 ? 5 : 3, present.length);
  if (!node.zk && present.filter((x) => x.zk).length < want) node.zk = true;
  // Copies that were rebuilt elsewhere while the node was away are now surplus; trim them.
  trimSurplus(s);
  // VMs still on this host (CVM-only failure) may have had local copies rebuilt elsewhere
  // while the CVM was away: locality is rebuilt as they read their data again.
  for (const vm of s.vms) if (vm.node === nodeId && vm.state === 'running') vm.movedAt = s.time;
  // VMs that HA could not place earlier get another try now that there is more memory.
  retryFailedVms(s);
  log(s, 'recover', `${node.name} is back. ${prev === 'cvm-down' ? 'Local I/O returns to its own CVM.' : 'Its CVM rejoins and its drives serve data again.'}`);
  return s;
}

/** Queue VMs that HA could not restart (no host had memory) for another restart attempt. */
export function retryFailedVms(s: ClusterState) {
  for (const vm of s.vms) {
    if (vm.state !== 'failed') continue;
    vm.state = 'restarting';
    vm.restartAt = s.time;
  }
}

/**
 * Remove copies beyond the target, keeping the copy local to the VM. (Rebuild discards the
 * stale copy it replaces, so surplus only appears transiently during moves; this is a guard.)
 */
export function trimSurplus(s: ClusterState) {
  for (const it of s.items) {
    if (it.kind !== 'rf' || it.members.length <= it.target) continue;
    const vmNode = s.vms[it.vm]?.node;
    const ordered = it.members.slice().sort((a, b) => (a.node === vmNode ? -1 : 0) - (b.node === vmNode ? -1 : 0));
    it.members = ordered.slice(0, it.target);
  }
}

/** Replace a failed drive with a new, empty one. Disk balancing fills it over time. */
export function replaceDisk(state: ClusterState, diskId: string): ClusterState {
  const d = state.disks.find((x) => x.id === diskId);
  if (!d || d.state === 'ok') return state;
  const s = clone(state);
  s.disks.find((x) => x.id === diskId)!.state = 'ok';
  log(s, 'info', `Drive ${d.idx + 1} in ${s.nodes[d.node].name} replaced. Disk balancing will spread data onto it.`);
  return s;
}

/** Add a node (expand). Capacity and CVM count grow; disk balancing moves data onto it. */
export function addNode(state: ClusterState): ClusterState {
  if (state.nodes.filter((n) => n.state !== 'removed').length >= 32) return state;
  const s = clone(state);
  const id = s.nodes.length;
  const cfg = { ...s.cfg, nodes: s.cfg.nodes + 1 };
  const node = makeNode({ ...cfg, storageOnly: 0 }, id, s.time);
  node.storageOnly = false;
  s.nodes.push(node);
  s.disks.push(...makeDisks(cfg, id));
  s.cfg = cfg;
  retryFailedVms(s);
  log(s, 'info', `${node.name} joined the cluster. A new CVM adds storage controller capacity; data rebalances onto its drives.`);
  return s;
}

export interface RemoveCheck {
  ok: boolean;
  reason?: string;
}

export function canRemoveNode(state: ClusterState, nodeId: number): RemoveCheck {
  const present = state.nodes.filter((n) => n.state !== 'removed' && n.state !== 'removing');
  const n = state.nodes[nodeId];
  if (!n || n.state !== 'up') return { ok: false, reason: 'Only a healthy node can be removed gracefully.' };
  if (present.some((x) => x.state !== 'up')) return { ok: false, reason: 'Resolve the current failure first: removal needs a healthy cluster.' };
  if (present.length - 1 < MIN_NODES[state.cfg.ft]) {
    return { ok: false, reason: `The cluster must keep at least ${MIN_NODES[state.cfg.ft]} nodes at redundancy factor ${state.cfg.ft}.` };
  }
  return { ok: true };
}

/** Start a graceful removal: the node keeps serving while its data is copied elsewhere first. */
export function removeNode(state: ClusterState, nodeId: number): ClusterState {
  if (!canRemoveNode(state, nodeId).ok) return state;
  const s = clone(state);
  const n = s.nodes[nodeId];
  n.state = 'removing';
  log(s, 'info', `${n.name} removal started. Its data is re-protected on other nodes before it leaves; its VMs migrate off.`);
  const targets = s.nodes.filter((x) => x.state === 'up' && !x.storageOnly);
  let i = 0;
  for (const vm of s.vms) {
    if (vm.node !== nodeId || !targets.length) continue;
    vm.node = targets[i++ % targets.length].id;
    vm.movedAt = s.time;
  }
  return s;
}

/** Live-migrate a VM. It keeps running; its data stays where it is until read (locality rebuilds). */
export function migrateVm(state: ClusterState, vmId: number, toNode: number): ClusterState {
  const vm = state.vms[vmId];
  const target = state.nodes[toNode];
  if (!vm || !target || target.state !== 'up' || target.storageOnly || vm.state !== 'running' || vm.node === toNode) return state;
  const s = clone(state);
  const from = s.nodes[vm.node].name;
  s.vms[vmId].node = toNode;
  s.vms[vmId].movedAt = s.time;
  log(s, 'info', `${vm.name} live-migrated ${from} → ${target.name}. First reads go to the old node over the network; hot data is localized as it is read.`);
  return s;
}

export function reassignZk(s: ClusterState) {
  assignZookeeper(s.nodes, s.cfg.ft, s.domain);
}
