// Shared pieces for the Enterprise AI feature scenes (gpus.tsx, speed.tsx, own.tsx): the scene frame
// (caption, key numbers, legend, play bar) and the parts every picture draws the same way: a box, a
// GPU with its memory bar, a "Tech preview" tag, and points moving along a path.
import type { ComponentChildren, VNode } from 'preact';
import { useMemo } from 'preact/hooks';
import { paced, useClock } from '../../components/clock';
import type { Fact } from '../../../content/types';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Kpis, Show, ease, phaseAt, prog, type KpiItem } from '../../components/show';

export type Pt = [number, number];
export const W = 960;

/** A point a fraction f of the way along a polyline. */
export function along(p: Pt[], f: number): Pt {
  const seg = p.slice(1).map((q, i) => Math.hypot(q[0] - p[i][0], q[1] - p[i][1]));
  let d = Math.max(0, Math.min(1, f)) * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const k = seg[i] ? Math.min(1, d / seg[i]) : 0;
      return [p[i][0] + (p[i + 1][0] - p[i][0]) * k, p[i][1] + (p[i + 1][1] - p[i][1]) * k];
    }
    d -= seg[i];
  }
  return p[p.length - 1];
}

export const pts = (p: Pt[]) => p.map((q) => q.join(',')).join(' ');

/** Where something travelling a path from time a to b is at t, or null before and after. */
export function fly(t: number, a: number, b: number, path: Pt[]): Pt | null {
  return t < a || t >= b ? null : along(path, ease(prog(t, a, b)));
}

/** A value easing from `from` to `to` between times a and b. */
export const ramp = (t: number, a: number, b: number, from: number, to: number) => from + (to - from) * ease(prog(t, a, b));

export interface StoryStep {
  tone: Tone | 'ink';
  k: string;
  text: string;
}

/** One feature's animation: the picture on the left with its steps and caption, key numbers on the right. */
export function Story({
  steps,
  at,
  end,
  poster,
  label,
  why,
  legend,
  top,
  side,
  release,
  license,
  kpis,
  children,
}: {
  steps: readonly StoryStep[];
  /** When each step starts, in seconds. */
  at: number[];
  end: number;
  /** The frame shown when motion is reduced: the outcome. */
  poster: number;
  label: string;
  /** What is simplified, for the "illustrative" note. */
  why: string;
  legend: { color: string; label: string; dashed?: boolean }[];
  top?: ComponentChildren;
  /** Extra sections for the right column, under the key numbers. */
  side?: ComponentChildren;
  /** Replaces the page's release or license line for a feature at a different stage. */
  release?: Fact;
  license?: Fact;
  kpis: (t: number, phase: number) => KpiItem[];
  children: (t: number, phase: number) => VNode;
}) {
  const paces = useMemo(
    () =>
      paced(
        at,
        steps.map((c) => [c.k, c.text]),
      ),
    [at, steps],
  );
  const clock = useClock({
    rate: 1,
    duration: end,
    keys: true,
    poster,
    steps: paces,
  });
  const t = clock.t;
  const phase = phaseAt(at, t);
  const c = steps[phase];
  return (
    <Show
      clock={clock}
      top={top}
      side={side}
      release={release}
      license={license}
      foot={
        <>
          <Follow tone={c.tone} k={c.k}>
            <p>{c.text}</p>
          </Follow>
          <Kpis items={kpis(t, phase)} />
        </>
      }
    >
      <div class="diagram-scroll">{children(t, phase)}</div>
      <Legend items={legend} />
      <PlayBar clock={clock} label={`${label} animation`} extra={<Illus why={why} />} />
    </Show>
  );
}

