// Edge & ROBO scenarios: what a 1-, 2- or 3-node cluster does when something happens, as a
// sequence of moments the module plays on a loop. Sources: docs/facts.md EDGE-1..3,
// docs/research/C-lcm-networking.md item 6. Kept conservative: only behavior traced to those
// notes is stated; anything else is left out or tagged.

export type Size = '1' | '2' | '3';
export type EventId = 'drive' | 'node' | 'peer' | 'wan' | 'upgrade';
export type Tone = 'ok' | 'warn' | 'bad';

export interface Step {
  /** A few words naming the moment (caption heading and play bar). */
  k: string;
  text: string;
  tone: Tone | 'ink';
  /** Nodes that are down (unplanned) or out for a planned upgrade. */
  down?: number[];
  planned?: boolean;
  disk?: [number, number];
  wan?: boolean;
  peer?: boolean;
  /** VMs of a down node now run on these nodes (shared out in turn). */
  vmsTo?: number[];
  vmsOff?: boolean;
  mode?: string;
  /** Copies being re-created, as [from node, to node]; the same node means between its own drives. */
  heal?: [number, number][];
  /** The Witness is being asked which node carries on. */
  ask?: boolean;
  illus?: string;
}

export const EVENTS: { id: EventId; label: string; tip: string }[] = [
  { id: 'drive', label: 'Drive fails', tip: 'One drive in a node stops working.' },
  { id: 'node', label: 'Node fails', tip: 'A whole node goes down: power, motherboard or similar.' },
  { id: 'peer', label: 'Nodes lose contact', tip: 'The link between the two nodes of a two-node cluster breaks while both keep running.' },
  { id: 'wan', label: 'Link to the data center drops', tip: 'The site loses its connection to the data center where Prism Central (and, for two nodes, the Witness) runs.' },
  { id: 'upgrade', label: 'Planned upgrade', tip: 'LCM upgrades AOS and AHV at the site.' },
];

export const SIZES: { id: Size; label: string; nodes: number }[] = [
  { id: '1', label: '1 node', nodes: 1 },
  { id: '2', label: '2 nodes + Witness', nodes: 2 },
  { id: '3', label: '3 nodes', nodes: 3 },
];

/** The first moment of every scenario: the site as it runs normally. */
const HEALTHY: Record<Size, Step> = {
  '1': { k: 'Healthy site', text: 'One node runs every VM at the site. Prism Central in the data center watches it over the WAN.', tone: 'ok' },
  '2': { k: 'Healthy site', text: 'Two nodes share the VMs and each holds a copy of all data. A small Witness VM in the data center breaks ties.', tone: 'ok', mode: 'Two-node mode' },
  '3': { k: 'Healthy site', text: 'Three nodes share the VMs and keep two copies of all data, on different nodes.', tone: 'ok' },
};

const WAN_STEPS = (extra: Step[] = []): Step[] => [
  { k: 'Link drops', text: 'The WAN link to the data center drops.', tone: 'warn', wan: true },
  { k: 'Site keeps running', text: 'The cluster keeps running its VMs and can still be managed locally in Prism Element. Central monitoring waits for the link.', tone: 'ok', wan: true },
  ...extra,
  { k: 'Link back', text: 'When the link is back, Prism Central sees the site again.', tone: 'ok' },
];

