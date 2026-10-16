import { describe, it, expect } from 'vitest';
import { FLEET, TIMING, clusterState, planRollout, waveGroups } from '../../src/engine/nkp-upgrade';

const byId = new Map(FLEET.map((c) => [c.id, c]));

function sample(plan: ReturnType<typeof planRollout>, fn: (t: number) => void) {
  for (let t = 0; t <= plan.end + TIMING.node; t += 7) fn(t);
}

describe('NKP fleet rollout', () => {
  it('goes canary first, then edge, data center and cloud', () => {
    const g = waveGroups();
    expect(g[0]).toHaveLength(1);
    expect(g[0][0].site).toBe('edge');
    expect(g.slice(1).map((w) => w[0].site)).toEqual(['edge', 'dc', 'cloud']);
    expect(g.flat()).toHaveLength(FLEET.length);
  });

  it('replaces at most one node at a time per cluster, control plane before workers', () => {
    const plan = planRollout({ canaryFails: false });
    for (const p of plan.clusters) {
      const c = byId.get(p.id)!;
      let last = 0;
      sample(plan, (t) => {
        const s = clusterState(c, p, t, plan);
        expect(s.unavailable).toBeLessThanOrEqual(1);
        expect(s.liveNodes).toBeLessThanOrEqual(p.nodes + 1);
        expect(s.replaced).toBeGreaterThanOrEqual(last);
        last = s.replaced;
        if (s.current) {
          expect(s.current.role).toBe(s.current.index < c.cp ? 'cp' : 'worker');
          expect(s.current.p).toBeGreaterThanOrEqual(0);
          expect(s.current.p).toBeLessThanOrEqual(1);
        }
      });
    }
  });

  it('starts a wave only after every cluster in the previous wave passed its check', () => {
    const plan = planRollout({ canaryFails: false });
    for (const p of plan.clusters) {
      const earlier = plan.clusters.filter((q) => q.wave < p.wave);
      for (const q of earlier) expect(p.start).toBeGreaterThanOrEqual(q.end);
    }
  });

  it('finishes every cluster when nothing fails', () => {
    const plan = planRollout({ canaryFails: false });
    expect(plan.haltAt).toBeNull();
    for (const p of plan.clusters) expect(clusterState(byId.get(p.id)!, p, plan.end, plan).status).toBe('done');
    expect(plan.waves[plan.waves.length - 1]).toBe(plan.end);
  });

  it('a failed canary stops the rollout, is rolled back, and no other cluster is touched', () => {
    const plan = planRollout({ canaryFails: true });
    expect(plan.haltAt).not.toBeNull();
    const canary = plan.clusters.find((p) => p.wave === 0)!;
    const c = byId.get(canary.id)!;
    expect(plan.end).toBe(canary.end);
    expect(clusterState(c, canary, plan.haltAt! + 1, plan).status).toBe('failed');
    const after = clusterState(c, canary, plan.end, plan);
    expect(after.status).toBe('rolledBack');
    expect(after.replaced).toBe(0);
    sample(plan, (t) => {
      const s = clusterState(c, canary, t, plan);
      expect(s.replaced).toBe(0);
      expect(s.unavailable).toBe(0);
    });
    for (const p of plan.clusters) {
      if (p === canary) continue;
      const other = byId.get(p.id)!;
      sample(plan, (t) => expect(clusterState(other, p, t, plan).replaced).toBe(0));
      expect(clusterState(other, p, plan.end, plan).status).toBe('halted');
    }
  });

  it('is deterministic', () => {
    expect(planRollout({ canaryFails: false })).toEqual(planRollout({ canaryFails: false }));
  });
});
