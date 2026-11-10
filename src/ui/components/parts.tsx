// Shared diagram parts (Nutanix 2.0, N2-008 and N2-009): a VM, a CVM, a drive, a node frame, a
// switch and a lettered block of data, each drawn once so every module shows them the same way.
// Sizes follow the diagram type scale (.d-fine, .d-sub, .d-label, .d-title in app.css).
import type { ComponentChildren } from 'preact';

type State = 'ok' | 'off' | 'down' | 'warn' | 'moving' | 'new' | 'dim';

/** A VM: a rounded box with its name; `state` colors the outline. */
export function VmBox({ x, y, w = 56, h = 22, name, state, hl }: { x: number; y: number; w?: number; h?: number; name: string; state?: State; hl?: boolean }) {
  return (
    <g class={`pt-vm${state ? ` ${state}` : ''}${hl ? ' hl' : ''}`}>
      <rect x={x} y={y} width={w} height={h} rx={4} />
      <text x={x + w / 2} y={y + h / 2 + 4} text-anchor="middle" class="d-fine">
        {name}
      </text>
    </g>
  );
}

/** The Controller VM: the node's storage controller, in the part color. */
export function CvmBox({ x, y, w = 56, h = 22, label = 'CVM', state }: { x: number; y: number; w?: number; h?: number; label?: string; state?: State }) {
  return (
    <g class={`pt-cvm${state ? ` ${state}` : ''}`}>
      <rect x={x} y={y} width={w} height={h} rx={4} />
      <text x={x + w / 2} y={y + h / 2 + 4} text-anchor="middle" class="d-fine">
        {state === 'down' ? '✕ ' : ''}
        {label}
      </text>
    </g>
  );
}

/** A drive: a short wide box with a notch, its type, and a bar for how full it is (0 to 1). */
export function Drive({ x, y, w = 48, h = 14, kind, full = 0, state }: { x: number; y: number; w?: number; h?: number; kind?: string; full?: number; state?: State }) {
  return (
    <g class={`pt-drive${state ? ` ${state}` : ''}`}>
      <rect x={x} y={y} width={w} height={h} rx={3} />
      {full > 0 && <rect class="pt-drive-fill" x={x + 2} y={y + h - 4} width={(w - 4) * Math.min(1, full)} height={2} />}
      <line x1={x + w - 6} x2={x + w - 6} y1={y + 3} y2={y + h - 6} class="pt-drive-notch" />
      {kind && (
        <text x={x + 5} y={y + h - 5} class="pt-drive-t">
          {kind}
        </text>
      )}
    </g>
  );
}

/** A node: a rounded frame with its title and a status word on the right; parts go inside as children. */
export function NodeFrame({ x, y, w, h, title, status, tone, children }: { x: number; y: number; w: number; h: number; title: string; status?: string; tone?: 'ok' | 'warn' | 'bad' | 'flow'; children?: ComponentChildren }) {
  return (
    <g class={`pt-node${tone ? ` ${tone}` : ''}`}>
      <rect x={x} y={y} width={w} height={h} rx={6} />
      <text x={x + 10} y={y + 18} class="d-label pt-node-t">
        {title}
      </text>
      {status && (
        <text x={x + w - 10} y={y + 18} text-anchor="end" class={`d-fine pt-node-s${tone ? ` ${tone}-fill` : ''}`}>
          {status}
        </text>
      )}
      {children}
    </g>
  );
}

/** A switch: a wide bar with port ticks along its bottom edge. */
export function Switch({ x, y, w, h = 18, label, ports = 12 }: { x: number; y: number; w: number; h?: number; label: string; ports?: number }) {
  const gap = w / (ports + 1);
  return (
    <g class="pt-switch">
      <rect x={x} y={y} width={w} height={h} rx={3} />
      {Array.from({ length: ports }, (_, i) => (
        <rect key={i} class="pt-port" x={x + gap * (i + 1) - 2} y={y + h - 5} width={4} height={3} />
      ))}
      <text x={x + 8} y={y + h / 2 + 3} class="d-fine">
        {label}
      </text>
    </g>
  );
}

/** Letters for pieces of data: A, B, C... */
export const blockLetter = (i: number) => String.fromCharCode(65 + (i % 26));

/**
 * A piece of data: a small rounded block with a letter. Copies of one piece share the letter and
 * the tint (one of eight, from neutral grey to blue), so they can be matched across nodes.
 * `cls` sets the state (the capacity module's cp-copy, cp-new, cp-lost ...).
 */
export function DataBlock({ x, y, letter, tint = 0, size = 16, cls = '', style }: { x: number; y: number; letter: string; tint?: number; size?: number; cls?: string; style?: Record<string, string | number> }) {
  const w = size * 1.375;
  const h = size;
  return (
    <g class={`db ${cls}`} style={{ '--b': `var(--blk-${tint % 8})`, ...style }}>
      <rect class="db-r" x={x - w / 2} y={y - h / 2} width={w} height={h} rx={3} />
      <text class="db-t d-fine" x={x} y={y + 4} text-anchor="middle">
        {letter}
      </text>
    </g>
  );
}
