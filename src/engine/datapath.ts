// Data path state machines: the write path (OpLog or direct to the extent store), the read
// path (cache, OpLog, local extent store, remote replica), the content-cache touch pools,
// and the data-locality sequence after a live migration. Pure and deterministic: the UI
// renders a step list and never decides behavior itself.
import { makeRng, shuffle } from './rng';
import type { RF } from './rules';

/** Nodes drawn in the data-path diagram. Node 0 hosts the VM. */
export const DP_NODES = 5;

export type WriteKind = 'random' | 'sequential';
export type ReadSource = 'cache' | 'oplog' | 'local' | 'remote';

/** A labeled hop in the diagram. Node ids index the diagram nodes. */
export interface Hop {
  from: Place;
  to: Place;
  kind: 'io' | 'replicate' | 'ack' | 'drain' | 'read' | 'network-read' | 'tier';
}

export type Place =
  | { at: 'vm' }
  | { at: 'stargate'; node: number }
  | { at: 'oplog'; node: number }
  | { at: 'extent'; node: number }
  | { at: 'cache'; node: number };

export interface DpStep {
  id: string;
  title: string;
  text: string;
  /** Places highlighted in this step. */
  active: Place[];
  hops: Hop[];
  /** Nodes holding a durable copy of the new write in the OpLog after this step. */
  oplogCopies: number[];
  /** Nodes holding a durable copy of the new write in the extent store after this step. */
  extentCopies: number[];
  /** True once the guest has been told the write is complete. */
  acked: boolean;
  /** Read only: where the data was served from, once found. */
  servedFrom?: ReadSource;
  /** Read only: places checked so far that did not have the data. */
  misses?: ReadSource[];
}

/**
 * Remote CVMs that receive the replica copies. AOS picks them dynamically across the
 * cluster based on load; here a seeded shuffle stands in for that choice.
 */
export function replicaTargets(rf: RF, seed: number, nodes = DP_NODES, local = 0): number[] {
  const others = Array.from({ length: nodes }, (_, i) => i).filter((i) => i !== local);
  return shuffle(makeRng(seed), others).slice(0, rf - 1);
}

const vm = { at: 'vm' } as const;
const sg = (node: number) => ({ at: 'stargate', node }) as const;
const op = (node: number) => ({ at: 'oplog', node }) as const;
const ex = (node: number) => ({ at: 'extent', node }) as const;
const ca = (node: number) => ({ at: 'cache', node }) as const;

