// Data Lens ransomware scenario on a file share. Pure and deterministic: state at sim time t.
//
// Modeled:
// - A compromised client starts encrypting files on an SMB share at a steady rate.
// - Signature detection matches known ransomware (Starter and Pro). Behavior-based detection
//   flags unusual activity even for a new variant (Pro). A new variant on Starter goes unseen.
// - On detection Data Lens raises an alert. With automatic blocking the client is cut off
//   right away; without it, an admin has to act, which takes longer.
// - Recovery restores the affected files from the last clean snapshot. Edits made after that
//   snapshot to files that were then encrypted are lost: that is the snapshot's recovery point.
// Every number here is illustrative; real detection and response times vary.
import { makeRng, shuffle } from './rng';

export type Tier = 'starter' | 'pro';
export type Variant = 'known' | 'new';
export type Rate = 'slow' | 'fast';

export interface AttackInput {
  tier: Tier;
  variant: Variant;
  autoBlock: boolean;
  rate: Rate;
  /** Sim time the presenter pressed "Recover", if they have. */
  recoverAt?: number;
  seed?: number;
}

export const FILES = 240;
export const SIM = {
  attackStart: 20,
  perSec: { slow: 1, fast: 4 } as Record<Rate, number>,
  /** Files encrypted before behavior analytics is confident it is an attack. */
  behaviorFiles: 20,
  /** Processing time from first evidence to alert. */
  detectLatency: 10,
  autoBlockDelay: 3,
  manualBlockDelay: 90,
  restorePerSec: 16,
  /** Files users edited after the last snapshot (their newest edits live only on the share). */
  editedSinceSnap: 18,
  duration: 330,
} as const;

export interface Timeline {
  /** Encryption order; the first `encryptedTotal` files in it get encrypted. */
  order: number[];
  /** Files edited since the last snapshot. */
  edited: Set<number>;
  detectAt: number | null;
  blockAt: number | null;
  /** Time the attack stops: blocked, or ran out of files. */
  stopAt: number;
  encryptedTotal: number;
  detection: 'signature' | 'behavior' | 'none';
}

export function timeline(i: AttackInput): Timeline {
  const rng = makeRng(i.seed ?? 7);
  const all = Array.from({ length: FILES }, (_, k) => k);
  const order = shuffle(rng, all);
  const edited = new Set(shuffle(rng, all).slice(0, SIM.editedSinceSnap));
  const r = SIM.perSec[i.rate];
  const fileTime = (n: number) => SIM.attackStart + n / r; // time the n-th file (1-based) is done
  let detection: Timeline['detection'] = 'none';
  let evidence: number | null = null;
  if (i.variant === 'known') {
    detection = 'signature';
    evidence = fileTime(1);
  } else if (i.tier === 'pro') {
    detection = 'behavior';
    evidence = fileTime(SIM.behaviorFiles);
  }
  const detectAt = evidence === null ? null : evidence + SIM.detectLatency;
  const blockAt = detectAt === null ? null : detectAt + (i.autoBlock ? SIM.autoBlockDelay : SIM.manualBlockDelay);
  const runOut = fileTime(FILES);
  const stopAt = blockAt === null ? runOut : Math.min(blockAt, runOut);
  const encryptedTotal = Math.min(FILES, Math.max(0, Math.floor((stopAt - SIM.attackStart) * r + 1e-9)));
  return { order, edited, detectAt, blockAt: blockAt !== null && blockAt <= runOut ? blockAt : null, stopAt, encryptedTotal, detection };
}

export type FileState = 'clean' | 'edited' | 'encrypted' | 'restored' | 'lostEdit';

export interface AttackState {
  files: FileState[];
  encrypted: number;
  restored: number;
  /** Files whose post-snapshot edits are gone after restore. */
  lostEdits: number;
  phase: 'quiet' | 'attack' | 'detected' | 'stopped' | 'recovering' | 'recovered';
  alert: boolean;
  blocked: boolean;
  /** Recovery may start once the attack has stopped. */
  canRecover: boolean;
}

export function attackState(i: AttackInput, tl: Timeline, t: number): AttackState {
  const r = SIM.perSec[i.rate];
  const done = t < SIM.attackStart ? 0 : Math.min(tl.encryptedTotal, Math.floor((t - SIM.attackStart) * r + 1e-9));
  const recStart = i.recoverAt !== undefined && i.recoverAt >= tl.stopAt ? i.recoverAt : undefined;
  const restoredN = recStart === undefined || t < recStart ? 0 : Math.min(tl.encryptedTotal, Math.floor((t - recStart) * SIM.restorePerSec));
  const files: FileState[] = Array.from({ length: FILES }, (_, k) => (tl.edited.has(k) ? 'edited' : 'clean'));
  let lostEdits = 0;
  for (let n = 0; n < done; n++) {
    const f = tl.order[n];
    if (n < restoredN) {
      const lost = tl.edited.has(f);
      if (lost) lostEdits++;
      files[f] = lost ? 'lostEdit' : 'restored';
    } else files[f] = 'encrypted';
  }
  const encrypted = done - restoredN;
  const alert = tl.detectAt !== null && t >= tl.detectAt;
  const blocked = tl.blockAt !== null && t >= tl.blockAt;
  let phase: AttackState['phase'] = 'quiet';
  if (recStart !== undefined && t >= recStart) phase = restoredN >= tl.encryptedTotal ? 'recovered' : 'recovering';
  else if (t >= tl.stopAt) phase = 'stopped';
  else if (alert) phase = 'detected';
  else if (t >= SIM.attackStart) phase = 'attack';
  return { files, encrypted, restored: restoredN, lostEdits, phase, alert, blocked, canRecover: t >= tl.stopAt && recStart === undefined };
}

export interface AttackEvent {
  t: number;
  tone: 'ok' | 'warn' | 'bad' | 'flow' | 'neutral';
  text: string;
}

export function attackEvents(i: AttackInput, tl: Timeline, t: number): AttackEvent[] {
  const ev: AttackEvent[] = [{ t: 0, tone: 'neutral', text: 'Normal activity on the share. Last snapshot taken earlier today.' }];
  ev.push({ t: SIM.attackStart, tone: 'bad', text: 'A compromised client starts encrypting files on the share.' });
  if (tl.detectAt !== null)
    ev.push({
      t: tl.detectAt,
      tone: 'warn',
      text: tl.detection === 'signature' ? 'Alert: activity matches a known ransomware signature.' : 'Alert: behavior analytics flags abnormal mass file changes by one user.',
    });
  if (tl.blockAt !== null)
    ev.push({ t: tl.blockAt, tone: 'ok', text: i.autoBlock ? 'Client blocked automatically. Encryption stops.' : 'Admin blocks the client after reviewing the alert. Encryption stops.' });
  if (tl.blockAt === null)
    ev.push({ t: tl.stopAt, tone: 'bad', text: tl.detectAt === null ? 'No alert raised. Every file on the share is now encrypted.' : 'Every file on the share was encrypted before the client was blocked.' });
  if (i.recoverAt !== undefined && i.recoverAt >= tl.stopAt) {
    ev.push({ t: i.recoverAt, tone: 'flow', text: 'Recovery started from the last clean snapshot.' });
    ev.push({ t: i.recoverAt + tl.encryptedTotal / SIM.restorePerSec, tone: 'ok', text: 'Recovery complete. Affected files restored.' });
  }
  return ev.filter((e) => e.t <= t).sort((a, b) => a.t - b.t);
}
