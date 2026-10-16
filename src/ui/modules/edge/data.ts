// Edge & ROBO scenarios: what a 1-, 2- or 3-node cluster does when something happens, step by step.
// Sources: docs/facts.md EDGE-1..3, docs/research/C-lcm-networking.md item 6. Kept conservative:
// only behavior traced to those notes is stated; anything else is left out or tagged.

export type Size = '1' | '2' | '3';
export type EventId = 'drive' | 'node' | 'peer' | 'wan' | 'upgrade';
export type Tone = 'ok' | 'warn' | 'bad';

export interface Step {
  text: string;
  tone: Tone;
  /** Nodes that are down (unplanned) or out for a planned upgrade. */
  down?: number[];
  planned?: boolean;
  disk?: [number, number];
  wan?: boolean;
  peer?: boolean;
  /** VMs of a failed node are now running on this node. */
  vmsTo?: number;
  vmsOff?: boolean;
  mode?: string;
  illus?: string;
}

export const EVENTS: { id: EventId; label: string; tip: string }[] = [
  { id: 'drive', label: 'Drive fails', tip: 'One drive in a node stops working.' },
  { id: 'node', label: 'Node fails', tip: 'A whole node goes down: power, motherboard or similar.' },
  { id: 'peer', label: 'Nodes lose contact', tip: 'The link between the two nodes of a two-node cluster breaks while both keep running.' },
  { id: 'wan', label: 'WAN link lost', tip: 'The site loses its connection to the data center where Prism Central (and, for two nodes, the Witness) runs.' },
  { id: 'upgrade', label: 'Planned upgrade', tip: 'LCM upgrades AOS and AHV at the site.' },
];

export const SIZES: { id: Size; label: string; nodes: number }[] = [
  { id: '1', label: '1 node', nodes: 1 },
  { id: '2', label: '2 nodes + Witness', nodes: 2 },
  { id: '3', label: '3 nodes', nodes: 3 },
];

const WAN_STEPS = (extra: Step[] = []): Step[] => [
  { text: 'The WAN link to the data center drops.', tone: 'warn', wan: true },
  { text: 'The cluster keeps running its VMs. Prism Element runs on the cluster itself, so local management still works.', tone: 'ok', wan: true },
  { text: 'Central monitoring and fleet operations for this site wait until the link is back.', tone: 'warn', wan: true },
  ...extra,
];

