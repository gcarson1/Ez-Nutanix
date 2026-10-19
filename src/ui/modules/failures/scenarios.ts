// Failure Gauntlet: one fixed 8-node cluster (4 blocks of 2 nodes, 3 VMs and 2 drives per
// node, block aware) and six failures. The engine decides the data layout, where HA restarts
// each VM, which data becomes unavailable and where every re-created copy lands; this file
// only paces those results into calm, step-by-step frames. Pure (no DOM), unit tested.
import { createCluster, type ClusterConfig, type ClusterState } from '../../../engine/cluster';
import { applyFailure, type Failure } from '../../../engine/failures';
import { victims } from '../../../engine/timeline';
import { itemLiveCount } from '../../../engine/status';
import type { RF } from '../../../engine/rules';
import { arrivalSlots, flight, prog, rebuilt, settle, stagger, stream, type Slot } from '../cluster-lab/story';

export const G_NODES = 8;
export const PER_BLOCK = 2;
export const G_DRIVES = 2;
export const VMS_PER_NODE = 3;
/** VM slots drawn per node: 3 home VMs plus room for 3 that arrive. */
export const G_SLOTS = 6;
/** A drive holds at most 10 tiles; each tile is a tenth of the drive, so tiles show how full it is. */
export const DRIVE_SLOTS = 10;
/** The engine never fills a drive past 95%, so 9 tiles means the drive is full. */
export const FULL_AT = 9;

export type GId = 'disk' | 'cvm' | 'node' | 'block' | 'double' | 'full';
export type Copies = 2 | 3;
export type GNodeLook = 'up' | 'down' | 'cvm';
export type GVmLook = 'run' | 'stopped' | 'restarting';
/** copy: a copy; single: its piece has fewer copies than normal; new: copy being re-created;
 *  off: copy on a node that is down; gone: offline copy of a piece with no copy online;
 *  lost: copy destroyed with a failed drive. */
export type GTile = 'copy' | 'single' | 'new' | 'off' | 'gone' | 'lost';

export type GAnchor = { k: 'disk'; disk: string } | { k: 'vms'; node: number } | { k: 'cvm'; node: number };

export interface GTileF {
  id: string;
  look: GTile;
}

export interface GVmF {
  id: number;
  at: Slot;
  to?: Slot;
  p?: number;
  look: GVmLook;
}

export interface GArcF {
  id: string;
  kind: 'rebuild' | 'redirect';
  from: GAnchor;
  to: GAnchor;
  dots: number[];
}

export interface GFrame {
  nodes: GNodeLook[];
  vms: GVmF[];
  tiles: Map<string, GTileF[]>;
  failedDisks: string[];
  arcs: GArcF[];
}

export interface GStep {
  at: number;
  /** Short label for the step tracker. */
  label: string;
  /** One sentence for the caption. */
  text: string;
}

export interface GOutcome {
  tone: 'ok' | 'warn' | 'bad';
  text: string;
}

export interface GLegend {
  look: GTile | 'arc-rebuild' | 'arc-redirect' | 'vm-restarting';
  label: string;
}

export interface GDef {
  id: GId;
  copies: Copies;
  steps: GStep[];
  outcome: GOutcome[];
  why: string;
  legend: GLegend[];
  duration: number;
  poster: number;
}

// ── the cluster ──────────────────────────────────────────────────────────────

export function cfgFor(fill: number, rf: RF): Partial<ClusterConfig> {
  return {
    nodes: G_NODES,
    nodesPerBlock: PER_BLOCK,
    racks: 1,
    blockAware: true,
    rackAware: false,
    rf,
    ft: rf,
    ecx: false,
    coldPct: 0,
    drivesPerNode: G_DRIVES,
    driveTB: 3.84,
    media: 'flash',
    vms: G_NODES * VMS_PER_NODE,
    fillPct: Math.round(fill * 100),
    // Tiles in total = items x copies = 16 drives x 10 slots x fill, so tiles show how full drives are.
    items: Math.round((G_NODES * G_DRIVES * DRIVE_SLOTS * fill) / rf),
    seed: 5,
    locality: true,
    haReserve: false,
    vmMemLoadPct: 45,
    rebuildTBph: 1,
    storageOnly: 0,
  };
}

interface Rec {
  id: string;
  item: number;
  node: number;
  disk: string;
  bornAt?: number;
  goneAt?: number;
}