const SCENARIOS: Record<Size, Partial<Record<EventId, Step[]>>> = {
  '1': {
    drive: [
      { k: 'Drive fails', text: 'A drive in the node fails.', tone: 'warn', disk: [0, 1] },
      { k: 'Rebuild inside the node', text: 'Data copies are kept on different drives in the node, so the lost copies are rebuilt onto the remaining drives, if there is free capacity.', tone: 'warn', disk: [0, 1], heal: [[0, 0]] },
      { k: 'If it was an SSD', text: 'If the failed drive is an SSD, the cluster can go read-only until it is replaced.', tone: 'bad', disk: [0, 1] },
      { k: 'Drive replaced', text: 'Replace the drive and protection is back to normal.', tone: 'ok' },
    ],
    node: [
      { k: 'Node fails', text: 'The node fails.', tone: 'bad', down: [0] },
      { k: 'Site down', text: 'Every VM at the site stops. There is no second node to restart them on.', tone: 'bad', down: [0], vmsOff: true },
      { k: 'Recover', text: 'Recover by repairing the node, or from a backup or replica elsewhere. Nutanix guidance limits async from a single node to a 6-hour RPO.', tone: 'bad', down: [0], vmsOff: true },
    ],
    wan: WAN_STEPS(),
    upgrade: [
      { k: 'VMs shut down first', text: 'LCM can upgrade AOS and AHV, but first you shut down every guest VM.', tone: 'warn', vmsOff: true },
      { k: 'Storage offline', text: 'The only CVM and host go down, so storage is offline during the upgrade.', tone: 'bad', down: [0], planned: true, vmsOff: true },
      { k: 'Firmware by hand', text: 'LCM does not upgrade firmware on a single node; that is done manually.', tone: 'warn', vmsOff: true },
      { k: 'VMs back', text: 'The node comes back and you start the VMs again.', tone: 'ok' },
    ],
  },
  '2': {
    drive: [
      { k: 'Drive fails', text: 'A drive fails on N1.', tone: 'warn', disk: [0, 1] },
      { k: 'Copy on the other node', text: 'Every piece of data also has a copy on N2: data is kept as two copies, one per node, and metadata as four copies across both.', tone: 'warn', disk: [0, 1] },
      { k: 'Rebuilt', text: 'The lost copies are rebuilt if there is free capacity. Replace the drive to restore full capacity.', tone: 'ok', disk: [0, 1], heal: [[1, 0]] },
    ],
    node: [
      { k: 'Node fails', text: 'N1 fails.', tone: 'bad', down: [0] },
      { k: 'Single-node mode', text: 'Within about 30 to 60 seconds N2 switches to single-node mode. Guest disk timeouts of at least 60 seconds let VMs ride through the switch.', tone: 'warn', down: [0], mode: 'Single-node mode' },
      { k: 'HA restarts', text: 'HA restarts N1’s VMs on N2. N1 is detached from the metadata ring.', tone: 'warn', down: [0], vmsTo: [1], mode: 'Single-node mode' },
      { k: 'Re-protect on one node', text: 'N2 keeps two copies of the data on different drives of its own, if it has room. That is why a two-node site is sized to run on one node, with disk and memory at about 40% or less.', tone: 'warn', down: [0], vmsTo: [1], mode: 'Single-node mode', heal: [[1, 1]] },
      { k: 'N1 repaired', text: 'N1 is repaired. After about 15 minutes of steady heartbeat, the cluster starts resyncing back to two-node mode.', tone: 'warn', vmsTo: [1], mode: 'Resyncing', heal: [[1, 0]] },
      { k: 'Two-node mode', text: 'The resync can take hours, depending on how much data changed. Then the cluster is back in two-node mode with resiliency OK.', tone: 'ok', vmsTo: [1], mode: 'Two-node mode' },
    ],
    peer: [
      { k: 'Nodes lose contact', text: 'The two nodes lose contact with each other, but both are still running.', tone: 'warn', peer: true },
      { k: 'Witness decides', text: 'Neither node can tell whether the other has failed. The Witness, at a separate site, arbitrates so that only one node carries on serving data.', tone: 'warn', peer: true, ask: true, illus: 'Simplified. Exact outcomes depend on which node can still reach the Witness; see the two-node failure guidance in Nutanix documentation.' },
      { k: 'Single-node mode', text: 'That node carries on in single-node mode.', tone: 'warn', peer: true, mode: 'Single-node mode' },
      { k: 'Back to two nodes', text: 'When the link returns, the cluster resyncs and returns to two-node mode.', tone: 'ok', mode: 'Two-node mode' },
    ],
    wan: WAN_STEPS([
      { k: 'Witness out of reach', text: 'The Witness is out of reach too. If a node failed now, automatic failover may not be possible, and maintenance such as LCM waits for the Witness.', tone: 'warn', wan: true },
    ]),
    upgrade: [
      { k: 'Rolling upgrade', text: 'LCM upgrades one node at a time and the cluster stays up. It needs a registered Witness.', tone: 'ok', mode: 'Two-node mode' },
      { k: 'One node at a time', text: 'While a node is upgrading, its VMs move live to the other node, which runs the site in single-node mode.', tone: 'warn', down: [0], planned: true, vmsTo: [1], mode: 'Single-node mode' },
      { k: 'Resync', text: 'Each node takes longer than on a larger cluster, because data resyncs every time the cluster moves between single-node and two-node mode.', tone: 'warn', mode: 'Resyncing', heal: [[1, 0]] },
      { k: 'Done', text: 'Done, with the VMs running the whole time.', tone: 'ok', mode: 'Two-node mode' },
    ],
  },
  '3': {
    drive: [
      { k: 'Drive fails', text: 'A drive fails on N1.', tone: 'warn', disk: [0, 1] },
      { k: 'Rebuild across nodes', text: 'Its data has copies on other nodes. Both other nodes rebuild the missing copies in parallel.', tone: 'warn', disk: [0, 1], heal: [[1, 0], [2, 0]] },
      { k: 'Protected again', text: 'Data is fully protected again, often before the drive is replaced, as long as there is free capacity.', tone: 'ok', disk: [0, 1] },
    ],
    node: [
      { k: 'Node fails', text: 'N1 fails.', tone: 'bad', down: [0] },
      { k: 'HA restarts', text: 'HA restarts its VMs on N2 and N3.', tone: 'warn', down: [0], vmsTo: [1, 2] },
      { k: 'Re-protect', text: 'N2 and N3 re-create the missing copies between them, if there is room. Size for N+1 so they can.', tone: 'warn', down: [0], vmsTo: [1, 2], heal: [[1, 2], [2, 1]] },
      { k: 'Protected again', text: 'Data is fully protected again. Repair or replace N1 to get the spare capacity back.', tone: 'ok', down: [0], vmsTo: [1, 2] },
    ],
    wan: WAN_STEPS(),
    upgrade: [
      { k: 'Pre-checks', text: 'LCM checks that data resiliency is OK, then works on one node at a time.', tone: 'ok' },
      { k: 'VMs move off', text: 'VMs move live off each node before it goes into maintenance mode. With RF2 there is no spare fault tolerance while that node is out.', tone: 'warn', down: [0], planned: true, vmsTo: [1, 2] },
      { k: 'Next node', text: 'The node comes back, data resyncs, and only then does LCM move to the next node. No VM downtime.', tone: 'ok', heal: [[1, 0], [2, 0]] },
    ],
  },
};

