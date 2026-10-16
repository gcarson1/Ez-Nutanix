// Nutanix Cloud Manager (NCM) models: anomaly band, capacity runway, right-sizing,
// self-service request evaluation, cost showback and compliance checks.
// Pure and deterministic. All numbers are illustrative inputs, not product defaults.
import { makeRng } from './rng';

// ── AIOps: anomaly detection against a learned baseline band ──
export interface SeriesPoint {
  h: number; // hour index
  v: number; // metric value (e.g. CPU %)
  lo: number;
  hi: number;
  mean: number;
  out: boolean;
}

/** Hourly CPU % for `days` days with a daily pattern and noise. Seeded. */
export function cpuSeries(days: number, seed = 7): number[] {
  const rnd = makeRng(seed);
  const out: number[] = [];
  for (let h = 0; h < days * 24; h++) {
    const hod = h % 24;
    const day = Math.floor(h / 24);
    const weekend = day % 7 >= 5;
    const business = hod >= 8 && hod <= 18 ? 1 : 0;
    const base = 22 + (weekend ? 4 : 18) * business + 6 * Math.sin(((hod - 6) / 24) * Math.PI * 2);
    out.push(Math.max(1, Math.min(99, base + (rnd() - 0.5) * 8)));
  }
  return out;
}

/**
 * Baseline per hour-of-day (and weekday/weekend) from earlier days, band = mean ± k·sd.
 * A point is an outlier when it falls outside the band. The first `learn` days only train.
 */
export function anomalyBand(series: number[], k: number, learn = 7): SeriesPoint[] {
  const pts: SeriesPoint[] = [];
  for (let h = 0; h < series.length; h++) {
    const hod = h % 24;
    const day = Math.floor(h / 24);
    const weekend = day % 7 >= 5;
    const hist: number[] = [];
    for (let d = 0; d < day; d++) {
      if ((d % 7 >= 5) !== weekend) continue;
      hist.push(series[d * 24 + hod]);
    }
    if (day < learn || hist.length < 2) {
      pts.push({ h, v: series[h], lo: NaN, hi: NaN, mean: NaN, out: false });
      continue;
    }
    const mean = hist.reduce((s, x) => s + x, 0) / hist.length;
    const sd = Math.sqrt(hist.reduce((s, x) => s + (x - mean) ** 2, 0) / (hist.length - 1));
    const w = k * Math.max(sd, 2); // floor so a very quiet metric still has a usable band
    const lo = mean - w;
    const hi = mean + w;
    pts.push({ h, v: series[h], lo, hi, mean, out: series[h] < lo || series[h] > hi });
  }
  return pts;
}

/** Add a spike of `size` points at hour `at` (lasting `len` hours). */
export function withSpike(series: number[], at: number, size: number, len = 3): number[] {
  return series.map((v, h) => (h >= at && h < at + len ? Math.min(100, v + size) : v));
}

// ── capacity runway ──
export interface Resource {
  id: 'cpu' | 'mem' | 'sto';
  label: string;
  unit: string;
  cap: number; // usable capacity after HA reserve
  used: number;
  growthPerDay: number;
  perVm: number; // what one added VM consumes
}

export function runwayDays(r: Resource, addVms: number): number {
  const used = r.used + addVms * r.perVm;
  if (used >= r.cap) return 0;
  if (r.growthPerDay <= 0) return Infinity;
  return (r.cap - used) / r.growthPerDay;
}

export function runway(res: Resource[], addVms: number): { id: Resource['id']; days: number }[] {
  return res.map((r) => ({ id: r.id, days: runwayDays(r, addVms) }));
}

export function limiting(res: Resource[], addVms: number): Resource['id'] {
  const rw = runway(res, addVms);
  return rw.reduce((a, b) => (b.days < a.days ? b : a)).id;
}

/** Largest number of VMs that still fits now (runway > 0). */
export function maxVmsThatFit(res: Resource[]): number {
  return Math.max(0, Math.min(...res.map((r) => Math.floor((r.cap - r.used) / r.perVm - 1e-9))));
}

// ── right-sizing ──
export interface VmUsage {
  name: string;
  vcpu: number;
  memGB: number;
  cpuPeak: number; // % of allocated
  memPeak: number; // % of allocated
}

export type SizeVerdict = 'over' | 'under' | 'inactive' | 'ok';

export function rightsize(v: VmUsage): { verdict: SizeVerdict; vcpu: number; memGB: number } {
  if (v.cpuPeak < 3 && v.memPeak < 10) return { verdict: 'inactive', vcpu: v.vcpu, memGB: v.memGB };
  if (v.cpuPeak > 90 || v.memPeak > 92) {
    return { verdict: 'under', vcpu: v.cpuPeak > 90 ? v.vcpu * 2 : v.vcpu, memGB: v.memPeak > 92 ? v.memGB * 2 : v.memGB };
  }
  // target ~70% peak, keep at least 1 vCPU / 2 GB, round vCPU to whole, memory to 2 GB
  const vcpu = Math.max(1, Math.ceil((v.vcpu * v.cpuPeak) / 70));
  const memGB = Math.max(2, Math.ceil((v.memGB * v.memPeak) / 70 / 2) * 2);
  if (vcpu < v.vcpu || memGB < v.memGB) return { verdict: 'over', vcpu: Math.min(vcpu, v.vcpu), memGB: Math.min(memGB, v.memGB) };
  return { verdict: 'ok', vcpu: v.vcpu, memGB: v.memGB };
}

