// Cluster & DSF Lab: one fixed cluster (4 nodes, 4 VMs and 3 drives per node, RF2) and five
// short, looping stories. The engine decides the data layout, which node HA restarts each VM
// on, and where every re-created copy lands; this file only paces those results into frames.
// Pure (no DOM), so the frames are unit tested.
import { createCluster, type ClusterConfig, type ClusterState, type DataItem } from '../../../engine/cluster';
import { applyFailure } from '../../../engine/failures';
import { tick } from '../../../engine/rebuild';
import { itemLiveCount } from '../../../engine/status';

export const NODES = 4;
export const VMS_PER_NODE = 4;
export const DRIVES = 3;
/** VM slots drawn per node: 4 home VMs plus room for VMs that arrive. */
export const SLOTS = 6;
/** Data tiles a drive can show (4 columns x 5 rows in the diagram). */
export const TILE_CAP = 20;

export const LAB_CFG: Partial<ClusterConfig> = {
  nodes: NODES,
  nodesPerBlock: 4,
  racks: 1,
  blockAware: false,
  rackAware: false,
  rf: 2,
  ft: 2,
  ecx: false,
  coldPct: 0,
  drivesPerNode: DRIVES,
  driveTB: 3.84,
  media: 'flash',
  vms: NODES * VMS_PER_NODE,
  fillPct: 30,
  items: NODES * VMS_PER_NODE * 3, // three pieces of data per VM
  seed: 11,
  locality: true,
  haReserve: false,
  vmMemLoadPct: 40,
  rebuildTBph: 1,
  storageOnly: 0,
};

// ── frame model ──────────────────────────────────────────────────────────────

export type ScenarioId = 'place' | 'migrate' | 'maint' | 'failover' | 'drive';
export type NodeLook = 'up' | 'off' | 'entering' | 'maint' | 'returning';
export type VmLook = 'run' | 'moving' | 'stopped' | 'restarting';
/** local = copy on the node where its VM runs; copy = any other copy (or every copy, when local isn't the point). */
export type TileLook = 'local' | 'copy' | 'single' | 'new' | 'off' | 'lost';
export type ArcKind = 'write' | 'copy' | 'rebuild' | 'localize' | 'read' | 'resync';

export interface Slot {
  node: number;
  slot: number;
}

/** Endpoints for arcs. `lane` is the bottom of a node's card, where network traffic arrives. */
export type Anchor = { k: 'vm'; at: Slot } | { k: 'cvm'; node: number } | { k: 'disk'; disk: string } | { k: 'lane'; node: number };

export interface TileF {
  id: string;
  look: TileLook;
  dim?: boolean;
}

export interface VmF {
  id: number;
  label: string;
  at: Slot;
  /** While moving: destination and 0..1 progress along the path. */
  to?: Slot;
  p?: number;
  look: VmLook;
  hl?: boolean;
}

export interface ArcF {
  id: string;
  kind: ArcKind;
  from: Anchor;
  to: Anchor;
  /** Positions (0..1) of the moving dots along the arc. */
  dots: number[];
}

export interface Frame {
  nodes: NodeLook[];
  vms: VmF[];
  /** Tiles per drive id ("node.drive"), bottom-up order. */
  tiles: Map<string, TileF[]>;
  failedDisks: string[];
  arcs: ArcF[];
  /** Show the "one storage pool" bracket under the drives. */
  pool: boolean;
  /** Short confirmation shown in a node's header in place of its state. */
  tag?: { node: number; text: string };
}

export interface Step {
  at: number;
  text: string;
}

export interface LegendItem {
  look: TileLook | 'arc-rebuild' | 'arc-localize' | 'arc-read' | 'arc-write';
  label: string;
}

export interface ScenarioDef {
  id: ScenarioId;
  label: string;
  icon: string;
  title: string;
  lede: string;
  steps: Step[];
  why: string;
  legend: LegendItem[];
  /** Loop length in seconds. */
  duration: number;
  /** Frame shown when motion is reduced (the clock starts paused here). */
  poster: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const prog = (t: number, a: number, b: number) => (b <= a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a)));
export const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
/** Evenly spaced dots streaming along an arc, looping with time. */
const stream = (t: number, n = 3, speed = 0.7) => Array.from({ length: n }, (_, k) => (t * speed + k / n) % 1);

export function stepAt(def: ScenarioDef, t: number): number {
  let i = 0;
  def.steps.forEach((s, k) => {
    if (t >= s.at - 1e-9) i = k;
  });
  return i;
}

