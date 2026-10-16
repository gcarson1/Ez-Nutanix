// A cluster run as a timeline: a list of timed user actions (failures, recoveries, adding or
// removing nodes, migrating VMs, replacing drives) replayed over the tick engine.
//
// The Timeline class keeps checkpoints of the replay so that scrubbing backward and forward
// is fast: any time t costs at most one checkpoint interval of ticks. Results are identical
// to replay() in rebuild.ts (covered by tests). Pure and deterministic.
import type { ClusterState } from './cluster';
import { applyFailure, recoverNode, addNode, removeNode, migrateVm, replaceDisk, type Failure } from './failures';
import { tick, type TimedAction } from './rebuild';
import { deriveStatus, itemState, type ClusterStatus, type Health } from './status';
import { makeRng } from './rng';

// ── actions ──────────────────────────────────────────────────────────────────

export type Act =
  | { t: number; k: 'fail'; f: Failure }
  | { t: number; k: 'recover'; node: number }
  | { t: number; k: 'add' }
  | { t: number; k: 'remove'; node: number }
  | { t: number; k: 'migrate'; vm: number; to: number }
  | { t: number; k: 'replace'; disk: string };

export function applyAct(s: ClusterState, a: Act): ClusterState {
  switch (a.k) {
    case 'fail':
      return applyFailure(s, a.f);
    case 'recover':
      return recoverNode(s, a.node);
    case 'add':
      return addNode(s);
    case 'remove':
      return removeNode(s, a.node);
    case 'migrate':
      return migrateVm(s, a.vm, a.to);
    case 'replace':
      return replaceDisk(s, a.disk);
  }
}

export function toTimed(acts: Act[]): TimedAction[] {
  return acts.map((a) => ({ t: a.t, apply: (s: ClusterState) => applyAct(s, a) }));
}

/** Compact, URL-safe code for one action, e.g. "60n3" = power off node index 3 at t=60 s. */
export function encodeAct(a: Act): string {
  const t = Math.max(0, Math.round(a.t));
  switch (a.k) {
    case 'fail': {
      const f = a.f;
      if (f.kind === 'disk') return `${t}d${f.disk}`;
      if (f.kind === 'block') return `${t}b${f.block}`;
      if (f.kind === 'rack') return `${t}k${f.rack}`;
      return `${t}${f.kind === 'node' ? 'n' : f.kind === 'cvm' ? 'c' : 'p'}${f.node}`;
    }
    case 'recover':
      return `${t}r${a.node}`;
    case 'add':
      return `${t}a`;
    case 'remove':
      return `${t}x${a.node}`;
    case 'migrate':
      return `${t}m${a.vm}-${a.to}`;
    case 'replace':
      return `${t}y${a.disk}`;
  }
}

export function encodeActs(acts: Act[]): string {
  return acts.map(encodeAct).join('~');
}

/** Parse an action list; malformed entries are skipped (links are user-editable). */
export function decodeActs(str: string): Act[] {
  const out: Act[] = [];
  for (const part of (str || '').split('~')) {
    const m = /^(\d+)([a-z])([0-9.\-]*)$/.exec(part);
    if (!m) continue;
    const t = Number(m[1]);
    const arg = m[3];
    const n = Number(arg);
    const int = arg !== '' && Number.isInteger(n) && n >= 0;
    const disk = /^\d+\.\d+$/.test(arg);
    switch (m[2]) {
      case 'n':
        if (int) out.push({ t, k: 'fail', f: { kind: 'node', node: n } });
        break;
      case 'c':
        if (int) out.push({ t, k: 'fail', f: { kind: 'cvm', node: n } });
        break;
      case 'p':
        if (int) out.push({ t, k: 'fail', f: { kind: 'partition', node: n } });
        break;
      case 'd':
        if (disk) out.push({ t, k: 'fail', f: { kind: 'disk', disk: arg } });
        break;
      case 'b':
        if (int) out.push({ t, k: 'fail', f: { kind: 'block', block: n } });
        break;
      case 'k':
        if (int) out.push({ t, k: 'fail', f: { kind: 'rack', rack: n } });
        break;
      case 'r':
        if (int) out.push({ t, k: 'recover', node: n });
        break;
      case 'a':
        if (arg === '') out.push({ t, k: 'add' });
        break;
      case 'x':
        if (int) out.push({ t, k: 'remove', node: n });
        break;
      case 'm': {
        const mm = /^(\d+)-(\d+)$/.exec(arg);
        if (mm) out.push({ t, k: 'migrate', vm: Number(mm[1]), to: Number(mm[2]) });
        break;
      }
      case 'y':
        if (disk) out.push({ t, k: 'replace', disk: arg });
        break;
    }
  }
  return out;
}

const nn = (i: number) => `N${i + 1}`;

