// The lab's fixed 4-node cluster, drawn large enough to read from the back of a room:
// each node shows its VMs, its Controller VM (CVM), the hypervisor and three drives holding
// data tiles. Traffic between nodes rides a network lane under the cards; traffic inside a
// node is a short straight line. Renders a Frame only.
import type { JSX } from 'preact';
import { DRIVES, NODES, TILE_CAP, type Anchor, type ArcF, type Frame, type NodeLook, type Slot, type TileF, type VmF } from './scenarios';
import { flowDots, pathLength } from '../../components/show';

// ── geometry (viewBox units) ──
export const W = 1000;
const PAD = 10;
const GAP = 20;
const NW = (W - PAD * 2 - GAP * (NODES - 1)) / NODES; // node card width
const TOP = 48; // card top; the space above is where VMs travel between nodes
const VW = 44;
const VH = 30;
const VG = 6;
const VMX = 12;
const VMY = 44;
const CVM_X = VMX + 3 * VW + 2 * VG + 8;
const CVM_W = NW - CVM_X - 12;
const CVM_H = 2 * VH + VG;
const HYP_Y = VMY + CVM_H + 8;
const HYP_H = 18;
const DISK_Y = HYP_Y + HYP_H + 10;
const DISK_H = 92;
const DISK_G = 8;
const DW = (NW - 24 - DISK_G * (DRIVES - 1)) / DRIVES;
const NH = DISK_Y + DISK_H + 12;
const TS = 11; // tile size
const TP = 14; // tile pitch
const TCOLS = 4;
const BOTTOM = TOP + NH;
const LANE_Y = BOTTOM + 44;
export const H = LANE_Y + 24;

const nodeX = (n: number) => PAD + n * (NW + GAP);
const diskX = (n: number, d: number) => nodeX(n) + 12 + d * (DW + DISK_G);
const parseDisk = (id: string) => {
  const [n, d] = id.split('.').map(Number);
  return { n, d };
};

function slotXY(s: Slot) {
  const col = s.slot % 3;
  const row = Math.floor(s.slot / 3);
  return { x: nodeX(s.node) + VMX + col * (VW + VG), y: TOP + VMY + row * (VH + VG) };
}

type Pt = { x: number; y: number };

/** Where an arc attaches; `side` says whether the arc travels inside the card or under it. */
function anchorPt(a: Anchor, side: 'in' | 'below'): Pt {
  switch (a.k) {
    case 'vm': {
      const p = slotXY(a.at);
      return { x: p.x + VW / 2, y: p.y + VH / 2 };
    }
    case 'cvm':
      return { x: nodeX(a.node) + CVM_X + CVM_W / 2, y: TOP + VMY + CVM_H / 2 };
    case 'disk': {
      const { n, d } = parseDisk(a.disk);
      const x = diskX(n, d) + DW / 2;
      return side === 'in' ? { x, y: TOP + DISK_Y + 6 } : { x, y: TOP + DISK_Y + DISK_H };
    }
    case 'lane':
      return { x: nodeX(a.node) + NW / 2, y: BOTTOM };
  }
}

function nodeOf(a: Anchor): number {
  if (a.k === 'vm') return a.at.node;
  if (a.k === 'disk') return parseDisk(a.disk).n;
  return a.node;
}

function quad(a: Pt, c: Pt, b: Pt, p: number): Pt {
  const u = 1 - p;
  return { x: u * u * a.x + 2 * u * p * c.x + p * p * b.x, y: u * u * a.y + 2 * u * p * c.y + p * p * b.y };
}

function arcGeom(arc: ArcF, i: number): { d: string; at: (p: number) => Pt } {
  const between = nodeOf(arc.from) !== nodeOf(arc.to);
  if (!between) {
    const a = anchorPt(arc.from, 'in');
    const b = anchorPt(arc.to, 'in');
    return { d: `M${a.x} ${a.y} L${b.x} ${b.y}`, at: (p) => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p }) };
  }
  const a = anchorPt(arc.from, 'below');
  const b = anchorPt(arc.to, 'below');
  const c = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + 64 + (i % 3) * 8 };
  return { d: `M${a.x} ${a.y} Q${c.x} ${c.y} ${b.x} ${b.y}`, at: (p) => quad(a, c, b, p) };
}