interface Rec {
  id: string;
  item: number;
  node: number;
  disk: string;
  bornAt?: number;
  goneAt?: number;
}

export interface Lab {
  s0: ClusterState;
  home: Map<number, Slot>;
  labels: Map<number, string>;
  /** Initial copies, one record per member, grouped later by drive. */
  recs: Rec[];
  byLabel: (label: string) => number;
}

let LAB: Lab | null = null;

/** The fixed cluster and its initial layout (built once). */
export function lab(): Lab {
  if (LAB) return LAB;
  const s0 = createCluster(LAB_CFG);
  const home = new Map<number, Slot>();
  const labels = new Map<number, string>();
  for (let n = 0; n < NODES; n++) {
    const ids = s0.vms.filter((v) => v.node === n).map((v) => v.id).sort((a, b) => a - b);
    ids.forEach((id, slot) => {
      home.set(id, { node: n, slot });
      labels.set(id, `VM${n * VMS_PER_NODE + slot + 1}`);
    });
  }
  const recs: Rec[] = [];
  for (const it of s0.items) it.members.forEach((m, k) => recs.push({ id: `${it.id}.${k}`, item: it.id, node: m.node, disk: m.disk }));
  const byLabel = (label: string) => {
    for (const [id, l] of labels) if (l === label) return id;
    throw new Error(`no VM labeled ${label}`);
  };
  LAB = { s0, home, labels, recs, byLabel };
  return LAB;
}

/** Group visible tiles by drive, keeping a stable bottom-up order (initial copies first, new ones on top). */
function group(recs: Rec[], t: number, look: (r: Rec) => TileLook | null, dim?: (r: Rec) => boolean): Map<string, TileF[]> {
  const out = new Map<string, TileF[]>();
  for (let n = 0; n < NODES; n++) for (let d = 0; d < DRIVES; d++) out.set(`${n}.${d}`, []);
  for (const r of recs) {
    if (r.bornAt !== undefined && t < r.bornAt) continue;
    if (r.goneAt !== undefined && t >= r.goneAt) continue;
    const l = look(r);
    if (!l) continue;
    out.get(r.disk)!.push({ id: r.id, look: l, dim: dim ? dim(r) : false });
  }
  return out;
}

/** Slots that VMs arriving at a node take, in arrival order (after the 4 home slots). */
function arrivalSlots(moves: { vm: number; to: number }[], vacated: Map<number, number[]> = new Map()): Map<number, Slot> {
  const used = new Map<number, number>();
  const out = new Map<number, Slot>();
  for (const m of moves) {
    const free = vacated.get(m.to) ?? [];
    const k = used.get(m.to) ?? 0;
    const slot = k < free.length ? free[k] : VMS_PER_NODE + (k - free.length);
    used.set(m.to, k + 1);
    out.set(m.vm, { node: m.to, slot });
  }
  return out;
}

function homeVms(L: Lab, look: (id: number) => VmLook = () => 'run', hl?: number): VmF[] {
  return L.s0.vms.map((v) => ({ id: v.id, label: L.labels.get(v.id)!, at: L.home.get(v.id)!, look: look(v.id), hl: v.id === hl }));
}

/** Run the engine from `s1` until every item has its full set of copies and HA is done. */
function settle(s1: ClusterState, limitS = 24 * 3600): ClusterState {
  let s = s1;
  const done = (x: ClusterState) =>
    x.items.every((it) => itemLiveCount(x, it) >= it.target) && x.vms.every((v) => v.state === 'running' || v.state === 'failed');
  for (let i = 0; i < limitS / 10 && !done(s); i++) s = tick(s, 10);
  return s;
}

/** Copies the engine re-created between the failure state and the settled state. */
function rebuilt(before: ClusterState, after: ClusterState, affected: (it: DataItem) => boolean) {
  const out: { item: number; from: { node: number; disk: string }; to: { node: number; disk: string } }[] = [];
  for (const it of before.items) {
    if (!affected(it)) continue;
    const fin = after.items[it.id];
    const key = (m: { node: number; disk: string }) => `${m.node}|${m.disk}`;
    const had = new Set(it.members.map(key));
    const added = fin.members.filter((m) => !had.has(key(m)));
    const source = fin.members.find((m) => had.has(key(m)));
    for (const a of added) out.push({ item: it.id, from: { node: source?.node ?? a.node, disk: source?.disk ?? a.disk }, to: { node: a.node, disk: a.disk } });
  }
  return out;
}

