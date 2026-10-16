// Shared controls in the design-system vocabulary: segmented choices, toggles, sliders,
// labeled fields with "why disabled" text, status chips, explain-this tips, honest-fit
// callouts, and the play bar for animated sequences.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon';
import { SPEEDS, fmtClock, type Clock } from './clock';

// ── explain-this tooltip ──
export function Tip({ text, detail, children, align }: { text: string; detail?: string; children: ComponentChildren; align?: 'right' | 'up' }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [more, setMore] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!pinned) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setPinned(false);
        setOpen(false);
        setMore(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setOpen(false);
        e.stopPropagation();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [pinned]);
  const show = open || pinned;
  return (
    <span class="tip" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        class="tip-btn"
        aria-expanded={show}
        onClick={() => {
          setPinned(!pinned);
          setOpen(!pinned);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => !pinned && setOpen(false)}
      >
        {children}
      </button>
      {show && (
        <span class={`tip-pop${align === 'right' ? ' right' : ''}${align === 'up' ? ' up' : ''}`} role="tooltip">
          {text}
          {detail && !more && (
            <span style={{ display: 'block' }}>
              <button
                type="button"
                class="tbtn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setPinned(true);
                  setMore(true);
                }}
              >
                Technical detail
              </button>
            </span>
          )}
          {detail && more && <span class="detail" style={{ display: 'block' }}>{detail}</span>}
        </span>
      )}
    </span>
  );
}

/** "Illustrative" tag with an explanation of the simplification. */
export function Illus({ why }: { why: string }) {
  return (
    <Tip text={why}>
      <span class="illus">Illustrative</span>
    </Tip>
  );
}

// ── segmented control ──
export interface SegOption<T> {
  value: T;
  label: ComponentChildren;
  disabled?: boolean;
  title?: string;
}

export function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: SegOption<T>[]; onChange: (v: T) => void; label: string }) {
  return (
    <div class="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          aria-pressed={o.value === value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, children, disabled, title }: { on: boolean; onChange: (v: boolean) => void; children: ComponentChildren; disabled?: boolean; title?: string }) {
  return (
    <button type="button" class="toggle" aria-pressed={on} disabled={disabled} title={title} onClick={() => onChange(!on)}>
      {children}
    </button>
  );
}

// ── field: label (+tip), value readout, control, why-disabled ──
export function Field({
  label,
  tip,
  detail,
  value,
  why,
  note,
  children,
}: {
  label: string;
  tip?: string;
  detail?: string;
  value?: ComponentChildren;
  why?: string | null;
  note?: ComponentChildren;
  children: ComponentChildren;
}) {
  return (
    <div class="field">
      <div class="field-head">
        <span class="field-label">{tip ? <Tip text={tip} detail={detail}>{label}</Tip> : label}</span>
        {value !== undefined && <span class="field-val">{value}</span>}
      </div>
      {children}
      {why && (
        <div class="field-why" role="note">
          <span aria-hidden="true">!</span>
          <span>{why}</span>
        </div>
      )}
      {note && <div class="field-note">{note}</div>}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <input
      class="range"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
    />
  );
}

// ── status chip: color + icon + word ──
export type Tone = 'ok' | 'warn' | 'bad' | 'flow' | 'neutral';
const TONE_ICON: Record<Tone, string> = { ok: 'ok', warn: 'rebuild', bad: 'bad', flow: 'flow', neutral: 'info' };

export function Chip({ tone, children, icon, lg }: { tone: Tone; children: ComponentChildren; icon?: string; lg?: boolean }) {
  return (
    <span class={`chip ${tone}${lg ? ' lg' : ''}`}>
      <Icon name={icon ?? TONE_ICON[tone]} />
      {children}
    </span>
  );
}

export function Stat({ k, v, tip, tone }: { k: string; v: ComponentChildren; tip?: string; tone?: Tone }) {
  return (
    <div class="stat">
      <span class="k">{tip ? <Tip text={tip}>{k}</Tip> : k}</span>
      <span class={`v${tone && tone !== 'neutral' ? ` ${tone}-text` : ''}`}>{v}</span>
    </div>
  );
}

export function Follow({ tone, k, children }: { tone?: Tone | 'ink'; k: string; children: ComponentChildren }) {
  const cls = tone === 'ok' ? 'good' : tone === 'bad' ? 'bad' : tone ?? '';
  return (
    <div class={`follow ${cls}`} role="status">
      <div class="follow-k">{k}</div>
      {children}
    </div>
  );
}

export function HonestFit({ items, title = 'Where this has trade-offs' }: { items: string[]; title?: string }) {
  return (
    <details class="honest">
      <summary>
        <Icon name="chev" />
        Honest fit · {title}
      </summary>
      <ul>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </details>
  );
}

export function Legend({ items }: { items: { cls?: string; color?: string; label: string; dashed?: boolean }[] }) {
  return (
    <div class="legend">
      {items.map((i) => (
        <span key={i.label}>
          <i
            class="sw"
            style={{
              background: i.dashed ? 'transparent' : i.color,
              border: i.dashed ? `1.5px dashed ${i.color}` : undefined,
            }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// ── play bar ──
export function PlayBar({ clock, label, scrub = true, fmt = fmtClock, extra }: { clock: Clock; label?: string; scrub?: boolean; fmt?: (t: number) => string; extra?: ComponentChildren }) {
  return (
    <div class="playbar" aria-label={label ?? 'Simulation controls'}>
      <button type="button" class="btn primary" onClick={clock.toggle} aria-label={clock.playing ? 'Pause' : 'Play'} title="Play / pause (Space)">
        <Icon name={clock.playing ? 'pause' : 'play'} />
        {clock.playing ? 'Pause' : 'Play'}
      </button>
      <button type="button" class="btn" onClick={() => clock.step(-1)} aria-label="Step back" title="Step back (Left arrow)">
        <Icon name="stepback" />
      </button>
      <button type="button" class="btn" onClick={() => clock.step(1)} aria-label="Step forward" title="Step forward (Right arrow)">
        <Icon name="step" />
      </button>
      <button type="button" class="tbtn" onClick={clock.reset} title="Reset (R)">
        <Icon name="reset" />
        Reset
      </button>
      <span class="clock" aria-live="off">{fmt(clock.t)}</span>
      {scrub && clock.duration !== undefined && (
        <input
          class="range scrub"
          type="range"
          min={0}
          max={clock.duration}
          step={clock.duration / 400}
          value={clock.t}
          aria-label="Timeline"
          onInput={(e) => {
            clock.pause();
            clock.seek(Number((e.target as HTMLInputElement).value));
          }}
        />
      )}
      <div class="seg" role="group" aria-label="Speed">
        {SPEEDS.map((s) => (
          <button type="button" key={s} aria-pressed={clock.speed === s} onClick={() => clock.setSpeed(s)}>
            {s}x
          </button>
        ))}
      </div>
      {extra}
    </div>
  );
}

export function Eyebrow({ children }: { children: ComponentChildren }) {
  return <div class="eyebrow">{children}</div>;
}

export function fmtTB(tb: number, digits = 1): string {
  if (!Number.isFinite(tb)) return '—';
  if (tb >= 1000) return `${(tb / 1000).toFixed(2)} PB`;
  return `${tb.toFixed(digits)} TB`;
}

export function fmtDur(hours: number): string {
  if (!Number.isFinite(hours)) return 'cannot complete';
  if (hours < 1 / 60) return '< 1 min';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}