/** Plain-English label for an action. */
export function describeAct(a: Act): string {
  switch (a.k) {
    case 'fail': {
      const f = a.f;
      if (f.kind === 'node') return `Power off ${nn(f.node)}`;
      if (f.kind === 'cvm') return `Stop the CVM on ${nn(f.node)}`;
      if (f.kind === 'partition') return `Cut ${nn(f.node)} off the network`;
      if (f.kind === 'disk') {
        const [node, idx] = f.disk.split('.').map(Number);
        return `Fail drive ${idx + 1} in ${nn(node)}`;
      }
      if (f.kind === 'block') return `Fail block ${f.block + 1}`;
      return `Fail rack ${f.rack + 1}`;
    }
    case 'recover':
      return `Bring ${nn(a.node)} back`;
    case 'add':
      return 'Add a node';
    case 'remove':
      return `Remove ${nn(a.node)} (graceful)`;
    case 'migrate':
      return `Live-migrate VM${a.vm + 1} to ${nn(a.to)}`;
    case 'replace': {
      const [node, idx] = a.disk.split('.').map(Number);
      return `Replace drive ${idx + 1} in ${nn(node)}`;
    }
  }
}

export function isFailure(a: Act): boolean {
  return a.k === 'fail';
}

// ── samples (for the timeline strip and scoring) ────────────────────────────

export interface Sample {
  t: number;
  health: Health;
  resiliency: ClusterStatus['resiliency'];
  tolerable: number;
  under: number;
  unavailable: number;
  vmsDown: number;
  vmsTotal: number;
  heal: ClusterStatus['selfHeal']['state'];
  progress: number;
  moving: boolean;
}

export function sampleOf(s: ClusterState): Sample {
  const st = deriveStatus(s);
  let vmsDown = 0;
  for (const v of s.vms) if (v.state !== 'running') vmsDown++;
  return {
    t: s.time,
    health: st.health,
    resiliency: st.resiliency,
    tolerable: st.tolerable,
    under: st.items.under,
    unavailable: st.items.unavailable,
    vmsDown,
    vmsTotal: s.vms.length,
    heal: st.selfHeal.state,
    progress: st.selfHeal.progress,
    moving: s.transfers.some((x) => s.time - x.t < 60),
  };
}

function sig(x: Sample) {
  return `${x.health}|${x.resiliency}|${x.under}|${x.unavailable}|${x.vmsDown}|${x.heal}|${x.moving ? 1 : 0}`;
}

// ── checkpointed replay ─────────────────────────────────────────────────────

interface Cursor {
  s: ClusterState;
  i: number; // index of the next action to apply
}

export interface TimelineOptions {
  /** Tick size in sim seconds (default 10, same as replay()). */
  step?: number;
  /** Ticks between checkpoints (default 30 = 5 sim minutes). */
  every?: number;
  /** Ticks between samples (default 6 = 1 sim minute). Must divide `every`. */
  sampleEvery?: number;
}

export class Timeline {
  readonly step: number;
  readonly every: number;
  readonly sampleEvery: number;
  readonly acts: Act[];
  private readonly keys: string[];
  private readonly sorted: TimedAction[];
  private readonly sortedActs: Act[];
  private cps: Cursor[];
  readonly samples: Sample[];
  private front: Cursor;
  private last: Cursor | null = null;

  constructor(
    readonly initial: ClusterState,
    acts: Act[],
    prev?: Timeline | null,
    opts: TimelineOptions = {},
  ) {
    this.step = opts.step ?? 10;
    this.every = opts.every ?? 30;
    this.sampleEvery = opts.sampleEvery ?? 6;
    this.acts = acts.slice();
    // Stable sort by time: equal times keep the order they were added.
    this.sortedActs = this.acts.slice().sort((a, b) => a.t - b.t);
    this.keys = this.sortedActs.map(encodeAct);
    this.sorted = toTimed(this.sortedActs);

    const reusable =
      prev && prev.initial === initial && prev.step === this.step && prev.every === this.every && prev.sampleEvery === this.sampleEvery;
    if (reusable) {
      // Everything before the first changed action is still valid.
      let k = 0;
      while (k < prev.keys.length && k < this.keys.length && prev.keys[k] === this.keys[k]) k++;
      const minT = Math.min(prev.sortedActs[k]?.t ?? Infinity, this.sortedActs[k]?.t ?? Infinity);
      // A checkpoint at time c has applied every action with t <= c - step; keep c <= minT.
      this.cps = prev.cps.filter((c) => c.s.time <= minT + 1e-9);
      const front = this.cps[this.cps.length - 1];
      if (minT === Infinity && prev.front.s.time > front.s.time) {
        this.cps = prev.cps.slice();
        this.front = prev.front;
        this.samples = prev.samples.slice();
      } else {
        this.front = front;
        this.samples = prev.samples.filter((x) => x.t <= front.s.time + 1e-9);
      }
    } else {
      this.cps = [{ s: initial, i: 0 }];
      this.front = this.cps[0];
      this.samples = [sampleOf(initial)];
    }
  }

