// Showcase layout for modules that should read at a glance: one or two preset choices on
// top, one big picture, the play bar, then a caption and a few key numbers.
import type { ComponentChildren } from 'preact';
import { Seg, Tip, type SegOption, type Tone } from './controls';

export function Show({ top, children, foot }: { top?: ComponentChildren; children: ComponentChildren; foot?: ComponentChildren }) {
  return (
    <div class="show">
      {top && <div class="show-top">{top}</div>}
      <div class="show-stage">{children}</div>
      {foot && <div class="show-foot">{foot}</div>}
    </div>
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
