// Simulation clock for animated sequences: play/pause, single-step, speed, scrub, reset.
// Respects prefers-reduced-motion by advancing in discrete steps instead of continuously.
// Global shortcuts (Space, arrows, R) drive whichever clock registered last.
import { useEffect, useRef, useState } from 'preact/hooks';

type Handler = { toggle: () => void; step: (dir: 1 | -1) => void; reset: () => void };
const stack: Handler[] = [];

export function simKey(action: 'toggle' | 'step+' | 'step-' | 'reset'): boolean {
  const h = stack[stack.length - 1];
  if (!h) return false;
  if (action === 'toggle') h.toggle();
  else if (action === 'step+') h.step(1);
  else if (action === 'step-') h.step(-1);
  else h.reset();
  return true;
}

export const SPEEDS = [0.5, 1, 2, 5] as const;
export type Speed = (typeof SPEEDS)[number];

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface ClockOptions {
  /** Sim seconds that pass per real second at 1x. */
  rate: number;
  /** Optional end time; the clock pauses there. */
  duration?: number;
  /** Size of one manual step, in sim seconds. */
  stepSize: number;
  /** Start playing on mount. */
  autoplay?: boolean;
  /** Register for global keyboard shortcuts (one clock per view). */
  keys?: boolean;
}

export interface Clock {
  t: number;
  playing: boolean;
  speed: Speed;
  duration?: number;
  setSpeed: (s: Speed) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  step: (dir: 1 | -1) => void;
  seek: (t: number) => void;
  reset: () => void;
}

export function useClock(opts: ClockOptions): Clock {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(!!opts.autoplay);
  const [speed, setSpeed] = useState<Speed>(1);
  const ref = useRef({ t: 0, playing: !!opts.autoplay, speed: 1 as Speed, opts });
  ref.current.opts = opts;

  const clamp = (v: number) => {
    const d = ref.current.opts.duration;
    return Math.max(0, d !== undefined ? Math.min(d, v) : v);
  };
  const set = (v: number) => {
    ref.current.t = clamp(v);
    setT(ref.current.t);
    const d = ref.current.opts.duration;
    if (d !== undefined && ref.current.t >= d && ref.current.playing) {
      ref.current.playing = false;
      setPlaying(false);
    }
  };

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let timer = 0;
    if (prefersReducedMotion()) {
      // Discrete steps, no continuous motion.
      timer = window.setInterval(() => set(ref.current.t + ref.current.opts.stepSize), 1100);
      return () => clearInterval(timer);
    }
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      set(ref.current.t + dt * ref.current.opts.rate * ref.current.speed);
      if (ref.current.playing) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const api: Clock = {
    t,
    playing,
    speed,
    duration: opts.duration,
    setSpeed: (s) => {
      ref.current.speed = s;
      setSpeed(s);
    },
    play: () => {
      const d = ref.current.opts.duration;
      if (d !== undefined && ref.current.t >= d) set(0);
      ref.current.playing = true;
      setPlaying(true);
    },
    pause: () => {
      ref.current.playing = false;
      setPlaying(false);
    },
    toggle: () => (ref.current.playing ? api.pause() : api.play()),
    step: (dir) => {
      api.pause();
      set(ref.current.t + dir * ref.current.opts.stepSize);
    },
    seek: (v) => set(v),
    reset: () => {
      api.pause();
      set(0);
    },
  };

  const apiRef = useRef(api);
  apiRef.current = api;
  useEffect(() => {
    if (!opts.keys) return;
    const h: Handler = {
      toggle: () => apiRef.current.toggle(),
      step: (d) => apiRef.current.step(d),
      reset: () => apiRef.current.reset(),
    };
    stack.push(h);
    return () => {
      const i = stack.indexOf(h);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [opts.keys]);

  return api;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}
