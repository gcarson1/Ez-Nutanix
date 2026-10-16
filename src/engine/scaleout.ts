// Scale-out vs 3-tier: how storage controllers and capacity grow as you add hosts.
// Pure and deterministic. The 3-tier side is a neutral, generic model (one dual-controller array)
// used only to show the architectural difference; all figures are illustrative.

export interface ScaleInputs {
  nodes: number;
  drivesPerNode: number;
  driveTB: number;
  /** Arrays in the 3-tier design (each with a controller pair). */
  arrays?: number;
}

export interface ScaleResult {
  hci: { controllers: number; rawTB: number };
  tier3: { controllers: number; hostsPerController: number; hosts: number };
}

export function scaleModel(i: ScaleInputs): ScaleResult {
  const n = Math.max(1, Math.round(i.nodes));
  const arrays = Math.max(1, Math.round(i.arrays ?? 1));
  return {
    hci: { controllers: n, rawTB: n * i.drivesPerNode * i.driveTB },
    tier3: { controllers: 2 * arrays, hostsPerController: n / (2 * arrays), hosts: n },
  };
}

export interface JoinStep {
  id: 'add' | 'join' | 'balance' | 'done';
  text: string;
  /** The new node counts toward capacity and controllers from this step on. */
  joined: boolean;
  balancing: boolean;
}

/** Adding a node, in the order it happens (simplified). */
export const JOIN_STEPS: JoinStep[] = [
  { id: 'add', text: 'A new node is racked, cabled and added from Prism with Expand Cluster. VMs keep running.', joined: false, balancing: false },
  { id: 'join', text: 'Its CVM joins the cluster: one more storage controller, and the storage pool grows by its drives.', joined: true, balancing: false },
  { id: 'balance', text: 'Disk balancing moves some existing data onto the new drives in the background.', joined: true, balancing: true },
  { id: 'done', text: 'More capacity and more controllers, one node at a time, and no VM was stopped.', joined: true, balancing: false },
];
