// Snapshots and clones as block maps: a virtual disk is a list of pointers to physical
// blocks. A snapshot freezes a copy of the map (metadata only). New writes are redirected
// to new blocks (redirect-on-write) and only the live map is updated. A clone is a new
// virtual disk whose map starts as a copy of a snapshot's map. Pure and deterministic.
//
// Simplified: one block size, logical capacity only (the replication factor multiplies
// everything equally), and no background cleanup of map chains.

export interface Disk {
  id: string;
  label: string;
  kind: 'vdisk' | 'snapshot' | 'clone';
  /** Index = logical block; value = physical block id. */
  map: number[];
  /** Snapshot this disk was made from (snapshots: the disk they froze; clones: their parent snapshot). */
  parent: string | null;
}

export interface SnapState {
  disks: Disk[];
  nextBlock: number;
  /** Physical blocks written in the most recent action (for highlighting). */
  fresh: number[];
  log: string[];
}

export function initial(blocks = 8): SnapState {
  return {
    disks: [{ id: 'vm', label: 'VM disk', kind: 'vdisk', map: Array.from({ length: blocks }, (_, i) => i), parent: null }],
    nextBlock: blocks,
    fresh: [],
    log: [`The VM’s disk has ${blocks} blocks of data.`],
  };
}

const clone = (s: SnapState): SnapState => ({ disks: s.disks.map((d) => ({ ...d, map: d.map.slice() })), nextBlock: s.nextBlock, fresh: [], log: s.log.slice() });

/** Take a snapshot of a writable disk: copies the map, writes no data. */
export function snapshot(s: SnapState, diskId: string, label?: string): SnapState {
  const n = clone(s);
  const d = n.disks.find((x) => x.id === diskId);
  if (!d || d.kind === 'snapshot') return s;
  const count = n.disks.filter((x) => x.kind === 'snapshot').length + 1;
  n.disks.push({ id: `snap${count}`, label: label ?? `Snapshot ${count}`, kind: 'snapshot', map: d.map.slice(), parent: d.id });
  n.log.push(`Snapshot of ${d.label}: the block map is copied. No data is copied.`);
  return n;
}

/** Write to logical blocks of a writable disk: each write goes to a new physical block. */
export function write(s: SnapState, diskId: string, blocks: number[]): SnapState {
  const n = clone(s);
  const d = n.disks.find((x) => x.id === diskId);
  if (!d || d.kind === 'snapshot') return s;
  for (const b of blocks) {
    if (b < 0 || b >= d.map.length) continue;
    d.map[b] = n.nextBlock;
    n.fresh.push(n.nextBlock);
    n.nextBlock++;
  }
  n.log.push(`${d.label} changes ${blocks.length} block${blocks.length === 1 ? '' : 's'}: new data goes to new space; the snapshot still points at the old blocks.`);
  return n;
}

/** Create a writable clone from a snapshot: a new map pointing at the same blocks. */
export function cloneFrom(s: SnapState, snapId: string, label?: string): SnapState {
  const n = clone(s);
  const snap = n.disks.find((x) => x.id === snapId && x.kind === 'snapshot');
  if (!snap) return s;
  const count = n.disks.filter((x) => x.kind === 'clone').length + 1;
  n.disks.push({ id: `clone${count}`, label: label ?? `Clone ${count}`, kind: 'clone', map: snap.map.slice(), parent: snap.id });
  n.log.push(`${label ?? `Clone ${count}`} created from ${snap.label}: ready at once, sharing all of its blocks.`);
  return n;
}

/** Delete a snapshot: blocks no other disk references are freed. */
export function deleteDisk(s: SnapState, id: string): SnapState {
  const n = clone(s);
  const d = n.disks.find((x) => x.id === id);
  if (!d || d.id === 'vm') return s;
  n.disks = n.disks.filter((x) => x.id !== id);
  n.log.push(`${d.label} deleted. Blocks still used by another disk stay; the rest are freed.`);
  return n;
}

/** Physical blocks referenced by at least one disk. */
export function usedBlocks(s: SnapState): Set<number> {
  const u = new Set<number>();
  for (const d of s.disks) for (const b of d.map) u.add(b);
  return u;
}

/** Number of disks referencing each physical block. */
export function refCounts(s: SnapState): Map<number, number> {
  const m = new Map<number, number>();
  for (const d of s.disks) for (const b of new Set(d.map)) m.set(b, (m.get(b) ?? 0) + 1);
  return m;
}

/** Space if every snapshot and clone were a full copy instead (blocks). */
export function fullCopyBlocks(s: SnapState): number {
  return s.disks.reduce((a, d) => a + d.map.length, 0);
}

/** Blocks unique to one disk (what deleting only it would free). */
export function exclusiveBlocks(s: SnapState, id: string): number {
  const d = s.disks.find((x) => x.id === id);
  if (!d) return 0;
  const rc = refCounts(s);
  return new Set(d.map.filter((b) => rc.get(b) === 1)).size;
}

// ── the scripted walkthrough ──

export interface SnapStep {
  id: string;
  title: string;
  text: string;
  state: SnapState;
}

/** Deterministic walkthrough: base disk, snapshot, writes, clones, clone writes. */
export function walkthrough(o: { blocks?: number; clones?: number; changePct?: number } = {}): SnapStep[] {
  const blocks = o.blocks ?? 8;
  const clones = Math.max(1, Math.min(4, o.clones ?? 2));
  const change = Math.max(0, Math.min(100, o.changePct ?? 25));
  const per = Math.round((blocks * change) / 100);
  const steps: SnapStep[] = [];
  let s = initial(blocks);
  steps.push({ id: 'base', title: 'A VM disk with data', text: `The virtual disk is a map of ${blocks} blocks. Each entry points at where that block physically lives.`, state: s });
  s = snapshot(s, 'vm');
  steps.push({ id: 'snap', title: 'Take a snapshot', text: 'Taking a snapshot copies the map, not the data. It completes almost immediately and uses no new data space.', state: s });
  s = write(s, 'vm', [1, 4].filter((b) => b < blocks));
  steps.push({ id: 'write', title: 'The VM keeps writing', text: 'New writes go to new blocks, and only the live disk’s map is updated (redirect-on-write). The old blocks are untouched, so the snapshot still sees the data as it was.', state: s });
  for (let c = 1; c <= clones; c++) s = cloneFrom(s, 'snap1');
  steps.push({ id: 'clone', title: `Create ${clones} clone${clones === 1 ? '' : 's'}`, text: `Each clone is a new writable disk whose map points at the snapshot’s blocks. ${clones === 1 ? 'It is' : 'They are'} ready at once and add no data space.`, state: s });
  for (let c = 1; c <= clones; c++) {
    const targets = Array.from({ length: per }, (_, i) => (i * 2 + c) % blocks);
    s = write(s, `clone${c}`, [...new Set(targets)]);
  }
  steps.push({ id: 'clone-write', title: 'Clones diverge', text: `Each clone changes about ${change}% of its blocks. Only those changes use new space; everything else is still shared.`, state: s });
  return steps;
}
