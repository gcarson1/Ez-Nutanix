// Capacity-check gates for online protection changes: converting RF2 to RF3, and enabling
// erasure coding (EC-X). Both are online operations, but they run as background work and
// change how much physical space the same data needs, so the UI checks before allowing them.
// Built on computeCapacity (capacity.ts) so the math stays in one place.
import { computeCapacity, type CapacityInput } from './capacity';
import { ecAllowed, rfAllowed, type RF } from './rules';

export interface GateResult {
  ok: boolean;
  /** Logical data stored today, TB (before data reduction). */
  logicalTB: number;
  /** Physical space that data uses today, TB. */
  usedNowTB: number;
  /** Physical space the same data needs after the change, TB. */
  usedAfterTB: number;
  /** Physical space available for data after the change while keeping the rebuild reserve, TB. */
  limitTB: number;
  /** Blended overhead before and after (physical / logical). */
  overheadNow: number;
  overheadAfter: number;
  reasons: string[];
}

export interface GateInput extends CapacityInput {
  /** Physical space used today, % of raw. */
  fillPct: number;
}

/** Physical TB available to data while keeping the rebuild reserve (raw - system - reserve). */
export function physicalLimitTB(input: CapacityInput): number {
  const c = computeCapacity(input);
  return Math.max(0, c.rawTB - c.systemTB - c.reserveTB);
}

function gate(now: GateInput, after: CapacityInput, extra: string[]): GateResult {
  const cNow = computeCapacity(now);
  const cAfter = computeCapacity(after);
  const usedNowTB = (cNow.rawTB * Math.min(100, Math.max(0, now.fillPct))) / 100;
  const logicalTB = usedNowTB / cNow.blendedOverhead;
  const usedAfterTB = logicalTB * cAfter.blendedOverhead;
  const limitTB = physicalLimitTB(after);
  const reasons = [...extra];
  if (usedAfterTB > limitTB + 1e-9) {
    reasons.push(`After the change this data needs ${usedAfterTB.toFixed(1)} TB of physical space, but only ${limitTB.toFixed(1)} TB is available while keeping the rebuild reserve. Add nodes or free space first.`);
  }
  return {
    ok: reasons.length === 0,
    logicalTB,
    usedNowTB,
    usedAfterTB,
    limitTB,
    overheadNow: cNow.blendedOverhead,
    overheadAfter: cAfter.blendedOverhead,
    reasons,
  };
}

/** Converting a container (and the cluster redundancy factor) from RF2 to RF3. */
export function rf3ConversionGate(input: GateInput): GateResult {
  const extra: string[] = [];
  const allowed = rfAllowed(3, input.nodes);
  if (!allowed.ok) extra.push(allowed.reason!);
  const after: CapacityInput = { ...input, rf: 3 as RF, ecx: input.ecx && ecAllowed(3, input.nodes).ok };
  if (input.ecx && !after.ecx) extra.push(ecAllowed(3, input.nodes).reason! + ' EC-X would have to be turned off for the RF3 container.');
  return gate({ ...input, rf: 2 }, after, extra);
}

/** Enabling EC-X on a container at its current RF. */
export function ecxEnableGate(input: GateInput): GateResult {
  const extra: string[] = [];
  const allowed = ecAllowed(input.rf, input.nodes);
  if (!allowed.ok) extra.push(allowed.reason!);
  const now = { ...input, ecx: false };
  const res = gate(now, { ...input, ecx: allowed.ok }, extra);
  // Encoding is post-process background work: today's data must already fit with the reserve.
  const limitNow = physicalLimitTB(now);
  if (res.usedNowTB > limitNow + 1e-9) {
    res.reasons.push(`The cluster already uses ${res.usedNowTB.toFixed(1)} TB, more than the ${limitNow.toFixed(1)} TB that keeps the rebuild reserve. Savings from EC-X arrive gradually as data turns cold, so free space or add nodes first.`);
    res.ok = false;
  }
  return res;
}