interface Base {
  s0: ClusterState;
  home: Map<number, Slot>;
  recs: Rec[];
}

const BASES = new Map<string, Base>();

function base(fill: number, rf: RF): Base {
  const key = `${fill}|${rf}`;
  const hit = BASES.get(key);
  if (hit) return hit;
  const s0 = createCluster(cfgFor(fill, rf));
  const home = new Map<number, Slot>();
  for (let n = 0; n < G_NODES; n++) {
    s0.vms
      .filter((v) => v.node === n)
      .map((v) => v.id)
      .sort((a, b) => a - b)
      .forEach((id, slot) => home.set(id, { node: n, slot }));
  }
  const recs: Rec[] = [];
  for (const it of s0.items) it.members.forEach((m, k) => recs.push({ id: `${it.id}.${k}`, item: it.id, node: m.node, disk: m.disk }));
  const b = { s0, home, recs };
  BASES.set(key, b);
  return b;
}

const NORMAL = 0.4;
const NEARLY_FULL = 0.85;

/** The node that fails in single-node stories: no Zookeeper role, so the story stays about data. */
export function victim(): number {
  return victims(base(NORMAL, 2).s0)[0];
}

/**
 * The two nodes that fail together: no Zookeeper role, in different blocks, sharing the most
 * pieces of data. In a real cluster any two nodes share a great many pieces, so this sample
 * shows what any pair would.
 */
export function doublePair(): [number, number] {
  const { s0 } = base(NORMAL, 2);
  const free = s0.nodes.filter((n) => !n.zk).map((n) => n.id);
  let best: [number, number] = [free[0], free[1]];
  let most = -1;
  for (let i = 0; i < free.length; i++)
    for (let j = i + 1; j < free.length; j++) {
      const a = free[i];
      const b = free[j];
      if (s0.nodes[a].block === s0.nodes[b].block) continue;
      const shared = s0.items.filter((it) => it.members.some((m) => m.node === a) && it.members.some((m) => m.node === b)).length;
      if (shared > most) {
        most = shared;
        best = [a, b];
      }
    }
  return best;
}

// ── plans: what the engine did ───────────────────────────────────────────────

interface Plan {
  b: Base;
  failAt: number;
  downNodes: number[];
  failedDisk: string | null;
  restarts: { vm: number; dest: Slot }[];
  rebuilds: { item: number; from: string; to: string; start: number; end: number }[];
  /** Items with fewer copies than normal after the failure, and when each is whole again (Infinity if never). */
  shortUntil: Map<number, number>;
  unavailable: Set<number>;
  recs: Rec[];
  cvmBack?: number;
}

interface Timing {
  failAt: number;
  fly: readonly [number, number];
  rebuild: readonly [number, number];
  arc: number;
}

function planFor(fill: number, rf: RF, f: Failure[], tm: Timing): Plan {
  const b = base(fill, rf);
  let s1 = b.s0;
  for (const x of f) s1 = applyFailure(s1, x);
  const s2 = settle(s1);
  const downNodes = s1.nodes.filter((n) => n.state === 'down').map((n) => n.id);
  const diskFailure = f.find((x): x is Extract<Failure, { kind: 'disk' }> => x.kind === 'disk');
  const failedDisk = diskFailure ? diskFailure.disk : null;
  const isShort = (it: (typeof s1.items)[number]) => itemLiveCount(s1, it) < it.target;
  const short = s1.items.filter(isShort);
  const unavailable = new Set(s1.items.filter((it) => itemLiveCount(s1, it) < it.need).map((it) => it.id));

  // HA: restart order from the engine; destination slots after the 3 home VMs.
  const ha = (s2.ha || []).filter((r) => r.to !== null && !r.failed).sort((x, y) => x.order - y.order);
  const dests = arrivalSlots(ha.map((r) => ({ vm: r.vm, to: r.to! })), VMS_PER_NODE);
  const restarts = ha.map((r) => ({ vm: r.vm, dest: dests.get(r.vm)! }));

  const list = rebuilt(s1, s2, (it) => isShort(it) && !unavailable.has(it.id));
  const times = stagger(list.length, tm.rebuild, tm.arc);
  const recs: Rec[] = b.recs.map((r) => ({ ...r, goneAt: failedDisk && r.disk === failedDisk ? tm.failAt + 0.9 : undefined }));
  const rebuilds = list.map((x, k) => {
    recs.push({ id: `${x.item}.r${k}`, item: x.item, node: x.to.node, disk: x.to.disk, bornAt: times[k].end });
    return { item: x.item, from: x.from.disk, to: x.to.disk, start: times[k].start, end: times[k].end };
  });
  const shortUntil = new Map<number, number>();
  for (const it of short) {
    const fin = s2.items[it.id];
    const whole = itemLiveCount(s2, fin) >= fin.target;
    const ends = rebuilds.filter((r) => r.item === it.id).map((r) => r.end);
    shortUntil.set(it.id, whole && ends.length ? Math.max(...ends) : Infinity);
  }
  return { b, failAt: tm.failAt, downNodes, failedDisk, restarts, rebuilds, shortUntil, unavailable, recs };
}

