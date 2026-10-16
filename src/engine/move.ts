// Nutanix Move migration timeline: seed (full copy while the source keeps running),
// periodic incremental syncs, then a cutover with a short downtime window.
// Pure and deterministic. Throughput, change rate and timings are user inputs (illustrative).

export interface MoveInput {
  vmGB: number; // data to copy
  mbps: number; // effective transfer rate, MB/s
  changeGBPerHour: number; // how fast the source VM changes data
  syncEveryMin: number; // time between incremental sync starts
  cutoverAt: number | null; // minute the operator triggers cutover (null = not yet)
  bootMin: number; // power-on and guest checks on the target
}

export type PhaseKind = 'seed' | 'sync' | 'idle' | 'final' | 'boot' | 'done';

export interface Phase {
  kind: PhaseKind;
  start: number;
  end: number;
  gb: number;
}

export interface MovePlan {
  phases: Phase[];
  seedEnd: number;
  converges: boolean; // can incremental syncs keep up with the change rate?
  downtimeMin: number | null; // from source shutdown to target running
  cutoverStart: number | null;
  doneAt: number | null;
  lastDeltaGB: number;
}

const gbPerMin = (mbps: number) => (mbps * 60) / 1024;

/** Build the timeline up to `horizon` minutes (or until the migration completes). */
export function planMove(i: MoveInput, horizon: number): MovePlan {
  const rate = gbPerMin(i.mbps);
  const chg = i.changeGBPerHour / 60;
  const phases: Phase[] = [];
  const seedEnd = i.vmGB / rate;
  phases.push({ kind: 'seed', start: 0, end: seedEnd, gb: i.vmGB });
  const converges = chg < rate;
  let lastSyncedAt = 0; // source state captured up to here (point the last copy started from)
  let t = seedEnd;
  let lastDelta = 0;
  // cutover can only be requested after the seed
  const cut = i.cutoverAt !== null ? Math.max(i.cutoverAt, seedEnd) : null;
  let guard = 0;
  while (t < horizon && guard++ < 2000) {
    if (cut !== null && t >= cut) break;
    const next = Math.min(t + i.syncEveryMin, cut ?? Infinity, horizon);
    if (next > t) phases.push({ kind: 'idle', start: t, end: next, gb: 0 });
    t = next;
    if (cut !== null && t >= cut) break;
    if (t >= horizon) break;
    // incremental: copy what changed since the last sync started
    const delta = (t - lastSyncedAt) * chg;
    const dur = delta / rate;
    phases.push({ kind: 'sync', start: t, end: t + dur, gb: delta });
    lastDelta = delta;
    lastSyncedAt = t;
    t += dur;
  }
  let downtime: number | null = null;
  let doneAt: number | null = null;
  let cutoverStart: number | null = null;
  if (cut !== null) {
    cutoverStart = Math.max(t, cut);
    // source is shut down: copy the final delta, then boot on the target
    const delta = (cutoverStart - lastSyncedAt) * chg;
    const fin = delta / rate;
    phases.push({ kind: 'final', start: cutoverStart, end: cutoverStart + fin, gb: delta });
    phases.push({ kind: 'boot', start: cutoverStart + fin, end: cutoverStart + fin + i.bootMin, gb: 0 });
    doneAt = cutoverStart + fin + i.bootMin;
    downtime = doneAt - cutoverStart;
    phases.push({ kind: 'done', start: doneAt, end: Math.max(doneAt, horizon), gb: 0 });
    lastDelta = delta;
  }
  return { phases, seedEnd, converges, downtimeMin: downtime, cutoverStart, doneAt, lastDeltaGB: lastDelta };
}

export function phaseAt(p: MovePlan, t: number): Phase {
  for (const ph of p.phases) if (t >= ph.start && t < ph.end) return ph;
  return p.phases[p.phases.length - 1];
}

/** Downtime if the operator cut over right after the seed, without incremental syncs. */
export function naiveDowntime(i: MoveInput): number {
  return i.vmGB / gbPerMin(i.mbps) + i.bootMin;
}
