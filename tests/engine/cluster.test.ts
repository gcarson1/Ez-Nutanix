import { describe, it, expect } from 'vitest';
import { createCluster, effectiveDomain, normalizeConfig, type ClusterState } from '../../src/engine/cluster';
import { applyFailure, recoverNode, addNode, removeNode, canRemoveNode, migrateVm, TIMING } from '../../src/engine/failures';
import { advance, replay } from '../../src/engine/rebuild';
import { deriveStatus, itemState } from '../../src/engine/status';
import { rfAllowed, ecAllowed, blockAwareAllowed, ecStrip } from '../../src/engine/rules';
import { domainKey } from '../../src/engine/placement';

function noSharedDomain(s: ClusterState, domain: 'node' | 'block' | 'rack') {
  for (const it of s.items) {
    const keys = it.members.map((m) => domainKey(s.nodes[m.node], domain));
    expect(new Set(keys).size).toBe(keys.length);
  }
}

describe('placement invariants', () => {
  it('never puts two copies of an item on the same node', () => {
    for (const nodes of [3, 4, 5, 8, 12, 32]) {
      const s = createCluster({ nodes, rf: nodes >= 5 ? 3 : 2, ft: nodes >= 5 ? 3 : 2, seed: nodes });
      noSharedDomain(s, 'node');
      expect(s.items.every((it) => it.members.length === it.target)).toBe(true);
    }
  });

  it('keeps copies in different blocks with block awareness on', () => {
    const s = createCluster({ nodes: 8, nodesPerBlock: 2, blockAware: true, seed: 3 });
    expect(s.domain).toBe('block');
    noSharedDomain(s, 'block');
  });

  it('keeps copies in different racks with rack awareness on', () => {
    const s = createCluster({ nodes: 12, nodesPerBlock: 1, racks: 3, rackAware: true, seed: 4 });
    expect(s.domain).toBe('rack');
    noSharedDomain(s, 'rack');
  });

  it('writes one copy local to the owning VM', () => {
    const s = createCluster({ nodes: 6, seed: 9 });
    for (const it of s.items.filter((i) => i.kind === 'rf')) expect(it.members.some((m) => m.node === s.vms[it.vm].node)).toBe(true);
  });

  it('EC-X strips put every member on a different node', () => {
    const s = createCluster({ nodes: 8, ecx: true, coldPct: 100, seed: 2 });
    const ec = s.items.filter((i) => i.kind === 'ec');
    expect(ec.length).toBeGreaterThan(0);
    for (const it of ec) {
      expect(it.target).toBe(5);
      expect(it.need).toBe(4);
    }
    noSharedDomain(s, 'node');
  });
});

describe('configuration rules', () => {
  it('RF3 needs 5 nodes; EC-X needs 4 (RF2) / 6 (RF3)', () => {
    expect(rfAllowed(3, 4).ok).toBe(false);
    expect(rfAllowed(3, 5).ok).toBe(true);
    expect(rfAllowed(2, 3).ok).toBe(true);
    expect(ecAllowed(2, 3).ok).toBe(false);
    expect(ecAllowed(2, 4).ok).toBe(true);
    expect(ecAllowed(3, 5).ok).toBe(false);
    expect(ecAllowed(3, 6).ok).toBe(true);
    expect(rfAllowed(3, 4).reason).toMatch(/at least 5 nodes/);
  });

  it('normalizes invalid combinations instead of building them', () => {
    expect(normalizeConfig({ nodes: 4, ft: 3, rf: 3 }).rf).toBe(2);
    expect(normalizeConfig({ nodes: 3, ecx: true }).ecx).toBe(false);
  });

  it('block awareness needs 3 blocks at RF2 and 5 at RF3', () => {
    expect(blockAwareAllowed(2, 2).ok).toBe(false);
    expect(blockAwareAllowed(2, 3).ok).toBe(true);
    expect(blockAwareAllowed(3, 4).ok).toBe(false);
    expect(effectiveDomain(normalizeConfig({ nodes: 8, nodesPerBlock: 4, blockAware: true }))).toBe('node');
  });

  it('EC strip table', () => {
    expect(ecStrip(4, 2)).toEqual({ data: 2, parity: 1 });
    expect(ecStrip(5, 2)).toEqual({ data: 3, parity: 1 });
    expect(ecStrip(6, 2)).toEqual({ data: 4, parity: 1 });
    expect(ecStrip(20, 2)).toEqual({ data: 4, parity: 1 });
    expect(ecStrip(6, 3)).toEqual({ data: 2, parity: 2 });
    expect(ecStrip(7, 3)).toEqual({ data: 3, parity: 2 });
    expect(ecStrip(8, 3)).toEqual({ data: 4, parity: 2 });
  });
});

