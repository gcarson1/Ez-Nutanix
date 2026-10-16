// Disaster recovery engine (pure, deterministic, no DOM): RPO classification, sync latency gate,
// data-loss exposure over time, failover sequences, and multi-site recovery choices.
//
// Sources for the tier boundaries (see the module's facts notes):
// - RPO 0 = synchronous; 1 to 15 minutes = NearSync; 1 hour or more (up to 24 hours) = asynchronous.
// - Synchronous replication needs less than 5 ms round-trip time between sites.
// Everything time-based beyond those boundaries (transfer times, boot durations) is illustrative.

export type Tier = 'sync' | 'nearsync' | 'async' | 'none';

export const SYNC_RTT_LIMIT_MS = 5;
export const NEARSYNC_MIN_S = 60;
export const NEARSYNC_MAX_S = 15 * 60;
export const ASYNC_MIN_S = 60 * 60;

/** The RPO values the slider offers, in seconds (stops inside each tier). */
export const RPO_STOPS = [0, 60, 120, 300, 600, 900, 3600, 7200, 4 * 3600, 6 * 3600, 12 * 3600, 24 * 3600];

export function classifyRpo(rpoS: number): Tier {
  if (rpoS === 0) return 'sync';
  if (rpoS >= NEARSYNC_MIN_S && rpoS <= NEARSYNC_MAX_S) return 'nearsync';
  if (rpoS >= ASYNC_MIN_S) return 'async';
  return 'none';
}

export const TIER_LABEL: Record<Tier, string> = {
  sync: 'Synchronous',
  nearsync: 'NearSync',
  async: 'Asynchronous',
  none: 'Not a replication tier',
};

export function tierReason(rpoS: number): string {
  const t = classifyRpo(rpoS);
  if (t === 'sync') return 'RPO 0: every write is committed at both sites before the application gets its acknowledgment.';
  if (t === 'nearsync') return 'RPO from 1 to 15 minutes: frequent lightweight recovery points shipped continuously.';
  if (t === 'async') return 'RPO of 1 hour or more (up to 24 hours): scheduled snapshots replicated after they are taken.';
  if (rpoS > 0 && rpoS < NEARSYNC_MIN_S) return 'Below 1 minute (but above 0) is not a policy tier in this model.';
  return 'Between 15 and 60 minutes is not a separate tier: pick 15 minutes (NearSync) or 1 hour (asynchronous).';
}

export interface SyncGate {
  allowed: boolean;
  reason: string;
}

export function syncGate(rttMs: number): SyncGate {
  if (rttMs < SYNC_RTT_LIMIT_MS) return { allowed: true, reason: `${fmtMs(rttMs)} round trip is under the ${SYNC_RTT_LIMIT_MS} ms limit for synchronous replication.` };
  return {
    allowed: false,
    reason: `Synchronous replication needs a round trip under ${SYNC_RTT_LIMIT_MS} ms. At ${fmtMs(rttMs)}, every write would wait too long for the remote acknowledgment.`,
  };
}

function fmtMs(ms: number): string {
  return `${Number.isInteger(ms) ? ms : ms.toFixed(1)} ms`;
}

/** Effective tier after the latency gate: Sync over a slow link is not possible. */
export function effectiveTier(rpoS: number, rttMs: number): { tier: Tier; blocked: boolean; reason: string } {
  const t = classifyRpo(rpoS);
  if (t === 'sync') {
    const g = syncGate(rttMs);
    if (!g.allowed) return { tier: 'none', blocked: true, reason: g.reason };
    return { tier: t, blocked: false, reason: g.reason };
  }
  return { tier: t, blocked: false, reason: tierReason(rpoS) };
}

/** Extra write latency a synchronous write pays: roughly one round trip to the remote site. Illustrative. */
export function syncWritePenaltyMs(rttMs: number): number {
  return rttMs;
}

// ── exposure (how much data could be lost right now) ──

