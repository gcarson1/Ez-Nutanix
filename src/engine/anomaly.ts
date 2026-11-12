// Data Lens anomaly detection on one share over one day: a fixed threshold for everyone versus user
// behavior analytics (UBA), which judges each user against their own learned normal. Pure; every
// user, count and setting here is an example. Claims are in docs/facts.md (DLA-1 to DLA-4).

/** The day runs hour by hour from 06:00 to 06:00. */
export const START = 6;
export const HOURS = 24;
/** The fixed rule: more than this many operations by one user in an hour raises an alert. */
export const RULE = 1000;
/** UBA settings you tune: how far above a user's normal counts, and the fewest operations that ever alert. */
export const DEVIATION = 100;
export const MIN_OPS = 50;

export const hourOf = (i: number) => (START + i) % 24;
/** UBA watches the workday; the fixed rule watches the rest (a monitoring schedule). */
export const workday = (i: number) => hourOf(i) >= 8 && hourOf(i) < 18;

export interface User {
  id: string;
  op: 'reads' | 'deletes';
  /** Operations in each hour of the day. */
  v: number[];
  /** Typical operations an hour in the workday, learned in the warmup; null when never learned. */
  norm: number | null;
}

export const USERS: readonly User[] = [
  { id: 'ana', op: 'reads', norm: 1150, v: [20, 120, 900, 1300, 1200, 1400, 700, 1100, 1250, 1350, 1150, 950, 300, 120, 60, 40, 30, 1500, 10, 5, 5, 5, 10, 40] },
  { id: 'ben', op: 'deletes', norm: 15, v: [0, 2, 12, 20, 15, 25, 8, 18, 600, 22, 14, 10, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'svc-backup', op: 'reads', norm: null, v: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4800, 6200, 5100, 0, 0] },
];
export const EXCLUDED = 'svc-backup';

/** The learned normal range drawn for a user: from half their normal up to where a deviation starts. */
export const band = (u: User): [number, number] | null => (u.norm === null ? null : [u.norm / 2, u.norm * (1 + DEVIATION / 100)]);

export interface Mode {
  /** UBA has finished its warmup and watches the workday. */
  uba: boolean;
  /** The backup account is excluded. */
  exclude: boolean;
}

/** What, if anything, raises an alert for user u in hour i. */
export function flag(u: User, i: number, m: Mode): 'rule' | 'uba' | null {
  if (m.exclude && u.id === EXCLUDED) return null;
  const v = u.v[i];
  const b = band(u);
  if (m.uba && workday(i) && b) return v > b[1] && v >= MIN_OPS ? 'uba' : null;
  return v > RULE ? 'rule' : null;
}

export const alerts = (m: Mode) => USERS.reduce((n, u) => n + u.v.filter((_, i) => flag(u, i, m)).length, 0);
