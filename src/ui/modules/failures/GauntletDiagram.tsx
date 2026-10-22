// The Gauntlet's 8-node cluster in one row: four block frames of two nodes. Each node shows
// its VMs, its Controller VM (CVM) and two drives; tiles in a drive show its copies and how
// full it is (each tile is a tenth of the drive). Re-created copies travel under the cards;
// VMs restarted by HA travel over them. Renders a GFrame only.
import type { JSX } from 'preact';
import { DRIVE_SLOTS, FULL_AT, G_DRIVES, G_NODES, PER_BLOCK, type GAnchor, type GArcF, type GFrame, type GNodeLook, type GTileF, type GVmF } from './scenarios';
import type { Slot } from '../cluster-lab/story';
import { flowDots, pathLength } from '../../components/show';

const W = 1000;
const PAD = 6;
const BLOCK_GAP = 14;
const FP = 5;
const NODE_GAP = 6;
const BLOCKS = G_NODES / PER_BLOCK;
const NW = (W - PAD * 2 - BLOCK_GAP * (BLOCKS - 1) - BLOCKS * FP * 2 - BLOCKS * NODE_GAP * (PER_BLOCK - 1)) / G_NODES;
const TOP = 46; // room above the cards for VMs moving between nodes
const LABEL = 18;
const CARD_Y = TOP + LABEL;
const VW = 15;
const VG = 4;
const VM_X = 8;
const VM_Y = 26;
const CVM_W = 36;
const CVM_H = VW * 2 + VG;
const DISK_Y = 68;
const DISK_G = 6;
const DW = (NW - 16 - DISK_G) / G_DRIVES;
const DH = 92;
const TS = 11;
const TP = 14;
const TCOLS = 2;
const NH = DISK_Y + DH + 8;
const BOTTOM = CARD_Y + NH;
const H = BOTTOM + 44;

const blockW = PER_BLOCK * NW + (PER_BLOCK - 1) * NODE_GAP + FP * 2;
const blockX = (g: number) => PAD + g * (blockW + BLOCK_GAP);
const nodeX = (n: number) => blockX(Math.floor(n / PER_BLOCK)) + FP + (n % PER_BLOCK) * (NW + NODE_GAP);
const diskX = (n: number, d: number) => nodeX(n) + 8 + d * (DW + DISK_G);
const parseDisk = (id: string) => {
  const [n, d] = id.split('.').map(Number);
  return { n, d };
};

function slotXY(s: Slot) {
  return { x: nodeX(s.node) + VM_X + (s.slot % 3) * (VW + VG), y: CARD_Y + VM_Y + Math.floor(s.slot / 3) * (VW + VG) };
}

type Pt = { x: number; y: number };

function quad(a: Pt, c: Pt, b: Pt, p: number): Pt {
  const u = 1 - p;
  return { x: u * u * a.x + 2 * u * p * c.x + p * p * b.x, y: u * u * a.y + 2 * u * p * c.y + p * p * b.y };
}

function anchor(a: GAnchor): Pt {
  if (a.k === 'disk') {
    const { n, d } = parseDisk(a.disk);
    return { x: diskX(n, d) + DW / 2, y: CARD_Y + DISK_Y + DH };
  }
  if (a.k === 'cvm') return { x: nodeX(a.node) + NW - 8 - CVM_W / 2, y: CARD_Y + VM_Y };
  return { x: nodeX(a.node) + VM_X + (3 * VW + 2 * VG) / 2, y: CARD_Y + VM_Y };
}

function arcGeom(arc: GArcF, i: number) {
  const a = anchor(arc.from);
  const b = anchor(arc.to);
  // Re-created copies travel under the cards; redirected I/O arcs over them.
  const c = arc.kind === 'rebuild' ? { x: (a.x + b.x) / 2, y: BOTTOM + 52 + (i % 3) * 6 } : { x: (a.x + b.x) / 2, y: TOP - 34 };
  return { d: `M${a.x} ${a.y} Q${c.x} ${c.y} ${b.x} ${b.y}`, at: (p: number) => quad(a, c, b, p) };
}

const WORD: Record<GNodeLook, string> = { up: '', down: 'Down', cvm: 'CVM down' };