export interface Link {
  /** Recovery point interval in seconds (the RPO). 0 = synchronous. */
  rpoS: number;
  /** Data changed per second at the protected site, MB/s. */
  changeMBps: number;
  /** Replication bandwidth, MB/s. */
  bwMBps: number;
}

export interface ReplicatedPoint {
  /** When the recovery point was taken. */
  taken: number;
  /** When its replication finished (it is usable at the remote site from then on). */
  landed: number;
}

/**
 * Recovery points taken every RPO seconds from t=0. Each one ships the data changed since the
 * previous one; transfers are serialized, so a link too slow for the change rate falls behind.
 */
export function replicatedPoints(link: Link, until: number): ReplicatedPoint[] {
  if (link.rpoS <= 0) return [];
  const out: ReplicatedPoint[] = [];
  const xfer = transferTime(link);
  let prevLanded = 0;
  for (let k = 0; k * link.rpoS <= until; k++) {
    const taken = k * link.rpoS;
    // The first point (k=0) is the initial seed, assumed already in place.
    const landed = k === 0 ? 0 : Math.max(prevLanded, taken) + xfer;
    out.push({ taken, landed });
    prevLanded = landed;
  }
  return out;
}

export function transferTime(link: Link): number {
  if (link.rpoS <= 0) return 0;
  if (link.bwMBps <= 0) return Infinity;
  return (link.changeMBps * link.rpoS) / link.bwMBps;
}

/** True when the link can ship each recovery point before the next one is due. */
export function keepsUp(link: Link): boolean {
  return link.rpoS === 0 ? true : transferTime(link) <= link.rpoS;
}

/** Seconds of changes that would be lost if the primary failed at time t. */
export function exposureAt(link: Link, t: number): number {
  if (link.rpoS <= 0) return 0;
  const pts = replicatedPoints(link, t);
  let best = 0;
  for (const p of pts) if (p.landed <= t && p.taken > best) best = p.taken;
  return Math.max(0, t - best);
}

export function exposureMB(link: Link, t: number): number {
  return exposureAt(link, t) * link.changeMBps;
}

/** Worst-case exposure in steady state (seconds): RPO plus the time to ship a point, if the link keeps up. */
export function worstExposure(link: Link): number {
  if (link.rpoS <= 0) return 0;
  if (!keepsUp(link)) return Infinity;
  return link.rpoS + transferTime(link);
}