export const STEPS: Record<Size, Partial<Record<EventId, Step[]>>> = {
  '1': {
    drive: [
      { text: 'A drive fails.', tone: 'warn', disk: [0, 1] },
      { text: 'Data copies are kept on different drives in the node, so the lost copies can be rebuilt onto the remaining drives if there is free capacity.', tone: 'warn', disk: [0, 1] },
      { text: 'If the failed drive is an SSD, the cluster can go read-only until it is replaced.', tone: 'bad', disk: [0, 1] },
      { text: 'Replace the drive and protection is back to normal.', tone: 'ok' },
    ],
    node: [
      { text: 'The node fails.', tone: 'bad', down: [0] },
      { text: 'Every VM at the site stops. There is no second node to restart them on.', tone: 'bad', down: [0], vmsOff: true },
      { text: 'Recover by repairing the node, or from a backup or replica elsewhere. Async replication from a single-node cluster is limited to a 6-hour RPO.', tone: 'bad', down: [0], vmsOff: true },
    ],
    wan: WAN_STEPS(),
    upgrade: [
      { text: 'LCM can upgrade AOS and AHV, but first you shut down every guest VM.', tone: 'warn', vmsOff: true },
      { text: 'The only CVM and host go down, so storage is offline during the upgrade.', tone: 'bad', down: [0], planned: true, vmsOff: true },
      { text: 'LCM does not upgrade firmware on a single node; that is done manually.', tone: 'warn', vmsOff: true },
      { text: 'The node comes back and you start the VMs again.', tone: 'ok' },
    ],
  },
  '2': {
    drive: [
      { text: 'A drive fails on N1.', tone: 'warn', disk: [0, 1] },
      { text: 'Every piece of data also has a copy on N2: data is kept as two copies, one per node, and metadata as four copies across both.', tone: 'warn', disk: [0, 1] },
      { text: 'The lost copies are rebuilt if there is free capacity. Replace the drive to restore full capacity.', tone: 'ok' },
    ],
    node: [
      { text: 'N1 fails.', tone: 'bad', down: [0] },
      { text: 'Within about 30 to 60 seconds N2 switches to single-node mode. Guest disk timeouts of at least 60 seconds let VMs ride through the switch.', tone: 'warn', down: [0], mode: 'Single-node mode' },
      { text: 'HA restarts N1’s VMs on N2. N1 is detached from the metadata ring.', tone: 'warn', down: [0], vmsTo: 1, mode: 'Single-node mode' },
      { text: 'N2 re-protects the data as two copies on different drives of its own, if it has room. That is why a two-node site is sized to run on one node, with disk and memory at about 40% or less.', tone: 'warn', down: [0], vmsTo: 1, mode: 'Single-node mode' },
      { text: 'N1 is repaired. After about 15 minutes of steady heartbeat, the cluster starts resyncing back to two-node mode.', tone: 'warn', vmsTo: 1, mode: 'Resyncing' },
      { text: 'The resync can take hours, depending on how much data changed. Then the cluster is back in two-node mode with resiliency OK.', tone: 'ok', mode: 'Two-node mode' },
    ],
    peer: [
      { text: 'The two nodes lose contact with each other, but both are still running.', tone: 'warn', peer: true },
      { text: 'Neither node can tell whether the other has failed. The Witness, at a separate site, arbitrates so that only one node carries on serving data.', tone: 'warn', peer: true, illus: 'Simplified. Exact outcomes depend on which node can still reach the Witness; see the two-node failure guidance in Nutanix documentation.' },
      { text: 'That node continues in single-node mode. When the link returns, the cluster resyncs and returns to two-node mode.', tone: 'warn', peer: true, mode: 'Single-node mode' },
    ],
    wan: WAN_STEPS([
      { text: 'The Witness is unreachable too. The nodes keep protecting each other, but the Witness matters if a node fails or the nodes lose contact, so automatic failover may not be possible until the link returns. Maintenance workflows such as LCM need the Witness as well.', tone: 'warn', wan: true },
    ]),
    upgrade: [
      { text: 'LCM upgrades one node at a time and the cluster stays up. It needs a registered Witness.', tone: 'ok' },
      { text: 'While a node is upgrading, the other runs the site in single-node mode.', tone: 'warn', down: [0], planned: true, vmsTo: 1, mode: 'Single-node mode' },
      { text: 'Each node takes longer than on a larger cluster, because data resyncs every time the cluster moves between single-node and two-node mode.', tone: 'warn', mode: 'Resyncing' },
      { text: 'Done, with the VMs running throughout. Note that network segmentation is not supported on two nodes, and virtual-switch changes need user VMs powered off.', tone: 'ok', mode: 'Two-node mode' },
    ],
  },
  '3': {
    drive: [
      { text: 'A drive fails on N1.', tone: 'warn', disk: [0, 1] },
      { text: 'Its data has copies on other nodes. Both other nodes rebuild the missing copies in parallel.', tone: 'warn', disk: [0, 1] },
      { text: 'Data is fully protected again, often before the drive is replaced, as long as there is free capacity.', tone: 'ok', disk: [0, 1] },
    ],
    node: [
      { text: 'N1 fails.', tone: 'bad', down: [0] },
      { text: 'HA restarts its VMs on N2 and N3.', tone: 'warn', down: [0], vmsTo: 1 },
      { text: 'N2 and N3 re-create the missing copies between them, if there is room. Size for N+1 so they can.', tone: 'warn', down: [0], vmsTo: 1 },
      { text: 'Data is fully protected again. Repair or replace N1 to get the spare capacity back.', tone: 'ok', down: [0], vmsTo: 1 },
    ],
    wan: WAN_STEPS(),
    upgrade: [
      { text: 'LCM checks that data resiliency is OK, then works on one node at a time.', tone: 'ok' },
      { text: 'VMs live-migrate off each node before it goes into maintenance mode. With RF2 there is no spare fault tolerance while that node is out.', tone: 'warn', down: [0], planned: true, vmsTo: 1 },
      { text: 'The node comes back, data resyncs, and only then does LCM move to the next node. No VM downtime.', tone: 'ok' },
    ],
  },
};

export const MATRIX: { row: string; cells: Record<Size, { tone: Tone | 'na'; text: string }> }[] = [
  {
    row: 'Drive failure',
    cells: {
      '1': { tone: 'warn', text: 'Rebuilds inside the node; an SSD failure can make it read-only' },
      '2': { tone: 'ok', text: 'Copy on the other node; rebuilds' },
      '3': { tone: 'ok', text: 'Rebuilds across the other nodes' },
    },
  },
  {
    row: 'Node failure',
    cells: {
      '1': { tone: 'bad', text: 'Site down until repaired or recovered' },
      '2': { tone: 'warn', text: 'Keeps running on one node; slow return to two-node mode' },
      '3': { tone: 'ok', text: 'Keeps running and re-protects data' },
    },
  },
  {
    row: 'Nodes lose contact',
    cells: {
      '1': { tone: 'na', text: 'Not applicable' },
      '2': { tone: 'warn', text: 'Witness arbitrates; one node carries on' },
      '3': { tone: 'na', text: 'Not shown here' },
    },
  },
  {
    row: 'WAN to data center lost',
    cells: {
      '1': { tone: 'ok', text: 'Keeps running locally' },
      '2': { tone: 'ok', text: 'Keeps running; Witness out of reach' },
      '3': { tone: 'ok', text: 'Keeps running locally' },
    },
  },
  {
    row: 'Upgrade (AOS, AHV)',
    cells: {
      '1': { tone: 'bad', text: 'Guest VMs shut down first; no firmware via LCM' },
      '2': { tone: 'ok', text: 'Stays up; slower; Witness required' },
      '3': { tone: 'ok', text: 'Rolling, no VM downtime' },
    },
  },
];
