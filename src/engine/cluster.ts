// Cluster model: nodes in blocks and racks, drives, VMs, and a representative sample
// of data items (each item is an RF replica set or an EC-X strip spread across nodes).
// Pure and deterministic: createCluster(cfg) always builds the same cluster for the same cfg.
import { makeRng, type Rng } from './rng';
import { ecStrip, blockAwareAllowed, rackAwareAllowed, ecAllowed, type Domain, type RF } from './rules';
import { placeItem, diskUsageMap } from './placement';

export type Media = 'nvme' | 'flash' | 'hybrid';
export type Tier = 'nvme' | 'ssd' | 'hdd';

export interface ClusterConfig {
  nodes: number; // 1..32
  nodesPerBlock: 1 | 2 | 4;
  racks: number; // 1..8; blocks are spread round-robin across racks
  blockAware: boolean;
  rackAware: boolean;
  rf: RF; // container replication factor
  ft: RF; // cluster redundancy factor (metadata/config copies follow this)
  ecx: boolean;
  coldPct: number; // % of data that is write-cold (EC-X candidates)
  drivesPerNode: number;
  driveTB: number;
  media: Media;
  vms: number;
  fillPct: number; // physical capacity used, % of raw
  items: number; // size of the representative data sample
  seed: number;
  locality: boolean; // illustrative switch; in AOS one replica is always written locally
  haReserve: boolean;
  nodeMemGB: number;
  cvmMemGB: number; // CVM memory reserved per node (example value, facts: CVM-1)
  vmMemLoadPct: number; // VM memory demand as % of total host memory available to VMs
  rebuildTBph: number; // per-node re-protection throughput assumption (TB/hour)
  storageOnly: number; // trailing nodes that hold data but run no VMs
}

export const DEFAULT_CONFIG: ClusterConfig = {
  nodes: 8,
  nodesPerBlock: 2,
  racks: 1,
  blockAware: false,
  rackAware: false,
  rf: 2,
  ft: 2,
  ecx: false,
  coldPct: 60,
  drivesPerNode: 6,
  driveTB: 3.84,
  media: 'flash',
  vms: 32,
  fillPct: 45,
  items: 288,
  seed: 7,
  locality: true,
  haReserve: false,
  nodeMemGB: 512,
  cvmMemGB: 32, // a typical starting point (adjustable); CVM memory grows with features. Not a product default.
  vmMemLoadPct: 55,
  rebuildTBph: 1,
  storageOnly: 0,
};

export type NodeState =
  | 'up'
  | 'down' // powered off / hardware failure
  | 'cvm-down' // CVM stopped, hypervisor and VMs keep running
  | 'isolated' // network partition from the rest of the cluster
  | 'maintenance' // LCM: host in maintenance mode, CVM down
  | 'cvm-restart' // LCM: CVM rebooting for an AOS upgrade, host up
  | 'removing' // graceful decommission in progress (still serving)
  | 'removed';

export interface SimNode {
  id: number;
  name: string;
  block: number;
  rack: number;
  state: NodeState;
  downSince: number | null;
  detached: boolean; // removed from the metadata ring after a prolonged outage
  zk: boolean; // runs a Zookeeper (cluster configuration) server
  storageOnly: boolean;
  joinedAt: number; // sim time the node joined (0 for originals)
  /** Sim time the cluster logged that this node stopped responding (null until detected). */
  detectedAt?: number | null;
  /** Sim time the node last came back after a failure (null/undefined if never down). */
  upSince?: number | null;
}

export interface SimDisk {
  id: string;
  node: number;
  idx: number;
  tier: Tier;
  capGB: number;
  state: 'ok' | 'failed';
}

export type MemberRole = 'replica' | 'data' | 'parity';

export interface Member {
  node: number;
  disk: string;
  role: MemberRole;
}

export interface DataItem {
  id: number;
  vm: number; // owning VM
  kind: 'rf' | 'ec';
  hot: boolean;
  target: number; // full member count (RF, or data+parity)
  need: number; // members required to read (1 for RF, data count for EC)
  memberGB: number; // physical size of one member
  members: Member[];
}

export type VmState = 'running' | 'restarting' | 'off' | 'failed';

export interface SimVM {
  id: number;
  name: string;
  node: number;
  memGB: number;
  state: VmState;
  restartAt: number | null;
  note?: string;
  movedAt: number | null; // last live migration (locality rebuild in progress)
}

export interface SimEvent {
  t: number;
  kind: 'failure' | 'detect' | 'ha' | 'rebuild' | 'ok' | 'info' | 'warn' | 'loss' | 'recover';
  text: string;
}