/** Write path for one write from a VM on node 0. */
export function writeSequence(o: { rf: RF; kind: WriteKind; seed?: number }): DpStep[] {
  const targets = replicaTargets(o.rf, o.seed ?? 1);
  const all = [0, ...targets];
  const copiesWord = o.rf === 2 ? 'one other CVM' : 'two other CVMs';
  const steps: DpStep[] = [];
  const push = (s: Omit<DpStep, 'oplogCopies' | 'extentCopies' | 'acked'> & Partial<DpStep>) =>
    steps.push({ oplogCopies: [], extentCopies: [], acked: false, ...s });

  push({
    id: 'issue',
    title: 'The VM issues a write',
    text: 'The guest writes to its virtual disk. The hypervisor hands the I/O to the Controller VM (CVM) on the same node, so the first hop never leaves the server.',
    active: [vm, sg(0)],
    hops: [{ from: vm, to: sg(0), kind: 'io' }],
  });

  if (o.kind === 'random') {
    push({
      id: 'classify',
      title: 'Stargate sees a random or bursty write',
      text: 'Stargate, the data-path service in the CVM, classifies the I/O. Small random or bursty writes go to the OpLog, a write buffer on the fastest drives.',
      active: [sg(0), op(0)],
      hops: [],
    });
    push({
      id: 'local',
      title: 'First copy lands in the local OpLog',
      text: 'One copy is always written on the node where the VM runs. The write is not acknowledged yet.',
      active: [op(0)],
      hops: [{ from: sg(0), to: op(0), kind: 'io' }],
      oplogCopies: [0],
    });
    push({
      id: 'replicate',
      title: `Replicate to the OpLog of ${copiesWord}`,
      text: `At the same time, Stargate sends the write over the network to ${copiesWord}. AOS picks the peers dynamically across the cluster, so every CVM shares this work.`,
      active: targets.flatMap((n) => [sg(n), op(n)]),
      hops: targets.map((n) => ({ from: sg(0), to: op(n), kind: 'replicate' as const })),
      oplogCopies: all,
    });
    push({
      id: 'peer-ack',
      title: 'Peers confirm their copies',
      text: `Each remote CVM confirms once its copy is persisted. Now ${o.rf} copies exist on ${o.rf} different nodes.`,
      active: [sg(0)],
      hops: targets.map((n) => ({ from: op(n), to: sg(0), kind: 'ack' as const })),
      oplogCopies: all,
    });
    push({
      id: 'ack',
      title: 'Only now is the write acknowledged',
      text: `The VM gets its acknowledgement after all ${o.rf} copies are written. A node failure at any moment after this point cannot lose the write.`,
      active: [vm],
      hops: [{ from: sg(0), to: vm, kind: 'ack' }],
      oplogCopies: all,
      acked: true,
    });
    push({
      id: 'drain',
      title: 'Later: the OpLog drains to the extent store',
      text: 'In the background, the OpLog coalesces neighboring writes and drains them sequentially into the extent store, the cluster’s long-term storage. Each node drains its own copy, so the data keeps its replication factor.',
      active: all.map(ex),
      hops: all.map((n) => ({ from: op(n), to: ex(n), kind: 'drain' as const })),
      extentCopies: all,
      acked: true,
    });
  } else {
    push({
      id: 'classify',
      title: 'Stargate sees a large sequential write',
      text: 'When outstanding write data for a virtual disk passes a threshold, Stargate treats the stream as sequential and skips the OpLog. Buffering it would add a second write for no benefit.',
      active: [sg(0), ex(0)],
      hops: [],
    });
    push({
      id: 'local',
      title: 'First copy goes straight to the local extent store',
      text: 'One copy is written on the node where the VM runs, directly into the extent store. The write is not acknowledged yet.',
      active: [ex(0)],
      hops: [{ from: sg(0), to: ex(0), kind: 'io' }],
      extentCopies: [0],
    });
    push({
      id: 'replicate',
      title: `Replicate to the extent store of ${copiesWord}`,
      text: `Bypassing the OpLog does not bypass protection. The same replication factor applies: copies go to ${copiesWord}.`,
      active: targets.flatMap((n) => [sg(n), ex(n)]),
      hops: targets.map((n) => ({ from: sg(0), to: ex(n), kind: 'replicate' as const })),
      extentCopies: all,
    });
    push({
      id: 'peer-ack',
      title: 'Peers confirm their copies',
      text: `Each remote CVM confirms once its copy is persisted. Now ${o.rf} copies exist on ${o.rf} different nodes.`,
      active: [sg(0)],
      hops: targets.map((n) => ({ from: ex(n), to: sg(0), kind: 'ack' as const })),
      extentCopies: all,
    });
    push({
      id: 'ack',
      title: 'Only now is the write acknowledged',
      text: `The VM gets its acknowledgement after all ${o.rf} copies are written, exactly as on the OpLog path.`,
      active: [vm],
      hops: [{ from: sg(0), to: vm, kind: 'ack' }],
      extentCopies: all,
      acked: true,
    });
  }

  const last = steps[steps.length - 1];
  push({
    id: 'ilm',
    title: 'ILM keeps data on the right tier',
    text: 'Information lifecycle management (ILM), run by the Curator service, keeps frequently accessed data on the fastest media and, on hybrid nodes, moves cold data down to hard drives over time.',
    active: all.map(ex),
    hops: all.map((n) => ({ from: ex(n), to: ex(n), kind: 'tier' as const })),
    extentCopies: last.extentCopies.length ? last.extentCopies : all,
    acked: true,
  });
  return steps;
}

const ORDER: ReadSource[] = ['cache', 'oplog', 'local', 'remote'];

