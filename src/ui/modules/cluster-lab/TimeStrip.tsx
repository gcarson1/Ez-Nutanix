// Timeline scrubber: health band, under-replicated / unavailable data over time, markers for
// actions and key events (detection, HA restart, rebuild start, back to OK). Click or drag
// to seek; arrow keys step a minute (Shift: ten minutes); Home/End jump.
import type { JSX } from 'preact';
import { useMemo, useRef } from 'preact/hooks';
import type { Sample, Act } from '../../../engine/timeline';
import { describeAct } from '../../../engine/timeline';
import type { SimEvent } from '../../../engine/cluster';
import { fmtT } from './sim';

const W = 1000;
const H = 74;
const X0 = 8;
const X1 = W - 8;

export function TimeStrip({
  samples,
  duration,
  computed,
  t,
  acts,
  events,
  onSeek,
  label = 'Timeline',
}: {
  samples: Sample[];
  duration: number;
  computed: number;
  t: number;
  acts: Act[];
  events: SimEvent[];
  onSeek: (t: number) => void;
  label?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const x = (tt: number) => X0 + (Math.min(duration, Math.max(0, tt)) / duration) * (X1 - X0);
  const seekFromEvent = (e: PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    onSeek(Math.round(((px - X0) / (X1 - X0)) * duration));
  };
  const art = useMemo(() => {
    const total = samples[0] ? Math.max(1, samples.reduce((m, s) => Math.max(m, s.under + s.unavailable), 0)) : 1;

    // health band + data-at-risk areas
    const runs: { cls: string; start: number; end: number }[] = [];
    let run: { cls: string; start: number; end: number } | null = null;
    let under = `M${x(0)} 60`;
    let lost = `M${x(0)} 60`;
    for (let i = 0; i < samples.length; i++) {
      const a = samples[i];
      if (a.t > duration) break;
      const b = samples[i + 1];
      const end = b ? Math.min(b.t, duration) : Math.min(computed, duration);
      const cls = a.resiliency === 'Data unavailable' || a.resiliency === 'Cluster down' ? 'h-bad' : a.health === 'OK' ? 'h-ok' : a.health === 'Warning' ? 'h-warn' : 'h-bad';
      if (run && run.cls === cls) run.end = end;
      else {
        if (run) runs.push(run);
        run = { cls, start: a.t, end };
      }
      const hu = ((a.under + a.unavailable) / total) * 30;
      const hl = (a.unavailable / total) * 30;
      under += ` L${x(a.t).toFixed(1)} ${(60 - hu).toFixed(1)} L${x(end).toFixed(1)} ${(60 - hu).toFixed(1)}`;
      lost += ` L${x(a.t).toFixed(1)} ${(60 - hl).toFixed(1)} L${x(end).toFixed(1)} ${(60 - hl).toFixed(1)}`;
    }
    if (run) runs.push(run);
    const segs: JSX.Element[] = runs.map((r, i) => <rect key={i} class={r.cls} x={x(r.start)} y={10} width={Math.max(0.6, x(r.end) - x(r.start))} height={9} />);
    const lastX = x(Math.min(computed, duration));
    under += ` L${lastX} 60 Z`;
    lost += ` L${lastX} 60 Z`;

    const marks: { t: number; cls: string; text: string }[] = [];
    for (const a of acts) marks.push({ t: a.t, cls: a.k === 'fail' ? 'fail' : 'act', text: describeAct(a) });
    let lastKind = '';
    for (const e of events) {
      const cls = e.kind === 'ok' ? 'ok' : e.kind === 'ha' ? 'ha' : e.kind === 'rebuild' ? 'rebuild' : e.kind === 'loss' ? 'fail' : e.kind === 'detect' ? 'act' : '';
      if (!cls) continue;
      if (e.kind === 'ha' && lastKind === 'ha') continue; // one marker per restart wave
      lastKind = e.kind;
      if (e.kind === 'detect' || e.kind === 'ha' || e.kind === 'rebuild' || e.kind === 'ok' || e.kind === 'loss') marks.push({ t: e.t, cls, text: e.text });
    }

    const ticks: number[] = [];
    const stepT = duration <= 2 * 3600 ? 900 : duration <= 6 * 3600 ? 1800 : 3600;
    for (let k = 0; k <= duration; k += stepT) ticks.push(k);
    return (
      <g>
        <rect class="h-none" x={X0} y={10} width={X1 - X0} height={9} />
        {segs}
        {computed < duration && <rect class="pending" x={lastX} y={10} width={X1 - lastX} height={50} />}
        <path class="area-under" d={under} />
        <path class="area-lost" d={lost} />
        <line class="base" x1={X0} x2={X1} y1={60.5} y2={60.5} />
        {marks.map((m, i) => (
          <g key={i}>
            <path class={`mk ${m.cls}`} d={`M${x(m.t)} 22 l4 6 h-8 z`} />
            <title>{`${fmtT(m.t)} · ${m.text}`}</title>
          </g>
        ))}
        {ticks.map((k) => (
          <text key={k} x={x(k)} y={72} text-anchor={k === 0 ? 'start' : k >= duration ? 'end' : 'middle'}>
            {k === 0 ? '0' : k % 3600 === 0 ? `${k / 3600}h` : `${Math.floor(k / 3600) ? `${Math.floor(k / 3600)}h` : ''}${(k % 3600) / 60}m`}
          </text>
        ))}
      </g>
    );
  }, [samples.length, samples[samples.length - 1], duration, computed, acts, events.length]);

  return (
    <svg
      ref={ref}
      class="cl-strip"
      viewBox={`0 0 ${W} ${H}`}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={Math.round(t)}
      aria-valuetext={fmtT(t)}
      onPointerDown={(e) => {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        seekFromEvent(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons & 1) seekFromEvent(e);
      }}
      onKeyDown={(e) => {
        const big = e.shiftKey ? 600 : 60;
        let v: number | null = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v = t + big;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v = t - big;
        else if (e.key === 'Home') v = 0;
        else if (e.key === 'End') v = duration;
        if (v !== null) {
          e.preventDefault();
          e.stopPropagation();
          onSeek(Math.max(0, Math.min(duration, v)));
        }
      }}
    >
      <defs>
        <pattern id="cl-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line class="hatch" x1="0" y1="0" x2="0" y2="6" />
        </pattern>
      </defs>
      {art}
      <line class="head" x1={x(t)} x2={x(t)} y1={4} y2={62} />
      <text x={X0} y={8} style={{ fontSize: '9.5px' }}>
        HEALTH
      </text>
      <text x={X1} y={8} text-anchor="end" style={{ fontSize: '9.5px' }}>
        {computed < duration ? 'computing ahead…' : 'data at risk below'}
      </text>
    </svg>
  );
}
