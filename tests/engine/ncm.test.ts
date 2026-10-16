import { describe, it, expect } from 'vitest';
import { cpuSeries, anomalyBand, withSpike, runwayDays, maxVmsThatFit, limiting, rightsize, evaluate, demand, provSteps, stepAt, monthlyCost, budgetState, score, type Resource, type Project, type CatalogItem } from '../../src/engine/ncm';

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
});

describe('capacity runway', () => {
  const res: Resource[] = [
    { id: 'cpu', label: 'CPU', unit: 'vCPU', cap: 400, used: 200, growthPerDay: 1, perVm: 4 },
    { id: 'mem', label: 'Memory', unit: 'GB', cap: 3000, used: 2000, growthPerDay: 4, perVm: 16 },
    { id: 'sto', label: 'Storage', unit: 'TB', cap: 100, used: 60, growthPerDay: 0.1, perVm: 0.2 },
  ];
  it('adding VMs never lengthens runway', () => {
    for (const r of res) expect(runwayDays(r, 10)).toBeLessThanOrEqual(runwayDays(r, 0));
  });
  it('max VMs that fit leaves positive runway, one more does not fit', () => {
    const m = maxVmsThatFit(res);
    expect(Math.min(...res.map((r) => runwayDays(r, m)))).toBeGreaterThan(0);
    expect(Math.min(...res.map((r) => runwayDays(r, m + 1)))).toBe(0);
  });
  it('identifies the limiting resource', () => {
    expect(limiting(res, 0)).toBe('cpu');
    expect(limiting(res.map((r) => (r.id === 'mem' ? { ...r, growthPerDay: 10 } : r)), 0)).toBe('mem');
  });
});

describe('right-sizing', () => {
  it('never recommends more than allocated for an over-provisioned VM', () => {
    const r = rightsize({ name: 'a', vcpu: 8, memGB: 32, cpuPeak: 20, memPeak: 30 });
    expect(r.verdict).toBe('over');
    expect(r.vcpu).toBeLessThanOrEqual(8);
    expect(r.memGB).toBeLessThanOrEqual(32);
  });
  it('flags constrained and inactive VMs', () => {
    expect(rightsize({ name: 'b', vcpu: 2, memGB: 4, cpuPeak: 97, memPeak: 60 }).verdict).toBe('under');
    expect(rightsize({ name: 'c', vcpu: 2, memGB: 4, cpuPeak: 1, memPeak: 5 }).verdict).toBe('inactive');
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
  it('step timeline ends done', () => {
    const s = provSteps(item, true);
    const total = s.reduce((a, b) => a + b.dur, 0);
    expect(stepAt(s, 0).idx).toBe(0);
    expect(stepAt(s, total).done).toBe(true);
    expect(s.some((x) => x.id === 'approve')).toBe(true);
  });
});

describe('cost and compliance', () => {
  it('cost is linear in usage and budget states are ordered', () => {
    const r = { vcpuMonth: 10, memGBMonth: 2, tbMonth: 30 };
    expect(monthlyCost({ project: 'a', vcpu: 10, memGB: 10, tb: 1, budget: 0 }, r)).toBe(100 + 20 + 30);
    expect(budgetState(50, 100)).toBe('ok');
    expect(budgetState(85, 100)).toBe('warn');
    expect(budgetState(101, 100)).toBe('over');
  });
  it('score is 100 when all checks pass', () => {
    expect(score([{ id: 'a', label: '', fix: '', pass: true, sev: 'high' }])).toBe(100);
    expect(score([{ id: 'a', label: '', fix: '', pass: false, sev: 'high' }, { id: 'b', label: '', fix: '', pass: true, sev: 'low' }])).toBe(25);
  });
});
