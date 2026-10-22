// Disaster recovery scene (pure, deterministic, no DOM): an app at Site A writes data, one of
// three replication choices copies it to Site B, then a planned or unplanned failover moves the
// app to Site B. Times are animation seconds: an hour of async replication is drawn as a few
// seconds, so the order of events and which writes are lost matter, not the durations.
//
// Facts behind the choices (docs/facts.md DR-1 to DR-4, DR-6 to DR-9): async RPO 1 to 24 hours,
// NearSync 1 to 15 minutes. Metro Availability is synchronous replication (RPO 0, sites under
// 5 ms round trip) plus a Witness in a third location: after a site is lost the Witness gives
// the other site the lock and its VMs restart there on their own; a planned move can
// live-migrate the VMs instead. Without Metro, a person decides to fail over.

export type Tier = 'async' | 'nearsync' | 'metro';
export type DrEvent = 'planned' | 'unplanned';

export const SYNC_RTT_LIMIT_MS = 5;

/** The app tiers the recovery plan starts at Site B, in boot order. */
export const STAGES = ['Database', 'App', 'Web'] as const;

/** Seconds between two writes by the app. */
export const WRITE_EVERY = 0.4;
/** When the failover event starts. Writes stop a little before it. */
export const FAIL_AT = 8.6;

// How often a recovery point is taken, and how long it takes to reach Site B (animation seconds).
const TIMING: Record<Tier, { first: number; every: number; travel: number }> = {
  async: { first: 2, every: 3.4, travel: 1.1 },
  nearsync: { first: 0.9, every: 1, travel: 0.5 },
  metro: { first: 0, every: 0, travel: 0.2 },
};
const SHUTDOWN = 1; // planned: apps shut down cleanly at Site A
const NOTICE = 1; // unplanned: the moment the site is gone, before anyone or anything reacts
const WITNESS = 1; // the Witness confirms the site is gone and starts the failover
const PERSON = 2.2; // a person confirms the outage and starts the recovery plan
const BOOT_GAP = 0.7;
const BOOT_UP = 0.5;
const HOLD = 2.2;

export interface DrWrite {
  /** When the app writes it at Site A. */
  t: number;
  /** When it exists at Site B too (Infinity if it never gets there). */
  atB: number;
  /** Lost with Site A in an unplanned failover. */
  lost: boolean;
  /** Recovery point that carries it (index into ships), or -1 for a synchronous write. */
  ship: number;
}

export interface DrShip {
  /** When the recovery point is taken at Site A. */
  t: number;
  /** When it has fully arrived at Site B. */
  land: number;
  /** Indexes of the writes it carries. */
  writes: number[];
  /** The last copy after the apps shut down (planned failover). */
  final: boolean;
  /** Still on its way when Site A was lost, so it never arrives. */
  lost: boolean;
}

export type DrPhase = 'replicate' | 'shutdown' | 'final' | 'migrate' | 'lost' | 'decide' | 'boot' | 'running';

export interface DrScene {
  tier: Tier;
  event: DrEvent;
  writes: DrWrite[];
  ships: DrShip[];
  /** Planned: apps start shutting down. Unplanned: Site A is lost. */
  fail: number;
  /** The failover at Site B begins (after the final copy, or once the Witness or a person decides). */
  go: number;
  /** When each app tier starts at Site B, in boot order (see STAGES); with live migration, when it starts moving. */
  boot: number[];
  /** A planned Metro move: the apps live-migrate and never stop. */
  live: boolean;
  /** Every app tier is running at Site B. */
  done: number;
  /** End of the loop. */
  end: number;
  /** Writes lost with Site A. */
  lost: number;
  /** Who starts the failover. */
  decision: 'scheduled' | 'witness' | 'person';
  /** Phase start times, ascending. */
  phases: { id: DrPhase; t: number }[];
}

const r2 = (x: number) => Math.round(x * 1000) / 1000;

export function buildScene(tier: Tier, event: DrEvent): DrScene {
  const tm = TIMING[tier];
  const fail = FAIL_AT;
  const writes: DrWrite[] = [];
  for (let i = 1; i * WRITE_EVERY < fail - 0.5; i++) writes.push({ t: r2(i * WRITE_EVERY), atB: Infinity, lost: false, ship: -1 });

  const ships: DrShip[] = [];
  const shipPending = (t: number, final: boolean) => {
    const carry = writes.map((w, i) => (w.ship === -1 && w.atB === Infinity && w.t <= t + 1e-9 ? i : -1)).filter((i) => i >= 0);
    if (!carry.length) return;
    const land = r2(t + tm.travel);
    for (const i of carry) {
      writes[i].ship = ships.length;
      writes[i].atB = land;
    }
    ships.push({ t: r2(t), land, writes: carry, final, lost: false });
  };

  if (tier === 'metro') for (const w of writes) w.atB = r2(w.t + tm.travel);
  else for (let k = 0; tm.first + k * tm.every < fail; k++) shipPending(tm.first + k * tm.every, false);

  let go: number;
  let decision: DrScene['decision'];
  const phases: DrScene['phases'] = [{ id: 'replicate', t: 0 }];
  const live = tier === 'metro' && event === 'planned';
  if (live) {
    // Every write is already at Site B, so the apps live-migrate one by one and never stop.
    decision = 'scheduled';
    go = fail;
    phases.push({ id: 'migrate', t: fail });
  } else if (event === 'planned') {
    decision = 'scheduled';
    const final = fail + SHUTDOWN;
    shipPending(final, true);
    go = r2(Math.max(final, ...writes.map((w) => w.atB)));
    phases.push({ id: 'shutdown', t: fail }, { id: 'final', t: r2(final) });
  } else {
    decision = tier === 'metro' ? 'witness' : 'person';
    for (const w of writes) if (w.atB > fail) Object.assign(w, { atB: Infinity, lost: true });
    for (const s of ships) if (s.land > fail) s.lost = true;
    go = r2(fail + NOTICE + (decision === 'witness' ? WITNESS : PERSON));
    phases.push({ id: 'lost', t: fail }, { id: 'decide', t: r2(fail + NOTICE) });
  }
  const boot = STAGES.map((_, i) => r2(go + 0.3 + i * BOOT_GAP));
  const done = r2(boot[boot.length - 1] + BOOT_UP);
  if (!live) phases.push({ id: 'boot', t: go });
  phases.push({ id: 'running', t: done });

  return { tier, event, writes, ships, fail, go, boot, live, done, end: r2(done + HOLD), lost: writes.filter((w) => w.lost).length, decision, phases };
}