/** Whether an event applies to a site size. */
export const applies = (s: Size, e: EventId) => !!SCENARIOS[s][e];

/** The moments to play for a size and event, starting from the healthy site. */
export function stepsFor(s: Size, e: EventId): Step[] {
  return [HEALTHY[s], ...(SCENARIOS[s][e] ?? [])];
}

export const MATRIX: { ev: EventId; row: string; cells: Record<Size, { tone: Tone | 'na'; text: string }> }[] = [
  {
    ev: 'drive',
    row: 'Drive failure',
    cells: {
      '1': { tone: 'warn', text: 'Rebuilds inside the node; an SSD failure can make it read-only' },
      '2': { tone: 'ok', text: 'Copy on the other node; rebuilds' },
      '3': { tone: 'ok', text: 'Rebuilds across the other nodes' },
    },
  },
  {
    ev: 'node',
    row: 'Node failure',
    cells: {
      '1': { tone: 'bad', text: 'Site down until repaired or recovered' },
      '2': { tone: 'warn', text: 'Keeps running on one node; slow return to two-node mode' },
      '3': { tone: 'ok', text: 'Keeps running and re-protects data' },
    },
  },
  {
    ev: 'peer',
    row: 'Nodes lose contact',
    cells: {
      '1': { tone: 'na', text: 'Not applicable' },
      '2': { tone: 'warn', text: 'Witness arbitrates; one node carries on' },
      '3': { tone: 'na', text: 'Not shown here' },
    },
  },
  {
    ev: 'wan',
    row: 'Link to the data center lost',
    cells: {
      '1': { tone: 'ok', text: 'Keeps running locally' },
      '2': { tone: 'ok', text: 'Keeps running; Witness out of reach' },
      '3': { tone: 'ok', text: 'Keeps running locally' },
    },
  },
  {
    ev: 'upgrade',
    row: 'Upgrade (AOS, AHV)',
    cells: {
      '1': { tone: 'bad', text: 'Guest VMs shut down first; no firmware via LCM' },
      '2': { tone: 'ok', text: 'Stays up; slower; Witness required' },
      '3': { tone: 'ok', text: 'Rolling, no VM downtime' },
    },
  },
];
