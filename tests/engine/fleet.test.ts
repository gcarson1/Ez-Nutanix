import { describe, it, expect } from 'vitest';
import { CLUSTERS, planUpgrade, runAt, rollupAlerts, visibleClusters, can, precheck, totals, type FleetCluster } from '../../src/engine/fleet';

const ALL = CLUSTERS.map((c) => c.id);
const healthy: FleetCluster[] = CLUSTERS.map((c) => ({ ...c, health: 'ok' }));
const opts = { waveSize: 2, canary: true, perNodeMin: 10, soakMin: 30 };

describe('fleet visibility (RBAC)', () => {
  it('fleet admin sees everything registered, regional operator only its domain', () => {
    expect(visibleClusters('fleet', ALL).length).toBe(CLUSTERS.length);
    expect(visibleClusters('emea', ALL).every((c) => c.domain === 'pc-eu')).toBe(true);
  });
  it('unregistered clusters are invisible to everyone', () => {
    expect(visibleClusters('fleet', ['nyc']).map((c) => c.id)).toEqual(['nyc']);
    expect(rollupAlerts('fleet', ['nyc']).every((a) => a.cluster === 'nyc')).toBe(true);
  });
  it('alerts are filtered by visibility and sorted by severity', () => {
    const a = rollupAlerts('emea', ALL);
    expect(a.every((x) => ['fra', 'lon'].includes(x.cluster))).toBe(true);
    const all = rollupAlerts('fleet', ALL);
    const rank = { critical: 0, warning: 1, info: 2 };
    for (let i = 1; i < all.length; i++) expect(rank[all[i - 1].severity]).toBeLessThanOrEqual(rank[all[i].severity]);
  });
  it('auditor can view but not act', () => {
    expect(can('audit', 'view')).toBe(true);
    expect(can('audit', 'upgrade')).toBe(false);
  });
  it('totals add up', () => {
    const t = totals(CLUSTERS);
    expect(t.nodes).toBe(CLUSTERS.reduce((s, c) => s + c.nodes, 0));
    expect(t.worst).toBe('warn');
  });
});

describe('staggered fleet upgrade', () => {
  it('canary runs alone in wave 0, and every cluster is planned once', () => {
    const p = planUpgrade(healthy, opts);
    expect(p.entries.filter((e) => e.wave === 0).length).toBe(1);
    expect(new Set(p.entries.map((e) => e.cluster)).size).toBe(healthy.length);
  });
  it('a later wave never starts before the previous wave ends', () => {
    const p = planUpgrade(healthy, opts);
    for (let w = 1; w < p.waves; w++) {
      const prevEnd = Math.max(...p.entries.filter((e) => e.wave === w - 1).map((e) => e.end));
      for (const e of p.entries.filter((x) => x.wave === w)) expect(e.start).toBeGreaterThanOrEqual(prevEnd);
    }
  });
  it('cluster duration is sequential per node', () => {
    const p = planUpgrade(healthy, opts);
    for (const e of p.entries) expect(e.end - e.start).toBe(healthy.find((c) => c.id === e.cluster)!.nodes * 10);
  });
  it('pre-check blocks an unhealthy cluster and holds all later waves', () => {
    expect(precheck(CLUSTERS.find((c) => c.id === 'tor')!)).not.toBeNull();
    const p = planUpgrade(CLUSTERS, { ...opts, canary: false, waveSize: 1 });
    const blocked = p.entries.find((e) => e.blocked)!;
    const r = runAt(p, CLUSTERS, p.total, null);
    expect(r.haltedAtWave).toBe(blocked.wave);
    for (const e of r.entries) if (e.wave > blocked.wave) expect(e.state).toBe('held');
  });
  it('a fault mid-upgrade pauses that cluster and nothing after it starts', () => {
    const p = planUpgrade(healthy, opts);
    const e = p.entries.find((x) => x.wave === 1)!;
    const fault = { cluster: e.cluster, at: e.start + 5 };
    const r = runAt(p, healthy, p.total, fault);
    expect(r.entries.find((x) => x.cluster === e.cluster)!.state).toBe('paused');
    for (const x of r.entries) if (x.wave > 1) expect(x.state).toBe('held');
  });
  it('with no faults everything is done at the end', () => {
    const p = planUpgrade(healthy, opts);
    expect(runAt(p, healthy, p.total, null).entries.every((e) => e.state === 'done')).toBe(true);
  });
});