export interface Transfer {
  from: number;
  to: number;
  t: number;
  kind: 'rebuild' | 'balance' | 'localize' | 'evacuate';
}

export interface ClusterState {
  cfg: ClusterConfig;
  domain: Domain;
  time: number;
  tick: number;
  nodes: SimNode[];
  disks: SimDisk[];
  items: DataItem[];
  vms: SimVM[];
  events: SimEvent[];
  transfers: Transfer[];
  rebuild: { budgetGB: number; doneGB: number; startedAt: number | null; blocked: string | null; resyncGB?: number; balanceGB?: number };
  zkMigrations: number;
  /** HA restart queue: one record per VM a host failure took down, in restart order. */
  ha?: HaRecord[];
}

export interface HaRecord {
  vm: number;
  from: number;
  order: number;
  failedAt: number;
  dueAt: number;
  to: number | null;
  restartedAt: number | null;
  failed: boolean;
}

/** Effective placement domain after checking the minimums. */
export function effectiveDomain(cfg: ClusterConfig): Domain {
  const blocks = Math.ceil(cfg.nodes / cfg.nodesPerBlock);
  if (cfg.rackAware && rackAwareAllowed(cfg.ft, Math.min(cfg.racks, blocks), cfg.ecx).ok) return 'rack';
  if (cfg.blockAware && blockAwareAllowed(cfg.ft, blocks, cfg.ecx).ok) return 'block';
  return 'node';
}

export function blockCount(cfg: ClusterConfig): number {
  return Math.ceil(cfg.nodes / cfg.nodesPerBlock);
}

export function tiersFor(media: Media, drives: number): Tier[] {
  if (media === 'nvme') return Array(drives).fill('nvme');
  if (media === 'flash') return Array(drives).fill('ssd');
  const ssd = Math.max(2, Math.round(drives / 3));
  return [...Array(Math.min(ssd, drives)).fill('ssd'), ...Array(Math.max(0, drives - ssd)).fill('hdd')];
}

/** Normalize a config so it never violates platform rules (the UI explains each adjustment). */
export function normalizeConfig(input: Partial<ClusterConfig>): ClusterConfig {
  const c: ClusterConfig = { ...DEFAULT_CONFIG, ...input };
  c.nodes = clampInt(c.nodes, 1, 32);
  c.racks = clampInt(c.racks, 1, 8);
  c.drivesPerNode = clampInt(c.drivesPerNode, c.media === 'hybrid' ? 4 : 2, 24);
  c.storageOnly = clampInt(c.storageOnly, 0, Math.max(0, c.nodes - 1));
  if (c.ft === 3 && c.nodes < 5) c.ft = 2;
  if (c.rf === 3 && c.ft !== 3) c.rf = 2; // RF3 containers need a redundancy-factor-3 cluster
  if (c.ecx && !ecAllowed(c.rf, c.nodes).ok) c.ecx = false;
  c.coldPct = clampInt(c.coldPct, 0, 100);
  c.fillPct = clampInt(c.fillPct, 1, 95);
  c.vmMemLoadPct = clampInt(c.vmMemLoadPct, 0, 100);
  return c;
}

function clampInt(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));
}

/** Total raw capacity in GB. */
export function rawGB(cfg: ClusterConfig): number {
  return cfg.nodes * cfg.drivesPerNode * cfg.driveTB * 1000;
}

export function createCluster(input: Partial<ClusterConfig>): ClusterState {
  const cfg = normalizeConfig(input);
  const rng = makeRng(cfg.seed);
  const domain = effectiveDomain(cfg);
  const nodes: SimNode[] = [];
  const disks: SimDisk[] = [];
  for (let i = 0; i < cfg.nodes; i++) {
    nodes.push(makeNode(cfg, i, 0));
    disks.push(...makeDisks(cfg, i));
  }
  assignZookeeper(nodes, cfg.ft, domain);

  const vms = makeVms(cfg, nodes, rng);
  const state: ClusterState = {
    cfg,
    domain,
    time: 0,
    tick: 0,
    nodes,
    disks,
    items: [],
    vms,
    events: [],
    transfers: [],
    rebuild: { budgetGB: 0, doneGB: 0, startedAt: null, blocked: null },
    zkMigrations: 0,
  };
  state.items = makeItems(state, rng);
  return state;
}

