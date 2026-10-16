import { describe, it, expect } from 'vitest';
import { REPLICA_OPTS, SERVE_TIMES, SITE, planServing } from '../../src/engine/ai-endpoint';

describe('NAI endpoint: spreading requests over replicas', () => {
  it('answers every request, in the order they arrived', () => {
    for (const r of REPLICA_OPTS) {
      const p = planServing(r);
      expect(p.jobs).toHaveLength(SERVE_TIMES.busy + SERVE_TIMES.during);
      for (let i = 1; i < p.jobs.length; i++) expect(p.jobs[i].dispatch).toBeGreaterThanOrEqual(p.jobs[i - 1].dispatch);
      for (const j of p.jobs) {
        expect(j.dispatch).toBeGreaterThanOrEqual(j.arrive);
        expect(j.back).toBeLessThan(p.end);
      }
    }
  });

  it('a replica works on one request at a time', () => {
    for (const r of REPLICA_OPTS) {
      const p = planServing(r);
      for (let k = 0; k < r; k++) {
        const mine = p.jobs.filter((j) => j.replica === k).sort((a, b) => a.begin - b.begin);
        for (let i = 1; i < mine.length; i++) expect(mine[i].begin).toBeGreaterThanOrEqual(mine[i - 1].done - 1e-9);
      }
    }
  });

  it('spreads requests over every replica', () => {
    const p = planServing(4);
    expect(new Set(p.jobs.filter((j) => j.batch === 'busy').map((j) => j.replica)).size).toBe(4);
  });

  it('a stopped replica gets no work while it is stopped', () => {
    for (const r of REPLICA_OPTS) {
      const p = planServing(r);
      for (const j of p.jobs.filter((x) => x.replica === p.stop.replica)) expect(j.dispatch >= p.stop.to - 1e-9 || j.done <= p.stop.from + 1e-9).toBe(true);
    }
  });

  it('with one replica requests queue, and wait for it while it is stopped', () => {
    const p = planServing(1);
    expect(p.maxWait.busy).toBeGreaterThan(0);
    for (const j of p.jobs.filter((x) => x.batch === 'stop')) expect(j.dispatch).toBeGreaterThanOrEqual(p.stop.to - 1e-9);
  });

  it('more replicas never make anyone wait longer, and four never wait', () => {
    const [a, b, c] = REPLICA_OPTS.map((r) => planServing(r).maxWait);
    expect(b.busy).toBeLessThanOrEqual(a.busy);
    expect(c.busy).toBeLessThanOrEqual(b.busy);
    expect(b.stop).toBeLessThanOrEqual(a.stop);
    expect(c.stop).toBeLessThanOrEqual(b.stop);
    expect(c).toEqual({ busy: 0, stop: 0 });
  });
});

describe('NAI endpoint: where it runs', () => {
  it('only the air-gapped site is offline, and it runs on your own Kubernetes (NKP)', () => {
    expect(SITE.dc.online).toBe(true);
    expect(SITE.cloud.online).toBe(true);
    expect(SITE.airgap.online).toBe(false);
    expect(SITE.airgap.runsOn).toMatch(/NKP/);
    expect(SITE.airgap.model.join(' ')).not.toMatch(/Hugging Face/);
  });
});