const T_NODE: Timing = { failAt: 2, fly: [5.8, 9.0], rebuild: [10.0, 14.6], arc: 1.3 };
const T_DISK: Timing = { failAt: 2, fly: [0, 0], rebuild: [5.8, 10.2], arc: 1.3 };
const T_BLOCK: Timing = { failAt: 2, fly: [5.8, 9.6], rebuild: [10.4, 15.0], arc: 1.3 };
const T_DOUBLE: Timing = { failAt: 2, fly: [8.8, 12.4], rebuild: [12.8, 16.2], arc: 1.3 };
const T_FULL: Timing = { failAt: 2, fly: [5.8, 9.0], rebuild: [10.0, 14.0], arc: 1.3 };
const CVM = { failAt: 2, redirect: 4.5, back: 10 } as const;

const PLANS = new Map<string, Plan>();

export function plan(id: GId, copies: Copies = 2): Plan {
  const key = `${id}|${id === 'double' ? copies : 2}`;
  const hit = PLANS.get(key);
  if (hit) return hit;
  const v = victim();
  let p: Plan;
  switch (id) {
    case 'node':
      p = planFor(NORMAL, 2, [{ kind: 'node', node: v }], T_NODE);
      break;
    case 'disk':
      p = planFor(NORMAL, 2, [{ kind: 'disk', disk: `${v}.0` }], T_DISK);
      break;
    case 'block':
      p = planFor(NORMAL, 2, [{ kind: 'block', block: base(NORMAL, 2).s0.nodes[v].block }], T_BLOCK);
      break;
    case 'double': {
      const [a, b] = doublePair();
      p = planFor(NORMAL, copies, [
        { kind: 'node', node: a },
        { kind: 'node', node: b },
      ], T_DOUBLE);
      break;
    }
    case 'full':
      p = planFor(NEARLY_FULL, 2, [{ kind: 'node', node: v }], T_FULL);
      break;
    case 'cvm': {
      const b = base(NORMAL, 2);
      const short = new Map<number, number>();
      for (const it of b.s0.items) if (it.members.some((m) => m.node === v)) short.set(it.id, CVM.back);
      p = { b, failAt: CVM.failAt, downNodes: [], failedDisk: null, restarts: [], rebuilds: [], shortUntil: short, unavailable: new Set(), recs: b.recs, cvmBack: CVM.back };
      break;
    }
  }
  PLANS.set(key, p);
  return p;
}

// ── frames ───────────────────────────────────────────────────────────────────

function tilesAt(p: Plan, t: number, cvmNode: number | null): Map<string, GTileF[]> {
  const out = new Map<string, GTileF[]>();
  for (let n = 0; n < G_NODES; n++) for (let d = 0; d < G_DRIVES; d++) out.set(`${n}.${d}`, []);
  const failed = t >= p.failAt;
  const cvmDown = cvmNode !== null && failed && t < (p.cvmBack ?? Infinity);
  const born = new Map(p.recs.filter((r) => r.bornAt !== undefined).map((r) => [r.id, r.bornAt!]));
  for (const r of p.recs) {
    if (r.bornAt !== undefined && t < r.bornAt) continue;
    if (r.goneAt !== undefined && t >= r.goneAt) continue;
    let look: GTile = 'copy';
    const b = born.get(r.id);
    if (p.failedDisk && r.disk === p.failedDisk && failed) look = 'lost';
    else if (failed && p.downNodes.includes(r.node)) look = p.unavailable.has(r.item) ? 'gone' : 'off';
    else if (cvmDown && r.node === cvmNode) look = 'off';
    else if (b !== undefined && t - b < 1.1) look = 'new';
    else if (failed && t < (p.shortUntil.get(r.item) ?? -Infinity)) look = 'single';
    out.get(r.disk)!.push({ id: r.id, look });
  }
  return out;
}

