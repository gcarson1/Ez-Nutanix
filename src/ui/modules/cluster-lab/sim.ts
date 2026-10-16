// Hooks that connect the engine timeline to the UI: build the initial cluster from the
// shared scenario, keep a checkpointed Timeline for the action list, compute it ahead in
// small slices (so the strip fills in without blocking a frame), and pick a clock rate
// that slows down right after each action so detection and HA restarts can be followed.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createCluster, type ClusterConfig, type ClusterState } from '../../../engine/cluster';
import { Timeline, type Act } from '../../../engine/timeline';
import { deriveStatus } from '../../../engine/status';
import { useClock, type Clock } from '../../components/clock';
import { useNum, setParams } from '../../../state/route';

export const HORIZON = 12 * 3600;
export const STEP = 10;

export interface SimTimeline {
  tl: Timeline;
  initial: ClusterState;
  settled: number | null;
  duration: number;
  computed: number;
}

export function useSimTimeline(cfg: ClusterConfig, acts: Act[], actKey: string): SimTimeline {
  return useMaybeTimeline(cfg, acts, actKey)!;
}

/** Same as useSimTimeline, but `cfg: null` computes nothing (for an optional comparison run). */
export function useMaybeTimeline(cfg: ClusterConfig | null, acts: Act[], actKey: string): SimTimeline | null {
  const cfgKey = cfg ? JSON.stringify(cfg) : '';
  const initial = useMemo(() => (cfg ? createCluster(cfg) : null), [cfgKey]);
  const prev = useRef<Timeline | null>(null);
  const tl = useMemo(() => {
    if (!initial) return null;
    const t = new Timeline(initial, acts, prev.current);
    prev.current = t;
    return t;
  }, [initial, actKey]);
  const [, setVer] = useState(0);

  useEffect(() => {
    if (!tl) return;
    let cancelled = false;
    let handle = 0;
    let lastPaint = performance.now();
    const work = () => {
      if (cancelled) return;
      const t0 = performance.now();
      let done = false;
      while (!done && performance.now() - t0 < 4) {
        done = tl.extend(HORIZON, 12) || tl.settledAt() !== null;
      }
      if (done || performance.now() - lastPaint > 250) {
        lastPaint = performance.now();
        setVer((v) => v + 1);
      }
      if (!done) handle = window.setTimeout(work, 12);
    };
    handle = window.setTimeout(work, 20);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [tl]);

  if (!tl || !initial) return null;
  const settled = tl.settledAt();
  const duration =
    settled !== null ? Math.min(HORIZON, Math.max(3600, Math.ceil((settled + 1200) / 600) * 600)) : Math.min(HORIZON, Math.max(2 * 3600, tl.lastActionT + 3 * 3600));
  return { tl, initial, settled, duration, computed: tl.computedUntil };
}

/** Sim seconds per real second at 1x: slow right after an action, fast otherwise. */
export function clockRate(t: number, acts: Act[]): { rate: number; slow: boolean } {
  const near = acts.some((a) => t >= a.t - 4 && t < a.t + 150);
  return near ? { rate: 8, slow: true } : { rate: 120, slow: false };
}

export function fmtT(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}`;
}

/** Round to the engine's tick grid so actions land exactly where the user clicked. */
export function snap(t: number): number {
  return Math.max(0, Math.floor(t / STEP) * STEP);
}

/** Timeline + clock + derived state at the playhead, for one cluster scenario. */
export function useRun(cfg: ClusterConfig, acts: Act[], actKey: string, keys = true) {
  const sim = useSimTimeline(cfg, acts, actKey);
  const tRef = useRef(0);
  const r = clockRate(tRef.current, acts);
  const clock = useClock({ rate: r.rate, duration: sim.duration, stepSize: 30, keys });
  tRef.current = clock.t;
  const state = useMemo(() => sim.tl.at(clock.t), [sim.tl, clock.t]);
  const st = useMemo(() => deriveStatus(state), [state]);
  return { sim, clock, state, st, slow: r.slow && clock.playing };
}

/** Keep the playhead in the link while paused, and restore it on load. */
export function usePersistedTime(clock: Clock, key = 'at') {
  const [at0] = useNum(key, 0, 0, HORIZON);
  const written = useRef<number | null>(null);
  useEffect(() => {
    // On load, or when a pasted link changes the time, jump there.
    if (written.current === at0) return;
    written.current = at0;
    if (at0 > 0) clock.seek(at0);
  }, [at0]);
  const rounded = Math.round(clock.t);
  useEffect(() => {
    if (clock.playing) return;
    const h = window.setTimeout(() => {
      written.current = rounded;
      setParams({ [key]: rounded > 0 ? rounded : null });
    }, 300);
    return () => clearTimeout(h);
  }, [clock.playing, rounded]);
}