/** Read path: checks each place in order until the data is found at `source`. */
export function readSequence(o: { source: ReadSource; seed?: number }): DpStep[] {
  const remote = replicaTargets(2, o.seed ?? 1)[0];
  const steps: DpStep[] = [];
  const misses: ReadSource[] = [];
  const base = { oplogCopies: [], extentCopies: [], acked: false };
  steps.push({
    ...base,
    id: 'issue',
    title: 'The VM issues a read',
    text: 'The read goes to the local CVM’s Stargate, which looks for the data in the fastest place first.',
    active: [vm, sg(0)],
    hops: [{ from: vm, to: sg(0), kind: 'io' }],
    misses: [],
  });
  const place: Record<ReadSource, Place> = { cache: ca(0), oplog: op(0), local: ex(0), remote: ex(remote) };
  const hitText: Record<ReadSource, string> = {
    cache: 'Hit in the content cache in CVM memory. This is the fastest answer. Data read once enters the single-touch pool; read again, it is promoted to the multi-touch pool so it stays cached longer.',
    oplog: 'The data was written recently and has not drained yet, so the OpLog serves it. Reads always see the latest write.',
    local: 'Read from the extent store on this node’s own drives. No network hop is needed, which is the point of data locality.',
    remote: `No local copy exists (for example, just after the VM moved). Stargate reads the replica on node ${remote + 1} over the network. This works, but adds a network round trip.`,
  };
  const missText: Record<ReadSource, string> = {
    cache: 'Not in the content cache.',
    oplog: 'Not in the OpLog: this data drained to the extent store earlier.',
    local: 'No copy in this node’s extent store.',
    remote: '',
  };
  const titles: Record<ReadSource, string> = {
    cache: 'Check the content cache',
    oplog: 'Check the OpLog',
    local: 'Check the local extent store',
    remote: 'Read a remote replica',
  };
  for (const s of ORDER) {
    const hit = s === o.source;
    if (!hit) misses.push(s);
    steps.push({
      ...base,
      id: s,
      title: hit ? `${titles[s]}: found` : `${titles[s]}: miss`,
      text: hit ? hitText[s] : missText[s],
      active: [place[s]],
      hops: [{ from: sg(0), to: place[s], kind: s === 'remote' ? 'network-read' : 'read' }],
      servedFrom: hit ? s : undefined,
      misses: misses.slice(),
    });
    if (hit) break;
  }
  steps.push({
    ...base,
    id: 'return',
    title: 'Data returns to the VM',
    text: o.source === 'remote' ? 'The data reaches the VM. If the VM moved here recently, AOS can copy data it keeps reading to this node so later reads stay local (see Locality after a move).' : 'The data reaches the VM without leaving the node.',
    active: [vm],
    hops: [{ from: sg(0), to: vm, kind: 'ack' }],
    servedFrom: o.source,
    misses: misses.slice(),
  });
  return steps;
}

/**
 * Illustrative latency ladder in relative units (local flash = 10). Ordering is the point;
 * the absolute values depend on media, network and load.
 */
export const LATENCY_LADDER: { source: ReadSource; label: string; units: number }[] = [
  { source: 'cache', label: 'Content cache (memory)', units: 1 },
  { source: 'oplog', label: 'OpLog (fast flash)', units: 8 },
  { source: 'local', label: 'Local extent store', units: 10 },
  { source: 'remote', label: 'Remote replica (network hop)', units: 18 },
];

// ── content cache single-touch / multi-touch ──

export interface CacheState {
  single: string[]; // most recent last
  multi: string[];
}

/** One read of `key`: a first touch enters single-touch; a second touch promotes to multi-touch. */
export function cacheAccess(state: CacheState, key: string, cap = { single: 4, multi: 4 }): { state: CacheState; hit: 'single' | 'multi' | null } {
  const single = state.single.filter((k) => k !== key);
  const multi = state.multi.filter((k) => k !== key);
  let hit: 'single' | 'multi' | null = null;
  if (state.multi.includes(key)) {
    hit = 'multi';
    multi.push(key);
  } else if (state.single.includes(key)) {
    hit = 'single';
    multi.push(key);
  } else {
    single.push(key);
  }
  // Evict oldest; an item evicted from multi-touch drops back to single-touch.
  while (multi.length > cap.multi) single.push(multi.shift()!);
  while (single.length > cap.single) single.shift();
  return { state: { single, multi }, hit };
}