  /** Sim time up to which the timeline has been computed (and sampled) contiguously. */
  get computedUntil(): number {
    return this.front.s.time;
  }

  /** The furthest computed state (its event log covers everything up to computedUntil). */
  get frontState(): ClusterState {
    return this.front.s;
  }

  get lastActionT(): number {
    return this.sortedActs.length ? this.sortedActs[this.sortedActs.length - 1].t : 0;
  }

  private run(from: Cursor, until: number, record: boolean, maxTicks = Infinity): Cursor {
    let { s, i } = from;
    const n = this.sorted.length;
    let ticks = 0;
    while (s.time + this.step <= until + 1e-9 && ticks < maxTicks) {
      while (i < n && this.sorted[i].t <= s.time + 1e-9) s = this.sorted[i++].apply(s);
      s = tick(s, this.step);
      ticks++;
      if (record) {
        const k = Math.round(s.time / this.step);
        if (k % this.sampleEvery === 0) this.samples.push(sampleOf(s));
        if (k % this.every === 0) this.cps.push({ s, i });
      }
    }
    return { s, i };
  }

  /** Compute (and sample) further ahead. Returns true once `until` is reached. */
  extend(until: number, maxTicks = Infinity): boolean {
    if (this.front.s.time + this.step > until + 1e-9) return true;
    this.front = this.run(this.front, until, true, maxTicks);
    return this.front.s.time + this.step > until + 1e-9;
  }

  /** Cluster state at sim time t (rounded down to the tick grid), with actions at <= t applied. */
  at(t: number): ClusterState {
    const until = Math.max(0, t);
    if (until > this.front.s.time) this.extend(until);
    const span = this.every * this.step;
    let start = this.cps[Math.min(this.cps.length - 1, Math.floor(until / span + 1e-9))];
    while (start.s.time > until + 1e-9) start = this.cps[this.cps.indexOf(start) - 1];
    if (this.last && this.last.s.time <= until + 1e-9 && this.last.s.time > start.s.time) start = this.last;
    if (this.front.s.time <= until + 1e-9 && this.front.s.time > start.s.time) start = this.front;
    const r = this.run(start, until, false);
    this.last = r;
    let { s, i } = r;
    while (i < this.sorted.length && this.sorted[i].t <= until + 1e-9) s = this.sorted[i++].apply(s);
    return s;
  }

  /**
   * First sample time after the last action from which nothing visible changes for
   * `quietS` sim seconds (no failures pending, rebuild finished or stuck, no data moving).
   */
  settledAt(quietS = 1800): number | null {
    const from = this.lastActionT + 60;
    const need = Math.ceil(quietS / (this.sampleEvery * this.step));
    let runStart = -1;
    let runSig = '';
    let count = 0;
    for (let j = 0; j < this.samples.length; j++) {
      const x = this.samples[j];
      if (x.t < from) continue;
      const g = sig(x);
      if (g === runSig) count++;
      else {
        runSig = g;
        runStart = j;
        count = 1;
      }
      if (count > need) return this.samples[runStart].t;
    }
    return null;
  }
}

// ── derived insights for the UI ─────────────────────────────────────────────

export interface Insights {
  /** % of VM-owned replicated data with a live copy on the VM's current node. */
  localityPct: number;
  /** Items whose every copy is gone for good (only failed drives held them). */
  lostForGood: number;
  vmsRunning: number;
  vmsRestarting: number;
  vmsFailed: number;
}

export function insights(s: ClusterState): Insights {
  let owned = 0;
  let local = 0;
  let lost = 0;
  for (const it of s.items) {
    if (it.members.length < it.need) lost++;
    if (it.kind !== 'rf' || it.vm < 0) continue;
    const vm = s.vms[it.vm];
    if (!vm || vm.state !== 'running') continue;
    owned++;
    if (it.members.some((m) => m.node === vm.node && itemState(s, it) !== 'unavailable')) local++;
  }
  let run = 0;
  let rst = 0;
  let fail = 0;
  for (const v of s.vms) {
    if (v.state === 'running') run++;
    else if (v.state === 'restarting') rst++;
    else if (v.state === 'failed') fail++;
  }
  return { localityPct: owned ? (local / owned) * 100 : 100, lostForGood: lost, vmsRunning: run, vmsRestarting: rst, vmsFailed: fail };
}

// ── Failure Gauntlet scripts ────────────────────────────────────────────────

