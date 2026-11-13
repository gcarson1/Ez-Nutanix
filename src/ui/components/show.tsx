// The one module layout (Nutanix 2.0, N2-010). On the left: the controls row, the picture, its
// legend and the play bar, and under them the steps (click one to jump there) and the current
// caption (the `Follow` in `foot`). On the right: the rest of `foot` (key numbers), anything else
// the module adds (`side`), and the module's own summary. Below 1100 px wide the right column
// drops under the left one.
import { createContext, Fragment, toChildArray, type ComponentChildren, type VNode } from 'preact';
import { useContext, useId, useLayoutEffect, useRef } from 'preact/hooks';
import type { Clock } from './clock';
import type { Fact } from '../../content/types';
import { Follow, Seg, Tip, type SegOption, type Tone } from './controls';
import { Icon } from './Icon';

/** The open module's summary, set by the shell, shown at the foot of the right column. */
export const ModuleInfo = createContext<{ summary: string; facts: { release: Fact; license: Fact } } | null>(null);

/** The two facts every page carries, always first in the right pane. */
export function ProductFacts({ release, license }: { release: Fact; license: Fact }) {
  return (
    <div class="show-facts">
      <Kpis
        items={[
          { k: 'Release version', v: release.v, sub: release.sub, tip: release.tip },
          { k: 'License needed', v: license.v, sub: license.sub, tip: license.tip },
        ]}
      />
    </div>
  );
}