describe('failure and self-healing', () => {
  it('RF2: one node failure self-heals back to full compliance', () => {
    let s = createCluster({ nodes: 6, fillPct: 40, seed: 11 });
    expect(deriveStatus(s).resiliency).toBe('OK');
    s = applyFailure(s, { kind: 'node', node: 2 });
    const during = deriveStatus(s);
    expect(during.resiliency).toBe('Critical');
    expect(during.items.under).toBeGreaterThan(0);
    s = advance(s, 6 * 3600);
    const after = deriveStatus(s);
    expect(after.items.under).toBe(0);
    expect(after.items.unavailable).toBe(0);
    expect(s.items.every((it) => itemState(s, it) === 'healthy')).toBe(true);
    // still no shared nodes after rebuild
    for (const it of s.items) expect(new Set(it.members.map((m) => m.node)).size).toBe(it.members.length);
    expect(s.events.some((e) => e.kind === 'ok' && /Re-protection complete/.test(e.text))).toBe(true);
  });

  it('starts re-protection as soon as the failure is detected', () => {
    let s = createCluster({ nodes: 6, seed: 5 });
    s = applyFailure(s, { kind: 'node', node: 0 });
    expect(s.rebuild.startedAt).toBeNull();
    expect(TIMING.rebuildDelayS).toBeLessThanOrEqual(10);
    s = advance(s, 20);
    expect(s.rebuild.startedAt).not.toBeNull();
  });

  it('RF2: a second failure before re-protection completes makes some data unavailable, and it stays unavailable', () => {
    let s = createCluster({ nodes: 5, fillPct: 60, seed: 21, rebuildTBph: 0.2 });
    // nodes 3 and 4 do not host Zookeeper, so this isolates the data-level effect
    s = applyFailure(s, { kind: 'node', node: 3 });
    s = advance(s, 120);
    s = applyFailure(s, { kind: 'node', node: 4 });
    const st = deriveStatus(s);
    expect(st.items.unavailable).toBeGreaterThan(0);
    expect(st.resiliency).toBe('Data unavailable');
    s = advance(s, 12 * 3600);
    // Rebuild cannot invent data that has no surviving copy.
    expect(deriveStatus(s).items.unavailable).toBeGreaterThan(0);
  });

  it('losing two of three Zookeeper nodes at once takes the cluster down until one returns', () => {
    let s = createCluster({ nodes: 5, seed: 21 });
    const zk = s.nodes.filter((n) => n.zk).map((n) => n.id);
    expect(zk.length).toBe(3);
    s = applyFailure(s, { kind: 'node', node: zk[0] });
    s = applyFailure(s, { kind: 'node', node: zk[1] });
    expect(deriveStatus(s).resiliency).toBe('Cluster down');
    s = recoverNode(s, zk[1]);
    expect(deriveStatus(s).resiliency).not.toBe('Cluster down');
  });

  it('RF3 survives two simultaneous node failures', () => {
    let s = createCluster({ nodes: 7, rf: 3, ft: 3, fillPct: 40, seed: 8 });
    s = applyFailure(s, { kind: 'node', node: 0 });
    s = applyFailure(s, { kind: 'node', node: 1 });
    expect(deriveStatus(s).items.unavailable).toBe(0);
    s = advance(s, 12 * 3600);
    expect(deriveStatus(s).items.under).toBe(0);
  });

  it('reports cannot self-heal when survivors are too few', () => {
    let s = createCluster({ nodes: 3, fillPct: 40, seed: 1 });
    s = applyFailure(s, { kind: 'node', node: 0 });
    s = applyFailure(s, { kind: 'disk', disk: '1.0' });
    s = advance(s, 4 * 3600);
    const st = deriveStatus(s);
    // two survivors can hold RF2 again, but the zookeeper/metadata layer can't be fully restored
    expect(st.tolerable).toBe(0);
  });

  it('reports cannot self-heal when capacity is insufficient', () => {
    let s = createCluster({ nodes: 4, fillPct: 85, seed: 13 });
    expect(deriveStatus(s).rebuildCapacity).toBe(false);
    s = applyFailure(s, { kind: 'node', node: 3 });
    s = advance(s, 24 * 3600);
    const st = deriveStatus(s);
    expect(st.selfHeal.state).toBe('blocked');
    expect(st.selfHeal.reason).toMatch(/capacity/);
  });

  it('CVM failure keeps VMs running on the host', () => {
    let s = createCluster({ nodes: 4, seed: 3 });
    const before = s.vms.filter((v) => v.node === 1).map((v) => v.id);
    s = applyFailure(s, { kind: 'cvm', node: 1 });
    s = advance(s, 300);
    for (const id of before) {
      expect(s.vms[id].node).toBe(1);
      expect(s.vms[id].state).toBe('running');
    }
  });

  it('node failure restarts its VMs on survivors via HA', () => {
    let s = createCluster({ nodes: 4, seed: 3, vmMemLoadPct: 40 });
    const ids = s.vms.filter((v) => v.node === 2).map((v) => v.id);
    s = applyFailure(s, { kind: 'node', node: 2 });
    s = advance(s, 600);
    for (const id of ids) {
      expect(s.vms[id].state).toBe('running');
      expect(s.vms[id].node).not.toBe(2);
    }
  });

  it('recovering a node before rebuild restores full health without rebuilding', () => {
    let s = createCluster({ nodes: 5, seed: 6 });
    s = applyFailure(s, { kind: 'cvm', node: 4 });
    s = advance(s, 30);
    s = recoverNode(s, 4);
    expect(deriveStatus(s).resiliency).toBe('OK');
  });

  it('block failure without awareness can lose data; with awareness it does not', () => {
    let naive = createCluster({ nodes: 8, nodesPerBlock: 4, fillPct: 50, seed: 17 });
    naive = applyFailure(naive, { kind: 'block', block: 0 });
    expect(deriveStatus(naive).items.unavailable).toBeGreaterThan(0);
    let aware = createCluster({ nodes: 8, nodesPerBlock: 2, blockAware: true, fillPct: 50, seed: 17 });
    aware = applyFailure(aware, { kind: 'block', block: 0 });
    expect(deriveStatus(aware).items.unavailable).toBe(0);
  });
});