function vmsAt(p: Plan, t: number, fly: readonly [number, number]): GVmF[] {
  const failed = t >= p.failAt;
  const order = p.restarts.map((r) => r.vm);
  return p.b.s0.vms.map((v) => {
    const at = p.b.home.get(v.id)!;
    if (!failed || !p.downNodes.includes(at.node)) return { id: v.id, at, look: 'run' as GVmLook };
    const k = order.indexOf(v.id);
    if (k < 0) return { id: v.id, at, look: 'stopped' as GVmLook };
    const f = flight(t, k, fly, order.length, 1.5);
    if (t < f.a) return { id: v.id, at, look: 'stopped' as GVmLook };
    if (t < f.b) return { id: v.id, at, to: p.restarts[k].dest, p: f.p, look: 'restarting' as GVmLook };
    return { id: v.id, at: p.restarts[k].dest, look: 'run' as GVmLook };
  });
}

function rebuildArcs(p: Plan, t: number): GArcF[] {
  const arcs: GArcF[] = [];
  for (const r of p.rebuilds)
    if (t >= r.start && t < r.end + 0.25)
      arcs.push({ id: `rb${r.item}-${r.to}`, kind: 'rebuild', from: { k: 'disk', disk: r.from }, to: { k: 'disk', disk: r.to }, dots: t < r.end ? [prog(t, r.start, r.end)] : [] });
  return arcs;
}

const TIMING: Record<Exclude<GId, 'cvm'>, Timing> = { node: T_NODE, disk: T_DISK, block: T_BLOCK, double: T_DOUBLE, full: T_FULL };

export function frameAt(id: GId, copies: Copies, t: number): GFrame {
  const p = plan(id, copies);
  if (id === 'cvm') {
    const v = victim();
    const down = t >= CVM.failAt && t < CVM.back;
    const arcs: GArcF[] = [];
    if (down && t >= CVM.redirect) {
      // The host's I/O goes to CVMs on other nodes: draw the two nearest.
      const peers = Array.from({ length: G_NODES }, (_, x) => x)
        .filter((x) => x !== v)
        .sort((a, b) => Math.abs(a - v) - Math.abs(b - v) || a - b)
        .slice(0, 2);
      for (const q of peers) arcs.push({ id: `io${q}`, kind: 'redirect', from: { k: 'vms', node: v }, to: { k: 'cvm', node: q }, dots: stream(t, 2, 0.6) });
    }
    return {
      nodes: Array.from({ length: G_NODES }, (_, n) => (n === v && down ? 'cvm' : 'up')),
      vms: vmsAt(p, t, [0, 0]),
      tiles: tilesAt(p, t, v),
      failedDisks: [],
      arcs,
    };
  }
  const tm = TIMING[id];
  const failed = t >= p.failAt;
  return {
    nodes: Array.from({ length: G_NODES }, (_, n) => (failed && p.downNodes.includes(n) ? 'down' : 'up')),
    vms: vmsAt(p, t, tm.fly),
    tiles: tilesAt(p, t, null),
    failedDisks: failed && p.failedDisk ? [p.failedDisk] : [],
    arcs: rebuildArcs(p, t),
  };
}

// ── words ────────────────────────────────────────────────────────────────────

const name = (n: number) => `N${n + 1}`;

const L_COPY: GLegend = { look: 'copy', label: 'Copy of a piece of data' };
const L_SHORT: GLegend = { look: 'single', label: 'Fewer copies than normal' };
const L_OFF: GLegend = { look: 'off', label: 'Offline copy' };
const L_NEW: GLegend = { look: 'new', label: 'Copy being re-created' };

