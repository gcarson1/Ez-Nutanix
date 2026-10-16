// Shared cluster scenario, read from and written to the URL hash so every cluster-based
// module (Cluster Lab, Protection & Capacity, Failure Gauntlet, LCM) shows the same setup
// and a presenter can send a link to it. Defaults are never written to the URL.
import { DEFAULT_CONFIG, normalizeConfig, type ClusterConfig, type Media } from '../engine/cluster';
import { useBool, useEnum, useNum, useRoute, setParams } from './route';
import type { RF } from '../engine/rules';

/** URL key for each cluster setting. */
export const KEYS = {
  nodes: 'nodes',
  nodesPerBlock: 'npb',
  racks: 'racks',
  blockAware: 'ba',
  rackAware: 'ra',
  rf: 'rf',
  ft: 'ft',
  ecx: 'ecx',
  coldPct: 'cold',
  drivesPerNode: 'drives',
  driveTB: 'tb',
  media: 'media',
  vms: 'vms',
  fillPct: 'fill',
  seed: 'seed',
  locality: 'loc',
  haReserve: 'ha',
  vmMemLoadPct: 'mem',
  rebuildTBph: 'rtb',
  storageOnly: 'so',
} as const;

export type ScenarioPatch = Partial<Record<keyof typeof KEYS, number | boolean | string>>;

export function useScenario(): { cfg: ClusterConfig; set: (patch: Partial<ClusterConfig>) => void } {
  useRoute();
  const D = DEFAULT_CONFIG;
  const [nodes] = useNum(KEYS.nodes, D.nodes, 1, 32);
  const [npb] = useNum(KEYS.nodesPerBlock, D.nodesPerBlock, 1, 4);
  const [racks] = useNum(KEYS.racks, D.racks, 1, 8);
  const [ba] = useBool(KEYS.blockAware, D.blockAware);
  const [ra] = useBool(KEYS.rackAware, D.rackAware);
  const [rf] = useNum(KEYS.rf, D.rf, 2, 3);
  const [ft] = useNum(KEYS.ft, D.ft, 2, 3);
  const [ecx] = useBool(KEYS.ecx, D.ecx);
  const [cold] = useNum(KEYS.coldPct, D.coldPct, 0, 100);
  const [drives] = useNum(KEYS.drivesPerNode, D.drivesPerNode, 2, 24);
  const [tb] = useNum(KEYS.driveTB, D.driveTB, 0.48, 30.72);
  const [media] = useEnum<Media>(KEYS.media, D.media, ['nvme', 'flash', 'hybrid']);
  const [vms] = useNum(KEYS.vms, D.vms, 0, 200);
  const [fill] = useNum(KEYS.fillPct, D.fillPct, 1, 95);
  const [seed] = useNum(KEYS.seed, D.seed, 0, 1e9);
  const [loc] = useBool(KEYS.locality, D.locality);
  const [ha] = useBool(KEYS.haReserve, D.haReserve);
  const [mem] = useNum(KEYS.vmMemLoadPct, D.vmMemLoadPct, 0, 100);
  const [rtb] = useNum(KEYS.rebuildTBph, D.rebuildTBph, 0.1, 10);
  const [so] = useNum(KEYS.storageOnly, D.storageOnly, 0, 31);
  const cfg = normalizeConfig({
    nodes,
    nodesPerBlock: (npb === 4 ? 4 : npb === 2 ? 2 : 1) as 1 | 2 | 4,
    racks,
    blockAware: ba,
    rackAware: ra,
    rf: rf as RF,
    ft: ft as RF,
    ecx,
    coldPct: cold,
    drivesPerNode: drives,
    driveTB: tb,
    media,
    vms,
    fillPct: fill,
    seed,
    locality: loc,
    haReserve: ha,
    vmMemLoadPct: mem,
    rebuildTBph: rtb,
    storageOnly: so,
  });
  return { cfg, set: setScenario };
}

/** Write cluster settings to the URL (defaults are removed so links stay short). */
export function setScenario(patch: Partial<ClusterConfig>) {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(patch) as [keyof ClusterConfig, unknown][]) {
    const key = (KEYS as Record<string, string>)[k];
    if (!key) continue;
    out[key] = v === (DEFAULT_CONFIG as unknown as Record<string, unknown>)[k] ? null : (v as string | number | boolean);
  }
  setParams(out);
}

export interface Preset {
  id: string;
  label: string;
  cfg: Partial<ClusterConfig>;
  /** Module to open for this preset (DR pair opens the DR module). */
  path?: string;
  params?: Record<string, string>;
}

export const PRESETS: Preset[] = [
  { id: 'edge3', label: '3-node edge (RF2)', cfg: { nodes: 3, nodesPerBlock: 1, rf: 2, ft: 2, vms: 12, drivesPerNode: 4 } },
  { id: 'start4', label: '4-node starter (RF2)', cfg: { nodes: 4, nodesPerBlock: 4, rf: 2, ft: 2, vms: 16 } },
  { id: 'prod8', label: '8-node production (RF2, block-aware)', cfg: { nodes: 8, nodesPerBlock: 2, blockAware: true, rf: 2, ft: 2, vms: 32 } },
  { id: 'rf3ec12', label: '12-node RF3 + EC-X', cfg: { nodes: 12, nodesPerBlock: 2, rf: 3, ft: 3, ecx: true, vms: 48 } },
  { id: 'dr2', label: 'Two-site DR pair', cfg: {}, path: 'nci/dr', params: { preset: 'pair' } },
];

/** Every cluster key, mapped to null: used by Reset and before applying a preset. */
export function clearedScenario(): Record<string, null> {
  return Object.fromEntries(Object.values(KEYS).map((k) => [k, null]));
}
