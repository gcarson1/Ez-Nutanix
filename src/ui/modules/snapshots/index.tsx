// Snapshots & Clones: one loop. A disk is a map of blocks; a snapshot copies the map; new
// writes go to new blocks; clones share blocks until they change them. The states come from
// the walkthrough in src/engine/snapshots.ts; this file only animates between them.
import { exclusiveBlocks, fullCopyBlocks, refCounts, usedBlocks, walkthrough, type SnapState } from '../../../engine/snapshots';
import { useClock } from '../../components/clock';
import { Follow, Illus, PlayBar, type Tone } from '../../components/controls';
import { Kpis, Show, ease, phaseAt, prog } from '../../components/show';
import './style.css';

const BLOCKS = 8;
const STEPS = walkthrough({ blocks: BLOCKS, clones: 2, changePct: 25 });
/** When each walkthrough step starts (sim seconds). */
const T = [0, 2.8, 5.4, 8.6, 11.2];
const END = 15.6;
const SLIDE = 0.8;
const FLY = 0.8;
const TONE: Tone[] = ['neutral', 'ok', 'flow', 'ok', 'flow'];
const WORD = ['A disk', 'Snapshot', 'New writes', 'Clones', 'Clones change'];

// ── geometry ──
const W = 960;
const LBL = 120;
const CW = 46;
const PITCH = 54;
const POOL_Y = 28;
const ROW0 = 134;
const ROW_H = 40;
const ROW_PITCH = 58;
const H = ROW0 + 3 * ROW_PITCH + ROW_H + 12;
const cellX = (i: number) => LBL + i * PITCH;
const rowY = (r: number) => ROW0 + r * ROW_PITCH;

interface Change {
  disk: string;
  idx: number;
  to: number;
  /** When its write lands in the stored blocks. */
  at: number;
  start: number;
}

/** The block-map changes between two steps, timed one after another. */
function changes(k: number): Change[] {
  if (k !== 2 && k !== 4) return [];
  const prev = STEPS[k - 1].state;
  const next = STEPS[k].state;
  const out: Change[] = [];
  for (const d of next.disks) {
    const p = prev.disks.find((x) => x.id === d.id);
    if (p) d.map.forEach((b, i) => b !== p.map[i] && out.push({ disk: d.id, idx: i, to: b, at: 0, start: 0 }));
  }
  const gap = k === 2 ? 0.6 : 0.45;
  return out.map((c, j) => ({ ...c, start: T[k] + 0.4 + j * gap, at: T[k] + 0.4 + j * gap + FLY }));
}
const CHANGES = [0, 1, 2, 3, 4].map(changes);

/** What the disks look like at time t: the step's state, with only the writes that have landed. */
function stateAt(k: number, t: number): SnapState {
  const ch = CHANGES[k];
  if (!ch.length) return STEPS[k].state;
  const prev = STEPS[k - 1].state;
  const landed = ch.filter((c) => t >= c.at);
  return { ...prev, disks: prev.disks.map((d) => ({ ...d, map: d.map.map((b, i) => landed.find((c) => c.disk === d.id && c.idx === i)?.to ?? b) })) };
}