// ── 1. Data placement ────────────────────────────────────────────────────────

const PLACE = { vm: 'VM1', w1: [3.9, 4.6], w2: [4.6, 5.4], copy: [7.2, 8.8], ok: [9.2, 10.4] } as const;

function placeFrame(t: number): Frame {
  const L = lab();
  const vm = L.byLabel(PLACE.vm);
  const item = L.s0.items.find((it) => it.vm === vm)!;
  const local = item.members.find((m) => m.node === L.home.get(vm)!.node)!;
  const remote = item.members.find((m) => m !== local)!;
  const focus = t >= 3.5 && t < 10.5;
  const flashLocal = t >= PLACE.w2[1] && t < PLACE.w2[1] + 1.1;
  const flashRemote = t >= PLACE.copy[1] && t < PLACE.copy[1] + 1.1;
  const vmNode = (it: number) => L.s0.vms[L.s0.items[it].vm].node;
  const tiles = group(
    L.recs,
    t,
    (r) => {
      if (r.item === item.id && r.disk === local.disk && flashLocal) return 'new';
      if (r.item === item.id && r.disk === remote.disk && flashRemote) return 'new';
      return r.node === vmNode(r.item) ? 'local' : 'copy';
    },
    (r) => focus && r.item !== item.id,
  );
  const at = L.home.get(vm)!;
  const arcs: ArcF[] = [];
  if (t >= PLACE.w1[0] && t < PLACE.w1[1]) arcs.push({ id: 'w1', kind: 'write', from: { k: 'vm', at }, to: { k: 'cvm', node: at.node }, dots: [prog(t, PLACE.w1[0], PLACE.w1[1])] });
  if (t >= PLACE.w2[0] && t < PLACE.w2[1]) arcs.push({ id: 'w2', kind: 'write', from: { k: 'cvm', node: at.node }, to: { k: 'disk', disk: local.disk }, dots: [prog(t, PLACE.w2[0], PLACE.w2[1])] });
  if (t >= PLACE.copy[0] && t < PLACE.copy[1] + 0.4)
    arcs.push({ id: 'cp', kind: 'copy', from: { k: 'disk', disk: local.disk }, to: { k: 'disk', disk: remote.disk }, dots: t < PLACE.copy[1] ? [prog(t, PLACE.copy[0], PLACE.copy[1])] : [] });
  return {
    nodes: Array(NODES).fill('up'),
    vms: homeVms(L, () => 'run', focus ? vm : undefined),
    tiles,
    failedDisks: [],
    arcs,
    pool: t < 3.5 || t >= 10.5,
    tag: t >= PLACE.ok[0] && t < PLACE.ok[1] ? { node: at.node, text: 'Write confirmed' } : undefined,
  };
}

// ── 2. Live migration ────────────────────────────────────────────────────────

const MIG = { vm: 'VM2', to: 1, fly: [3.8, 6.0], remote: [6.5, 10], loc: [10.2, 13.6], end: 14 } as const;

interface MigPlan {
  vm: number;
  dest: Slot;
  moves: { item: number; fromRec: string; from: { node: number; disk: string }; to: { node: number; disk: string }; start: number; end: number }[];
  recs: Rec[];
}
let MIGPLAN: MigPlan | null = null;

/**
 * Localization the way the engine does it: for each piece of the VM's data with no copy on the
 * new node, a copy is made on the new node and the copy on the old node is dropped, so there
 * are two copies throughout.
 */
export function migPlan(): MigPlan {
  if (MIGPLAN) return MIGPLAN;
  const L = lab();
  const vm = L.byLabel(MIG.vm);
  const from = L.home.get(vm)!.node;
  const dest = arrivalSlots([{ vm, to: MIG.to }]).get(vm)!;
  const recs = L.recs.map((r) => ({ ...r }));
  const load = new Map<string, number>();
  for (const r of recs) load.set(r.disk, (load.get(r.disk) || 0) + 1);
  const need = L.s0.items.filter((it) => it.vm === vm && !it.members.some((m) => m.node === MIG.to));
  const span = (MIG.loc[1] - MIG.loc[0]) / Math.max(1, need.length);
  const moves: MigPlan['moves'] = [];
  need.forEach((it, k) => {
    const old = it.members.find((m) => m.node === from) ?? it.members[0];
    const disks = Array.from({ length: DRIVES }, (_, d) => `${MIG.to}.${d}`).sort((a, b) => (load.get(a) || 0) - (load.get(b) || 0) || a.localeCompare(b));
    const disk = disks[0];
    load.set(disk, (load.get(disk) || 0) + 1);
    const start = MIG.loc[0] + k * span;
    const end = start + Math.min(1.1, span * 0.85);
    const oldRec = recs.find((r) => r.item === it.id && r.disk === old.disk)!;
    oldRec.goneAt = end;
    recs.push({ id: `${it.id}.m`, item: it.id, node: MIG.to, disk, bornAt: end });
    moves.push({ item: it.id, fromRec: oldRec.id, from: { node: old.node, disk: old.disk }, to: { node: MIG.to, disk }, start, end });
  });
  MIGPLAN = { vm, dest, moves, recs };
  return MIGPLAN;
}

