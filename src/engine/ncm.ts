// Nutanix Cloud Manager (NCM) models: anomaly band, self-service request flow, cost metered
// over a month and compliance score. Pure and deterministic. All numbers are illustrative
// inputs, not product defaults.
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
 * Outliers are left out of later baselines, so one spike does not widen the next day's band.
 */
export function anomalyBand(series: number[], k: number, learn = 7): SeriesPoint[] {
  const pts: SeriesPoint[] = [];
  for (let h = 0; h < series.length; h++) {
    const hod = h % 24;
    const day = Math.floor(h / 24);
    const weekend = day % 7 >= 5;
    const hist: number[] = [];
    for (let d = 0; d < day; d++) {
      if ((d % 7 >= 5) !== weekend || pts[d * 24 + hod].out) continue;
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

/** Contiguous stretches where `hit` is true, as [start, end) index pairs. One alert per stretch. */
export function stretches(hit: boolean[]): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let start = -1;
  hit.forEach((h, i) => {
    if (h && start < 0) start = i;
    if (!h && start >= 0) {
      out.push({ start, end: i });
      start = -1;
    }
  });
  if (start >= 0) out.push({ start, end: hit.length });
  return out;
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
  id: 'policy' | 'approve' | 'create' | 'config' | 'ready' | 'refused';
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

/** The steps a request goes through: refused at the policy check, or provisioned. */
export function requestSteps(item: CatalogItem, v: Verdict): ProvStep[] {
  if (!v.ok) return [{ id: 'policy', label: 'Check quota and policy', dur: 2 }, { id: 'refused', label: 'Sent back with the reason', dur: 3 }];
  return provSteps(item, v.needsApproval);
}

/** Which step is running at time t, and how far through it (0..1). */
export function stepAt(steps: ProvStep[], t: number): { idx: number; frac: number; done: boolean } {
  let acc = 0;
  for (let i = 0; i < steps.length; i++) {
    if (t < acc + steps[i].dur) return { idx: i, frac: Math.max(0, (t - acc) / steps[i].dur), done: false };
    acc += steps[i].dur;
  }
  return { idx: steps.length - 1, frac: 1, done: true };
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

/** From day `from` on, daily use is `factor` times the planned rate, until the next change. */
export interface Surge {
  from: number;
  factor: number;
}

/** One change, several (any order) or none. */
type Changes = Surge | Surge[] | undefined;
const changeList = (c: Changes): Surge[] => (!c ? [] : Array.isArray(c) ? [...c].sort((a, b) => a.from - b.from) : [c]);

/** Daily use on `day` as a multiple of the planned rate. */
export function factorAt(day: number, changes?: Changes): number {
  let f = 1;
  for (const c of changeList(changes)) if (day >= c.from) f = c.factor;
  return f;
}

/**
 * Cost metered by `day` (0..days) for a project whose planned month costs `monthly`,
 * spent evenly across the month, with optional changes in the daily rate.
 */
export function accrued(monthly: number, day: number, days = 30, changes?: Changes): number {
  const d = Math.max(0, Math.min(days, day));
  const perDay = monthly / days;
  let total = 0;
  let at = 0;
  let f = 1;
  for (const c of changeList(changes)) {
    const to = Math.min(d, Math.max(at, c.from));
    total += perDay * f * (to - at);
    at = to;
    if (c.from >= d) return total;
    f = c.factor;
  }
  return total + perDay * f * (d - at);
}

/** Where the month ends if the rate on `day` holds for the rest of it. */
export function paceEnd(monthly: number, day: number, days = 30, changes?: Changes): number {
  const d = Math.max(0, Math.min(days, day));
  return accrued(monthly, d, days, changes) + (monthly / days) * factorAt(d, changes) * (days - d);
}

/** First day (fractional) the metered cost reaches `state`, or null if it does not this month. */
export function crossDay(monthly: number, budget: number, state: 'warn' | 'over', days = 30, changes?: Changes, warnAt = 0.8): number | null {
  const reached = (d: number) => {
    const s = budgetState(accrued(monthly, d, days, changes), budget, warnAt);
    return state === 'over' ? s === 'over' : s !== 'ok';
  };
  if (!reached(days)) return null;
  let lo = 0;
  let hi = days;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (reached(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

// ── security compliance ──
export interface Check {
  id: string;
  label: string;
  fix: string;
  pass: boolean;
  sev: 'high' | 'medium' | 'low';
}

export const SEV_WEIGHT = { high: 3, medium: 2, low: 1 } as const;

export function score(checks: Check[]): number {
  const tot = checks.reduce((s, c) => s + SEV_WEIGHT[c.sev], 0);
  const ok = checks.reduce((s, c) => s + (c.pass ? SEV_WEIGHT[c.sev] : 0), 0);
  return tot ? Math.round((ok / tot) * 100) : 100;
}
