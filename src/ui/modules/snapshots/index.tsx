// Snapshots & Clones: a step-through of metadata-only, redirect-on-write snapshots and
// instant clones, drawn as block maps pointing at shared physical blocks, with capacity
// before and after. Behavior comes from src/engine/snapshots.ts.
import { useMemo, useState } from 'preact/hooks';
import { useNum } from '../../../state/route';
import { useClock } from '../../components/clock';
import { Field, Follow, Illus, PlayBar, Slider, Stat, Tip } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { go } from '../../shell/nav';
import { exclusiveBlocks, fullCopyBlocks, refCounts, usedBlocks, walkthrough, type Disk, type SnapState } from '../../../engine/snapshots';
import './style.css';

const BLOCKS = 8;

function fmtGB(gb: number) {
  return gb >= 1000 ? `${(gb / 1000).toFixed(2)} TB` : `${Math.round(gb)} GB`;
}

function MapDiagram({ s, sel, onSel }: { s: SnapState; sel: string; onSel: (id: string) => void }) {
  const LBL = 128;
  const CW = 40;
  const CG = 6;
  const RH = 44;
  const top = 26;
  const used = [...usedBlocks(s)].sort((a, b) => a - b);
  const rc = refCounts(s);
  const perRow = 12;
  const poolTop = top + s.disks.length * RH + 46;
  const poolRows = Math.ceil(Math.max(1, used.length) / perRow);
  const W = Math.max(LBL + BLOCKS * (CW + CG), perRow * (CW + CG)) + 8;
  const H = poolTop + poolRows * (CW + 22) + 6;
  const pos = new Map(used.map((b, i) => [b, { x: (i % perRow) * (CW + CG) + 4, y: poolTop + Math.floor(i / perRow) * (CW + 22) }]));
  const selDisk = s.disks.find((d) => d.id === sel) ?? s.disks[s.disks.length - 1];
  const rowY = (i: number) => top + i * RH;
  const selIdx = s.disks.indexOf(selDisk);
  return (
    <svg class="diagram sn-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Block maps of the VM disk, its snapshot and clones, pointing at shared physical blocks">
      <text x={LBL} y={14} class="muted" style={{ fontSize: '11px', letterSpacing: '0.06em' }}>
        BLOCK MAP (METADATA) · LOGICAL BLOCKS 1–{BLOCKS}
      </text>
      {/* pointer lines for the selected disk */}
      {selDisk.map.map((b, i) => {
        const p = pos.get(b)!;
        const x1 = LBL + i * (CW + CG) + CW / 2;
        const y1 = rowY(selIdx) + 34;
        return <path key={i} d={`M ${x1} ${y1} C ${x1} ${y1 + 60}, ${p.x + CW / 2} ${p.y - 60}, ${p.x + CW / 2} ${p.y}`} class="sn-ptr" />;
      })}
      {s.disks.map((d, i) => (
        <DiskRow key={d.id} d={d} y={rowY(i)} lbl={LBL} cw={CW} cg={CG} rc={rc} fresh={s.fresh} on={d.id === selDisk.id} onSel={onSel} />
      ))}
      <text x={4} y={poolTop - 14} class="muted sn-lbl" style={{ fontSize: '11px', letterSpacing: '0.06em' }}>
        PHYSICAL BLOCKS IN THE STORAGE FABRIC · {used.length} USED
      </text>
      {used.map((b) => {
        const p = pos.get(b)!;
        const n = rc.get(b) ?? 0;
        const isFresh = s.fresh.includes(b);
        const mine = selDisk.map.includes(b);
        return (
          <g key={b}>
            <rect x={p.x} y={p.y} width={CW} height={CW} class={`sn-phys ${mine ? 'mine' : ''} ${isFresh ? 'fresh' : ''}`} />
            <text x={p.x + CW / 2} y={p.y + CW / 2 + 4} text-anchor="middle" class="mono" style={{ fontSize: '11px', fontWeight: 600 }}>
              p{b + 1}
            </text>
            <text x={p.x + CW / 2} y={p.y + CW + 13} text-anchor="middle" class={n > 1 ? 'mono sn-shared-t' : 'mono faint'} style={{ fontSize: '10.5px' }}>
              {n > 1 ? `×${n}` : '×1'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function DiskRow({ d, y, lbl, cw, cg, rc, fresh, on, onSel }: { d: Disk; y: number; lbl: number; cw: number; cg: number; rc: Map<number, number>; fresh: number[]; on: boolean; onSel: (id: string) => void }) {
  const sub = d.kind === 'snapshot' ? 'read-only' : d.kind === 'clone' ? 'writable clone' : 'live, writable';
  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={on}
      aria-label={`${d.label}: show where its blocks point`}
      onClick={() => onSel(d.id)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSel(d.id))}
    >
      <rect class="hit sn-row" x={0} y={y} width={lbl + BLOCKS * (cw + cg)} height={38} stroke={on ? 'var(--ink-fg)' : 'transparent'} stroke-width={on ? 1.5 : 0} />
      <text x={8} y={y + 17} style={{ fontSize: '13.5px', fontWeight: 600 }}>
        {d.label}
      </text>
      <text x={8} y={y + 31} class="muted" style={{ fontSize: '11px' }}>
        {sub}
      </text>
      {d.map.map((b, i) => {
        const shared = (rc.get(b) ?? 0) > 1;
        const isNew = fresh.includes(b);
        const x = lbl + i * (cw + cg);
        return (
          <g key={i}>
            <rect x={x} y={y + 4} width={cw} height={30} class={`${shared ? 'sn-cell-shared' : 'sn-cell-own'} ${isNew ? 'sn-new' : ''}`} />
            <text x={x + cw / 2} y={y + 23} text-anchor="middle" class="mono" style={{ fontSize: '11px', fontWeight: 600, fill: shared ? undefined : '#fff' }}>
              p{b + 1}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export default function Snapshots() {
  const [clones, setClones] = useNum('cl', 2, 1, 4);
  const [change, setChange] = useNum('chg', 25, 0, 50);
  const [diskGB, setDiskGB] = useNum('gb', 400, 50, 2000);
  const steps = useMemo(() => walkthrough({ blocks: BLOCKS, clones, changePct: change }), [clones, change]);
  const clock = useClock({ rate: 0.6, duration: steps.length - 0.001, stepSize: 1, keys: true });
  const i = Math.min(steps.length - 1, Math.floor(clock.t));
  const st = steps[i];
  const [selRaw, setSel] = useState<string | null>(null);
  const sel = selRaw && st.state.disks.some((d) => d.id === selRaw) ? selRaw : st.state.disks[st.state.disks.length - 1].id;

  const gbPerBlock = diskGB / BLOCKS;
  const used = usedBlocks(st.state).size;
  const full = fullCopyBlocks(st.state);
  const base = BLOCKS;
  const saved = full - used;
  const maxBar = Math.max(full, 1);
  const selDisk = st.state.disks.find((d) => d.id === sel)!;

  return (
    <div class="lab sn">
      <div class="ctl">
        <Field label="Clones" tip="How many writable copies to make from the snapshot, for example for test or development." value={clones}>
          <Slider label="Clones" value={clones} min={1} max={4} onChange={(v) => (setClones(v), clock.reset())} />
        </Field>
        <Field label="Change per clone" tip="Share of its blocks each clone overwrites after it is created." value={`${change}%`}>
          <Slider label="Change per clone" value={change} min={0} max={50} step={5} onChange={(v) => (setChange(v), clock.reset())} />
        </Field>
        <Field label="VM disk size" tip="Used only to turn block counts into capacity." value={fmtGB(diskGB)}>
          <Slider label="VM disk size in GB" value={diskGB} min={50} max={2000} step={50} onChange={setDiskGB} />
        </Field>
        <Field label="Related" note="Database Service builds database clones on the same snapshots; DR replicates them to other sites.">
          <div class="stack-sm">
            <button type="button" class="tbtn" onClick={() => go('ndb')}>
              Database Service <Icon name="arrow" />
            </button>
            <button type="button" class="tbtn" onClick={() => go('nci/dr')}>
              Disaster Recovery <Icon name="arrow" />
            </button>
          </div>
        </Field>
      </div>

      <div class="stage">
        <div class="diagram-scroll">
          <MapDiagram s={st.state} sel={sel} onSel={setSel} />
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
            <i class="sw" style={{ border: '1.5px solid var(--ok)' }} />
            Written in this step
          </span>
          <span>Click a row to see where its map points.</span>
        </div>
        <PlayBar clock={clock} label="Snapshot and clone sequence" fmt={() => `step ${i + 1}/${steps.length}`} />
        <Follow tone={st.id === 'snap' || st.id === 'clone' ? 'ok' : 'ink'} k={`Step ${i + 1} · ${st.title}`}>
          <p>{st.text}</p>
          <p class="rest">
            <Illus why="Blocks here are large and few so they can be drawn. AOS tracks changes at a much finer granularity, manages snapshot chains in the background, and stores every block with the container’s replication factor, which multiplies both sides of the comparison equally." />
          </p>
        </Follow>
      </div>

      <div class="rail">
        <div class="side-sec">
          <div class="eyebrow">Capacity, before and after</div>
          <div class="sn-cmp">
            <div>
              <span class="small muted">Actually used</span>
              <div class="sn-bar">
                <i style={{ width: `${(used / maxBar) * 100}%` }} />
              </div>
              <span class="mono">{fmtGB(used * gbPerBlock)}</span>
            </div>
            <div>
              <span class="small muted">If each were a full copy</span>
              <div class="sn-bar full">
                <i style={{ width: `${(full / maxBar) * 100}%` }} />
              </div>
              <span class="mono">{fmtGB(full * gbPerBlock)}</span>
            </div>
          </div>
          <Stat k="Original disk" v={fmtGB(base * gbPerBlock)} />
          <Stat k="Added since start" v={fmtGB((used - base) * gbPerBlock)} tip="Only new writes, by the VM or by clones, add space." />
          <Stat k="Not copied" v={fmtGB(saved * gbPerBlock)} tone="ok" />
          <p class="field-note">Logical capacity. Each block is also stored with the container’s replication factor.</p>
        </div>
        <div class="side-sec">
          <div class="eyebrow">{selDisk.label}</div>
          <Stat k="Blocks in its map" v={selDisk.map.length} />
          <Stat k="Only this disk uses" v={exclusiveBlocks(st.state, selDisk.id)} tip="Blocks no other disk points at. Roughly what deleting just this disk would free." />
          <p class="field-note">
            {selDisk.kind === 'snapshot'
              ? 'A snapshot holds on to old blocks that the live disk has since replaced. That is the space a snapshot costs over time.'
              : selDisk.kind === 'clone'
                ? 'A clone starts sharing every block, then pays only for what it changes.'
                : 'The live disk always points at the newest version of each block.'}
          </p>
        </div>
        <div class="side-sec">
          <div class="eyebrow">Terms</div>
          <ul class="small sn-terms">
            <li>
              <Tip text="A snapshot records a copy of the disk’s block map. It does not copy data.">Metadata-only snapshot</Tip>
            </li>
            <li>
              <Tip text="After a snapshot, new writes go to new blocks and only the live map is updated. Old blocks are not copied aside first, so a write after a snapshot is still a single write." detail="Contrast with copy-on-write designs, which copy the old block aside before overwriting it in place.">
                Redirect-on-write
              </Tip>
            </li>
            <li>
              <Tip text="A clone is a new writable disk whose map starts as a copy of a snapshot’s map. It is ready at once and shares blocks until it changes them.">Instant clone</Tip>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
