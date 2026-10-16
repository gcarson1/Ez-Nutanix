// Capacity math: raw -> usable, with RF, EC-X on write-cold data, a rebuild reserve and an
// optional data-reduction ratio. Formulas are documented in docs/facts.md and unit tested.
import { ecStrip, ecOverhead, MIN_BLOCKS, type RF } from './rules';

export type ReservePolicy = 'none' | 'auto' | 'n1' | 'n2' | 'block';

export interface CapacityInput {
  nodes: number;
  drivesPerNode: number;
  driveTB: number;
  rf: RF;
  ecx: boolean;
  coldPct: number; // % of data that is write-cold (EC-X only encodes cold data)
  reserve: ReservePolicy;
  nodesPerBlock: number;
  blockAware: boolean;
  dataReduction: number; // compression/dedupe ratio, 1 = none
  systemOverheadPct: number; // optional deduction for system/metadata reservations
}

export interface CapacityStep {
  key: string;
  label: string;
  tb: number;
}

export interface CapacityResult {
  rawTB: number;
  systemTB: number;
  reserveNodes: number;
  reserveTB: number;
  reserveWhy: string;
  rfOverhead: number;
  strip: { data: number; parity: number } | null;
  ecOverhead: number | null;
  blendedOverhead: number;
  /** Logical capacity if the whole cluster could be filled (no rebuild reserve). */
  usableTB: number;
  /** Logical capacity that still allows a full self-heal after the reserved failure(s). */
  usableAfterReserveTB: number;
  /** usableAfterReserve x data reduction. */
  effectiveTB: number;
  steps: CapacityStep[];
  advisories: string[];
}

/** Recommended rebuild reserve in nodes (facts: CAP-3). */
export function recommendedReserve(input: Pick<CapacityInput, 'nodes' | 'rf' | 'nodesPerBlock' | 'blockAware'>): { nodes: number; why: string } {
  const { nodes, rf, nodesPerBlock, blockAware } = input;
  const blocks = Math.ceil(nodes / nodesPerBlock);
  if (blockAware && nodesPerBlock > 1 && blocks >= MIN_BLOCKS[rf]) {
    const n = nodesPerBlock * (rf - 1);
    return { nodes: n, why: `Block awareness: keep ${rf === 2 ? 'one block' : 'two blocks'} (${n} nodes) of free space so a whole-block loss can fully self-heal.` };
  }
  if (rf === 3) return { nodes: 2, why: 'RF3: keep two nodes of free space (N+2) so data can re-protect after two node failures.' };
  if (nodes > 24) return { nodes: 2, why: 'Large RF2 cluster: consider N+2, since the chance of overlapping failures grows with node count.' };
  return { nodes: 1, why: 'RF2: keep one node of free space (N+1) so data can fully re-protect after a node failure.' };
}

