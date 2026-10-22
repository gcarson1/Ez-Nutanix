// Animation clock: plays on its own and loops, with pause and scrub. There are no step,
// speed or reset controls; scrubbing pauses, Play resumes from where the scrubber is.
// With prefers-reduced-motion the clock starts paused and moves only when scrubbed or
// played. Space toggles whichever clock registered last. The clock never stops between
// steps: a step whose caption needs longer to read than the step lasts plays slower instead,
// at least `SECS_PER_WORD` real seconds per word, easing into and out of the slower speed.
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

/** One step of an animation: where it starts (sim seconds) and how long its caption takes to read (real seconds). */
export interface Step {
  at: number;
  read: number;
}

/** Reading time the clock allows for every word of a step's caption. */
export const SECS_PER_WORD = 0.3;

/** The plain text of a caption: strings, numbers, arrays and elements (their children). */
export function plain(x: unknown): string {
  if (x === null || x === undefined || typeof x === 'boolean') return '';
  if (typeof x === 'string' || typeof x === 'number') return String(x);
  if (Array.isArray(x)) return x.map(plain).join(' ');
  if (typeof x === 'object' && 'props' in x) return plain((x as { props: { children?: unknown } }).props.children);
  return '';
}

/** Words in a caption. */
export function words(x: unknown): number {
  return plain(x)
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Real seconds needed to read the given text. */
export function readSecs(...text: unknown[]): number {
  return SECS_PER_WORD * words(text);
}

/**
 * Steps from their start times and each one's caption (a string, or several parts). A step
 * whose caption is the same as the one before it continues that step, so the reading time
 * covers them together.
 */
export function paced(at: readonly number[], text: readonly unknown[]): Step[] {
  const out: Step[] = [];
  let prev: string | null = null;
  at.forEach((a, i) => {
    const p = plain(text[i]).replace(/\s+/g, ' ').trim();
    if (p !== prev) out.push({ at: a, read: readSecs(p) });
    prev = p;
  });
  return out;
}

/**
 * Steps for views whose captions come from the state rather than a list of times: sample the
 * caption over one loop and start a step wherever its heading changes.
 */
export function stepsFrom(duration: number, caption: (t: number) => { k: string; text?: unknown }, samples = 600): Step[] {
  const out: Step[] = [];
  let prev: string | null = null;
  for (let i = 0; i <= samples; i++) {
    const t = (duration * i) / samples;
    const c = caption(t);
    if (c.k === prev) continue;
    // find where the heading changes, to a small fraction of a sample
    let at = t;
    if (prev !== null) {
      let lo = (duration * (i - 1)) / samples;
      let hi = t;
      for (let k = 0; k < 12; k++) {
        const mid = (lo + hi) / 2;
        if (caption(mid).k === prev) lo = mid;
        else hi = mid;
      }
      at = hi;
    }
    out.push({ at, read: readSecs(c.k, c.text) });
    prev = c.k;
  }
  return out;
}

/** Real seconds the speed takes to ease between a slow step and full speed. */
export const RAMP = 0.8;

/**
 * Playback speed (sim seconds per real second) at sim time `t`. Full speed is `rate`; inside a
 * step that needs more time to read, the speed drops so the step lasts at least its reading
 * time. The speed changes gradually around a slow step, never faster inside one, so the picture
 * keeps moving and slows down or speeds up smoothly.
 */
export function rateAt(t: number, rate: number, steps: readonly Step[] = [], duration = Infinity): number {
  let r = rate;
  const sorted = steps.filter((s) => s.at < duration).sort((a, b) => a.at - b.at);
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i].at;
    const b = i + 1 < sorted.length ? sorted[i + 1].at : duration;
    if (!(b > a) || !(sorted[i].read > 0) || !Number.isFinite(b)) continue;
    const slow = Math.min(rate, (b - a) / sorted[i].read);
    const dist = t < a ? a - t : t > b ? t - b : 0;
    r = Math.min(r, slow + (rate - slow) * Math.min(1, dist / (rate * RAMP)));
  }
  return r;
}

/**
 * Time into a step (`at` to `end`) as if it played at full speed, held at the step's end once
 * reached. When the clock slows a step down for its caption, motion driven by this still plays
 * at its normal pace and then rests while the caption is read, instead of crawling.
 */
export function brisk(t: number, at: number, end: number, read: number, rate = 1): number {
  const len = end - at;
  if (!(len > 0)) return 0;
  return Math.min(len, Math.max(0, t - at) * Math.max(1, (read * rate) / len));
}

/** Real seconds one pass from `from` to `to` takes at the speeds `rateAt` gives. */
export function realLength(rate: number, steps: readonly Step[], duration: number, from = 0, to = duration): number {
  let real = 0;
  const n = 2000;
  const h = (to - from) / n;
  for (let k = 0; k < n; k++) real += h / rateAt(from + (k + 0.5) * h, rate, steps, duration);
  return real;
}

export interface ClockOptions {
  /** Sim seconds that pass per real second at full speed. */
  rate: number;
  /** Length of one loop in sim seconds. Without it the clock runs on forever. */
  duration?: number;
  /** Start playing on mount (default true, except with reduced motion). */
  autoplay?: boolean;
  /** Start over after the end (default true). False holds the last frame. */
  loop?: boolean;
  /** Real seconds to hold the last frame before looping (default 0.6). */
  hold?: number;
  /** Register for the Space shortcut (one clock per view). */
  keys?: boolean;
  /** Frame to show when the clock starts paused (reduced motion), in sim seconds. */
  poster?: number;
  /** The animation's steps; each plays slower if its caption needs longer to read. */
  steps?: readonly Step[];
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
        if (ref.current.held >= (o.hold ?? 0.6)) {
          ref.current.held = 0;
          set(0);
        }
      } else set(ref.current.t + dt * rateAt(ref.current.t, o.rate, o.steps, d));
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