/** A plain labelled box: a heading and up to two muted lines. `state` replaces the last line with a status. */
export function Box({
  x,
  y,
  w,
  h,
  t,
  s,
  s2,
  cls = 'ai-box',
  state,
  tone,
  dim,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  t: string;
  s?: string;
  s2?: string;
  cls?: string;
  state?: string;
  tone?: 'ok' | 'warn' | 'bad';
  dim?: boolean;
}) {
  return (
    <g style={{ opacity: dim ? 0.4 : 1 }}>
      <rect x={x} y={y} width={w} height={h} rx={6} class={cls} />
      <text class="d-label" x={x + 12} y={y + 20} style={{ fontWeight: 600 }}>
        {t}
      </text>
      {s && (
        <text x={x + 12} y={y + 37} class="muted d-sub">
          {s}
        </text>
      )}
      {(state ?? s2) && (
        <text x={x + 12} y={y + (s ? 54 : 37)} class={`${state && tone ? `${tone}-fill` : 'muted'} d-sub`} style={{ fontWeight: state && tone ? 600 : 400 }}>
          {state ?? s2}
        </text>
      )}
    </g>
  );
}

/** The "Tech preview" tag, drawn in a picture. */
export function Preview({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={88} height={20} rx={3} class="ai-tag" />
      <text x={x + 44} y={y + 14} text-anchor="middle" class="muted d-fine" style={{ fontWeight: 600 }}>
        Tech preview
      </text>
    </g>
  );
}

/** A GPU's height for a memory bar `bar` tall. */
const gpuH = (bar = 18) => bar + 34;

interface Part {
  /** Where the part starts in the bar and how much memory it takes, in GB. */
  at: number;
  gb: number;
  label?: string;
  /** `mem`: in use by a model. `idle`: taken but unused. */
  kind?: 'mem' | 'idle';
}

/**
 * A GPU: its name, how much memory is in use, and a memory bar holding one part per model. `cells`
 * cuts the bar into that many MIG slices; `work` (0..1) fills a thin bar while the GPU computes.
 */
export function Gpu({
  x,
  y,
  w,
  name,
  cap,
  parts,
  right,
  cells,
  work,
  tone,
  bar = 18,
}: {
  x: number;
  y: number;
  w: number;
  name: string;
  cap: number;
  parts: Part[];
  right?: string;
  cells?: number;
  work?: number;
  tone?: 'bad';
  bar?: number;
}) {
  const bx = x + 8;
  const bw = w - 16;
  const px = bw / cap;
  const used = parts.filter((p) => p.kind !== 'idle').reduce((a, p) => a + p.gb, 0);
  return (
    <g>
      <rect class={`ai-gchip${tone ? ` ${tone}` : ''}`} x={x} y={y} width={w} height={gpuH(bar)} rx={4} />
      <text class="d-fine" x={bx} y={y + 14} style={{ fontWeight: 600 }}>
        {name}
      </text>
      <text class={`d-fine ${tone ? `${tone}-fill` : 'muted'}`} x={x + w - 8} y={y + 14} text-anchor="end" style={{ fontWeight: tone ? 600 : 400 }}>
        {right ?? `${Math.round(used)} GB of ${cap} GB`}
      </text>
      <rect class="ai-bar" x={bx} y={y + 21} width={bw} height={bar} rx={2} />
      {parts.map(
        (p, i) =>
          p.gb > 0.5 && (
            <g key={i}>
              <rect class={`ai-${p.kind ?? 'mem'}`} x={bx + p.at * px} y={y + 21} width={p.gb * px} height={bar} rx={2} />
              {p.label && p.gb * px > p.label.length * 6.2 + 8 && (
                <text class={`d-fine ${p.kind && p.kind !== 'mem' ? '' : 'ai-on-ink'}`} x={bx + (p.at + p.gb / 2) * px} y={y + 25 + bar / 2} text-anchor="middle">
                  {p.label}
                </text>
              )}
            </g>
          ),
      )}
      {cells &&
        Array.from({ length: cells - 1 }, (_, i) => {
          const cx = bx + ((i + 1) * bw) / cells;
          return <line key={i} class="ai-cut" x1={cx} x2={cx} y1={y + 19} y2={y + 23 + bar} />;
        })}
      <rect class="ai-bar" x={bx} y={y + 25 + bar} width={bw} height={3} />
      {!!work && <rect class="ai-bar-on" x={bx} y={y + 25 + bar} width={bw * work} height={3} />}
    </g>
  );
}

/** A small "x" where something is refused. */
export function Cross({ x, y }: { x: number; y: number }) {
  return <path d={`M${x - 5} ${y - 5} l10 10 m0 -10 l-10 10`} class="gw-x" />;
}
