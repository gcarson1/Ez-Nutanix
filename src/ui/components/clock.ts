// Animation clock: plays on its own and loops, with pause and scrub. There are no step,
// speed or reset controls; scrubbing pauses, Play resumes from where the scrubber is.
// With prefers-reduced-motion the clock starts paused and moves only when scrubbed or
// played. Space toggles whichever clock registered last.
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
}

export function useClock(opts: ClockOptions): Clock {
  const auto = opts.autoplay !== false && !prefersReducedMotion();
  const t0 = auto ? 0 : opts.poster ?? 0;
  const [t, setT] = useState(t0);
  const [playing, setPlaying] = useState(auto);
  const ref = useRef({ t: t0, playing: auto, held: 0, opts });
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
      } else set(ref.current.t + dt * o.rate);
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
      set(v);
    },
    restart: () => {
      ref.current.held = 0;
      set(0);
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