function migrateFrame(t: number): Frame {
  const L = lab();
  const P = migPlan();
  const vm = P.vm;
  const home = L.home.get(vm)!;
  const arrived = t >= MIG.fly[1];
  const vmNodeNow = arrived ? MIG.to : home.node;
  const mine = (r: Rec) => L.s0.items[r.item].vm === vm;
  const born = new Map(P.moves.map((m) => [`${m.item}.m`, m.end]));
  const tiles = group(
    P.recs,
    t,
    (r) => {
      const b = born.get(r.id);
      if (b !== undefined && t - b < 1.1) return 'new';
      const owner = L.s0.items[r.item].vm;
      const ownerNode = owner === vm ? vmNodeNow : L.s0.vms[owner].node;
      return r.node === ownerNode ? 'local' : 'copy';
    },
    (r) => !mine(r),
  );
  const vms = homeVms(L, () => 'run', vm).map((v) => {
    if (v.id !== vm) return v;
    if (t < MIG.fly[0]) return v;
    if (!arrived) return { ...v, to: P.dest, p: ease(prog(t, MIG.fly[0], MIG.fly[1])), look: 'moving' as VmLook };
    return { ...v, at: P.dest };
  });
  const arcs: ArcF[] = [];
  const at = arrived ? P.dest : home;
  // Reads: local before the move and after localization, remote in between.
  const myItems = L.s0.items.filter((it) => it.vm === vm);
  if (t < MIG.fly[0]) {
    for (const it of myItems) {
      const m = it.members.find((x) => x.node === home.node);
      if (m) arcs.push({ id: `rl${it.id}`, kind: 'read', from: { k: 'disk', disk: m.disk }, to: { k: 'vm', at }, dots: stream(t + it.id * 0.13, 2, 0.6) });
    }
  } else if (arrived && t < MIG.loc[0]) {
    for (const it of myItems) {
      const local = it.members.find((x) => x.node === MIG.to);
      const src = local ?? it.members.find((x) => x.node === home.node) ?? it.members[0];
      // Data already on Node 2 is read locally; the rest crosses the network from its old node.
      const to: Anchor = local ? { k: 'vm', at } : { k: 'lane', node: MIG.to };
      arcs.push({ id: `rr${it.id}`, kind: 'read', from: { k: 'disk', disk: src.disk }, to, dots: stream(t + it.id * 0.13, local ? 2 : 3, local ? 0.6 : 0.45) });
    }
  } else if (arrived && t < MIG.end) {
    for (const mv of P.moves) {
      if (t >= mv.start && t < mv.end + 0.3)
        arcs.push({ id: `lz${mv.item}`, kind: 'localize', from: { k: 'disk', disk: mv.from.disk }, to: { k: 'disk', disk: mv.to.disk }, dots: t < mv.end ? [prog(t, mv.start, mv.end)] : [] });
    }
  } else if (t >= MIG.end) {
    for (const it of myItems) {
      const mv = P.moves.find((x) => x.item === it.id);
      const disk = mv ? mv.to.disk : it.members.find((x) => x.node === MIG.to)?.disk;
      if (disk) arcs.push({ id: `rl2${it.id}`, kind: 'read', from: { k: 'disk', disk }, to: { k: 'vm', at }, dots: stream(t + it.id * 0.13, 2, 0.6) });
    }
  }
  return { nodes: Array(NODES).fill('up'), vms, tiles, failedDisks: [], arcs, pool: false };
}

// ── 3. Planned shutdown (maintenance) ────────────────────────────────────────

