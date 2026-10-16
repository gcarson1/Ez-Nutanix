// Animation clock: plays on its own and loops, with pause and scrub. There are no step,
// speed or reset controls; scrubbing pauses, Play resumes from where the scrubber is.
// With prefers-reduced-motion the clock starts paused and moves only when scrubbed or
// played. Space toggles whichever clock registered last. While playing, the clock pauses
// briefly at the end of each step (`stops`) so its caption can be read; scrubbing ignores them.
import { useEffect, useRef, useState } from 'preact/hooks';

type Handler = { toggle: () => void };
const stack: Handler[] = [];

export function simKey(action: 'toggle'): boolean {
  const h = stack[stack.length - 1];
  if (!h) return false;
  if (action === 'toggle') h.toggle();
  return true;
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface ClockOptions {
  /** Sim seconds that pass per real second. */
  rate: number;
  /** Length of one loop in sim seconds. Without it the clock runs on forever. */
  duration?: number;
  /** Start playing on mount (default true, except with reduced motion). */
  autoplay?: boolean;
  /** Start over after the end (default true). False holds the last frame. */
  loop?: boolean;
  /** Real seconds to hold the last frame before looping (default 1.8). */
  hold?: number;
  /** Register for the Space shortcut (one clock per view). */
  keys?: boolean;
  /** Frame to show when the clock starts paused (reduced motion), in sim seconds. */
  poster?: number;
  /** Sim times where a step starts. Playing pauses just before each for `stepPause`. */
  stops?: readonly number[];
  /** Real seconds to pause at each stop. Defaults to `stepPause()` of the loop's length. */
  stepPause?: number;
}

/** Pause at each step: a tenth of the loop's real length, at least 0.4 s and at most 1 s. */
export function stepPause(loopRealSeconds: number): number {
  return Math.min(1, Math.max(0.4, loopRealSeconds / 10));
}

/** How far before a stop the clock waits, in sim seconds, so the step that is ending stays on screen. */
export const EARLY = 1e-4;

/** Move a playing clock on by `step` sim seconds, waiting just before the first stop it reaches. */
export function advance(t: number, step: number, stops: readonly number[] = []): { t: number; stopped: boolean } {
  const next = t + step;
  let hit = Infinity;
  for (const s of stops) {
    const at = s - EARLY;
    if (at > t + 1e-9 && at <= next && at < hit) hit = at;
  }
  return hit === Infinity ? { t: next, stopped: false } : { t: hit, stopped: true };
}

export interface Clock {
  t: number;
  playing: boolean;
  duration?: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
  /** Back to the start; keeps playing if it was playing. */
  restart: () => void;
  /** Pause for one step's length before moving on, optionally from an earlier frame (see `useStepKey`). */
  pauseStep: (at?: number) => void;
}

export function useClock(opts: ClockOptions): Clock {
  const auto = opts.autoplay !== false && !prefersReducedMotion();
  const t0 = auto ? 0 : opts.poster ?? 0;
  const [t, setT] = useState(t0);
  const [playing, setPlaying] = useState(auto);
  const ref = useRef({ t: t0, playing: auto, held: 0, paused: 0, opts });
  ref.current.opts = opts;

  const clamp = (v: number) => {
    const d = ref.current.opts.duration;
    return Math.max(0, d !== undefined ? Math.min(d, v) : v);
  };
  const set = (v: number) => {
    ref.current.t = clamp(v);
    setT(ref.current.t);
  };

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const o = ref.current.opts;
      const d = o.duration;
      if (d !== undefined && ref.current.t >= d) {
        if (o.loop === false) {
          ref.current.playing = false;
          setPlaying(false);
          return;
        }
        ref.current.held += dt;
        if (ref.current.held >= (o.hold ?? 1.8)) {
          ref.current.held = 0;
          set(0);
        }
      } else if (ref.current.paused > 0) ref.current.paused -= dt;
      else {
        const stops = o.stops?.filter((s) => s > 0 && (d === undefined || s < d));
        const a = advance(ref.current.t, dt * o.rate, stops);
        set(a.t);
        if (a.stopped) api.pauseStep();
      }
      if (ref.current.playing) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const api: Clock = {
    t,
    playing,
    duration: opts.duration,
    play: () => {
      const d = ref.current.opts.duration;
      if (d !== undefined && ref.current.t >= d) set(0);
      ref.current.held = 0;
      ref.current.paused = 0;
      ref.current.playing = true;
      setPlaying(true);
    },
    pause: () => {
      ref.current.playing = false;
      setPlaying(false);
    },
    toggle: () => (ref.current.playing ? api.pause() : api.play()),
    seek: (v) => {
      ref.current.held = 0;
      ref.current.paused = 0;
      set(v);
    },
    restart: () => {
      ref.current.held = 0;
      ref.current.paused = 0;
      set(0);
    },
    pauseStep: (at) => {
      const o = ref.current.opts;
      if (at !== undefined) set(at);
      ref.current.paused = o.stepPause ?? stepPause(o.duration !== undefined && o.rate > 0 ? o.duration / o.rate : Infinity);
    },
  };

  const apiRef = useRef(api);
  apiRef.current = api;
  useEffect(() => {
    if (!opts.keys) return;
    const h: Handler = { toggle: () => apiRef.current.toggle() };
    stack.push(h);
    return () => {
      const i = stack.indexOf(h);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [opts.keys]);

  return api;
}

/**
 * For views whose steps come from the state rather than a list of times: when `key` (the
 * caption's heading) changes while the clock plays forward, step back to the last frame of the
 * step that just ended and pause there. The re-render happens before the browser paints.
 */
export function useStepKey(clock: Clock, key: string) {
  const prev = useRef<{ key: string; t: number; passed: string | null } | null>(null);
  const p = prev.current;
  if (p && p.key !== key && clock.playing && clock.t > p.t && p.passed !== key) {
    clock.pauseStep(p.t);
    prev.current = { ...p, passed: key };
    return;
  }
  prev.current = { key, t: clock.t, passed: p && p.key === key && clock.t >= p.t ? p.passed : null };
}

/** Restart the clock whenever one of `deps` changes (a new preset starts from the top). */
export function useRestartOn(clock: Clock, deps: unknown[]) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    clock.restart();
  }, deps);
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}
