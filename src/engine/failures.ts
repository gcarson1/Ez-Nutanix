// Actions that change the cluster: failures, recoveries, adding/removing nodes, migrating VMs.
// Every action returns a new state (inputs are never mutated) so a timeline can be replayed.
import type { ClusterState, NodeState, SimEvent, SimNode } from './cluster';
import { makeNode, makeDisks, assignZookeeper } from './cluster';
import { MIN_NODES } from './rules';
import { storageLive } from './placement';

/** Illustrative timings (sim seconds). Real values depend on AOS version; see docs/facts.md. */
export const TIMING = {
  /** Host heartbeat loss before AHV HA restarts VMs elsewhere. */
  haDetectS: 40,
  /** Spacing between successive VM restarts in the sim's restart queue. */
  haStaggerS: 6,
  /** Time to boot a restarted VM. */
  vmBootS: 45,
  /** How long a node/CVM must be unreachable before re-protection of its data starts. */
  rebuildDelayS: 60,
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
  // VMs: a powered-off or isolated host loses its VMs; HA restarts them on survivors.
  // A CVM-only failure leaves the hypervisor and its VMs running (I/O is autopathed).
  if (st === 'down' || st === 'isolated') {
    let order = 0;
    for (const vm of s.vms) {
      if (vm.node !== n.id || vm.state !== 'running') continue;
      vm.state = 'restarting';
      vm.restartAt = s.time + TIMING.haDetectS + order * TIMING.haStaggerS;
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
  // Copies that were rebuilt elsewhere while the node was away are now surplus; trim them.
  trimSurplus(s);
  if (prev === 'isolated') {
    for (const vm of s.vms) if (vm.node === nodeId && vm.state === 'running') vm.state = 'running';
  }
  log(s, 'recover', `${node.name} is back. ${prev === 'cvm-down' ? 'Local I/O returns to its own CVM.' : 'Its CVM rejoins and its drives serve data again.'}`);
  return s;
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
