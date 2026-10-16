// Nutanix Database Service (NDB) models: Time Machine recovery planning (snapshots plus
// captured transaction logs) and how a database is patched. Pure and deterministic.
// Times are minutes from the start of the window. Schedules are illustrative.

export interface TmPolicy {
  windowMin: number; // how far back the timeline goes (e.g. 7 days)
  snapEveryMin: number; // snapshot interval
  snapOffsetMin: number; // first snapshot time
  logEveryMin: number; // log catch-up interval
}

export interface RecoveryPlan {
  ok: boolean;
  target: number; // the requested time
  effective: number; // what we can actually recover to
  snapshot: number | null; // base snapshot used
  logMin: number; // minutes of log replayed on top of the snapshot
  lastCaptured: number;
  reason: string | null;
}

export function snapshots(p: TmPolicy, now: number): number[] {
  const out: number[] = [];
  for (let t = p.snapOffsetMin; t <= Math.min(now, p.windowMin); t += p.snapEveryMin) out.push(t);
  return out;
}

export function logCatchups(p: TmPolicy, now: number): number[] {
  const out: number[] = [];
  for (let t = p.logEveryMin; t <= Math.min(now, p.windowMin); t += p.logEveryMin) out.push(t);
  return out;
}

/** The latest point whose transaction log has been captured into Time Machine. */
export function lastCaptured(p: TmPolicy, now: number): number {
  const c = logCatchups(p, now);
  return c.length ? c[c.length - 1] : 0;
}

/**
 * Point-in-time recovery: start from the newest snapshot at or before the target, then
 * replay captured logs up to the target. A target after the last log catch-up cannot be
 * reached yet; a target before the first snapshot has no base image.
 */
export function planRecovery(p: TmPolicy, now: number, target: number): RecoveryPlan {
  const snaps = snapshots(p, now);
  const last = lastCaptured(p, now);
  const first = snaps.length ? snaps[0] : null;
  if (first === null || target < first) {
    return { ok: false, target, effective: first ?? 0, snapshot: first, logMin: 0, lastCaptured: last, reason: 'Before the first snapshot in the retention window' };
  }
  let effective = target;
  let reason: string | null = null;
  if (target > last) {
    effective = last;
    reason = 'Logs after the last catch-up are not in Time Machine yet';
  }
  const base = snaps.filter((s) => s <= effective).pop()!;
  return { ok: reason === null, target, effective, snapshot: base, logMin: effective - base, lastCaptured: last, reason };
}

// ── patching ──
export interface DbServer {
  name: string;
  engine: string;
  version: number; // profile version index
  ha: boolean;
}

/** HA group: members patched one at a time (a role switch, not an outage). Single instance: a restart window. */
export function patchDowntime(db: DbServer): 'rolling' | 'restart-window' {
  return db.ha ? 'rolling' : 'restart-window';
}