const blocks = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function Maps({ k, t }: { k: number; t: number }) {
  const s = stateAt(k, t);
  const rc = refCounts(s);
  const used = [...usedBlocks(s)].sort((a, b) => a - b);
  const fresh = CHANGES[k].filter((c) => t >= c.at && t < c.at + 1.4);
  const flying = CHANGES[k].filter((c) => t >= c.start && t < c.at);
  const rowOf = (id: string) => s.disks.findIndex((d) => d.id === id);
  const linesIn = prog(t, 0.3, 1.3);

  /** Where a row is drawn while it slides out of the row it was copied from. */
  const place = (r: number) => {
    const from = r === 1 ? 0 : r >= 2 ? 1 : r;
    const t0 = r === 1 ? T[1] : r >= 2 ? T[3] + (r - 2) * 0.25 : -1;
    const f = t0 < 0 ? 1 : ease(prog(t, t0, t0 + SLIDE));
    return { y: rowY(from) + (rowY(r) - rowY(from)) * f, o: 0.25 + 0.75 * f };
  };

  return (
    <svg class="diagram sn-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Block maps: ${s.disks.map((d) => d.label).join(', ')} pointing at ${used.length} stored blocks. Full copies would need ${fullCopyBlocks(s)}.`}>
      <text x={8} y={POOL_Y + 19} style={{ fontSize: '13.5px', fontWeight: 600 }}>
        Stored data
      </text>
      <text x={8} y={POOL_Y + 34} class="muted" style={{ fontSize: '11px' }}>
        {used.length} blocks
      </text>
      {/* the live disk's pointers */}
      {linesIn > 0 &&
        s.disks[0].map.map((b, i) => {
          const x1 = cellX(i) + CW / 2;
          const x2 = cellX(b) + CW / 2;
          const y1 = rowY(0);
          const y2 = POOL_Y + CW;
          const my = (y1 + y2) / 2;
          return <path key={i} d={`M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`} class="sn-ptr" style={{ opacity: 0.6 * linesIn }} />;
        })}
      {used.map((b) => {
        const n = rc.get(b) ?? 0;
        const x = cellX(b);
        const isFresh = fresh.some((c) => c.to === b);
        return (
          <g key={b}>
            <rect x={x} y={POOL_Y} width={CW} height={CW} class={`sn-block${isFresh ? ' fresh' : ''}`} />
            <text x={x + CW / 2} y={POOL_Y + 21} text-anchor="middle" class="mono" style={{ fontSize: '13px', fontWeight: 600 }}>
              {b + 1}
            </text>
            {Array.from({ length: n }, (_, j) => (
              <circle key={j} cx={x + CW / 2 + (j - (n - 1) / 2) * 8} cy={POOL_Y + 35} r={2.6} class="sn-ref" />
            ))}
          </g>
        );
      })}
      {s.disks.map((d, r) => {
        const p = place(r);
        const sub = d.kind === 'snapshot' ? 'read-only' : d.kind === 'clone' ? 'writable clone' : 'live, writable';
        const own = exclusiveBlocks(s, d.id);
        const note =
          d.kind === 'snapshot'
            ? own
              ? `holds on to ${blocks(own, 'old block')} the VM replaced`
              : 'a copy of the map, no data copied'
            : own === d.map.length
              ? 'points at stored blocks'
              : own
                ? `${blocks(own, 'block')} of its own, the rest shared`
                : 'shares every block';
        return (
          <g key={d.id} style={{ opacity: p.o }}>
            <text x={8} y={p.y + 17} style={{ fontSize: '13.5px', fontWeight: 600 }}>
              {d.label}
            </text>
            <text x={8} y={p.y + 32} class="muted" style={{ fontSize: '11px' }}>
              {sub}
            </text>
            {d.map.map((b, i) => {
              const shared = (rc.get(b) ?? 0) > 1;
              const isNew = fresh.some((c) => c.disk === d.id && c.idx === i);
              return (
                <g key={i}>
                  <rect x={cellX(i)} y={p.y} width={CW} height={ROW_H} class={`sn-cell ${shared ? 'shared' : 'own'}${isNew ? ' new' : ''}`} />
                  <text x={cellX(i) + CW / 2} y={p.y + 25} text-anchor="middle" class={`mono sn-cell-t${shared ? '' : ' own'}`} style={{ fontSize: '13px', fontWeight: 600 }}>
                    {b + 1}
                  </text>
                </g>
              );
            })}
            <text x={cellX(BLOCKS) + 8} y={p.y + 25} class="muted" style={{ fontSize: '12px' }}>
              {note}
            </text>
          </g>
        );
      })}
      {/* writes on their way to new stored blocks */}
      {flying.map((c) => {
        const r = rowOf(c.disk);
        const k2 = ease(prog(t, c.start, c.at));
        const x1 = cellX(c.idx) + CW / 2;
        const y1 = rowY(r);
        const x2 = cellX(c.to) + CW / 2;
        const y2 = POOL_Y + CW;
        return (
          <g key={`${c.disk}-${c.idx}`}>
            <rect x={x2} y={POOL_Y} width={CW} height={CW} class="sn-slot" />
            <circle cx={x1 + (x2 - x1) * k2} cy={y1 + (y2 - y1) * k2} r={6} class="sn-dot" />
          </g>
        );
      })}
    </svg>
  );
}

export default function Snapshots() {
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: END - 0.5 });
  const t = clock.t;
  const k = phaseAt(T, t);
  const st = STEPS[k];
  const s = stateAt(k, t);
  const used = usedBlocks(s).size;
  const full = fullCopyBlocks(s);

  return (
    <Show
      foot={
        <>
          <Follow tone={TONE[k] === 'neutral' ? 'ink' : TONE[k]} k={st.title}>
            <p>{st.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Disks', v: s.disks.length, sub: 'the VM disk, a snapshot, clones' },
              { k: 'Blocks stored', v: used, tone: used < full ? 'ok' : undefined, tip: 'Only new writes, by the VM or by a clone, add stored blocks.' },
              { k: 'As full copies', v: full, sub: 'blocks if every disk were copied' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <Maps k={k} t={t} />
      </div>
      <div class="legend">
        <span>
          <i class="sw" style={{ background: 'var(--s3)' }} />
          Block shared with another disk
        </span>
        <span>
          <i class="sw" style={{ background: 'var(--ink)' }} />
          Block only this disk uses
        </span>
        <span>
          <i class="sw" style={{ border: '2px solid var(--ok)' }} />
          Just written
        </span>
        <span>Dots in a stored block: how many disks point at it</span>
      </div>
      <PlayBar
        clock={clock}
        label="Snapshot and clone animation"
        fmt={() => WORD[k]}
        extra={<Illus why="Blocks here are large and few so they can be drawn. AOS tracks changes at a much finer granularity, manages snapshot chains in the background, and stores every block with the container’s replication factor, which multiplies both sides of the comparison equally." />}
      />
    </Show>
  );
}
