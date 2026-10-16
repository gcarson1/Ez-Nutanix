// Geometry for the cluster diagram: racks contain blocks, blocks contain nodes, nodes
// contain a CVM, VMs, the hypervisor and drives. Pure (no DOM) so it is cheap to memoize.
import type { ClusterState } from '../../../engine/cluster';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface NodeGeo extends Box {
  id: number;
  cvm: Box;
  vmArea: Box;
  hyp: Box;
  disks: (Box & { id: string })[];
  diskRows: number;
}

export interface Layout {
  W: number;
  H: number;
  compact: boolean;
  nodes: Map<number, NodeGeo>;
  blocks: (Box & { label: string })[];
  racks: (Box & { label: string })[];
  tile: { s: number; cols: number; rows: number };
}

const PAD = 8;

export function layoutCluster(s: ClusterState, compact: boolean, maxPerDisk: number): Layout {
  const npb = s.cfg.nodesPerBlock;
  const n = s.nodes.length;
  const NW = compact ? 104 : 150;
  const G = 6; // gap between nodes in a block
  const BP = npb > 1 ? 5 : 0; // block padding
  const BL = npb > 1 ? 15 : 0; // block label height
  const BG = 12; // gap between blocks
  const drives = s.cfg.drivesPerNode;
  const dCols = Math.min(drives, drives <= 6 ? 3 : drives <= 12 ? 4 : 6);
  const diskRows = Math.ceil(drives / dCols);
  const DH = compact ? (diskRows > 2 ? 22 : 30) : diskRows > 2 ? 30 : 40;
  const top = compact ? 34 : 78; // where the drives start inside a node
  const NH = top + diskRows * (DH + 3) + 4;

  let cols = compact ? Math.ceil(Math.sqrt(n)) : Math.ceil(Math.sqrt(n * 1.5));
  cols = Math.max(2, Math.min(compact ? 6 : 8, cols));
  cols = Math.max(npb, Math.ceil(cols / npb) * npb);
  cols = Math.max(1, Math.min(cols, Math.ceil(n / npb) * npb));
  if (cols > 8 && npb === 4) cols = 8;
  const blocksPerRow = Math.max(1, Math.floor(cols / npb));

  const racksOn = s.cfg.racks > 1;
  const RH = racksOn ? 22 : 0;
  const RP = racksOn ? 8 : 0;
  const blockW = npb * NW + (npb - 1) * G + BP * 2;
  const blockH = NH + BP * 2 + BL;
  const rowW = blocksPerRow * blockW + (blocksPerRow - 1) * BG;
  const W = rowW + PAD * 2 + RP * 2;

  const blockIds = [...new Set(s.nodes.map((x) => x.block))].sort((a, b) => a - b);
  const rackIds = racksOn ? [...new Set(s.nodes.map((x) => x.rack))].sort((a, b) => a - b) : [0];
  const nodes = new Map<number, NodeGeo>();
  const blocks: Layout['blocks'] = [];
  const racks: Layout['racks'] = [];

  // tile grid inside one drive
  const cw = (NW - 12 - (dCols - 1) * 3) / dCols;
  let tile = { s: 2, cols: Math.floor((cw - 1) / 3), rows: Math.floor((DH - 1) / 3) };
  for (const sz of [6, 5, 4, 3, 2]) {
    const c = Math.floor((cw - 2 + 1) / (sz + 1));
    const r = Math.floor((DH - 2 + 1) / (sz + 1));
    if (c * r >= maxPerDisk || sz === 2) {
      tile = { s: sz, cols: c, rows: r };
      break;
    }
  }

  let y = PAD;
  for (const r of rackIds) {
    const inRack = blockIds.filter((b) => !racksOn || s.nodes.find((x) => x.block === b)!.rack === r);
    if (!inRack.length) continue;
    const rackY = y;
    y += RH;
    for (let k = 0; k < inRack.length; k += blocksPerRow) {
      const row = inRack.slice(k, k + blocksPerRow);
      row.forEach((b, bi) => {
        const bx = PAD + RP + bi * (blockW + BG);
        if (npb > 1) blocks.push({ x: bx, y, w: blockW, h: blockH, label: `Block ${b + 1}` });
        const members = s.nodes.filter((x) => x.block === b).sort((p, q) => p.id - q.id);
        members.forEach((node, j) => {
          const nx = bx + BP + j * (NW + G);
          const ny = y + BP + BL;
          const cvmW = compact ? 0 : 44;
          const geo: NodeGeo = {
            id: node.id,
            x: nx,
            y: ny,
            w: NW,
            h: NH,
            cvm: compact ? { x: nx + NW - 22, y: ny + 5, w: 16, h: 12 } : { x: nx + NW - 6 - cvmW, y: ny + 26, w: cvmW, h: 30 },
            vmArea: { x: nx + 6, y: ny + 26, w: NW - 18 - cvmW, h: 30 },
            hyp: { x: nx + 6, y: ny + 59, w: NW - 12, h: 14 },
            disks: [],
            diskRows,
          };
          for (let d = 0; d < drives; d++) {
            const c = d % dCols;
            const rr = Math.floor(d / dCols);
            geo.disks.push({ id: `${node.id}.${d}`, x: nx + 6 + c * (cw + 3), y: ny + top + rr * (DH + 3), w: cw, h: DH });
          }
          nodes.set(node.id, geo);
        });
      });
      y += blockH + BG;
    }
    y -= BG;
    if (racksOn) racks.push({ x: PAD, y: rackY, w: W - PAD * 2, h: y - rackY + RP, label: `Rack ${r + 1}` });
    y += RP + 14;
  }
  const H = y - 14 + PAD;
  return { W, H, compact, nodes, blocks, racks, tile };
}