export function makeNode(cfg: ClusterConfig, i: number, t: number): SimNode {
  const block = Math.floor(i / cfg.nodesPerBlock);
  return {
    id: i,
    name: `N${i + 1}`,
    block,
    rack: block % cfg.racks,
    state: 'up',
    downSince: null,
    detached: false,
    zk: false,
    storageOnly: i >= cfg.nodes - cfg.storageOnly,
    joinedAt: t,
  };
}

export function makeDisks(cfg: ClusterConfig, node: number): SimDisk[] {
  return tiersFor(cfg.media, cfg.drivesPerNode).map((tier, idx) => ({
    id: `${node}.${idx}`,
    node,
    idx,
    tier,
    capGB: cfg.driveTB * 1000,
    state: 'ok' as const,
  }));
}

/** Zookeeper servers on distinct nodes, spread across domains where possible. */
export function assignZookeeper(nodes: SimNode[], ft: RF, domain: Domain) {
  const want = Math.min(ft === 3 ? 5 : 3, nodes.filter((n) => n.state !== 'removed').length);
  nodes.forEach((n) => (n.zk = false));
  const chosen: SimNode[] = [];
  const key = (n: SimNode) => (domain === 'rack' ? n.rack : domain === 'block' ? n.block : n.id);
  const live = nodes.filter((n) => n.state === 'up');
  for (const n of live) {
    if (chosen.length >= want) break;
    if (!chosen.some((c) => key(c) === key(n))) chosen.push(n);
  }
  for (const n of live) {
    if (chosen.length >= want) break;
    if (!chosen.includes(n)) chosen.push(n);
  }
  chosen.forEach((n) => (n.zk = true));
}

function makeVms(cfg: ClusterConfig, nodes: SimNode[], rng: Rng): SimVM[] {
  const compute = nodes.filter((n) => !n.storageOnly);
  const hostMem = cfg.nodeMemGB - cfg.cvmMemGB;
  const totalDemand = (hostMem * compute.length * cfg.vmMemLoadPct) / 100;
  const n = Math.max(0, cfg.vms);
  const weights = Array.from({ length: n }, () => 0.5 + rng());
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const vms: SimVM[] = [];
  for (let i = 0; i < n; i++) {
    const node = compute.length ? compute[i % compute.length].id : 0;
    const memGB = Math.max(2, Math.round((totalDemand * weights[i]) / wsum));
    vms.push({ id: i, name: `VM${i + 1}`, node, memGB, state: 'running', restartAt: null, movedAt: null });
  }
  return vms;
}

function makeItems(state: ClusterState, rng: Rng): DataItem[] {
  const { cfg } = state;
  const items: DataItem[] = [];
  const usage = diskUsageMap(state);
  const physicalGB = (rawGB(cfg) * cfg.fillPct) / 100;
  // With block or rack awareness, a strip must fit one-per-domain with a spare domain to
  // rebuild into, so its width follows the domain count (facts: FD-1, EC-2).
  const domains = state.domain === 'rack' ? Math.min(cfg.racks, blockCount(cfg)) : state.domain === 'block' ? blockCount(cfg) : cfg.nodes;
  const strip = cfg.ecx ? ecStrip(domains, cfg.rf) : null;
  const count = Math.max(1, cfg.items);
  // Decide which items are cold and EC-encoded, then size every item so the
  // sample's physical footprint equals the configured fill.
  const plan = Array.from({ length: count }, () => {
    const cold = rng() * 100 < cfg.coldPct;
    return { cold, ec: !!strip && cold };
  });
  const overheadSum = plan.reduce((s, p) => s + (p.ec && strip ? (strip.data + strip.parity) / strip.data : cfg.rf), 0);
  const logicalPerItem = physicalGB / overheadSum;
  const vmCount = Math.max(1, state.vms.length);
  for (let i = 0; i < count; i++) {
    const p = plan[i];
    const vm = state.vms.length ? state.vms[i % vmCount] : null;
    const owner = vm ? vm.node : i % cfg.nodes;
    const item: DataItem =
      p.ec && strip
        ? {
            id: i,
            vm: vm ? vm.id : -1,
            kind: 'ec',
            hot: false,
            target: strip.data + strip.parity,
            need: strip.data,
            memberGB: logicalPerItem / strip.data,
            members: [],
          }
        : {
            id: i,
            vm: vm ? vm.id : -1,
            kind: 'rf',
            hot: !p.cold,
            target: cfg.rf,
            need: 1,
            memberGB: logicalPerItem,
            members: [],
          };
    item.members = placeItem(state, item, owner, rng, usage);
    items.push(item);
  }
  return items;
}
