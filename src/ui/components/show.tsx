// The one module layout (Nutanix 2.0, N2-010). On the left: the controls row, the picture, its
// legend and the play bar. On the right: the steps (click one to jump there), the current
// caption and key numbers (`foot`), anything else the module adds (`side`), and the module's
// own summary. Below 1100 px wide the right column drops under the picture.
import { createContext, type ComponentChildren } from 'preact';
import { useContext, useId } from 'preact/hooks';
import type { Clock } from './clock';
import { Seg, Tip, type SegOption, type Tone } from './controls';
import { Icon } from './Icon';

/** The open module's summary, set by the shell, shown at the foot of the right column. */
export const ModuleInfo = createContext<{ summary: string } | null>(null);

export function Show({ top, children, foot, side, clock }: { top?: ComponentChildren; children: ComponentChildren; foot?: ComponentChildren; side?: ComponentChildren; clock?: Clock }) {
  const info = useContext(ModuleInfo);
  return (
    <div class="show">
      <div class="show-main">
        {top && <div class="show-top">{top}</div>}
        <div class="show-stage">{children}</div>
      </div>
      <aside class="show-side" aria-label="What happens">
        {clock && <StepList clock={clock} />}
        {foot && <div class="show-foot">{foot}</div>}
        {side}
        {info && (
          <section class="side-about">
            <h2>About</h2>
            <p>{info.summary}</p>
          </section>
        )}
      </aside>
    </div>
  );
}

/** The animation's steps as a numbered list: done ones ticked, the current one marked. Click one to pause and jump there. */
export function StepList({ clock }: { clock: Clock }) {
  const steps = (clock.steps ?? []).filter((s) => s.label);
  if (steps.length < 2) return null;
  const now = Math.min(steps.length, clock.step?.index ?? 1) - 1;
  return (
    <ol class="steps" aria-label="Steps">
      {steps.map((s, k) => (
        <li key={`${s.at}-${k}`} class={k < now ? 'done' : k === now ? 'now' : ''}>
          <button
            type="button"
            aria-current={k === now ? 'step' : undefined}
            title="Jump to this step"
            onClick={() => {
              clock.pause();
              clock.seek(s.at + 0.01);
            }}
          >
            <span class="n" aria-hidden="true">
              {k < now ? <Icon name="check" /> : k + 1}
            </span>
            <span class="l">{s.label}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/**
 * Separate topics in one module, as underline tabs. Left and Right (and Home, End) move between
 * them, so the arrows scrub the animation only once focus leaves the tabs.
 */
export function Tabs<T extends string>({ label, value, tabs, onChange, children }: { label: string; value: T; tabs: readonly { id: T; label: ComponentChildren }[]; onChange: (v: T) => void; children: ComponentChildren }) {
  const id = useId();
  const onKey = (e: KeyboardEvent) => {
    const n = tabs.length;
    const i = tabs.findIndex((x) => x.id === value);
    const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    onChange(tabs[to].id);
    (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]')[to]?.focus();
  };
  return (
    <>
      <div class="tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
        {tabs.map((x) => (
          <button type="button" role="tab" key={x.id} id={`${id}-${x.id}`} aria-selected={x.id === value} aria-controls={`${id}-panel`} tabIndex={x.id === value ? 0 : -1} onClick={() => onChange(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${value}`}>
        {children}
      </div>
    </>
  );
}

/** A labeled preset choice (segmented buttons). */
export function Choice<T extends string | number>({ label, value, options, onChange, why }: { label: string; value: T; options: SegOption<T>[]; onChange: (v: T) => void; why?: string | null }) {
  return (
    <div class="choice">
      <span class="choice-l">{label}</span>
      <Seg label={label} value={value} options={options} onChange={onChange} />
      {why && <span class="choice-why">{why}</span>}
    </div>
  );
}

/** A labeled list of names (what something works with), plain text, not buttons. */
export function Names({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <div class="names">
      <span class="choice-l">{label}</span>
      <ul aria-label={label}>
        {items.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </div>
  );
}

export interface KpiItem {
  k: string;
  v: ComponentChildren;
  tone?: Tone;
  tip?: string;
  sub?: ComponentChildren;
}

/** A row of big key numbers. */
export function Kpis({ items }: { items: KpiItem[] }) {
  return (
    <div class="kpis">
      {items.map((i) => (
        <div class="kpi" key={i.k}>
          <span class="k">{i.tip ? <Tip text={i.tip}>{i.k}</Tip> : i.k}</span>
          <span class={`v${i.tone && i.tone !== 'neutral' ? ` ${i.tone}-text` : ''}`}>{i.v}</span>
          {i.sub && <span class="s">{i.sub}</span>}
        </div>
      ))}
    </div>
  );
}

export interface Point {
  k: string;
  /** Which product or component does it, shown under the heading. */
  by?: string;
  text: string;
  tone: 'ok' | 'warn' | 'flow' | 'bad' | 'ink';
  /** Animation time when the card lights up. */
  at: number;
}

/** Numbered cards that light up as the animation reaches each one; the latest is outlined until `until`. */
export function Points({ label, items, t, until }: { label: string; items: Point[]; t: number; until?: number }) {
  const now = phaseAt([-1, ...items.map((g) => g.at)], t) - 1;
  return (
    <div class="points" style={{ '--n': items.length }}>
      <span class="choice-l">{label}</span>
      <ol>
        {items.map((g, i) => (
          <li key={g.k} class={`${t >= g.at ? `on ${g.tone}` : ''}${i === now && (until === undefined || t <= until) ? ' now' : ''}`}>
            <span class="n">{i + 1}</span>
            <b>{g.k}</b>
            {g.by && <span class="by">{g.by}</span>}
            <p>{g.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Index of the phase a time falls in, given phase start times (ascending). */
export function phaseAt(starts: number[], t: number): number {
  let i = 0;
  for (let k = 0; k < starts.length; k++) if (t >= starts[k] - 1e-9) i = k;
  return i;
}

/** 0..1 progress of `t` between a and b. */
export function prog(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0;
  return Math.max(0, Math.min(1, (t - a) / (b - a)));
}

/** Smooth ease for movement along a path. */
export function ease(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/** How fast looping dots travel along a link, in diagram units per sim second at full speed. */
export const FLOW_SPEED = 70;

/**
 * Positions (0..1) of dots looping along a path `len` units long. Every link's dots move at the
 * same calm speed whatever its length, and longer links get more of them (`n` overrides).
 */
export function flowDots(t: number, len: number, n?: number, speed = FLOW_SPEED): number[] {
  const count = n ?? Math.max(1, Math.min(4, Math.round(len / 150)));
  const f = (t * speed) / Math.max(1, len);
  return Array.from({ length: count }, (_, k) => (((f + k / count) % 1) + 1) % 1);
}

type XY = { x: number; y: number } | readonly [number, number];
const xy = (p: XY) => ('x' in p ? p : { x: p[0], y: p[1] });

/** Length of a path given as a function from 0..1 to a point. */
export function pathLength(at: (p: number) => XY, samples = 24): number {
  let len = 0;
  let prev = xy(at(0));
  for (let k = 1; k <= samples; k++) {
    const q = xy(at(k / samples));
    len += Math.hypot(q.x - prev.x, q.y - prev.y);
    prev = q;
  }
  return len;
}
