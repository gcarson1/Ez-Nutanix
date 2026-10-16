// Cluster & DSF Lab: the scripted stories must stay true to the engine's rules at every frame.
import { describe, it, expect } from 'vitest';
import {
  lab,
  frameAt,
  stepAt,
  failPlan,
  drivePlan,
  migPlan,
  maintPlan,
  SCENARIOS,
  ORDER,
  NODES,
  DRIVES,
  SLOTS,
  TILE_CAP,
  VMS_PER_NODE,
  type Frame,
} from '../../src/ui/modules/cluster-lab/scenarios';

const itemOf = (tileId: string) => Number(tileId.split('.')[0]);
const nodeOf = (disk: string) => Number(disk.split('.')[0]);

/** Live (not offline, not lost) copies per item, as drawn. */
function copies(f: Frame): Map<number, { node: number; disk: string }[]> {
  const out = new Map<number, { node: number; disk: string }[]>();
  for (const [disk, tiles] of f.tiles) {
    for (const t of tiles) {
      if (t.look === 'off' || t.look === 'lost') continue;
      const list = out.get(itemOf(t.id)) ?? [];
      list.push({ node: nodeOf(disk), disk });
      out.set(itemOf(t.id), list);
    }
  }
  return out;
}

function times(duration: number, step = 0.1) {
  const out: number[] = [];
  for (let t = 0; t <= duration + 1e-9; t += step) out.push(Math.round(t * 1000) / 1000);
  return out;
}

describe('the fixed lab cluster', () => {
  it('is 4 nodes with 4 VMs and 3 drives each, and every piece of data has 2 copies on different nodes', () => {
    const L = lab();
    expect(L.s0.nodes.length).toBe(NODES);
    expect(L.s0.disks.length).toBe(NODES * DRIVES);
    for (let n = 0; n < NODES; n++) expect(L.s0.vms.filter((v) => v.node === n).length).toBe(VMS_PER_NODE);
    for (const it of L.s0.items) {
      expect(it.members.length).toBe(2);
      expect(new Set(it.members.map((m) => m.node)).size).toBe(2);
    }
    // VM labels follow the drawing: Node 1 holds VM1-VM4, Node 2 VM5-VM8, ...
    for (const v of L.s0.vms) {
      const n = Number(L.labels.get(v.id)!.slice(2));
      expect(Math.floor((n - 1) / VMS_PER_NODE)).toBe(v.node);
    }
  });
});

describe('every frame of every story', () => {
  for (const id of ORDER) {
    it(`${id}: fits the drawing and keeps VMs in distinct slots`, () => {
      const def = SCENARIOS[id];
      for (const t of times(def.duration)) {
        const f = frameAt(id, t);
        for (const tiles of f.tiles.values()) expect(tiles.length).toBeLessThanOrEqual(TILE_CAP);
        expect(f.vms.length).toBe(NODES * VMS_PER_NODE);
        const parked = f.vms.filter((v) => !v.to).map((v) => `${v.at.node}:${v.at.slot}`);
        expect(new Set(parked).size).toBe(parked.length);
        for (const v of f.vms) {
          expect(v.at.slot).toBeLessThan(SLOTS);
          if (v.to) expect(v.to.slot).toBeLessThan(SLOTS);
        }
        // No item ever shows two live copies on the same node.
        for (const list of copies(f).values()) expect(new Set(list.map((c) => c.node)).size).toBe(list.length);
      }
    });

    it(`${id}: steps are in order and inside the loop`, () => {
      const def = SCENARIOS[id];
      def.steps.forEach((s, k) => {
        expect(s.at).toBeGreaterThanOrEqual(0);
        expect(s.at).toBeLessThan(def.duration);
        if (k) expect(s.at).toBeGreaterThan(def.steps[k - 1].at);
      });
      expect(def.poster).toBeLessThanOrEqual(def.duration);
      expect(stepAt(def, 0)).toBe(0);
      expect(stepAt(def, def.duration)).toBe(def.steps.length - 1);
    });

    it(`${id}: is deterministic`, () => {
      const a = frameAt(id, SCENARIOS[id].duration * 0.6);
      const b = frameAt(id, SCENARIOS[id].duration * 0.6);
      expect(JSON.stringify([...a.tiles], null, 0) + JSON.stringify(a.vms)).toBe(JSON.stringify([...b.tiles], null, 0) + JSON.stringify(b.vms));
    });
  }
});