function Node({ n, look, tiles, failed }: { n: number; look: GNodeLook; tiles: Map<string, GTileF[]>; failed: string[] }) {
  const x = nodeX(n);
  const y = CARD_Y;
  const cvmX = x + NW - 8 - CVM_W;
  return (
    <g class={`gx-node ${look}`}>
      <rect class="gx-card" x={x} y={y} width={NW} height={NH} />
      <text class="gx-name" x={x + 8} y={y + 17}>
        N{n + 1}
      </text>
      {look !== 'up' && (
        <text class={`gx-word ${look}`} x={x + NW - 8} y={y + 17} text-anchor="end">
          {WORD[look]}
        </text>
      )}
      <g class={`gx-cvm${look === 'down' ? ' down' : look === 'cvm' ? ' stopped' : ''}`}>
        <rect x={cvmX} y={y + VM_Y} width={CVM_W} height={CVM_H} />
        <text x={cvmX + CVM_W / 2} y={y + VM_Y + 14} text-anchor="middle">
          CVM
        </text>
        {look === 'up' ? (
          <circle class="gx-beat beat" cx={cvmX + CVM_W / 2} cy={y + VM_Y + 25} r={3} />
        ) : (
          <path class="gx-x" d={`M${cvmX + CVM_W / 2 - 4} ${y + VM_Y + 21} l8 8 m0 -8 l-8 8`} />
        )}
      </g>
      {Array.from({ length: G_DRIVES }, (_, d) => {
        const id = `${n}.${d}`;
        const dx = diskX(n, d);
        const dy = y + DISK_Y;
        const list = tiles.get(id) || [];
        const isFailed = failed.includes(id);
        const live = list.filter((t) => t.look !== 'off' && t.look !== 'gone' && t.look !== 'lost').length;
        const full = look === 'up' && !isFailed && live >= FULL_AT;
        const gridW = TCOLS * TP - (TP - TS);
        return (
          <g key={id}>
            <rect class={`gx-disk${isFailed ? ' failed' : ''}${full ? ' full' : ''}`} x={dx} y={dy} width={DW} height={DH} />
            {isFailed && (
              <>
                <text class="gx-dlabel bad" x={dx + DW / 2} y={dy + 12} text-anchor="middle">
                  Failed
                </text>
                <path class="gx-x bad" d={`M${dx + 9} ${dy + 24} L${dx + DW - 9} ${dy + DH - 10} M${dx + DW - 9} ${dy + 24} L${dx + 9} ${dy + DH - 10}`} />
              </>
            )}
            {full && (
              <text class="gx-dlabel warn" x={dx + DW / 2} y={dy + 12} text-anchor="middle">
                Full
              </text>
            )}
            {list.slice(0, DRIVE_SLOTS).map((tl, i) => (
              <rect
                key={tl.id}
                class={`gt-${tl.look}`}
                x={dx + (DW - gridW) / 2 + (i % TCOLS) * TP}
                y={dy + DH - 6 - TS - Math.floor(i / TCOLS) * TP}
                width={TS}
                height={TS}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}

function Vm({ vm }: { vm: GVmF }) {
  let p = slotXY(vm.at);
  let trail: string | null = null;
  if (vm.to && vm.p !== undefined) {
    const a = slotXY(vm.at);
    const b = slotXY(vm.to);
    const c = { x: (a.x + b.x) / 2, y: TOP - 80 };
    p = quad(a, c, b, vm.p);
    trail = `M${a.x + VW / 2} ${a.y + VW / 2} Q${c.x + VW / 2} ${c.y + VW / 2} ${b.x + VW / 2} ${b.y + VW / 2}`;
  }
  return (
    <g class={`gx-vm ${vm.look}`}>
      {trail && <path class="gx-trail" d={trail} />}
      <rect x={p.x} y={p.y} width={VW} height={VW} />
    </g>
  );
}

export function GauntletDiagram({ frame, label }: { frame: GFrame; label: string }) {
  const arcs = frame.arcs.map((a, i) => ({ a, g: arcGeom(a, i) }));
  const vms = frame.vms.slice().sort((a, b) => Number(!!a.to) - Number(!!b.to));
  const lines: JSX.Element[] = arcs.map(({ a, g }) => <path key={`l-${a.id}`} class={`gx-arc ${a.kind}`} d={g.d} />);
  const dots: JSX.Element[] = [];
  arcs.forEach(({ a, g }) =>
    (a.flow !== undefined ? flowDots(a.flow, pathLength(g.at)) : a.dots).forEach((p, k) => {
      const pt = g.at(p);
      dots.push(<circle key={`d-${a.id}-${k}`} class={`gx-dot ${a.kind}`} cx={pt.x} cy={pt.y} r={4} />);
    }),
  );
  return (
    <svg class="diagram gx-dia" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {Array.from({ length: BLOCKS }, (_, g) => {
        const nodes = Array.from({ length: PER_BLOCK }, (_, k) => g * PER_BLOCK + k);
        const down = nodes.every((n) => frame.nodes[n] === 'down');
        return (
          <g key={`b${g}`}>
            <rect class={`gx-block${down ? ' down' : ''}`} x={blockX(g)} y={TOP} width={blockW} height={LABEL + NH + FP} />
            <text class="gx-blabel" x={blockX(g) + FP + 2} y={TOP + 13}>
              Block {g + 1}
            </text>
          </g>
        );
      })}
      {Array.from({ length: G_NODES }, (_, n) => (
        <Node key={n} n={n} look={frame.nodes[n]} tiles={frame.tiles} failed={frame.failedDisks} />
      ))}
      <g aria-hidden="true">{lines}</g>
      {vms.map((vm) => (
        <Vm key={vm.id} vm={vm} />
      ))}
      <g aria-hidden="true">{dots}</g>
    </svg>
  );
}

/** Small legend with only the marks the chosen story uses. */
export function GauntletLegend({ items }: { items: { look: string; label: string }[] }) {
  return (
    <div class="legend gx-legend">
      {items.map((i) => (
        <span key={i.label}>
          <svg class="gx-sw" viewBox="0 0 16 12" aria-hidden="true">
            {i.look.startsWith('arc-') ? (
              <>
                <path class={`gx-arc ${i.look.slice(4)}`} d="M1 6 H15" />
                <circle class={`gx-dot ${i.look.slice(4)}`} cx="10" cy="6" r="2.6" />
              </>
            ) : (
              <rect class={`gt-${i.look}`} x="3" y="1" width="10" height="10" />
            )}
          </svg>
          {i.label}
        </span>
      ))}
    </div>
  );
}