// ── self-service ──
export interface CatalogItem {
  id: string;
  label: string;
  vms: number;
  vcpu: number; // per VM at size M
  memGB: number;
  diskGB: number;
  multiVm: boolean;
}

export interface Project {
  id: string;
  label: string;
  quota: { vcpu: number; memGB: number; diskGB: number };
  used: { vcpu: number; memGB: number; diskGB: number };
  /** Requests above this many vCPU need approval (an approval policy). */
  approvalAbove: number;
}

export const SIZE_MULT = { S: 0.5, M: 1, L: 2 } as const;
export type Size = keyof typeof SIZE_MULT;

export interface Demand {
  vcpu: number;
  memGB: number;
  diskGB: number;
}

export function demand(item: CatalogItem, size: Size): Demand {
  const m = SIZE_MULT[size];
  return { vcpu: Math.max(1, item.vcpu * m) * item.vms, memGB: Math.max(1, item.memGB * m) * item.vms, diskGB: item.diskGB * item.vms };
}

export interface Verdict {
  ok: boolean;
  needsApproval: boolean;
  reasons: string[];
  after: Demand;
}

export function evaluate(p: Project, d: Demand, approvalsAvailable: boolean): Verdict {
  const reasons: string[] = [];
  const after = { vcpu: p.used.vcpu + d.vcpu, memGB: p.used.memGB + d.memGB, diskGB: p.used.diskGB + d.diskGB };
  if (after.vcpu > p.quota.vcpu) reasons.push(`vCPU quota: needs ${d.vcpu}, ${p.quota.vcpu - p.used.vcpu} left`);
  if (after.memGB > p.quota.memGB) reasons.push(`Memory quota: needs ${d.memGB} GB, ${p.quota.memGB - p.used.memGB} GB left`);
  if (after.diskGB > p.quota.diskGB) reasons.push(`Storage quota: needs ${d.diskGB} GB, ${p.quota.diskGB - p.used.diskGB} GB left`);
  const needsApproval = approvalsAvailable && d.vcpu > p.approvalAbove;
  return { ok: reasons.length === 0, needsApproval, reasons, after };
}

export interface ProvStep {
  id: string;
  label: string;
  dur: number; // seconds (illustrative)
}

export function provSteps(item: CatalogItem, needsApproval: boolean): ProvStep[] {
  const s: ProvStep[] = [{ id: 'policy', label: 'Check quota and policy', dur: 2 }];
  if (needsApproval) s.push({ id: 'approve', label: 'Wait for approval', dur: 4 });
  s.push({ id: 'create', label: item.vms > 1 ? `Create ${item.vms} VMs from the blueprint` : 'Create the VM from the blueprint', dur: 3 + item.vms });
  s.push({ id: 'config', label: 'Run install and configuration tasks', dur: 4 });
  s.push({ id: 'ready', label: 'Ready: owner, project and categories applied', dur: 1 });
  return s;
}

export function stepAt(steps: ProvStep[], t: number): { idx: number; done: boolean } {
  let acc = 0;
  for (let i = 0; i < steps.length; i++) {
    acc += steps[i].dur;
    if (t < acc) return { idx: i, done: false };
  }
  return { idx: steps.length - 1, done: true };
}

// ── cost showback ──
export interface Rates {
  vcpuMonth: number;
  memGBMonth: number;
  tbMonth: number;
}

export interface Usage {
  project: string;
  vcpu: number;
  memGB: number;
  tb: number;
  budget: number;
}

export function monthlyCost(u: Usage, r: Rates): number {
  return u.vcpu * r.vcpuMonth + u.memGB * r.memGBMonth + u.tb * r.tbMonth;
}

export type BudgetState = 'ok' | 'warn' | 'over';

export function budgetState(cost: number, budget: number, warnAt = 0.8): BudgetState {
  if (cost > budget) return 'over';
  if (cost >= budget * warnAt) return 'warn';
  return 'ok';
}

// ── security compliance ──
export interface Check {
  id: string;
  label: string;
  fix: string;
  pass: boolean;
  sev: 'high' | 'medium' | 'low';
}

export function score(checks: Check[]): number {
  const w = { high: 3, medium: 2, low: 1 } as const;
  const tot = checks.reduce((s, c) => s + w[c.sev], 0);
  const ok = checks.reduce((s, c) => s + (c.pass ? w[c.sev] : 0), 0);
  return tot ? Math.round((ok / tot) * 100) : 100;
}
