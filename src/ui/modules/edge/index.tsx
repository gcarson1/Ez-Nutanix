// Edge & ROBO: pick a site size (1 node, 2 nodes with a Witness, 3 nodes) and something that
// happens, and watch the site respond on a loop. The table underneath compares what each size
// survives. Scenario moments live in data.ts.
import { useMemo } from 'preact/hooks';
import './style.css';
import { useEnum } from '../../../state/route';
import { useClock, useRestartOn } from '../../components/clock';
import { Chip, Follow, Illus, Legend, PlayBar, type Tone as ChipTone } from '../../components/controls';
import { Choice, Kpis, Show, ease, phaseAt, prog } from '../../components/show';
import { EVENTS, MATRIX, SIZES, applies, stepsFor, type EventId, type Size, type Step } from './data';

const SIZE_IDS = SIZES.map((s) => s.id);
const EVENT_IDS = EVENTS.map((e) => e.id);
const TONE_WORD = { ok: 'Keeps running', warn: 'Degraded', bad: 'Down', na: 'n/a' } as const;

/** Seconds each moment stays on screen, long enough to read its caption. */
function hold(s: Step): number {
  const words = s.text.split(/\s+/).length;
  return Math.min(6.5, Math.max(2.6, 1.4 + words * 0.2));
}

function useTimeline(size: Size, ev: EventId) {
  return useMemo(() => {
    const steps = stepsFor(size, ev);
    const starts: number[] = [];
    let t = 0;
    for (const s of steps) {
      starts.push(t);
      t += hold(s);
    }
    return { steps, starts, end: t };
  }, [size, ev]);
}