export function defFor(id: GId, copies: Copies = 2): GDef {
  const v = name(victim());
  const p = plan(id, copies);
  const vmCount = p.restarts.length;
  switch (id) {
    case 'node':
      return {
        id,
        copies: 2,
        steps: [
          { at: 0, label: 'Running', text: 'Eight nodes in four blocks. Every piece of data has two copies, on different nodes.' },
          { at: 2, label: `${v} fails`, text: `${v} loses power. Its ${vmCount} VMs stop and the copies on its drives go offline.` },
          { at: 5.5, label: 'VMs restart', text: 'High availability (HA) restarts those VMs on other nodes, typically within about two minutes.' },
          { at: 9.6, label: 'Copies re-created', text: 'Every surviving node re-creates some of the missing copies, all at the same time.' },
          { at: 15, label: 'Protected', text: 'Every piece of data has two copies again. Nobody had to step in.' },
        ],
        outcome: [
          { tone: 'ok', text: 'VMs restarted on other nodes, typically in about two minutes' },
          { tone: 'ok', text: 'No data lost or unavailable' },
          { tone: 'ok', text: 'Back to two copies on its own' },
        ],
        why: 'Recovery doesn’t wait for a person or a spare part. And because every node helps rebuild, bigger clusters heal faster.',
        legend: [L_COPY, L_SHORT, L_OFF, L_NEW],
        duration: 18,
        poster: 12,
      };
    case 'disk':
      return {
        id,
        copies: 2,
        steps: [
          { at: 0, label: 'Running', text: 'Eight nodes in four blocks. Every piece of data has two copies, on different nodes.' },
          { at: 2, label: 'A drive fails', text: `A drive in ${v} fails. The copies on it are gone, but each of those pieces still has a copy on another node.` },
          { at: 5.5, label: 'Copies re-created', text: 'Every node helps re-create the missing copies from the surviving ones. VMs keep running throughout.' },
          { at: 10.5, label: 'Protected', text: 'Two copies of everything again. The drive can be replaced whenever it suits you.' },
        ],
        outcome: [
          { tone: 'ok', text: 'VMs kept running' },
          { tone: 'ok', text: 'No data lost or unavailable' },
          { tone: 'ok', text: 'Back to two copies on its own' },
        ],
        why: 'The rebuild is shared by every node instead of funneled into one spare drive, so no single drive or node becomes the bottleneck.',
        legend: [L_COPY, L_SHORT, { look: 'lost', label: 'Copy lost with the drive' }, L_NEW],
        duration: 14,
        poster: 8,
      };
    case 'cvm':
      return {
        id,
        copies: 2,
        steps: [
          { at: 0, label: 'Running', text: 'Each node’s VMs read and write through the Controller VM (CVM) on their own node.' },
          { at: 2, label: 'CVM stops', text: `${v}’s CVM stops. The node and its VMs keep running: nothing restarts.` },
          { at: 4.5, label: 'I/O redirected', text: 'Their storage I/O goes over the network to CVMs on other nodes, with a little extra latency. Copies on its drives are offline meanwhile.' },
          { at: 10, label: 'CVM back', text: 'The CVM comes back and I/O returns to it. Its copies count again.' },
          { at: 13, label: 'Done', text: 'No VM restarted and no data was lost.' },
        ],
        outcome: [
          { tone: 'ok', text: 'VMs kept running: no restart' },
          { tone: 'ok', text: 'No data lost or unavailable' },
          { tone: 'ok', text: 'I/O back on the local CVM when it returns' },
        ],
        why: 'The storage controller runs on every node, so losing one controller slows a node down a little instead of stopping it. If the CVM stayed down, the cluster would re-create its copies elsewhere, as it does for a node failure.',
        legend: [L_COPY, L_SHORT, L_OFF, { look: 'arc-redirect', label: 'I/O redirected to another CVM' }],
        duration: 16,
        poster: 7,
      };
    case 'block':
      return {
        id,
        copies: 2,
        steps: [
          { at: 0, label: 'Running', text: 'Block awareness keeps the two copies of every piece in different blocks (chassis).' },
          { at: 2, label: 'A block fails', text: `A whole block loses power: ${p.downNodes.map(name).join(' and ')} go down together, with their ${vmCount} VMs.` },
          { at: 5.5, label: 'VMs restart', text: `HA restarts the ${vmCount} VMs on the other nodes.` },
          { at: 10, label: 'Copies re-created', text: 'Every piece still had a copy in another block, so the other blocks re-create the missing copies.' },
          { at: 15.4, label: 'Protected', text: 'Nothing was unavailable at any point, and two copies are back, still in different blocks.' },
        ],
        outcome: [
          { tone: 'ok', text: 'VMs restarted on other nodes' },
          { tone: 'ok', text: 'No data unavailable: copies were in different blocks' },
          { tone: 'ok', text: 'Back to two copies on its own' },
        ],
        why: 'Nodes in one chassis can share power and cooling. Block awareness turns a whole-chassis failure into something the cluster rides through. It needs at least 3 blocks with two copies (5 with three).',
        legend: [L_COPY, L_SHORT, L_OFF, L_NEW],
        duration: 18.5,
        poster: 12,
      };
    case 'double': {
      const [a, b] = doublePair();
      const pair = `${name(a)} and ${name(b)}`;
      if (copies === 2)
        return {
          id,
          copies,
          steps: [
            { at: 0, label: 'Running', text: 'Two copies of every piece of data (RF2), on different nodes.' },
            { at: 2, label: 'Two nodes fail', text: `${pair} fail at the same moment.` },
            { at: 5, label: 'Some data unavailable', text: 'Pieces that had both copies on those two nodes have no copy online. They stay unavailable until one of the nodes comes back.' },
            { at: 8.5, label: 'Recovery', text: 'HA restarts the VMs on other nodes. Pieces that still have a copy are re-created; the unavailable ones have nothing to copy from.' },
            { at: 16.6, label: 'Result', text: 'Two copies protect against one failure at a time. Switch to three copies (RF3) to see the same failure survived.' },
          ],
          outcome: [
            { tone: 'ok', text: 'VMs restarted on other nodes' },
            { tone: 'bad', text: 'Some data unavailable until a node returns' },
            { tone: 'warn', text: 'Three copies (RF3) survive this' },
          ],
          why: 'Two copies tolerate one failure at a time. Two at once, or a second failure before the rebuild finishes, is the risk window that three copies, and block or rack awareness, are for.',
          legend: [L_COPY, L_SHORT, { look: 'gone', label: 'No copy online' }, L_NEW],
          duration: 20,
          poster: 7,
        };
      return {
        id,
        copies,
        steps: [
          { at: 0, label: 'Running', text: 'Three copies of every piece of data (RF3), on different nodes.' },
          { at: 2, label: 'Two nodes fail', text: `${pair} fail at the same moment.` },
          { at: 5, label: 'Still available', text: 'Every piece still has at least one copy online, so nothing is unavailable.' },
          { at: 8.5, label: 'Recovery', text: 'HA restarts the VMs on other nodes, and every surviving node re-creates the missing copies.' },
          { at: 16.6, label: 'Protected', text: 'Three copies of everything again.' },
        ],
        outcome: [
          { tone: 'ok', text: 'VMs restarted on other nodes' },
          { tone: 'ok', text: 'No data unavailable' },
          { tone: 'ok', text: 'Back to three copies on its own' },
        ],
        why: 'Three copies survive two failures at once, at the cost of a third copy of every piece of data and needing at least five nodes.',
        legend: [L_COPY, L_SHORT, L_OFF, L_NEW],
        duration: 20,
        poster: 12,
      };
    }
    case 'full':
      return {
        id,
        copies: 2,
        steps: [
          { at: 0, label: 'Running', text: 'The same cluster, but its drives are about 85% full.' },
          { at: 2, label: `${v} fails`, text: `${v} loses power. Its ${vmCount} VMs stop and the copies on its drives go offline.` },
          { at: 5.5, label: 'VMs restart', text: 'HA restarts those VMs on other nodes.' },
          { at: 9.6, label: 'Out of space', text: 'The other nodes start re-creating copies, but their drives fill up before every copy is back.' },
          { at: 14.6, label: 'Result', text: 'Data stays available, but some pieces have only one copy until capacity is added.' },
        ],
        outcome: [
          { tone: 'ok', text: 'VMs restarted on other nodes' },
          { tone: 'ok', text: 'No data lost or unavailable' },
          { tone: 'bad', text: 'Cannot fully re-protect: no free space' },
        ],
        why: 'Self-healing needs room on the survivors. Common sizing guidance is to keep one node’s worth of space free with two copies, so a node failure can always be fully re-protected.',
        legend: [L_COPY, L_SHORT, L_OFF, L_NEW],
        duration: 18,
        poster: 15,
      };
  }
}

export const IDS: GId[] = ['disk', 'cvm', 'node', 'block', 'double', 'full'];

export function stepIndex(def: GDef, t: number): number {
  let i = 0;
  def.steps.forEach((s, k) => {
    if (t >= s.at - 1e-9) i = k;
  });
  return i;
}
