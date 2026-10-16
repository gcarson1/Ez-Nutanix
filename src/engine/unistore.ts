// Unified storage models: Nutanix Files (FSVM ownership and failover), Volumes (iSCSI
// session redirection) and Objects (lifecycle tiering). Pure and deterministic.

// ── Files ──
export interface FilesState {
  fsvms: number;
  down: number[]; // failed FSVM indexes
  /** Top-level directories of a distributed share, each owned by one FSVM's volume group. */
  dirs: { name: string; home: number }[];
}

export interface Ownership {
  name: string;
  home: number; // FSVM whose volume group (and IP) normally serves it
  servedBy: number | null; // null = unavailable
  moved: boolean;
}

export const DIR_NAMES = ['finance', 'hr', 'eng', 'sales', 'legal', 'ops', 'design', 'support', 'it', 'exec', 'marketing', 'research'];

/** Distribute the top-level directories round-robin across FSVMs. */
export function makeFiles(fsvms: number, dirs = DIR_NAMES.length): FilesState {
  const n = Math.max(1, fsvms);
  return { fsvms: n, down: [], dirs: DIR_NAMES.slice(0, dirs).map((name, i) => ({ name, home: i % n })) };
}

/**
 * Who serves each directory. A failed FSVM's volume group and IP are taken over by a
 * surviving FSVM (here: the next healthy one, in order), so clients keep the same path.
 * With one FSVM, or when every FSVM is down, nothing can take over.
 */
export function ownership(s: FilesState): Ownership[] {
  const healthy = Array.from({ length: s.fsvms }, (_, i) => i).filter((i) => !s.down.includes(i));
  return s.dirs.map((d) => {
    if (!s.down.includes(d.home)) return { name: d.name, home: d.home, servedBy: d.home, moved: false };
    if (!healthy.length) return { name: d.name, home: d.home, servedBy: null, moved: false };
    // deterministic takeover: next healthy FSVM after the failed one
    const next = healthy.find((h) => h > d.home) ?? healthy[0];
    return { name: d.name, home: d.home, servedBy: next, moved: true };
  });
}

export function loadPerFsvm(s: FilesState): number[] {
  const out = new Array(s.fsvms).fill(0);
  for (const o of ownership(s)) if (o.servedBy !== null) out[o.servedBy]++;
  return out;
}

export function filesAvailable(s: FilesState): boolean {
  return ownership(s).every((o) => o.servedBy !== null);
}

// ── Volumes (iSCSI) ──
/**
 * External hosts log in to one cluster Data Services IP and are redirected to a CVM
 * (Stargate) that serves their volume group. If that CVM goes away, the next login is
 * redirected to a healthy CVM. Returns the CVM serving each client.
 */
export function iscsiTargets(clients: number, cvms: number, down: number[]): (number | null)[] {
  const healthy = Array.from({ length: cvms }, (_, i) => i).filter((i) => !down.includes(i));
  const out: (number | null)[] = Array.from({ length: clients }, (_, c) => (down.includes(c % cvms) ? null : c % cvms));
  const load = new Map(healthy.map((h) => [h, out.filter((t) => t === h).length]));
  for (let c = 0; c < clients; c++) {
    if (out[c] !== null || !healthy.length) continue;
    // redirect to the least-loaded healthy CVM (lowest index on ties)
    const pick = healthy.reduce((a, b) => (load.get(b)! < load.get(a)! ? b : a));
    out[c] = pick;
    load.set(pick, load.get(pick)! + 1);
  }
  return out;
}

// ── Objects lifecycle tiering ──
/** Fraction of objects older than `days` given objects arrive evenly over `spanDays`. */
export function tieredFraction(days: number, spanDays: number): number {
  if (days <= 0) return 1;
  if (days >= spanDays) return 0;
  return (spanDays - days) / spanDays;
}

export function tierSplit(totalTB: number, ruleDays: number | null, spanDays: number): { localTB: number; remoteTB: number } {
  if (ruleDays === null) return { localTB: totalTB, remoteTB: 0 };
  const f = tieredFraction(ruleDays, spanDays);
  return { localTB: totalTB * (1 - f), remoteTB: totalTB * f };
}