const MAINT = { node: 2, enter: 1, fly: [2.8, 6.6], down: 7, back: 11, resync: [11.3, 13.4], flyBack: [14.8, 18.0] } as const;

interface MaintPlan {
  away: Map<number, Slot>;
  order: number[];
  partners: Set<number>;
  /** Pieces written while the node was away: their copy on the node must catch up. */
  resync: { item: number; from: string; to: string; start: number; end: number }[];
  ok: number;
}
let MAINTPLAN: MaintPlan | null = null;

export function maintPlan(): MaintPlan {
  if (MAINTPLAN) return MAINTPLAN;
  const L = lab();
  const order = L.s0.vms.filter((v) => v.node === MAINT.node).map((v) => v.id).sort((a, b) => a - b);
  const targets = Array.from({ length: NODES }, (_, n) => n).filter((n) => n !== MAINT.node);
  const away = arrivalSlots(order.map((vm, k) => ({ vm, to: targets[k % targets.length] })));
  const held = L.s0.items.filter((it) => it.members.some((m) => m.node === MAINT.node));
  const partners = new Set(held.map((it) => it.id));
  // Illustrative: about a third of the pieces on the node changed while it was away.
  const changed = held.filter((it) => it.id % 3 === 0);
  const each = 1;
  const gap = changed.length > 1 ? (MAINT.resync[1] - MAINT.resync[0] - each) / (changed.length - 1) : 0;
  const resync = changed.map((it, k) => {
    const start = MAINT.resync[0] + k * gap;
    const on = it.members.find((m) => m.node === MAINT.node)!;
    const other = it.members.find((m) => m.node !== MAINT.node)!;
    return { item: it.id, from: other.disk, to: on.disk, start, end: start + each };
  });
  const ok = resync.length ? Math.max(...resync.map((r) => r.end)) : MAINT.back;
  MAINTPLAN = { away, order, partners, resync, ok };
  return MAINTPLAN;
}

function flight(t: number, k: number, window: readonly [number, number], n: number) {
  const each = 1.6;
  const gap = n > 1 ? (window[1] - window[0] - each) / (n - 1) : 0;
  const a = window[0] + k * gap;
  return { a, b: a + each, p: ease(prog(t, a, a + each)) };
}

function maintFrame(t: number): Frame {
  const L = lab();
  const P = maintPlan();
  const down = t >= MAINT.down && t < MAINT.back;
  const look: NodeLook = t < MAINT.enter ? 'up' : t < MAINT.down ? 'entering' : t < MAINT.back ? 'maint' : t < P.ok ? 'returning' : 'up';
  const nodes: NodeLook[] = Array.from({ length: NODES }, (_, n) => (n === MAINT.node ? look : 'up'));
  const syncedAt = new Map(P.resync.map((r) => [r.item, r.end]));
  // Unchanged copies count again as soon as the node is back; changed ones once they catch up.
  const behind = (item: number) => t >= MAINT.back && t < (syncedAt.get(item) ?? -Infinity);
  const tiles = group(L.recs, t, (r) => {
    if (r.node === MAINT.node) {
      if (down) return 'off';
      return behind(r.item) ? 'new' : 'copy';
    }
    if (P.partners.has(r.item) && (down || behind(r.item))) return 'single';
    return 'copy';
  });
  const n = P.order.length;
  const vms = homeVms(L).map((v) => {
    const k = P.order.indexOf(v.id);
    if (k < 0) return v;
    const dest = P.away.get(v.id)!;
    const out = flight(t, k, MAINT.fly, n);
    const back = flight(t, k, MAINT.flyBack, n);
    if (t < out.a) return v;
    if (t < out.b) return { ...v, to: dest, p: out.p, look: 'moving' as VmLook };
    if (t < back.a) return { ...v, at: dest };
    if (t < back.b) return { ...v, at: dest, to: v.at, p: back.p, look: 'moving' as VmLook };
    return v;
  });
  const arcs: ArcF[] = [];
  for (const r of P.resync) {
    if (t >= r.start && t < r.end + 0.25)
      arcs.push({ id: `rs${r.item}`, kind: 'resync', from: { k: 'disk', disk: r.from }, to: { k: 'disk', disk: r.to }, dots: t < r.end ? [prog(t, r.start, r.end)] : [] });
  }
  return { nodes, vms, tiles, failedDisks: [], arcs, pool: false };
}

// ── 4. VM failover (node failure) ────────────────────────────────────────────