/** Sample the exposure curve for a chart. */
export function exposureSeries(link: Link, until: number, samples = 240): { t: number; s: number }[] {
  const out: { t: number; s: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = (until * i) / samples;
    out.push({ t, s: exposureAt(link, t) });
  }
  // Add exact points just before and at each landing so the sawtooth has vertical drops.
  for (const p of replicatedPoints(link, until)) {
    if (p.landed > 0 && p.landed <= until) {
      out.push({ t: p.landed - 1e-6, s: exposureAt(link, p.landed - 1e-6) });
      out.push({ t: p.landed, s: exposureAt(link, p.landed) });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

// ── failover sequences ──

export type FailoverKind = 'planned' | 'unplanned' | 'test' | 'failback';

export interface StageCfg {
  name: string;
  vms: string[];
}

export interface FailoverOpts {
  kind: FailoverKind;
  tier: Tier;
  /** Seconds of data not yet at the recovery site when the event starts (for unplanned). */
  lagS: number;
  /** Witness configured (synchronous only): failover is automatic. */
  witness: boolean;
  /** Delay between recovery-plan stages (seconds). */
  stageDelayS: number;
  stages: StageCfg[];
  netMap: boolean;
  scripts: boolean;
}

export type SiteState = 'running' | 'stopping' | 'off' | 'down' | 'test';

export interface Step {
  id: string;
  label: string;
  detail: string;
  start: number;
  end: number;
  /** Recovery-plan stage index this step powers on, if any. */
  stage?: number;
  tone: 'ok' | 'warn' | 'bad' | 'flow' | 'neutral';
}

export interface Sequence {
  kind: FailoverKind;
  steps: Step[];
  duration: number;
  /** Seconds of writes lost (0 for planned, test and failback). */
  dataLossS: number;
  /** Whether a person had to decide to fail over. */
  manualDecision: boolean;
  /** Recovered VMs reachable on the network afterwards. */
  reachable: boolean;
}

// Illustrative durations (seconds).
export const DUR = {
  shutdown: 90,
  finalSync: 60,
  detectAuto: 30,
  detectManual: 600,
  restorePoint: 60,
  bootStage: 120,
  netMap: 30,
  scripts: 60,
  cleanup: 120,
  validate: 300,
  reverseSync: 300,
};

export function buildSequence(o: FailoverOpts): Sequence {
  const steps: Step[] = [];
  let t = 0;
  const add = (id: string, label: string, detail: string, dur: number, tone: Step['tone'] = 'flow', stage?: number) => {
    steps.push({ id, label, detail, start: t, end: t + dur, tone, stage });
    t += dur;
  };
  let manual = false;
  let loss = 0;

  if (o.kind === 'planned' || o.kind === 'failback') {
    const from = o.kind === 'planned' ? 'Site A' : 'Site B';
    add('start', o.kind === 'planned' ? 'Planned failover starts' : 'Failback starts', 'Both sites are healthy. An administrator runs the recovery plan.', 10, 'neutral');
    if (o.kind === 'failback') add('resync', 'Reverse replication catches up', 'Changes made while running at Site B are replicated back to Site A first.', DUR.reverseSync, 'flow');
    add('shutdown', `Shut down VMs at ${from}`, 'Guests are shut down cleanly, so nothing new is written.', DUR.shutdown, 'warn');
    add('final', 'Final replication', o.tier === 'sync' ? 'Already in step: synchronous writes are at both sites.' : 'The last changes are shipped to the recovery site, so no data is lost.', o.tier === 'sync' ? 10 : DUR.finalSync, 'flow');
  } else if (o.kind === 'unplanned') {
    add('outage', 'Site A is lost', 'Power, network or site failure. Writes since the last replicated point are gone.', 10, 'bad');
    if (o.tier === 'sync' && o.witness) {
      add('detect', 'Witness confirms the failure', 'Both sites can reach the Witness, so it can tell a site failure from a broken link and fail over automatically.', DUR.detectAuto, 'warn');
    } else {
      manual = true;
      add(
        'detect',
        'An administrator declares a disaster',
        o.tier === 'sync' ? 'Without a Witness the surviving site cannot tell a site failure from a broken link, so a person decides.' : 'Someone confirms the outage and starts the recovery plan.',
        DUR.detectManual,
        'warn',
      );
    }
    add('restore', 'Restore the latest recovery point', o.tier === 'sync' ? 'The recovery site already has every acknowledged write.' : 'VMs are created from the newest point that reached the recovery site.', DUR.restorePoint, 'flow');
    loss = o.tier === 'sync' ? 0 : o.lagS;
  } else {
    add('clone', 'Clone the latest recovery point', 'Production keeps running and replicating. The test uses clones, not the replicas themselves.', DUR.restorePoint, 'flow');
  }

  if (o.kind !== 'failback') {
    o.stages.forEach((s, i) => {
      add(`stage${i}`, `Stage ${i + 1}: power on ${s.name}`, `${s.vms.join(', ')}`, DUR.bootStage, 'ok', i);
      if (i < o.stages.length - 1 && o.stageDelayS > 0) add(`delay${i}`, `Wait ${o.stageDelayS} s`, 'Delay so the previous stage is ready before its dependents start.', o.stageDelayS, 'neutral');
    });
    if (o.netMap) add('net', o.kind === 'test' ? 'Attach the isolated test network' : 'Apply network mapping', o.kind === 'test' ? 'Test VMs join a network with no route to production.' : 'Each VM is connected to the matching network at the recovery site.', DUR.netMap, 'flow');
    if (o.scripts) add('scripts', 'Run in-guest scripts', 'For example, update DNS records or application settings.', DUR.scripts, 'flow');
    if (o.kind === 'test') add('validate', 'Validate the application', 'Check that the app works, then record the result.', DUR.validate, 'neutral');
    if (o.kind === 'test') add('cleanup', 'Clean up test VMs', 'Test clones are deleted. Production was never touched.', DUR.cleanup, 'neutral');
  } else {
    o.stages.forEach((s, i) => add(`stage${i}`, `Stage ${i + 1}: power on ${s.name} at Site A`, s.vms.join(', '), DUR.bootStage, 'ok', i));
    if (o.netMap) add('net', 'Apply network mapping back to Site A', 'VMs return to their original networks.', DUR.netMap, 'flow');
  }
  add('done', o.kind === 'test' ? 'Test complete' : 'Recovered', o.kind === 'test' ? 'Recovery proven without touching production.' : 'Applications are running at the recovery site.', 1, o.kind === 'unplanned' && loss > 0 ? 'warn' : 'ok');

  return { kind: o.kind, steps, duration: t, dataLossS: loss, manualDecision: manual, reachable: o.netMap };
}

export interface SeqState {
  step: Step;
  index: number;
  /** Stages fully powered on at the recovery site. */
  stagesUp: number;
  primary: SiteState;
  recovery: SiteState;
  done: boolean;
}

export function stateAt(seq: Sequence, t: number): SeqState {
  let index = seq.steps.findIndex((s) => t < s.end);
  if (index < 0) index = seq.steps.length - 1;
  const step = seq.steps[index];
  const done = t >= seq.duration;
  let stagesUp = 0;
  for (const s of seq.steps) if (s.stage !== undefined && t >= s.end) stagesUp = Math.max(stagesUp, s.stage + 1);
  const passed = (id: string) => seq.steps.some((s) => s.id === id && t >= s.start);
  let primary: SiteState = 'running';
  let recovery: SiteState = 'off';
  if (seq.kind === 'planned') {
    primary = passed('final') ? 'off' : passed('shutdown') ? 'stopping' : 'running';
    recovery = stagesUp > 0 ? 'running' : 'off';
  } else if (seq.kind === 'unplanned') {
    primary = 'down';
    recovery = stagesUp > 0 ? 'running' : 'off';
  } else if (seq.kind === 'test') {
    primary = 'running';
    recovery = passed('cleanup') && done ? 'off' : stagesUp > 0 ? 'test' : 'off';
  } else {
    // failback: "primary" is Site B (currently running), "recovery" is Site A.
    primary = passed('final') ? 'off' : passed('shutdown') ? 'stopping' : 'running';
    recovery = stagesUp > 0 ? 'running' : 'off';
  }
  return { step, index, stagesUp, primary, recovery, done };
}

// ── multi-site ──

export interface RemoteSite {
  id: string;
  name: string;
  rpoS: number;
  rttMs: number;
}

export interface RecoveryOption {
  site: RemoteSite;
  tier: Tier;
  /** Worst-case data loss in seconds for this target. */
  lossS: number;
}

/** Surviving recovery targets ordered by least data loss. Empty if every target is lost. */
export function recoveryOptions(sites: RemoteSite[], lost: string[], lagFor: (s: RemoteSite) => number): RecoveryOption[] {
  return sites
    .filter((s) => !lost.includes(s.id))
    .map((s) => {
      const tier = effectiveTier(s.rpoS, s.rttMs).tier;
      return { site: s, tier, lossS: tier === 'sync' ? 0 : lagFor(s) };
    })
    .sort((a, b) => a.lossS - b.lossS || a.site.id.localeCompare(b.site.id));
}

export function fmtSpan(s: number): string {
  if (!Number.isFinite(s)) return 'unbounded';
  if (s <= 0) return '0 s';
  if (s < 60) return `${Math.round(s)} s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const r = Math.round(s % 60);
    return r ? `${m} min ${r} s` : `${m} min`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (m === 60) return `${h + 1} h`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