/** `release` and `license` replace the page's facts for a tab or scene that needs something more specific. */
export function Show({ top, children, foot, side, clock, release, license }: { top?: ComponentChildren; children: ComponentChildren; foot?: ComponentChildren; side?: ComponentChildren; clock?: Clock; release?: Fact; license?: Fact }) {
  const info = useContext(ModuleInfo);
  const root = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLDivElement>(null);
  const aside = useRef<HTMLElement>(null);
  // `foot` is usually <><Follow/><Kpis/></>: the caption goes under the picture, the rest to the right.
  const parts = toChildArray(foot).flatMap((c) => ((c as VNode).type === Fragment ? toChildArray((c as VNode<{ children?: ComponentChildren }>).props.children) : [c]));
  const isCaption = (c: unknown) => (c as VNode | null)?.type === Follow;
  const caption = parts.filter(isCaption);
  const rest = parts.filter((c) => !isCaption(c));
  const steps = clock && <StepList clock={clock} />;
  // Each picture's viewBox width, for the phone rule in app.css that keeps 11 px diagram text from
  // rendering under 10 px (N2-014). Cheap enough to run after every render; viewBoxes can change.
  // Also mark the pictures that are one SVG straight in the stage: on wide screens those shrink to
  // fit the screen, but not below a readable size set from their height (.fits in app.css);
  // anything else keeps its natural height.
  useLayoutEffect(() => {
    const m = main.current;
    if (!m) return;
    let fits = false;
    m.querySelectorAll<SVGSVGElement>('.diagram-scroll > svg.diagram').forEach((svg) => {
      const w = String(Math.round(svg.viewBox.baseVal?.width ?? 0));
      if (svg.style.getPropertyValue('--vbw') !== w) svg.style.setProperty('--vbw', w);
      const box = svg.parentElement!;
      const fit = box.parentElement?.classList.contains('show-stage') === true && box.childElementCount === 1;
      box.classList.toggle('fit', fit);
      const h = String(Math.round(svg.viewBox.baseVal?.height ?? 0));
      if (box.style.getPropertyValue('--vbh') !== h) box.style.setProperty('--vbh', h);
      if (box.style.getPropertyValue('--vbw') !== w) box.style.setProperty('--vbw', w);
      fits ||= fit;
    });
    m.classList.toggle('fits', fits);
  });
  // On wide screens both columns fit the screen (see .show in app.css): the left one is exactly as
  // tall as the space under the top bar and its picture shrinks to fit, and the right one scrolls
  // inside itself when it is longer. Measure where the layout starts on the page, and mark the
  // right column while it scrolls: a fade at the bottom until the end, and a tab stop for the keyboard.
  // Not on every render (the clock re-renders about 60 times a second): once on mount, then when the
  // window, the page, the layout or the right column's contents change size.
  useLayoutEffect(() => {
    const sync = () => syncSide(root.current, aside.current);
    sync();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(sync) : null;
    const watch = () => {
      if (!ro) return;
      ro.disconnect();
      for (const el of [root.current, aside.current, document.body, ...Array.from(aside.current?.children ?? [])]) if (el) ro.observe(el);
    };
    watch();
    const mo = typeof MutationObserver === 'function' && aside.current ? new MutationObserver(watch) : null;
    if (mo && aside.current) mo.observe(aside.current, { childList: true });
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('resize', sync);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, []);
  return (
    <div class="show" ref={root}>
      <div class="show-main" ref={main}>
        {top && <div class="show-top">{top}</div>}
        <div class="show-stage">{children}</div>
        {(caption.length > 0 || steps) && (
          <div class="show-under">
            {steps}
            {caption}
          </div>
        )}
      </div>
      <aside class="show-side" aria-label="Details" ref={aside} onScroll={() => syncSide(root.current, aside.current)}>
        {info && <ProductFacts release={release ?? info.facts.release} license={license ?? info.facts.license} />}
        {rest.length > 0 && <div class="show-foot">{rest}</div>}
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

function syncSide(root: HTMLElement | null, side: HTMLElement | null) {
  if (!root || !side) return;
  // Where the layout starts on the page, and how much page (padding, footer) follows it. Count the
  // paddings and the blocks after it, not the stretch the shell adds to keep its footer at the
  // bottom of a short page, or the layout would shrink to leave that gap empty.
  const top = `${Math.round(root.getBoundingClientRect().top + window.scrollY)}px`;
  let after = 0;
  for (let el: Element = root; el.parentElement && el !== document.body; el = el.parentElement) {
    const cs = getComputedStyle(el.parentElement);
    after += parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
    for (let sib = el.nextElementSibling; sib; sib = sib.nextElementSibling) {
      const pos = getComputedStyle(sib).position;
      if (pos !== 'absolute' && pos !== 'fixed') after += sib.getBoundingClientRect().height;
    }
  }
  const below = `${Math.round(after)}px`;
  if (root.style.getPropertyValue('--show-top') !== top) root.style.setProperty('--show-top', top);
  if (root.style.getPropertyValue('--show-below') !== below) root.style.setProperty('--show-below', below);
  const scrolls = side.scrollHeight > side.clientHeight + 1;
  side.classList.toggle('scrolls', scrolls);
  side.classList.toggle('at-end', !scrolls || side.scrollTop + side.clientHeight >= side.scrollHeight - 2);
  if (scrolls) side.tabIndex = 0;
  else side.removeAttribute('tabindex');
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

const KPI_ICON: Partial<Record<Tone, string>> = { ok: 'ok', warn: 'warn', bad: 'bad', flow: 'flow' };

/** Key numbers: a muted label, the value in plain text, and status as a small colored icon before it. */
export function Kpis({ items }: { items: KpiItem[] }) {
  return (
    <div class="kpis">
      {items.map((i) => {
        const icon = i.tone ? KPI_ICON[i.tone] : undefined;
        return (
          <div class="kpi" key={i.k}>
            <span class="k">{i.tip ? <Tip text={i.tip}>{i.k}</Tip> : i.k}</span>
            <span class="v">
              {icon && (
                <span class={`kpi-st ${i.tone}-text`} aria-hidden="true">
                  <Icon name={icon} />
                </span>
              )}
              {i.v}
            </span>
            {i.sub && <span class="s">{i.sub}</span>}
          </div>
        );
      })}
    </div>
  );
}

export interface Outcome {
  tone: 'ok' | 'warn' | 'bad';
  text: string;
}

/** The result of a failure story as a side section: a heading and one row per outcome, icon + text (never color alone). */
export function Outcomes({ items, title = 'Outcome' }: { items: Outcome[]; title?: string }) {
  return (
    <section>
      <h2 class="side-sec-h">{title}</h2>
      <ul class="outcomes">
        {items.map((o) => (
          <li key={o.text} class={o.tone}>
            <Icon name={o.tone} />
            {o.text}
          </li>
        ))}
      </ul>
    </section>
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