export default function Edge() {
  const [size, setSize] = useEnum<Size>('sz', '2', SIZE_IDS);
  const [evRaw, setEv] = useEnum<EventId>('ev', 'node', EVENT_IDS);
  const ev: EventId = applies(size, evRaw) ? evRaw : 'node';
  const tl = useTimeline(size, ev);
  const tell = Math.min(tl.steps.length - 1, 2);
  const clock = useClock({ rate: 1, duration: tl.end, keys: true, poster: tl.starts[tell] + 0.8 });
  useRestartOn(clock, [size, ev]);
  const t = clock.t;
  const idx = phaseAt(tl.starts, t);
  const step = tl.steps[idx];
  const prev = tl.steps[Math.max(0, idx - 1)];
  const nodes = SIZES.find((s) => s.id === size)!.nodes;
  const vms = placeVms(nodes, step);
  const running = vms.filter((v) => !v.off).length;
  const down = step.down?.length ?? 0;
  const cell = MATRIX.find((r) => r.ev === ev)!.cells[size];
  const tone = (n: number, of: number): ChipTone => (n === of ? 'ok' : n === 0 ? 'bad' : 'warn');

  return (
    <>
      <Show
        top={
          <>
            <Choice<Size>
              label="Site size"
              value={size}
              onChange={(s) => {
                setSize(s);
                if (!applies(s, evRaw)) setEv('node');
              }}
              options={SIZES.map((s) => ({ value: s.id, label: s.label }))}
            />
            <Choice<EventId>
              label="What happens"
              value={ev}
              onChange={setEv}
              options={EVENTS.map((e) => ({ value: e.id, label: e.label, disabled: !applies(size, e.id), title: applies(size, e.id) ? e.tip : 'Applies to two-node clusters, where a Witness breaks the tie' }))}
            />
          </>
        }
        foot={
          <>
            <Follow tone={step.tone} k={step.k}>
              <p>
                {step.text} {step.illus && <Illus why={step.illus} />}
              </p>
            </Follow>
            <Kpis
              items={[
                { k: 'VMs running', v: `${running} of ${vms.length}`, tone: tone(running, vms.length) },
                { k: 'Nodes up', v: `${nodes - down} of ${nodes}`, tone: tone(nodes - down, nodes) },
                { k: 'Outcome at this size', v: TONE_WORD[cell.tone], tone: cell.tone === 'na' ? undefined : cell.tone, tip: cell.text },
              ]}
            />
          </>
        }
      >
        <div class="diagram-scroll">
          <SiteDiagram size={size} nodes={nodes} step={step} prev={prev} t={t} t0={tl.starts[idx]} />
        </div>
        <Legend
          items={[
            { color: 'var(--ink)', label: 'VM running' },
            { color: 'var(--bad)', label: 'VM stopped' },
            { color: 'var(--warn)', label: 'VM restarted by HA', dashed: true },
            { color: 'var(--flow)', label: 'Copies being re-created' },
          ]}
        />
        <PlayBar clock={clock} label="Site animation" fmt={() => step.k} />
      </Show>

      <h2 class="sec-h">What each size survives</h2>
      <div class="diagram-scroll">
        <table class="tbl edge-matrix">
          <thead>
            <tr>
              <th>Event</th>
              {SIZES.map((s) => (
                <th key={s.id} class={s.id === size ? 'on' : ''}>
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((r) => (
              <tr key={r.row} class={r.ev === ev ? 'on' : ''}>
                <td>{r.row}</td>
                {SIZES.map((s) => {
                  const c = r.cells[s.id];
                  return (
                    <td key={s.id} class={s.id === size ? 'on' : ''}>
                      {c.tone === 'na' ? (
                        <span class="muted">{c.text}</span>
                      ) : (
                        <>
                          <Chip tone={c.tone}>{TONE_WORD[c.tone]}</Chip>
                          <div class="small edge-cell">{c.text}</div>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── geometry ──
const W = 960;
const DC = { x: 8, y: 34, w: 250, h: 290 };
const SITE = { x: 330, y: 34, w: 622, h: 290 };
const NW = 176;
const NG = 26;
const NY = SITE.y + 58;
const NH = 196;
const H = SITE.y + SITE.h + 10;
const WAN_Y = DC.y + 50;
const WIT_Y = DC.y + 176;
const VM = 22;
const VM_GAP = 6;
const DRIVE_Y = NY + NH - 38;

const rowX = (nodes: number) => SITE.x + (SITE.w - (nodes * NW + (nodes - 1) * NG)) / 2;
const nodeX = (nodes: number, i: number) => rowX(nodes) + i * (NW + NG);
const vmsPerNode = (nodes: number) => (nodes === 1 ? 6 : nodes === 2 ? 4 : 3);

interface PlacedVm {
  id: string;
  host: number;
  slot: number;
  moved: boolean;
  off: boolean;
}

/** Where every VM runs at a moment: VMs of a down node go to `vmsTo` in turn. */
function placeVms(nodes: number, s: Step): PlacedVm[] {
  const down = new Set(s.down ?? []);
  const all: { id: string; owner: number; host: number }[] = [];
  for (let o = 0; o < nodes; o++)
    for (let k = 0; k < vmsPerNode(nodes); k++) {
      const moves = s.vmsTo && !s.vmsTo.includes(o);
      all.push({ id: `${o}:${k}`, owner: o, host: moves ? s.vmsTo![k % s.vmsTo!.length] : o });
    }
  // VMs that stay keep their slots; arrivals fill in after them.
  const count = new Map<number, number>();
  const out: PlacedVm[] = [];
  for (const v of [...all.filter((v) => v.host === v.owner), ...all.filter((v) => v.host !== v.owner)]) {
    const slot = count.get(v.host) ?? 0;
    count.set(v.host, slot + 1);
    out.push({ id: v.id, host: v.host, slot, moved: v.host !== v.owner, off: !!s.vmsOff || (down.has(v.host) && !s.planned) });
  }
  return out;
}

function vmXY(nodes: number, v: PlacedVm) {
  return { x: nodeX(nodes, v.host) + 12 + (v.slot % 5) * (VM + VM_GAP), y: NY + 72 + Math.floor(v.slot / 5) * (VM + VM_GAP) };
}

/** Center of a node's drive `d` (0..3). */
function driveXY(nodes: number, n: number, d: number) {
  const dw = (NW - 20) / 4;
  return { x: nodeX(nodes, n) + 10 + d * dw + (dw - 6) / 2, y: DRIVE_Y + 13 };
}

function quad(a: { x: number; y: number }, c: { x: number; y: number }, b: { x: number; y: number }, f: number) {
  const u = 1 - f;
  return { x: u * u * a.x + 2 * u * f * c.x + f * f * b.x, y: u * u * a.y + 2 * u * f * c.y + f * f * b.y };
}

function SiteDiagram({ size, nodes, step, prev, t, t0 }: { size: Size; nodes: number; step: Step; prev: Step; t: number; t0: number }) {
  const down = new Set(step.down ?? []);
  const two = size === '2';
  const wanCut = !!step.wan;
  const vms = placeVms(nodes, step);
  const before = new Map(placeVms(nodes, prev).map((v) => [v.id, v]));
  const slide = !!(step.planned || prev.planned);
  const k = ease(prog(t, t0, t0 + 1.2));
  const fadeIn = prog(t, t0, t0 + 0.8);
  const wit = (i: number) => {
    const a = { x: DC.x + DC.w - 16, y: WIT_Y + 27 };
    const b = { x: nodeX(nodes, i) + NW / 2, y: NY + NH };
    const c = { x: (a.x + b.x) / 2, y: NY + NH + 60 };
    return { a, b, c };
  };

  return (
    <svg class="diagram edge-dia" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${SIZES.find((s) => s.id === size)!.label} cluster at a branch site, managed from the data center. ${step.k}: ${step.text}`}>
      {/* data center */}
      <rect x={DC.x} y={DC.y} width={DC.w} height={DC.h} class="frame" />
      <text x={DC.x + 12} y={DC.y - 12} class="edge-cap muted">
        DATA CENTER
      </text>
      <rect x={DC.x + 16} y={DC.y + 18} width={DC.w - 32} height={64} class="ink-fill" />
      <text x={DC.x + DC.w / 2} y={DC.y + 45} text-anchor="middle" class="edge-t" style={{ fill: '#fff' }}>
        Prism Central
      </text>
      <text x={DC.x + DC.w / 2} y={DC.y + 66} text-anchor="middle" class="edge-s" style={{ fill: 'rgba(255,255,255,.85)' }}>
        manages every site
      </text>
      {['Site 2', 'Site 3', 'Site 4'].map((s, i) => (
        <g key={s}>
          <rect x={DC.x + 16 + i * 74} y={DC.y + 100} width={66} height={34} class="bg3" stroke="var(--line-2)" />
          <text x={DC.x + 49 + i * 74} y={DC.y + 122} text-anchor="middle" class="edge-xs muted">
            {s}
          </text>
        </g>
      ))}
      {two && (
        <g>
          <rect x={DC.x + 16} y={WIT_Y} width={DC.w - 32} height={54} class={step.ask ? 'ink-soft' : 'bg2'} stroke="var(--ink)" stroke-width={step.ask ? 2.5 : 1.5} />
          <text x={DC.x + DC.w / 2} y={WIT_Y + 23} text-anchor="middle" class="edge-t">
            Witness VM
          </text>
          <text x={DC.x + DC.w / 2} y={WIT_Y + 42} text-anchor="middle" class="edge-xs muted">
            {wanCut ? 'out of reach' : step.ask ? 'deciding who carries on' : 'separate failure domain'}
          </text>
        </g>
      )}

      {/* the WAN, with status flowing to Prism Central while it is up */}
      <line x1={DC.x + DC.w} y1={WAN_Y} x2={SITE.x} y2={WAN_Y} class={wanCut ? 'bad-stroke' : 'edge-link'} stroke-width={2.5} stroke-dasharray={wanCut ? '6 5' : undefined} />
      <text x={(DC.x + DC.w + SITE.x) / 2} y={WAN_Y - 10} text-anchor="middle" class={`edge-xs ${wanCut ? 'bad-fill' : 'muted'}`}>
        {wanCut ? '✕ WAN down' : 'WAN'}
      </text>
      {!wanCut && <circle cx={SITE.x - ((t * 0.7) % 1) * (SITE.x - DC.x - DC.w)} cy={WAN_Y} r={4.5} class="edge-beat" />}
      {two &&
        [0, 1].map((i) => {
          const { a, b, c } = wit(i);
          return (
            <g key={i}>
              <path d={`M${a.x} ${a.y} Q ${c.x} ${c.y}, ${b.x} ${b.y}`} fill="none" class={wanCut ? 'bad-stroke' : step.ask ? 'flow-stroke' : 'edge-wit'} stroke-dasharray="4 4" stroke-width={1.5} />
              {step.ask &&
                [0, 0.5].map((o) => {
                  const p = quad(b, c, a, (t * 0.6 + o) % 1);
                  return <circle key={o} cx={p.x} cy={p.y} r={4} class="flow-fill" />;
                })}
            </g>
          );
        })}

      {/* site */}
      <rect x={SITE.x} y={SITE.y} width={SITE.w} height={SITE.h} class="frame" />
      <text x={SITE.x + 12} y={SITE.y - 12} class="edge-cap muted">
        BRANCH SITE
      </text>
      <text x={SITE.x + 14} y={SITE.y + 28} class="edge-s muted">
        Prism Element runs on the cluster
      </text>
      {step.mode && (
        <text x={SITE.x + SITE.w - 14} y={SITE.y + 28} text-anchor="end" class={`edge-s edge-mode ${step.mode === 'Two-node mode' ? 'ok-fill' : 'warn-fill'}`}>
          {step.mode}
        </text>
      )}
      {two && (
        <g>
          <line x1={nodeX(nodes, 0) + NW} y1={NY + 47} x2={nodeX(nodes, 1)} y2={NY + 47} class={step.peer ? 'bad-stroke' : 'edge-link'} stroke-width={2.5} stroke-dasharray={step.peer ? '6 5' : undefined} />
          {step.peer && (
            <text x={nodeX(nodes, 0) + NW + NG / 2} y={NY + 36} text-anchor="middle" class="edge-s bad-fill">
              ✕
            </text>
          )}
        </g>
      )}
      {nodes === 3 && [0, 1].map((i) => <line key={i} x1={nodeX(nodes, i) + NW} y1={NY + 47} x2={nodeX(nodes, i + 1)} y2={NY + 47} class="edge-link" stroke-width={1.5} />)}
      {Array.from({ length: nodes }, (_, i) => {
        const isDown = down.has(i);
        const planned = isDown && step.planned;
        const x = nodeX(nodes, i);
        return (
          <g key={i}>
            <rect x={x} y={NY} width={NW} height={NH} class={`node-box ${isDown ? (planned ? 'warn' : 'down') : ''}`} />
            <text x={x + 12} y={NY + 24} class="edge-t">
              N{i + 1}
            </text>
            <text x={x + NW - 12} y={NY + 24} text-anchor="end" class={`edge-xs ${isDown ? (planned ? 'warn-fill' : 'bad-fill') : 'ok-fill'}`}>
              {isDown ? (planned ? '⚠ upgrading' : '✕ down') : '✓ up'}
            </text>
            <rect x={x + 10} y={NY + 36} width={NW - 20} height={22} class={`cvm ${isDown ? (planned ? 'warn' : 'down') : ''}`} />
            <text x={x + 18} y={NY + 51} class="edge-xs" style={{ fill: planned ? '#16161b' : '#fff' }}>
              CVM
            </text>
            <text x={x + 12} y={DRIVE_Y - 8} class="edge-xs muted">
              drives
            </text>
            {Array.from({ length: 4 }, (_, d) => {
              const dw = (NW - 20) / 4;
              const bad = step.disk && step.disk[0] === i && step.disk[1] === d;
              return <rect key={d} x={x + 10 + d * dw} y={DRIVE_Y} width={dw - 6} height={26} class={`disk${bad ? ' failed' : ''}`} />;
            })}
          </g>
        );
      })}
      {vms.map((v) => {
        const to = vmXY(nodes, v);
        const was = before.get(v.id)!;
        const cls = `vm ${v.off ? 'failed' : v.moved && !step.planned && !prev.planned ? 'restart' : 'hl'}`;
        if (was.host === v.host || !slide) {
          const appear = was.host !== v.host ? fadeIn : 1;
          return <rect key={v.id} x={to.x} y={to.y} width={VM} height={VM} class={cls} style={{ opacity: appear }} />;
        }
        const from = vmXY(nodes, was);
        return <rect key={v.id} x={from.x + (to.x - from.x) * k} y={from.y + (to.y - from.y) * k} width={VM} height={VM} class={cls} />;
      })}
      {(step.heal ?? []).map(([a, b], j) => {
        const same = a === b;
        // an arc underneath the drives, within one node or across to another
        const p0 = driveXY(nodes, a, same || a > b ? 0 : 3);
        const p1 = driveXY(nodes, b, same || a > b ? 3 : 0);
        const c = { x: (p0.x + p1.x) / 2, y: same ? DRIVE_Y + 52 : NY + NH + 40 + j * 12 };
        return (
          <g key={j}>
            <path d={`M${p0.x} ${p0.y} Q ${c.x} ${c.y}, ${p1.x} ${p1.y}`} fill="none" class="edge-heal" />
            {[0, 1 / 3, 2 / 3].map((o) => {
              const p = quad(p0, c, p1, (t * 0.7 + o) % 1);
              return <circle key={o} cx={p.x} cy={p.y} r={4.5} class="flow-fill" />;
            })}
          </g>
        );
      })}
    </svg>
  );
}
