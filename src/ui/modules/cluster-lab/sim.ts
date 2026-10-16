// Connects the engine timeline to the UI for the Failure Gauntlet: build the initial cluster,
// keep a checkpointed Timeline for the action list, and compute it ahead in small slices so
// the time strip fills in without blocking a frame.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createCluster, type ClusterConfig, type ClusterState } from '../../../engine/cluster';
import { Timeline, type Act } from '../../../engine/timeline';

export const HORIZON = 12 * 3600;

export interface SimTimeline {
  tl: Timeline;
  initial: ClusterState;
  settled: number | null;
  duration: number;
  computed: number;
}

/** The timeline for one scenario; `cfg: null` computes nothing (for an optional comparison run). */
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

export function fmtT(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(ss)}` : `${m}:${p(ss)}`;
}
