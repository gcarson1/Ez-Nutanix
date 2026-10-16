import { describe, it, expect } from 'vitest';
import { FLEET, TIMING, clusterState, covered, events, planRollout, type Edition, type Strategy } from '../../src/engine/nkp-upgrade';

const EDS: Edition[] = ['starter', 'pro', 'ultimate'];
const STRATS: Strategy[] = ['serial', 'waves'];
const byId = new Map(FLEET.map((c) => [c.id, c]));

function sample(plan: ReturnType<typeof planRollout>, fn: (t: number) => void) {
  const end = Number.isFinite(plan.end) ? plan.end : 0;
  for (let t = 0; t <= end + TIMING.node; t += 17) fn(t);
}

describe('NKP fleet rollout', () => {
  it('only includes clusters the edition covers, and never upgrades attached clusters', () => {
    for (const edition of EDS)
      for (const strategy of STRATS) {
        const plan = planRollout({ edition, strategy, canaryFails: false });
        for (const p of plan.clusters) {
          const c = byId.get(p.id)!;
          const inRollout = Number.isFinite(p.start);
          expect(inRollout).toBe(covered(c, edition) && !c.attached);
          if (c.attached && covered(c, edition)) expect(p.skip).toBe('attached');
          sample(plan, (t) => {
            const s = clusterState(c, p, t, plan);
            if (!inRollout) expect(['skipped', 'waiting', 'halted']).toContain(s.status);
            if (!inRollout) expect(s.replaced).toBe(0);
          });
        }
      }
  });

  it('replaces at most one node at a time per cluster, control plane before workers', () => {
    const plan = planRollout({ edition: 'ultimate', strategy: 'waves', canaryFails: false });
    for (const p of plan.clusters) {
      const c = byId.get(p.id)!;
      let last = 0;
      sample(plan, (t) => {
        const s = clusterState(c, p, t, plan);
        expect(s.unavailable).toBeLessThanOrEqual(1);
        expect(s.liveNodes).toBeLessThanOrEqual(p.nodes + 1);
        expect(s.replaced).toBeGreaterThanOrEqual(last);
        last = s.replaced;
        if (s.current) expect(s.current.role).toBe(s.current.index < c.cp ? 'cp' : 'worker');
      });
    }
  });

  it('finishes every covered cluster when nothing fails', () => {
    for (const strategy of STRATS) {
      const plan = planRollout({ edition: 'ultimate', strategy, canaryFails: false });
      expect(plan.halted).toBe(false);
      for (const p of plan.clusters) {
        const c = byId.get(p.id)!;
        const s = clusterState(c, p, plan.end, plan);
        expect(s.status).toBe(c.attached ? 'skipped' : 'done');
      }
      expect(events(plan, FLEET, plan.end).slice(-1)[0]?.text).toBe('Rollout complete.');
    }
  });

  it('stops after a failed canary: no later cluster is touched', () => {
    for (const strategy of STRATS) {
      const plan = planRollout({ edition: 'ultimate', strategy, canaryFails: true });
      expect(plan.halted).toBe(true);
      const canary = plan.clusters.find((p) => p.wave === 0)!;
      expect(plan.end).toBe(canary.end);
      for (const p of plan.clusters) {
        if (p === canary) continue;
        const c = byId.get(p.id)!;
        const s = clusterState(c, p, plan.end + 10 * TIMING.node, plan);
        expect(s.replaced).toBe(0);
        if (p.wave > 0) expect(s.status).toBe('halted');
      }
      expect(clusterState(byId.get(canary.id)!, canary, plan.end, plan).status).toBe('failed');
    }
  });

  it('waves finish sooner than one cluster at a time, and the plan is deterministic', () => {
    const a = planRollout({ edition: 'ultimate', strategy: 'serial', canaryFails: false });
    const b = planRollout({ edition: 'ultimate', strategy: 'waves', canaryFails: false });
    expect(b.end).toBeLessThan(a.end);
    expect(planRollout({ edition: 'ultimate', strategy: 'waves', canaryFails: false })).toEqual(b);
  });
});
