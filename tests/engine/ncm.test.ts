import { describe, it, expect } from 'vitest';
import {
  accrued,
  anomalyBand,
  budgetState,
  cpuSeries,
  crossDay,
  demand,
  evaluate,
  factorAt,
  monthlyCost,
  paceEnd,
  provSteps,
  requestSteps,
  score,
  stepAt,
  stretches,
  withSpike,
  type CatalogItem,
  type Project,
} from '../../src/engine/ncm';

describe('anomaly band', () => {
  it('is deterministic', () => {
    expect(cpuSeries(14, 3)).toEqual(cpuSeries(14, 3));
  });
  it('learning days have no band and no outliers', () => {
    const pts = anomalyBand(cpuSeries(14), 2);
    expect(pts.slice(0, 7 * 24).every((p) => !p.out && Number.isNaN(p.lo))).toBe(true);
  });
  it('a large spike after the learning period is flagged', () => {
    const at = 10 * 24 + 3;
    const pts = anomalyBand(withSpike(cpuSeries(14), at, 50), 3);
    expect(pts[at].out).toBe(true);
  });
  it('a wider band never flags more points', () => {
    const s = withSpike(cpuSeries(14), 250, 30);
    const n = (k: number) => anomalyBand(s, k).filter((p) => p.out).length;
    expect(n(4)).toBeLessThanOrEqual(n(2));
    expect(n(2)).toBeLessThanOrEqual(n(1.5));
  });
  it('a flagged spike does not widen the next day’s band', () => {
    const learn = 14;
    const at = learn * 24 + 3 * 24 + 2;
    const base = anomalyBand(cpuSeries(21, 11), 3, learn);
    const spiked = anomalyBand(withSpike(cpuSeries(21, 11), at, 35), 3, learn);
    expect(Math.abs(spiked[at + 24].hi - base[at + 24].hi)).toBeLessThan(1);
    expect(spiked[at + 24].hi).toBeLessThan(spiked[at].v);
  });
  it('a night spike stays under a fixed afternoon-safe threshold but leaves the learned band', () => {
    const learn = 14;
    const at = learn * 24 + 3 * 24 + 2; // a Thursday, 2 to 4 a.m.
    const pts = anomalyBand(withSpike(cpuSeries(21, 11), at, 35), 3, learn).slice(learn * 24);
    const flagged = stretches(pts.map((p) => p.out));
    expect(flagged.length).toBe(1);
    expect(flagged[0].start).toBe(at - learn * 24);
    expect(Math.max(...pts.map((p) => p.v))).toBeLessThan(70);
  });
});

describe('stretches', () => {
  it('groups neighbouring hits into one alert', () => {
    expect(stretches([false, true, true, false, true])).toEqual([
      { start: 1, end: 3 },
      { start: 4, end: 5 },
    ]);
    expect(stretches([false, false])).toEqual([]);
  });
});

describe('self-service', () => {
  const item: CatalogItem = { id: 'x', label: 'x', vms: 3, vcpu: 4, memGB: 8, diskGB: 100, multiVm: true };
  const p: Project = { id: 'p', label: 'p', quota: { vcpu: 40, memGB: 128, diskGB: 2000 }, used: { vcpu: 30, memGB: 64, diskGB: 500 }, approvalAbove: 8 };
  it('rejects a request that exceeds quota and says which one', () => {
    const v = evaluate(p, demand(item, 'M'), true);
    expect(v.ok).toBe(false);
    expect(v.reasons.some((r) => r.startsWith('vCPU'))).toBe(true);
  });
  it('a smaller size fits; approval only when approvals are available', () => {
    expect(evaluate(p, demand(item, 'S'), true).ok).toBe(true);
    expect(evaluate(p, demand({ ...item, vms: 1 }, 'L'), false).needsApproval).toBe(false);
    expect(evaluate(p, demand({ ...item, vms: 1 }, 'L'), true).needsApproval).toBe(false);
    expect(evaluate({ ...p, approvalAbove: 4 }, demand({ ...item, vms: 1 }, 'L'), true).needsApproval).toBe(true);
  });
  it('step timeline ends done and reports progress inside a step', () => {
    const s = provSteps(item, true);
    const total = s.reduce((a, b) => a + b.dur, 0);
    expect(stepAt(s, 0)).toEqual({ idx: 0, frac: 0, done: false });
    expect(stepAt(s, s[0].dur / 2).frac).toBeCloseTo(0.5);
    expect(stepAt(s, total).done).toBe(true);
    expect(s.some((x) => x.id === 'approve')).toBe(true);
  });
  it('a refused request stops at the policy check and creates nothing', () => {
    const v = evaluate(p, demand(item, 'M'), true);
    const s = requestSteps(item, v);
    expect(s.map((x) => x.id)).toEqual(['policy', 'refused']);
    const ok = requestSteps(item, evaluate(p, demand(item, 'S'), true));
    expect(ok[ok.length - 1].id).toBe('ready');
    expect(ok.some((x) => x.id === 'create')).toBe(true);
  });
});