const FAIL = { node: 1, at: 2, fly: [5.8, 9.6], rebuild: [10.2, 15.0], arc: 1.2 } as const;

interface FailPlan {
  restarts: { vm: number; dest: Slot; order: number }[];
  rebuilds: { item: number; from: string; to: string; start: number; end: number }[];
  recs: Rec[];
  affected: Set<number>;
}
let FAILPLAN: FailPlan | null = null;

export function failPlan(): FailPlan {
  if (FAILPLAN) return FAILPLAN;
  const L = lab();
  const s1 = applyFailure(L.s0, { kind: 'node', node: FAIL.node });
  const s2 = settle(s1);
  const ha = (s2.ha || []).filter((r) => r.from === FAIL.node && r.to !== null && !r.failed).sort((a, b) => a.order - b.order);
  const dests = arrivalSlots(ha.map((r) => ({ vm: r.vm, to: r.to! })));
  const restarts = ha.map((r) => ({ vm: r.vm, dest: dests.get(r.vm)!, order: r.order }));
  const affected = new Set(s1.items.filter((it) => it.members.some((m) => m.node === FAIL.node)).map((it) => it.id));
  const list = rebuilt(s1, s2, (it) => affected.has(it.id));
  const recs = L.recs.map((r) => ({ ...r }));
  const span = FAIL.rebuild[1] - FAIL.rebuild[0] - FAIL.arc;
  const rebuilds = list.map((x, k) => {
    const start = FAIL.rebuild[0] + (list.length > 1 ? (k * span) / (list.length - 1) : 0);
    const end = start + FAIL.arc;
    recs.push({ id: `${x.item}.r${k}`, item: x.item, node: x.to.node, disk: x.to.disk, bornAt: end });
    return { item: x.item, from: x.from.disk, to: x.to.disk, start, end };
  });
  FAILPLAN = { restarts, rebuilds, recs, affected };
  return FAILPLAN;
}

function failoverFrame(t: number): Frame {
  const L = lab();
  const P = failPlan();
  const failed = t >= FAIL.at;
  const nodes: NodeLook[] = Array.from({ length: NODES }, (_, n) => (n === FAIL.node && failed ? 'off' : 'up'));
  const doneAt = new Map<number, number>();
  for (const r of P.rebuilds) doneAt.set(r.item, Math.max(doneAt.get(r.item) ?? 0, r.end));
  const born = new Map(P.recs.filter((r) => r.bornAt !== undefined).map((r) => [r.id, r.bornAt!]));
  const tiles = group(P.recs, t, (r) => {
    if (r.node === FAIL.node && failed) return 'off';
    const b = born.get(r.id);
    if (b !== undefined && t - b < 1.1) return 'new';
    if (failed && P.affected.has(r.item) && t < (doneAt.get(r.item) ?? Infinity)) return 'single';
    return 'copy';
  });
  const n = P.restarts.length;
  const vms = homeVms(L).map((v) => {
    if (L.home.get(v.id)!.node !== FAIL.node || !failed) return v;
    const k = P.restarts.findIndex((r) => r.vm === v.id);
    if (k < 0) return { ...v, look: 'stopped' as VmLook };
    const f = flight(t, k, FAIL.fly, n);
    if (t < f.a) return { ...v, look: 'stopped' as VmLook };
    if (t < f.b) return { ...v, to: P.restarts[k].dest, p: f.p, look: 'restarting' as VmLook };
    return { ...v, at: P.restarts[k].dest };
  });
  const arcs: ArcF[] = [];
  for (const r of P.rebuilds) {
    if (t >= r.start && t < r.end + 0.25)
      arcs.push({ id: `rb${r.item}-${r.to}`, kind: 'rebuild', from: { k: 'disk', disk: r.from }, to: { k: 'disk', disk: r.to }, dots: t < r.end ? [prog(t, r.start, r.end)] : [] });
  }
  return { nodes, vms, tiles, failedDisks: [], arcs, pool: false };
}

// ── 5. Drive failure ─────────────────────────────────────────────────────────

const DRIVE = { disk: '0.1', at: 2, lostFor: 0.9, rebuild: [5.8, 10.6], arc: 1.2 } as const;

interface DrivePlan {
  rebuilds: { item: number; from: string; to: string; start: number; end: number }[];
  recs: Rec[];
  affected: Set<number>;
}
let DRIVEPLAN: DrivePlan | null = null;

