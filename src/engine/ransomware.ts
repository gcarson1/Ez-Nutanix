// Data Lens ransomware scenario on a file server's shares. Pure and deterministic: state at sim
// time t.
//
// Modeled:
// - A normal day, then a compromised PC starts encrypting files on the shares at a steady rate.
// - After a handful of files, Data Lens recognizes the pattern (a known signature, or behavior
//   analytics for a strain with no signature) and raises an alert.
// - Auto-block cuts the PC off from the shares right away. Alert only leaves it to an admin,
//   who blocks it later, so the PC keeps encrypting meanwhile.
// - Recovery restores the hit files from the last clean snapshot, which the PC cannot touch.
// Every number here is illustrative; real detection and response times vary.
import { makeRng, shuffle } from './rng';

export type Response = 'alert' | 'block';

export const SHARES = ['finance', 'hr', 'eng'] as const;
export const PER_SHARE = 36;
export const FILES = SHARES.length * PER_SHARE;

export const SIM = {
  /** Normal activity runs until the attack starts. */
  attackStart: 4,
  /** Files encrypted per sim second. */
  perSec: 5,
  /** Files encrypted before Data Lens is confident it is an attack. */
  detectFiles: 8,
  /** Processing time from that evidence to the alert. */
  detectLatency: 1.5,
  autoBlockDelay: 0.5,
  /** Time for an admin to see the alert, check it and block the PC. */
  adminDelay: 12,
  /** Pause after the attack stops, before recovery starts. */
  recoverGap: 2.5,
  restorePerSec: 24,
  /** Time the end state stays on screen. */
  tail: 4,
} as const;

export interface Timeline {
  /** Encryption order; the first `hit` files in it get encrypted. */
  order: number[];
  /** Everyday edits before the attack: when, and which file. */
  normal: { t: number; file: number }[];
  detectAt: number;
  blockAt: number;
  /** Time the attack stops: blocked, or ran out of files. */
  stopAt: number;
  /** Files encrypted in total. */
  hit: number;
  recoverAt: number;
  recoveredAt: number;
  end: number;
}

/** Time the n-th file in the order (0-based) is encrypted. */
export const encryptTime = (n: number) => SIM.attackStart + (n + 1) / SIM.perSec;

export function timeline(response: Response, seed = 7): Timeline {
  const rng = makeRng(seed);
  const order = shuffle(rng, Array.from({ length: FILES }, (_, k) => k));
  const normal = [0.6, 1.4, 2.2, 3.1].map((t) => ({ t, file: Math.floor(rng() * FILES) }));
  const detectAt = encryptTime(SIM.detectFiles - 1) + SIM.detectLatency;
  const blockAt = detectAt + (response === 'block' ? SIM.autoBlockDelay : SIM.adminDelay);
  const stopAt = Math.min(blockAt, encryptTime(FILES - 1));
  const hit = Math.min(FILES, Math.floor((stopAt - SIM.attackStart) * SIM.perSec + 1e-9));
  const recoverAt = stopAt + SIM.recoverGap;
  const recoveredAt = recoverAt + hit / SIM.restorePerSec;
  return { order, normal, detectAt, blockAt, stopAt, hit, recoverAt, recoveredAt, end: recoveredAt + SIM.tail };
}

/** Time the n-th hit file (0-based, in encryption order) is restored. */
export const restoreTime = (tl: Timeline, n: number) => tl.recoverAt + (n + 1) / SIM.restorePerSec;

export type FileState = 'clean' | 'encrypted' | 'restored';
export type Phase = 'quiet' | 'attack' | 'detected' | 'stopped' | 'recovering' | 'recovered';

export interface AttackState {
  files: FileState[];
  /** Files encrypted right now. */
  encrypted: number;
  /** Files hit so far, restored or not. */
  hit: number;
  restored: number;
  phase: Phase;
  alert: boolean;
  blocked: boolean;
}

export function attackState(tl: Timeline, t: number): AttackState {
  const hit = t < SIM.attackStart ? 0 : Math.min(tl.hit, Math.floor((t - SIM.attackStart) * SIM.perSec + 1e-9));
  const restored = t < tl.recoverAt ? 0 : Math.min(hit, Math.floor((t - tl.recoverAt) * SIM.restorePerSec + 1e-9));
  const files: FileState[] = new Array(FILES).fill('clean');
  for (let n = 0; n < hit; n++) files[tl.order[n]] = n < restored ? 'restored' : 'encrypted';
  let phase: Phase = 'quiet';
  if (t >= tl.recoveredAt) phase = 'recovered';
  else if (t >= tl.recoverAt) phase = 'recovering';
  else if (t >= tl.stopAt) phase = 'stopped';
  else if (t >= tl.detectAt) phase = 'detected';
  else if (t >= SIM.attackStart) phase = 'attack';
  return { files, encrypted: hit - restored, hit, restored, phase, alert: t >= tl.detectAt, blocked: t >= tl.blockAt };
}