describe('cost', () => {
  it('cost is linear in usage and budget states are ordered', () => {
    const r = { vcpuMonth: 10, memGBMonth: 2, tbMonth: 30 };
    expect(monthlyCost({ project: 'a', vcpu: 10, memGB: 10, tb: 1, budget: 0 }, r)).toBe(100 + 20 + 30);
    expect(budgetState(50, 100)).toBe('ok');
    expect(budgetState(85, 100)).toBe('warn');
    expect(budgetState(101, 100)).toBe('over');
  });
  it('metered cost reaches the planned month at month end and never goes down', () => {
    expect(accrued(3000, 30)).toBeCloseTo(3000);
    expect(accrued(3000, 15)).toBeCloseTo(1500);
    let last = 0;
    for (let d = 0; d <= 30; d++) {
      const a = accrued(3000, d, 30, { from: 8, factor: 2.5 });
      expect(a).toBeGreaterThanOrEqual(last);
      last = a;
    }
    expect(last).toBeGreaterThan(3000);
  });
  it('crossing days match the budget state and the alert comes before going over', () => {
    const surge = { from: 8, factor: 2.5 };
    const warn = crossDay(3000, 4000, 'warn', 30, surge)!;
    const over = crossDay(3000, 4000, 'over', 30, surge)!;
    expect(warn).toBeLessThan(over);
    expect(budgetState(accrued(3000, warn + 0.01, 30, surge), 4000)).not.toBe('ok');
    expect(budgetState(accrued(3000, warn - 0.01, 30, surge), 4000)).toBe('ok');
    expect(budgetState(accrued(3000, over + 0.01, 30, surge), 4000)).toBe('over');
    expect(crossDay(3000, 4000, 'warn')).toBeNull();
    expect(crossDay(3000, 4000, 'over')).toBeNull();
  });
  it('several rate changes apply in order, and the pace forecast follows the current rate', () => {
    const changes = [
      { from: 18, factor: 0.6 },
      { from: 5, factor: 2.5 },
      { from: 13, factor: 1 },
    ];
    // 5 days at 100/day, 8 at 250, 5 at 100, 12 at 60
    expect(accrued(3000, 30, 30, changes)).toBeCloseTo(500 + 2000 + 500 + 720);
    expect(accrued(3000, 3, 30, changes)).toBeCloseTo(300);
    expect(factorAt(4, changes)).toBe(1);
    expect(factorAt(5, changes)).toBe(2.5);
    expect(factorAt(20, changes)).toBe(0.6);
    expect(paceEnd(3000, 0, 30, changes)).toBeCloseTo(3000);
    expect(paceEnd(3000, 10, 30, changes)).toBeCloseTo(500 + 1250 + 20 * 250);
    expect(paceEnd(3000, 30, 30, changes)).toBeCloseTo(accrued(3000, 30, 30, changes));
    expect(crossDay(3000, 4000, 'warn', 30, changes, 0.5)).toBeCloseTo(5 + 1500 / 250);
  });
});

describe('compliance', () => {
  it('score is 100 when all checks pass and weighs by severity', () => {
    expect(score([{ id: 'a', label: '', fix: '', pass: true, sev: 'high' }])).toBe(100);
    expect(score([{ id: 'a', label: '', fix: '', pass: false, sev: 'high' }, { id: 'b', label: '', fix: '', pass: true, sev: 'low' }])).toBe(25);
  });
});