const WORD: Record<NodeLook, { text: string; tone: 'ok' | 'warn' | 'bad' | 'flow' }> = {
  up: { text: 'Running', tone: 'ok' },
  off: { text: 'Powered off', tone: 'bad' },
  entering: { text: 'Entering maintenance', tone: 'warn' },
  maint: { text: 'In maintenance', tone: 'warn' },
  returning: { text: 'Catching up', tone: 'flow' },
};

function Node({ n, look, tiles, failed, tag }: { n: number; look: NodeLook; tiles: Map<string, TileF[]>; failed: string[]; tag?: string }) {
  const x = nodeX(n);
  const word = tag ? { text: `✓ ${tag}`, tone: 'ok' as const } : WORD[look];
  const cvmDown = look === 'off' || look === 'maint';
  const storageOff = look === 'off' || look === 'maint';
  return (
    <g class={`dl-node ${look}`}>
      <rect class="dl-card" x={x} y={TOP} width={NW} height={NH} />
      <text class="dl-name" x={x + 12} y={TOP + 24}>
        Node {n + 1}
      </text>
      <text class={`dl-word ${word.tone}`} x={x + NW - 12} y={TOP + 24} text-anchor="end">
        {word.text}
      </text>

      <g class={`dl-cvm${look === 'off' ? ' down' : look === 'maint' ? ' paused' : ''}`}>
        <rect x={x + CVM_X} y={TOP + VMY} width={CVM_W} height={CVM_H} />
        <text x={x + CVM_X + CVM_W / 2} y={TOP + VMY + 22} text-anchor="middle">
          CVM
        </text>
        {cvmDown ? (
          <path class="dl-x" d={`M${x + CVM_X + CVM_W / 2 - 6} ${TOP + VMY + 38} l12 12 m0 -12 l-12 12`} />
        ) : (
          <circle class="dl-beat beat" cx={x + CVM_X + CVM_W / 2} cy={TOP + VMY + 46} r={4} />
        )}
      </g>

      <rect class={`dl-hyp${look === 'off' ? ' off' : ''}`} x={x + 12} y={TOP + HYP_Y} width={NW - 24} height={HYP_H} />
      <text class="dl-hypt" x={x + NW / 2} y={TOP + HYP_Y + 12.5} text-anchor="middle">
        {look === 'off' ? 'AHV hypervisor · off' : look === 'maint' || look === 'entering' ? 'AHV hypervisor · maintenance mode' : 'AHV hypervisor'}
      </text>

      {Array.from({ length: DRIVES }, (_, d) => {
        const id = `${n}.${d}`;
        const dx = diskX(n, d);
        const dy = TOP + DISK_Y;
        const isFailed = failed.includes(id);
        const list = tiles.get(id) || [];
        const gridW = TCOLS * TP - (TP - TS);
        return (
          <g key={id} class={`dl-drive${storageOff ? ' dim' : ''}`}>
            <rect class={`dl-disk${isFailed ? ' failed' : ''}`} x={dx} y={dy} width={DW} height={DISK_H} />
            <text class={`dl-dl${isFailed ? ' bad' : ''}`} x={dx + 6} y={dy + 14}>
              {isFailed ? 'Failed' : `Drive ${d + 1}`}
            </text>
            {isFailed && <path class="dl-x bad" d={`M${dx + 14} ${dy + 30} L${dx + DW - 14} ${dy + DISK_H - 14} M${dx + DW - 14} ${dy + 30} L${dx + 14} ${dy + DISK_H - 14}`} />}
            {list.slice(0, TILE_CAP).map((tl, i) => {
              const col = i % TCOLS;
              const row = Math.floor(i / TCOLS);
              return (
                <rect
                  key={tl.id}
                  class={`t-${tl.look}${tl.dim ? ' t-dim' : ''}`}
                  x={dx + (DW - gridW) / 2 + col * TP}
                  y={dy + DISK_H - 7 - TS - row * TP}
                  width={TS}
                  height={TS}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

function Vm({ vm }: { vm: VmF }) {
  let p = slotXY(vm.at);
  let trail: string | null = null;
  if (vm.to && vm.p !== undefined) {
    const a = slotXY(vm.at);
    const b = slotXY(vm.to);
    const c = { x: (a.x + b.x) / 2, y: TOP - 120 };
    p = quad(a, c, b, vm.p);
    trail = `M${a.x + VW / 2} ${a.y + VH / 2} Q${c.x + VW / 2} ${c.y + VH / 2} ${b.x + VW / 2} ${b.y + VH / 2}`;
  }
  const cls = `dl-vm ${vm.look}${vm.hl ? ' hl' : ''}`;
  return (
    <g class={cls}>
      {trail && <path class={`dl-trail ${vm.look}`} d={trail} />}
      <rect x={p.x} y={p.y} width={VW} height={VH} />
      <text x={p.x + VW / 2} y={p.y + VH / 2 + 4} text-anchor="middle">
        {vm.label}
      </text>
    </g>
  );
}

export function LabDiagram({ frame, label }: { frame: Frame; label: string }) {
  const firstDisk = diskX(0, 0);
  const lastDisk = diskX(NODES - 1, DRIVES - 1) + DW;
  const arcs = frame.arcs.map((a, i) => ({ a, g: arcGeom(a, i) }));
  // VMs in motion are drawn last so they pass over the cards.
  const vms = frame.vms.slice().sort((a, b) => Number(!!a.to) - Number(!!b.to));
  const lines: JSX.Element[] = arcs.map(({ a, g }) => <path key={`l-${a.id}`} class={`dl-arc ${a.kind}`} d={g.d} />);
  const dots: JSX.Element[] = [];
  arcs.forEach(({ a, g }) =>
    (a.flow !== undefined ? flowDots(a.flow, pathLength(g.at)) : a.dots).forEach((p, k) => {
      const pt = g.at(p);
      dots.push(<circle key={`d-${a.id}-${k}`} class={`dl-dot ${a.kind}`} cx={pt.x} cy={pt.y} r={4.5} />);
    }),
  );
  return (
    <svg class="diagram dl-dia" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <line class="dl-lane" x1={PAD} y1={LANE_Y} x2={W - PAD} y2={LANE_Y} />
      <text class="dl-lanet" x={PAD} y={LANE_Y + 16}>
        NETWORK
      </text>
      {frame.pool && (
        <g class="dl-poolg">
          <path class="dl-pool" d={`M${firstDisk} ${BOTTOM + 6} V${BOTTOM + 14} H${lastDisk} V${BOTTOM + 6}`} />
          <text class="dl-poolt" x={(firstDisk + lastDisk) / 2} y={BOTTOM + 31} text-anchor="middle">
            One storage pool across all four nodes: the Distributed Storage Fabric
          </text>
        </g>
      )}
      {Array.from({ length: NODES }, (_, n) => (
        <Node key={n} n={n} look={frame.nodes[n]} tiles={frame.tiles} failed={frame.failedDisks} tag={frame.tag?.node === n ? frame.tag.text : undefined} />
      ))}
      <g aria-hidden="true">{lines}</g>
      {vms.map((vm) => (
        <Vm key={vm.id} vm={vm} />
      ))}
      <g aria-hidden="true">{dots}</g>
    </svg>
  );
}

/** Legend swatches that match the diagram's tiles and lines. */
export function LabLegend({ items }: { items: { look: string; label: string }[] }) {
  return (
    <div class="legend dl-legend">
      {items.map((i) => (
        <span key={i.label}>
          <svg class="dl-sw" viewBox="0 0 16 12" aria-hidden="true">
            {i.look.startsWith('arc-') ? (
              <>
                <path class={`dl-arc ${i.look.slice(4)}`} d="M1 6 H15" />
                <circle class={`dl-dot ${i.look.slice(4)}`} cx="10" cy="6" r="2.6" />
              </>
            ) : (
              <rect class={`t-${i.look}`} x="3" y="1" width="10" height="10" />
            )}
          </svg>
          {i.label}
        </span>
      ))}
    </div>
  );
}