export function drivePlan(): DrivePlan {
  if (DRIVEPLAN) return DRIVEPLAN;
  const L = lab();
  const affected = new Set(L.s0.items.filter((it) => it.members.some((m) => m.disk === DRIVE.disk)).map((it) => it.id));
  const s1 = applyFailure(L.s0, { kind: 'disk', disk: DRIVE.disk });
  const s2 = settle(s1);
  const list = rebuilt(s1, s2, (it) => affected.has(it.id));
  const recs = L.recs.map((r) => (r.disk === DRIVE.disk ? { ...r, goneAt: DRIVE.at + DRIVE.lostFor } : { ...r }));
  const span = DRIVE.rebuild[1] - DRIVE.rebuild[0] - DRIVE.arc;
  const rebuilds = list.map((x, k) => {
    const start = DRIVE.rebuild[0] + (list.length > 1 ? (k * span) / (list.length - 1) : 0);
    const end = start + DRIVE.arc;
    recs.push({ id: `${x.item}.d${k}`, item: x.item, node: x.to.node, disk: x.to.disk, bornAt: end });
    return { item: x.item, from: x.from.disk, to: x.to.disk, start, end };
  });
  DRIVEPLAN = { rebuilds, recs, affected };
  return DRIVEPLAN;
}

function driveFrame(t: number): Frame {
  const L = lab();
  const P = drivePlan();
  const failed = t >= DRIVE.at;
  const doneAt = new Map<number, number>();
  for (const r of P.rebuilds) doneAt.set(r.item, Math.max(doneAt.get(r.item) ?? 0, r.end));
  const born = new Map(P.recs.filter((r) => r.bornAt !== undefined).map((r) => [r.id, r.bornAt!]));
  const tiles = group(P.recs, t, (r) => {
    if (r.disk === DRIVE.disk && failed) return 'lost';
    const b = born.get(r.id);
    if (b !== undefined && t - b < 1.1) return 'new';
    if (failed && P.affected.has(r.item) && t < (doneAt.get(r.item) ?? Infinity)) return 'single';
    return 'copy';
  });
  const arcs: ArcF[] = [];
  for (const r of P.rebuilds) {
    if (t >= r.start && t < r.end + 0.25)
      arcs.push({ id: `rb${r.item}-${r.to}`, kind: 'rebuild', from: { k: 'disk', disk: r.from }, to: { k: 'disk', disk: r.to }, dots: t < r.end ? [prog(t, r.start, r.end)] : [] });
  }
  return { nodes: Array(NODES).fill('up'), vms: homeVms(L), tiles, failedDisks: failed ? [DRIVE.disk] : [], arcs, pool: false };
}

// ── scenario copy ────────────────────────────────────────────────────────────


