// Helpers for scripted cluster stories (the Cluster & DSF Lab and the Failure Gauntlet): run the
// engine to a settled state, diff the copies it re-created, and pace moves and flights in time.
// Pure (no DOM), so the stories built on them are unit tested.
import type { ClusterState, DataItem } from '../../../engine/cluster';
import { tick } from '../../../engine/rebuild';
import { itemLiveCount } from '../../../engine/status';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const prog = (t: number, a: number, b: number) => (b <= a ? (t >= b ? 1 : 0) : clamp01((t - a) / (b - a)));
export const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

export interface Slot {
  node: number;
  slot: number;
}

/**
 * Run the engine from `s1` until every item has its full set of copies and HA is done. If the
 * rebuild cannot finish (no free space, or pieces with no copy left), stop once nothing has
 * changed for a while instead of running to the limit.
 */
export function settle(s1: ClusterState, limitS = 24 * 3600): ClusterState {
  let s = s1;
  let lastUnder = -1;
  let still = 0;
  const vmsDone = (x: ClusterState) => x.vms.every((v) => v.state === 'running' || v.state === 'failed');
  for (let i = 0; i < limitS / 10; i++) {
    const under = s.items.filter((it) => itemLiveCount(s, it) < it.target).length;
    if (under === 0 && vmsDone(s)) break;
    if (vmsDone(s) && under === lastUnder) {
      if (++still >= 120) break; // 20 minutes of simulated time with no progress
    } else still = 0;
    lastUnder = under;
    s = tick(s, 10);
  }
  return s;
}

/** Copies the engine re-created between the failure state and the settled state. */
export function rebuilt(before: ClusterState, after: ClusterState, affected: (it: DataItem) => boolean) {
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

/** Slots that VMs arriving at a node take, in arrival order, after `firstFree` home slots. */
export function arrivalSlots(moves: { vm: number; to: number }[], firstFree: number): Map<number, Slot> {
  const used = new Map<number, number>();
  const out = new Map<number, Slot>();
  for (const m of moves) {
    const k = used.get(m.to) ?? 0;
    used.set(m.to, k + 1);
    out.set(m.vm, { node: m.to, slot: firstFree + k });
  }
  return out;
}

/** The k-th of n moves spread across a time window, each lasting `each` seconds. */
export function flight(t: number, k: number, window: readonly [number, number], n: number, each = 2) {
  const gap = n > 1 ? (window[1] - window[0] - each) / (n - 1) : 0;
  const a = window[0] + k * gap;
  return { a, b: a + each, p: ease(prog(t, a, a + each)) };
}

/** Spread n rebuild arcs across a window so several run at once. */
export function stagger(n: number, window: readonly [number, number], arc: number) {
  const span = window[1] - window[0] - arc;
  return Array.from({ length: n }, (_, k) => {
    const start = window[0] + (n > 1 ? (k * span) / (n - 1) : 0);
    return { start, end: start + arc };
  });
}