describe('expansion, removal, migration', () => {
  it('adding a node rebalances data onto it', () => {
    let s = createCluster({ nodes: 4, fillPct: 60, seed: 2 });
    s = addNode(s);
    const id = s.nodes.length - 1;
    const onNew = () => s.items.filter((it) => it.members.some((m) => m.node === id)).length;
    expect(onNew()).toBe(0);
    s = advance(s, 4 * 3600);
    expect(onNew()).toBeGreaterThan(0);
    noSharedDomain(s, 'node');
  });

  it('graceful removal re-protects data before the node leaves', () => {
    let s = createCluster({ nodes: 5, fillPct: 40, seed: 2 });
    expect(canRemoveNode(s, 4).ok).toBe(true);
    s = removeNode(s, 4);
    expect(deriveStatus(s).items.unavailable).toBe(0);
    s = advance(s, 8 * 3600);
    expect(s.nodes[4].state).toBe('removed');
    expect(s.items.every((it) => it.members.every((m) => m.node !== 4) && it.members.length === it.target)).toBe(true);
  });

  it('refuses to remove below the minimum node count', () => {
    const s = createCluster({ nodes: 3, seed: 2 });
    expect(canRemoveNode(s, 0).ok).toBe(false);
  });

  it('migrated VM data is localized on read over time', () => {
    let s = createCluster({ nodes: 4, seed: 12, coldPct: 0 });
    const vm = s.vms[0];
    const to = (vm.node + 1) % 4;
    s = migrateVm(s, 0, to);
    const local = () => s.items.filter((it) => it.vm === 0).filter((it) => it.members.some((m) => m.node === to)).length;
    const before = local();
    s = advance(s, 3600);
    expect(local()).toBeGreaterThan(before);
  });
});

describe('determinism', () => {
  it('same seed and inputs produce identical output', () => {
    const run = () => {
      const s0 = createCluster({ nodes: 9, nodesPerBlock: 1, seed: 99, ecx: true });
      return replay(s0, [
        { t: 100, apply: (s) => applyFailure(s, { kind: 'node', node: 3 }) },
        { t: 900, apply: (s) => applyFailure(s, { kind: 'disk', disk: '5.1' }) },
      ], 7200);
    };
    const a = run();
    const b = run();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seeds produce different layouts', () => {
    const a = createCluster({ nodes: 8, seed: 1 });
    const b = createCluster({ nodes: 8, seed: 2 });
    expect(JSON.stringify(a.items)).not.toBe(JSON.stringify(b.items));
  });
});