export function computeCapacity(input: CapacityInput): CapacityResult {
  const nodes = Math.max(1, Math.round(input.nodes));
  const perNodeTB = input.drivesPerNode * input.driveTB;
  const rawTB = nodes * perNodeTB;
  const systemTB = (rawTB * Math.max(0, input.systemOverheadPct)) / 100;

  const rec = recommendedReserve(input);
  let reserveNodes = 0;
  let reserveWhy = 'No rebuild reserve: after a failure the cluster may not have room to fully self-heal.';
  if (input.reserve === 'auto') {
    reserveNodes = rec.nodes;
    reserveWhy = rec.why;
  } else if (input.reserve === 'n1') {
    reserveNodes = 1;
    reserveWhy = 'N+1: one node of free space held back for re-protection.';
  } else if (input.reserve === 'n2') {
    reserveNodes = 2;
    reserveWhy = 'N+2: two nodes of free space held back for re-protection.';
  } else if (input.reserve === 'block') {
    reserveNodes = input.nodesPerBlock;
    reserveWhy = `One block (${input.nodesPerBlock} nodes) of free space held back for re-protection.`;
  }
  reserveNodes = Math.min(reserveNodes, Math.max(0, nodes - 1));
  const reserveTB = reserveNodes * perNodeTB * (1 - Math.max(0, input.systemOverheadPct) / 100);

  const rfOverhead = input.rf;
  const strip = input.ecx ? ecStrip(nodes, input.rf) : null;
  const ecOv = strip ? ecOverhead(strip) : null;
  const cold = Math.min(100, Math.max(0, input.coldPct)) / 100;
  const blendedOverhead = strip && ecOv ? cold * ecOv + (1 - cold) * rfOverhead : rfOverhead;

  const afterSystem = rawTB - systemTB;
  const usableTB = afterSystem / blendedOverhead;
  const usableAfterReserveTB = Math.max(0, afterSystem - reserveTB) / blendedOverhead;
  const dr = Math.max(1, input.dataReduction || 1);
  const effectiveTB = usableAfterReserveTB * dr;

  const steps: CapacityStep[] = [{ key: 'raw', label: 'Raw (sum of all drives)', tb: rawTB }];
  if (systemTB > 0) steps.push({ key: 'system', label: 'System overhead (your figure)', tb: -systemTB });
  if (reserveTB > 0) steps.push({ key: 'reserve', label: `Rebuild reserve (${reserveNodes} node${reserveNodes === 1 ? '' : 's'})`, tb: -reserveTB });
  const protectedRaw = afterSystem - reserveTB;
  steps.push({
    key: 'protection',
    label: strip ? `Copies & parity (RF${input.rf} hot, EC-X ${strip.data}/${strip.parity} cold)` : `Copies (RF${input.rf})`,
    tb: -(protectedRaw - usableAfterReserveTB),
  });
  steps.push({ key: 'usable', label: 'Usable after reserve', tb: usableAfterReserveTB });
  if (dr > 1) steps.push({ key: 'effective', label: `Effective at ${dr.toFixed(1)}:1 data reduction`, tb: effectiveTB });

  const advisories: string[] = [];
  if (input.ecx && !strip) advisories.push(`EC-X needs at least ${input.rf === 2 ? 4 : 6} nodes at RF${input.rf}.`);
  if (strip && nodes < strip.data + strip.parity + 1) {
    advisories.push(`With ${nodes} nodes and a ${strip.data}/${strip.parity} strip there is no spare node to rebuild a full-width strip after a failure.`);
  }
  if (input.reserve !== 'auto' && reserveNodes < rec.nodes) advisories.push(`Recommended reserve here is ${rec.nodes} node${rec.nodes === 1 ? '' : 's'}: ${rec.why}`);

  return {
    rawTB,
    systemTB,
    reserveNodes,
    reserveTB,
    reserveWhy,
    rfOverhead,
    strip,
    ecOverhead: ecOv,
    blendedOverhead,
    usableTB,
    usableAfterReserveTB,
    effectiveTB,
    steps,
    advisories,
  };
}

export interface SurvivalRow {
  domain: 'Drive' | 'Node' | 'Block' | 'Rack';
  survives: number; // simultaneous failures of this kind tolerated
  why: string;
}

/** "What failure can this survive?" matrix. */
export function survivalMatrix(o: { rf: RF; nodes: number; nodesPerBlock: number; blockAware: boolean; racks: number; rackAware: boolean }): SurvivalRow[] {
  const tol = o.rf - 1;
  const blocks = Math.ceil(o.nodes / o.nodesPerBlock);
  const blockOk = o.nodesPerBlock === 1 || (o.blockAware && blocks >= MIN_BLOCKS[o.rf]);
  const racksUsed = Math.min(o.racks, blocks);
  const rackOk = o.rackAware && racksUsed >= MIN_BLOCKS[o.rf];
  return [
    { domain: 'Drive', survives: tol, why: `Copies of any piece of data sit on different nodes, so ${tol === 1 ? 'any one drive' : 'any two drives'} can fail (several drives in one node count as one node).` },
    { domain: 'Node', survives: tol, why: `RF${o.rf} keeps ${o.rf} copies on different nodes.` },
    {
      domain: 'Block',
      survives: blockOk ? tol : 0,
      why: blockOk
        ? o.nodesPerBlock === 1
          ? 'One node per block: a block failure is a node failure.'
          : `Block awareness keeps copies in different blocks (${blocks} blocks).`
        : `Copies may share a block. Needs block awareness and at least ${MIN_BLOCKS[o.rf]} blocks.`,
    },
    {
      domain: 'Rack',
      survives: rackOk ? tol : 0,
      why: rackOk ? `Rack awareness keeps copies in different racks (${racksUsed} racks).` : `Copies may share a rack. Needs rack awareness and at least ${MIN_BLOCKS[o.rf]} racks.`,
    },
  ];
}

/** Rebuild time estimate: data to re-protect / (survivors x per-node throughput). */
export function rebuildEstimateHours(dataTB: number, survivors: number, perNodeTBph: number): number {
  if (survivors <= 0 || perNodeTBph <= 0) return Infinity;
  return dataTB / (survivors * perNodeTBph);
}