describe('story end states follow the engine', () => {
  it('data placement: the write lands on the VM’s own node and one other node', () => {
    const L = lab();
    const vm = L.byLabel('VM1');
    const item = L.s0.items.find((it) => it.vm === vm)!;
    const nodes = item.members.map((m) => m.node);
    expect(nodes).toContain(L.home.get(vm)!.node);
    expect(new Set(nodes).size).toBe(2);
  });

  it('live migration: VM2 ends on Node 2 with every piece of its data local there, still two copies', () => {
    const P = migPlan();
    const end = frameAt('migrate', SCENARIOS.migrate.duration);
    const vm = end.vms.find((v) => v.label === 'VM2')!;
    expect(vm.at.node).toBe(1);
    const L = lab();
    const mine = L.s0.items.filter((it) => it.vm === P.vm).map((it) => it.id);
    const c = copies(end);
    for (const id of mine) {
      const list = c.get(id)!;
      expect(list.length).toBe(2);
      expect(list.some((x) => x.node === 1)).toBe(true);
    }
    expect(P.moves.length).toBeGreaterThan(0);
  });

  it('planned shutdown: VMs leave Node 3, its copies go offline, everything returns', () => {
    const P = maintPlan();
    const mid = frameAt('maint', 9);
    for (const vm of P.order) expect(mid.vms.find((v) => v.id === vm)!.at.node).not.toBe(2);
    for (let d = 0; d < DRIVES; d++) for (const t of mid.tiles.get(`2.${d}`)!) expect(t.look).toBe('off');
    expect(mid.nodes[2]).toBe('maint');
    const end = frameAt('maint', SCENARIOS.maint.duration);
    const L = lab();
    for (const vm of P.order) expect(end.vms.find((v) => v.id === vm)!.at).toEqual(L.home.get(vm));
    for (const tiles of end.tiles.values()) for (const t of tiles) expect(t.look).toBe('copy');
    expect(P.resync.length).toBeGreaterThan(0);
  });

  it('VM failover: every VM on the failed node restarts elsewhere and every piece is back to two copies off that node', () => {
    const P = failPlan();
    const L = lab();
    const victims = L.s0.vms.filter((v) => v.node === 1).map((v) => v.id);
    expect(P.restarts.map((r) => r.vm).sort()).toEqual(victims.slice().sort());
    for (const r of P.restarts) expect(r.dest.node).not.toBe(1);
    for (const r of P.rebuilds) expect(nodeOf(r.to)).not.toBe(1);
    const end = frameAt('failover', SCENARIOS.failover.duration);
    expect(end.nodes[1]).toBe('off');
    const c = copies(end);
    for (const it of L.s0.items) {
      const list = c.get(it.id)!;
      expect(list.length).toBe(2);
      expect(list.every((x) => x.node !== 1)).toBe(true);
    }
    for (const vm of victims) expect(end.vms.find((v) => v.id === vm)!.look).toBe('run');
  });

  it('drive failure: copies on the failed drive are rebuilt from the surviving copy onto other drives', () => {
    const P = drivePlan();
    const L = lab();
    expect(P.rebuilds.length).toBe(P.affected.size);
    for (const r of P.rebuilds) {
      expect(r.to).not.toBe('0.1');
      const item = L.s0.items[r.item];
      const survivor = item.members.find((m) => m.disk !== '0.1')!;
      expect(r.from).toBe(survivor.disk);
    }
    const end = frameAt('drive', SCENARIOS.drive.duration);
    expect(end.failedDisks).toEqual(['0.1']);
    expect(end.tiles.get('0.1')!.length).toBe(0);
    const c = copies(end);
    for (const it of L.s0.items) expect(c.get(it.id)!.length).toBe(2);
  });
});
