// Edge & ROBO scenarios: what a 1-, 2- or 3-node cluster does when something happens, as a
// sequence of moments the module plays on a loop. Sources: docs/facts.md EDGE-1..3 and
// EDGE-4..6, docs/research/C-lcm-networking.md item 6. Kept conservative: only behavior traced
// to those notes is stated; anything else is left out or tagged.

export type Size = '1' | '2' | '3';
export type EventId = 'drive' | 'node' | 'peer' | 'wan' | 'upgrade' | 'expand';
export type Tone = 'ok' | 'warn' | 'bad';

export interface Step {
  /** A few words naming the moment (caption heading and play bar). */
  k: string;
  text: string;
  tone: Tone | 'ink';
  /** Nodes that are down (unplanned) or out for a planned upgrade. */
  down?: number[];
  planned?: boolean;
  /** Nodes still powered on but cut off from the cluster, and the word shown on them. */
  cut?: number[];
  cutWord?: string;
  /** The VMs on cut-off nodes are stopped, so no VM ever runs in two places. */
  fenced?: boolean;
  /** The node being added (expand only): arriving, refused, joined, or a separate new cluster. */
  extra?: 'new' | 'blocked' | 'joined' | 'cluster';
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
  { id: 'peer', label: 'Nodes lose contact', tip: 'The network between the nodes breaks while every node keeps running.' },
  { id: 'wan', label: 'Link to the data center drops', tip: 'The site loses its connection to the data center where Prism Central (and, for two nodes, the Witness) runs.' },
  { id: 'upgrade', label: 'Planned upgrade', tip: 'LCM upgrades AOS and AHV at the site.' },
  { id: 'expand', label: 'Add a node', tip: 'The site needs more room, so one more node arrives.' },
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
    expand: [
      { k: 'A node arrives', text: 'The site needs more room, so a second node arrives.', tone: 'ink', extra: 'new' },
      { k: 'It can’t join', text: 'A single-node cluster can’t be expanded. Adding a node to it is not supported, so the new node can’t simply join.', tone: 'bad', extra: 'blocked', illus: 'From Nutanix community answers and the expansion error AOS shows; check the Expanding a Cluster guide for your release.' },
      { k: 'Build a new cluster', text: 'The way forward is a new cluster on the new hardware. Replicate the VMs to it, for example with Nutanix disaster recovery, then move the site over.', tone: 'warn', extra: 'cluster', heal: [[0, 1]] },
      { k: 'Reuse the old node', text: 'Once the VMs run on the new cluster, the old node is re-imaged and added to it as one more node.', tone: 'ok', extra: 'cluster', vmsTo: [1] },
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
      { k: 'Nodes lose contact', text: 'The link between N1 and N2 breaks. Both nodes are still running, and neither can tell whether the other has failed.', tone: 'warn', peer: true },
      { k: 'Witness decides', text: 'Both nodes ask the Witness for the leadership lock. Whichever gets it carries on, so only one node ever serves the data.', tone: 'warn', peer: true, ask: true, illus: 'Simplified from Nutanix’s two-node failure guidance. Here N1 gets the lock; which node wins depends on which asks first and can still reach the Witness.' },
      { k: 'N1 carries on', text: 'N1 switches to single-node mode. N2 shuts down its services and waits, and HA restarts N2’s VMs on N1.', tone: 'warn', peer: true, cut: [1], cutWord: 'waiting', fenced: true, vmsTo: [0], mode: 'Single-node mode' },
      { k: 'Link back', text: 'When the link returns, N2 comes back the same way as after a node failure: about 15 minutes of steady heartbeat, then a resync to two-node mode.', tone: 'warn', vmsTo: [0], mode: 'Resyncing', heal: [[0, 1]] },
      { k: 'Two-node mode', text: 'After the resync the cluster is back in two-node mode with resiliency OK.', tone: 'ok', vmsTo: [0], mode: 'Two-node mode' },
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
    expand: [
      { k: 'A node arrives', text: 'A third node arrives. It is imaged first with the same AOS and AHV versions as the cluster.', tone: 'ink', extra: 'new', mode: 'Two-node mode' },
      { k: 'Expand Cluster', text: 'From AOS 7.6, a two-node AHV cluster can grow to three: Expand Cluster in Prism adds the node as a full HCI node, and the VMs keep running.', tone: 'ink', extra: 'new', mode: 'Adding N3', illus: 'AOS 7.6 release notes, plus a hands-on walkthrough for the steps. Earlier releases could not expand a two-node cluster.' },
      { k: 'Three-node cluster', text: 'N3 joins and the site is now a standard three-node cluster. A node failure is handled by the other two, without single-node mode.', tone: 'ok', extra: 'joined', mode: 'Three-node cluster' },
      { k: 'One way', text: 'The change is one way: a three-node cluster can’t go back to two nodes.', tone: 'ok', extra: 'joined', mode: 'Three-node cluster', illus: 'From a hands-on walkthrough of AOS 7.6, not Nutanix documentation.' },
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
    peer: [
      { k: 'N1 cut off', text: 'N1 loses its network link to N2 and N3, but it is still powered on and running its VMs.', tone: 'warn', peer: true, cut: [0] },
      { k: 'Majority carries on', text: 'N2 and N3 are the majority, so they keep the cluster running. They block N1’s storage I/O, so its VMs stop: a VM never runs in two places at once.', tone: 'warn', peer: true, cut: [0], fenced: true },
      { k: 'HA restarts', text: 'About two minutes in, HA restarts N1’s VMs on N2 and N3, and they start re-creating N1’s data copies between them right away.', tone: 'warn', peer: true, cut: [0], fenced: true, vmsTo: [1, 2], heal: [[1, 2], [2, 1]], illus: 'Timings from the Nutanix Bible’s network-partition example: I/O blocked at about 60 seconds, VMs restarted at about 120.' },
      { k: 'Link back', text: 'When the link is back and N1 has been stable for a while, it rejoins the cluster on its own and its capacity is used again.', tone: 'ok', vmsTo: [1, 2] },
    ],
    expand: [
      { k: 'A node arrives', text: 'A fourth node arrives, imaged with the cluster’s AOS and AHV versions.', tone: 'ink', extra: 'new' },
      { k: 'Expand Cluster', text: 'Expand Cluster in Prism adds it, the same way any Nutanix cluster grows, and the VMs keep running.', tone: 'ink', extra: 'new' },
      { k: 'Four nodes', text: 'N4 joins. The cluster now has more room for VMs and data, and more spare capacity to re-protect data after a failure.', tone: 'ok', extra: 'joined' },
    ],
  },
};

/** Whether an event applies to a site size. */
export const applies = (s: Size, e: EventId) => !!SCENARIOS[s][e];

/** The moments to play for a size and event, starting from the healthy site. */
export function stepsFor(s: Size, e: EventId): Step[] {
  return [HEALTHY[s], ...(SCENARIOS[s][e] ?? [])];
}

export const MATRIX: { ev: EventId; row: string; cells: Record<Size, { tone: Tone | 'na'; text: string; word?: string }> }[] = [
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
      '1': { tone: 'na', text: 'A single node has no other node to lose contact with' },
      '2': { tone: 'warn', text: 'The Witness picks one node to carry on; the other waits' },
      '3': { tone: 'ok', text: 'The two connected nodes carry on; HA restarts the cut-off node’s VMs' },
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
  {
    ev: 'expand',
    row: 'Add a node',
    cells: {
      '1': { tone: 'bad', word: 'Not supported', text: 'Can’t be expanded; build a new cluster and move the VMs' },
      '2': { tone: 'ok', word: 'Supported', text: 'Grows to three nodes from AOS 7.6 on AHV; one way' },
      '3': { tone: 'ok', word: 'Supported', text: 'Standard Expand Cluster' },
    },
  },
];
