// Failure Gauntlet: each scripted failure must stay true to the engine at every frame.
import { describe, it, expect } from 'vitest';
import { defFor, frameAt, plan, victim, doublePair, IDS, G_NODES, G_SLOTS, DRIVE_SLOTS, PER_BLOCK, type GFrame, type GId, type Copies } from '../../src/ui/modules/failures/scenarios';

const itemOf = (id: string) => Number(id.split('.')[0]);
const nodeOf = (disk: string) => Number(disk.split('.')[0]);
const blockOf = (node: number) => Math.floor(node / PER_BLOCK);

/** Copies that are online (not on a down node, not lost), per item. */
function online(f: GFrame): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const [disk, tiles] of f.tiles)
    for (const t of tiles) {
      if (t.look === 'off' || t.look === 'gone' || t.look === 'lost') continue;
      const list = out.get(itemOf(t.id)) ?? [];
      list.push(nodeOf(disk));
      out.set(itemOf(t.id), list);
    }
  return out;
}

const CASES: [GId, Copies][] = [...IDS.map((id) => [id, 2] as [GId, Copies]), ['double', 3]];

describe('every frame of every failure', () => {
  for (const [id, copies] of CASES) {
    it(`${id} (RF${copies}): fits the drawing, VMs never overlap, no node holds two copies of a piece`, () => {
      const def = defFor(id, copies);
      for (let t = 0; t <= def.duration + 1e-9; t += 0.25) {
        const f = frameAt(id, copies, t);
        for (const tiles of f.tiles.values()) expect(tiles.length).toBeLessThanOrEqual(DRIVE_SLOTS);
        expect(f.vms.length).toBe(24);
        const parked = f.vms.filter((v) => !v.to).map((v) => `${v.at.node}:${v.at.slot}`);
        expect(new Set(parked).size).toBe(parked.length);
        for (const v of f.vms) expect(Math.max(v.at.slot, v.to?.slot ?? 0)).toBeLessThan(G_SLOTS);
        for (const nodes of online(f).values()) expect(new Set(nodes).size).toBe(nodes.length);
      }
    });

    it(`${id} (RF${copies}): steps are ordered and inside the loop`, () => {
      const def = defFor(id, copies);
      def.steps.forEach((s, k) => {
        expect(s.at).toBeLessThan(def.duration);
        if (k) expect(s.at).toBeGreaterThan(def.steps[k - 1].at);
      });
      expect(def.outcome.length).toBe(3);
      expect(def.legend.length).toBeLessThanOrEqual(4);
    });
  }
});

describe('outcomes follow the engine', () => {
  it('node: its VMs restart elsewhere and every piece is back to two copies on other nodes', () => {
    const v = victim();
    const p = plan('node');
    expect(p.restarts.length).toBe(3);
    for (const r of p.restarts) expect(r.dest.node).not.toBe(v);
    const end = frameAt('node', 2, defFor('node').duration);
    expect(end.nodes[v]).toBe('down');
    for (const nodes of online(end).values()) {
      expect(nodes.length).toBe(2);
      expect(nodes).not.toContain(v);
    }
    expect(p.unavailable.size).toBe(0);
  });

  it('drive: lost copies are rebuilt from the surviving copy and the failed drive ends empty', () => {
    const p = plan('disk');
    expect(p.failedDisk).not.toBeNull();
    expect(p.rebuilds.length).toBeGreaterThan(0);
    for (const r of p.rebuilds) expect(r.to).not.toBe(p.failedDisk);
    const end = frameAt('disk', 2, defFor('disk').duration);
    expect(end.tiles.get(p.failedDisk!)!.length).toBe(0);
    for (const nodes of online(end).values()) expect(nodes.length).toBe(2);
    expect(end.vms.every((v) => v.look === 'run')).toBe(true);
  });

  it('controller VM: nothing restarts and every copy counts again once it is back', () => {
    const v = victim();
    const mid = frameAt('cvm', 2, 6);
    expect(mid.nodes[v]).toBe('cvm');
    expect(mid.arcs.filter((a) => a.kind === 'redirect').length).toBe(2);
    for (let d = 0; d < 2; d++) for (const t of mid.tiles.get(`${v}.${d}`)!) expect(t.look).toBe('off');
    const end = frameAt('cvm', 2, defFor('cvm').duration);
    expect(end.nodes.every((x) => x === 'up')).toBe(true);
    for (const tiles of end.tiles.values()) for (const t of tiles) expect(t.look).toBe('copy');
    expect(end.vms.every((vm) => vm.look === 'run' && !vm.to)).toBe(true);
  });

  it('block: both nodes go down, nothing is unavailable, and copies end in different blocks', () => {
    const p = plan('block');
    expect(p.downNodes.length).toBe(PER_BLOCK);
    expect(new Set(p.downNodes.map(blockOf)).size).toBe(1);
    expect(p.unavailable.size).toBe(0);
    const end = frameAt('block', 2, defFor('block').duration);
    for (const nodes of online(end).values()) {
      expect(nodes.length).toBe(2);
      expect(new Set(nodes.map(blockOf)).size).toBe(2);
    }
  });

  it('two nodes with RF2: some pieces have no copy online and are not rebuilt; with RF3 none', () => {
    const [a, b] = doublePair();
    expect(blockOf(a)).not.toBe(blockOf(b));
    const p2 = plan('double', 2);
    expect(p2.unavailable.size).toBeGreaterThan(0);
    for (const r of p2.rebuilds) expect(p2.unavailable.has(r.item)).toBe(false);
    const end2 = frameAt('double', 2, defFor('double', 2).duration);
    const gone = [...end2.tiles.values()].flat().filter((t) => t.look === 'gone');
    expect(gone.length).toBe(p2.unavailable.size * 2);
    const p3 = plan('double', 3);
    expect(p3.unavailable.size).toBe(0);
    const end3 = frameAt('double', 3, defFor('double', 3).duration);
    for (const nodes of online(end3).values()) expect(nodes.length).toBe(3);
  });

  it('nearly full: VMs restart, nothing is unavailable, but some pieces stay short of copies', () => {
    const p = plan('full');
    expect(p.unavailable.size).toBe(0);
    expect([...p.shortUntil.values()].some((x) => x === Infinity)).toBe(true);
    const end = frameAt('full', 2, defFor('full').duration);
    const short = [...end.tiles.values()].flat().filter((t) => t.look === 'single');
    expect(short.length).toBeGreaterThan(0);
    expect(end.vms.every((v) => v.look === 'run')).toBe(true);
  });

  it('uses the same victim across stories and keeps it off the Zookeeper nodes', () => {
    expect(victim()).toBeGreaterThanOrEqual(0);
    expect(victim()).toBeLessThan(G_NODES);
  });
});