/** Compute nodes with VMs that do not hold a Zookeeper role, last first (good "victims"). */
export function victims(s: ClusterState): number[] {
  const live = s.nodes.filter((n) => n.state === 'up' && !n.storageOnly);
  const score = (id: number) => (s.nodes[id].zk ? 0 : 100) + s.vms.filter((v) => v.node === id).length;
  return live
    .map((n) => n.id)
    .sort((a, b) => score(b) - score(a) || b - a);
}

export const FAIL_AT = 60;
export const SECOND_AT = FAIL_AT + 20 * 60;

export type ScriptId = 'disk' | 'node' | 'cvm' | 'partition' | 'block' | 'rack' | 'double' | 'second' | 'full' | 'small' | 'twonode' | 'free' | 'game';

/** The failure script for a Gauntlet scenario, built against the initial cluster. */
export function scriptActs(id: ScriptId, s0: ClusterState, gameSeed = 1): Act[] {
  const v = victims(s0);
  const a = v[0] ?? 0;
  const b = v[1] ?? (a === 0 ? 1 : 0);
  switch (id) {
    case 'disk':
      return [{ t: FAIL_AT, k: 'fail', f: { kind: 'disk', disk: `${a}.0` } }];
    case 'node':
    case 'full':
    case 'small':
    case 'twonode':
      return [{ t: FAIL_AT, k: 'fail', f: { kind: 'node', node: id === 'twonode' ? s0.nodes.length - 1 : a } }];
    case 'cvm':
      return [
        { t: FAIL_AT, k: 'fail', f: { kind: 'cvm', node: a } },
        { t: FAIL_AT + 15 * 60, k: 'recover', node: a },
      ];
    case 'partition':
      return [{ t: FAIL_AT, k: 'fail', f: { kind: 'partition', node: a } }];
    case 'block':
      return [{ t: FAIL_AT, k: 'fail', f: { kind: 'block', block: s0.nodes[a]?.block ?? 0 } }];
    case 'rack':
      return [{ t: FAIL_AT, k: 'fail', f: { kind: 'rack', rack: s0.nodes[a]?.rack ?? 0 } }];
    case 'double':
      return [
        { t: FAIL_AT, k: 'fail', f: { kind: 'node', node: a } },
        { t: FAIL_AT, k: 'fail', f: { kind: 'node', node: b } },
      ];
    case 'second':
      return [
        { t: FAIL_AT, k: 'fail', f: { kind: 'node', node: a } },
        { t: SECOND_AT, k: 'fail', f: { kind: 'node', node: b } },
      ];
    case 'game':
      return gameActs(s0, gameSeed);
    case 'free':
      return [];
  }
}

/** Gauntlet game: a seeded, random but reproducible sequence of failures. */
export function gameActs(s0: ClusterState, seed: number, count = 3): Act[] {
  const rng = makeRng((seed * 7919 + 17) >>> 0);
  const nodes = s0.nodes.filter((n) => n.state === 'up').map((n) => n.id);
  const acts: Act[] = [];
  let t = FAIL_AT;
  for (let k = 0; k < count && nodes.length; k++) {
    const node = nodes[Math.floor(rng() * nodes.length)];
    const r = rng();
    if (r < 0.35) {
      const idx = Math.floor(rng() * s0.cfg.drivesPerNode);
      acts.push({ t, k: 'fail', f: { kind: 'disk', disk: `${node}.${idx}` } });
    } else if (r < 0.7) acts.push({ t, k: 'fail', f: { kind: 'node', node } });
    else if (r < 0.88) acts.push({ t, k: 'fail', f: { kind: 'cvm', node } });
    else acts.push({ t, k: 'fail', f: { kind: 'partition', node } });
    t += Math.round((15 + rng() * 75) / 1) * 60;
  }
  return acts;
}

export interface Score {
  dataPct: number; // % of sampled time with every item readable
  vmPct: number; // average % of VMs running
  healed: boolean; // fully re-protected at the end
  points: number; // 0..100
}

/** Score a run: availability first, then whether the cluster healed itself. */
export function scoreRun(samples: Sample[], until: number): Score {
  const xs = samples.filter((x) => x.t <= until);
  if (!xs.length) return { dataPct: 100, vmPct: 100, healed: true, points: 100 };
  const dataPct = (xs.filter((x) => x.unavailable === 0 && x.resiliency !== 'Cluster down').length / xs.length) * 100;
  const vmPct = (xs.reduce((a, x) => a + (x.vmsTotal ? 1 - x.vmsDown / x.vmsTotal : 1), 0) / xs.length) * 100;
  const end = xs[xs.length - 1];
  const healed = end.resiliency === 'OK';
  const points = Math.round(dataPct * 0.5 + vmPct * 0.3 + (healed ? 20 : 0));
  return { dataPct, vmPct, healed, points };
}
