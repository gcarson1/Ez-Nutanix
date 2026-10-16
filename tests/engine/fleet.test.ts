import { describe, it, expect } from 'vitest';
import { CLUSTERS, DOMAINS, consolesToSeeAll, inView, totals } from '../../src/engine/fleet';

describe('what each console can see', () => {
  it('Prism Element sees only its own cluster', () => {
    expect(inView('pe', 'nyc').map((c) => c.id)).toEqual(['nyc']);
    expect(inView('pe', 'fra').map((c) => c.id)).toEqual(['fra']);
  });
  it('Prism Central sees the clusters registered to it, and no other domain', () => {
    const am = inView('pc', 'nyc');
    expect(am.length).toBeGreaterThan(1);
    expect(am.every((c) => c.domain === 'pc-am')).toBe(true);
    expect(inView('pc', 'lon').every((c) => c.domain === 'pc-eu')).toBe(true);
  });
  it('Nutanix Central sees every cluster in every domain', () => {
    expect(inView('nc', 'nyc').length).toBe(CLUSTERS.length);
    expect(new Set(inView('nc', 'nyc').map((c) => c.domain)).size).toBe(DOMAINS.length);
  });
  it('a higher console never sees less than a lower one', () => {
    for (const c of CLUSTERS) {
      const pe = inView('pe', c.id).length;
      const pc = inView('pc', c.id).length;
      const nc = inView('nc', c.id).length;
      expect(pe).toBeLessThanOrEqual(pc);
      expect(pc).toBeLessThanOrEqual(nc);
    }
  });
  it('consoles needed to see everything: one per cluster, one per domain, or one', () => {
    expect(consolesToSeeAll('pe')).toBe(CLUSTERS.length);
    expect(consolesToSeeAll('pc')).toBe(DOMAINS.length);
    expect(consolesToSeeAll('nc')).toBe(1);
    expect(consolesToSeeAll('nc', [])).toBe(0);
  });
});

describe('totals', () => {
  it('add up nodes and count clusters that are not healthy', () => {
    const t = totals(CLUSTERS);
    expect(t.clusters).toBe(CLUSTERS.length);
    expect(t.nodes).toBe(CLUSTERS.reduce((s, c) => s + c.nodes, 0));
    expect(t.warnings).toBe(CLUSTERS.filter((c) => c.health !== 'ok').length);
    expect(t.warnings).toBeGreaterThan(0);
  });
  it('a warning outside the view is not counted', () => {
    const warned = CLUSTERS.find((c) => c.health === 'warn')!;
    const other = CLUSTERS.find((c) => c.health === 'ok')!;
    expect(totals(inView('pe', other.id)).warnings).toBe(0);
    expect(totals(inView('pc', warned.id)).warnings).toBe(1);
  });
});