// ── data locality after a live migration ──

export interface LocalityFrame {
  t: number;
  phase: 'before' | 'migrate' | 'after';
  vmNode: number;
  /** Per hot extent: node holding a replica the VM can read locally (true) or not. */
  local: boolean[];
  /** Extent read in this frame, if any. */
  read: number | null;
  readRemote: boolean;
  localized: number | null;
  /** Illustrative read latency for this frame, relative units. */
  latency: number;
  /** Cumulative network read traffic since the migration, MB (illustrative). */
  networkMB: number;
  text: string;
}

/**
 * Locality sequence: the VM reads its hot extents locally, live-migrates, reads them
 * remotely at first, and each remote read localizes that extent on the new node.
 */
export function localitySequence(o: { extents?: number; readsBefore?: number; seed?: number; extentMB?: number }): LocalityFrame[] {
  const n = o.extents ?? 8;
  const before = o.readsBefore ?? 4;
  const mb = o.extentMB ?? 1;
  const rng = makeRng(o.seed ?? 3);
  const lat = (remote: boolean) => (remote ? LATENCY_LADDER[3].units : LATENCY_LADDER[2].units);
  const frames: LocalityFrame[] = [];
  let local = Array.from({ length: n }, () => true);
  let t = 0;
  let net = 0;
  for (let i = 0; i < before; i++) {
    const r = Math.floor(rng() * n);
    frames.push({ t: t++, phase: 'before', vmNode: 0, local: local.slice(), read: r, readRemote: false, localized: null, latency: lat(false), networkMB: 0, text: 'The VM reads its hot data from its own node. No network traffic for reads.' });
  }
  local = local.map(() => false);
  frames.push({ t: t++, phase: 'migrate', vmNode: 1, local: local.slice(), read: null, readRemote: false, localized: null, latency: 0, networkMB: 0, text: 'The VM live-migrates to node 2. Its data stays where it was; only the VM moved.' });
  // Every hot extent is read once (in a shuffled order), then a couple of extra reads show it staying local.
  const order = shuffle(rng, Array.from({ length: n }, (_, i) => i));
  for (const r of order) {
    const remote = !local[r];
    if (remote) net += mb;
    local[r] = true;
    frames.push({
      t: t++,
      phase: 'after',
      vmNode: 1,
      local: local.slice(),
      read: r,
      readRemote: remote,
      localized: remote ? r : null,
      latency: lat(remote),
      networkMB: net,
      text: remote ? 'First read after the move goes over the network to a remote replica. The extent is then copied to the new node.' : 'This extent was already localized, so the read stays on the node.',
    });
  }
  for (let i = 0; i < 3; i++) {
    const r = Math.floor(rng() * n);
    frames.push({ t: t++, phase: 'after', vmNode: 1, local: local.slice(), read: r, readRemote: false, localized: null, latency: lat(false), networkMB: net, text: 'All hot data is local again. Reads are back to local latency and read traffic on the network stops.' });
  }
  return frames;
}

/** Summary for the before/after comparison. */
export function localitySummary(frames: LocalityFrame[]) {
  const after = frames.filter((f) => f.phase === 'after');
  const before = frames.filter((f) => f.phase === 'before');
  const avg = (fs: LocalityFrame[]) => (fs.length ? fs.reduce((a, f) => a + f.latency, 0) / fs.length : 0);
  const firstRemote = after.findIndex((f) => !f.readRemote);
  return {
    beforeLatency: avg(before),
    afterMoveLatency: LATENCY_LADDER[3].units,
    settledLatency: after.length ? after[after.length - 1].latency : 0,
    afterAvgLatency: avg(after),
    remoteReads: after.filter((f) => f.readRemote).length,
    networkMB: after.length ? after[after.length - 1].networkMB : 0,
    firstLocalIndex: firstRemote,
  };
}