export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  place: {
    id: 'place',
    label: 'Data placement',
    icon: 'layers',
    title: 'Data placement',
    lede: 'How the cluster stores data so that any one node or drive can fail.',
    steps: [
      { at: 0, text: 'The drives in all four nodes form one storage pool: the Distributed Storage Fabric (DSF).' },
      { at: 3.5, text: 'VM1 writes. The Controller VM (CVM) on its node keeps one copy on Node 1’s own drives.' },
      { at: 7, text: 'It sends a second copy to another node. The write is confirmed only after both copies are saved.' },
      { at: 10.5, text: 'Every VM works this way, so second copies end up spread across all the other nodes.' },
    ],
    why: 'There is no separate storage array to buy or outgrow. Each node adds drives and a CVM, and if any one node or drive fails, every piece of data still has a copy.',
    legend: [
      { look: 'local', label: 'Copy on the VM’s own node' },
      { look: 'copy', label: 'Copy on another node' },
      { look: 'new', label: 'Copy being written' },
    ],
    duration: 15,
    poster: 11,
  },
  migrate: {
    id: 'migrate',
    label: 'Live migration',
    icon: 'move',
    title: 'Live migration',
    lede: 'Move a running VM to another node and watch its data follow.',
    steps: [
      { at: 0, text: 'VM2 runs on Node 1 and reads its data from Node 1’s own drives.' },
      { at: 3.5, text: 'VM2 live-migrates to Node 2. It keeps running the whole time.' },
      { at: 6.5, text: 'At first, its reads go over the network to the node that holds its data.' },
      { at: 10, text: 'As VM2 reads, that data is copied to Node 2. New writes land there right away.' },
      { at: 14, text: 'VM2 reads locally again. Its data kept two copies the whole time.' },
    ],
    why: 'Keeping a VM’s data on the node where it runs (data locality) keeps reads fast and off the network, even after VMs move for maintenance or balancing.',
    legend: [
      { look: 'local', label: 'Copy on the node where its VM runs' },
      { look: 'copy', label: 'Copy on another node' },
      { look: 'arc-read', label: 'Reads' },
      { look: 'arc-localize', label: 'Data copied to the new node' },
    ],
    duration: 17,
    poster: 11.2,
  },
  maint: {
    id: 'maint',
    label: 'Planned shutdown',
    icon: 'power',
    title: 'Planned shutdown',
    lede: 'Take a node down for maintenance without stopping any VM.',
    steps: [
      { at: 0, text: 'Node 3 needs maintenance, such as a firmware or hypervisor upgrade.' },
      { at: 2.5, text: 'Its VMs live-migrate to the other nodes. They keep running: no downtime.' },
      { at: 7, text: 'Node 3’s CVM shuts down. Data with a copy on Node 3 is read from its other copy.' },
      { at: 11, text: 'Node 3 comes back and catches up on changes made while it was away.' },
      { at: 14.5, text: 'Its VMs move back, and every piece of data has two copies again.' },
    ],
    why: 'Upgrades and hardware fixes don’t need VM downtime. Life Cycle Manager (LCM) runs this sequence for each node in turn.',
    legend: [
      { look: 'copy', label: 'Copy of a piece of data' },
      { look: 'single', label: 'Only one copy online' },
      { look: 'off', label: 'Offline while in maintenance' },
      { look: 'new', label: 'Copy catching up' },
    ],
    duration: 19,
    poster: 8.5,
  },
  failover: {
    id: 'failover',
    label: 'VM failover',
    icon: 'zap',
    title: 'VM failover',
    lede: 'A node loses power. Its VMs restart on other nodes and the cluster heals itself.',
    steps: [
      { at: 0, text: 'A healthy cluster: every piece of data has two copies, on different nodes.' },
      { at: 2, text: 'Node 2 loses power. Its 4 VMs stop and the copies on its drives go offline.' },
      { at: 5.5, text: 'High availability (HA) restarts those VMs on other nodes with free memory, typically within about two minutes.' },
      { at: 10, text: 'At the same time, every surviving node re-creates the missing copies, in parallel.' },
      { at: 15.5, text: 'Every piece of data has two copies again, without anyone stepping in.' },
    ],
    why: 'Recovery is automatic. VMs are typically back in minutes, and full protection returns on its own, before anyone repairs the failed node.',
    legend: [
      { look: 'copy', label: 'Copy of a piece of data' },
      { look: 'single', label: 'Only one copy online' },
      { look: 'off', label: 'Offline copy' },
      { look: 'new', label: 'Copy being re-created' },
    ],
    duration: 19,
    poster: 12.5,
  },
  drive: {
    id: 'drive',
    label: 'Drive failure',
    icon: 'disk',
    title: 'Drive failure',
    lede: 'A drive dies. Every node helps rebuild its data from the other copies.',
    steps: [
      { at: 0, text: 'A healthy cluster: every piece of data has two copies, on different nodes.' },
      { at: 2, text: 'Drive 2 in Node 1 fails. The copies it held are gone.' },
      { at: 3.6, text: 'Each of those pieces still has its other copy on another node, so VMs keep running.' },
      { at: 5.5, text: 'Every node helps re-create the missing copies from the surviving ones, in parallel.' },
      { at: 11, text: 'Two copies of everything again. Replace the drive whenever it suits you.' },
    ],
    why: 'Rebuild work is shared by every node instead of funneled into one spare drive, so no single drive or node becomes the bottleneck.',
    legend: [
      { look: 'copy', label: 'Copy of a piece of data' },
      { look: 'single', label: 'Only one copy online' },
      { look: 'lost', label: 'Copy lost with the drive' },
      { look: 'new', label: 'Copy being re-created' },
    ],
    duration: 15,
    poster: 8,
  },
};

export const ORDER: ScenarioId[] = ['place', 'migrate', 'maint', 'failover', 'drive'];

export function frameAt(id: ScenarioId, t: number): Frame {
  switch (id) {
    case 'place':
      return placeFrame(t);
    case 'migrate':
      return migrateFrame(t);
    case 'maint':
      return maintFrame(t);
    case 'failover':
      return failoverFrame(t);
    case 'drive':
      return driveFrame(t);
  }
}
