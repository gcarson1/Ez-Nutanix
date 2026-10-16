// Scale-out vs 3-tier: how storage controllers and capacity grow as you add hosts.
// Pure and deterministic. The 3-tier side is a neutral, generic model (one dual-controller array)
// used only to show the architectural difference; all figures are illustrative.

export interface ScaleInputs {
  nodes: number;
  drivesPerNode: number;
  driveTB: number;
  /** Share of each node's CPU and memory reserved for its CVM, 0..1 (the user's own sizing figure). */
  cvmShare: number;
  /** Arrays in the 3-tier design (each with a controller pair). */
  arrays?: number;
}

export interface ScaleResult {
  hci: { controllers: number; rawTB: number; hostsPerController: number; vmNodeEquivalents: number; controllerNodeEquivalents: number };
  tier3: { controllers: number; hostsPerController: number; hosts: number };
}

export function scaleModel(i: ScaleInputs): ScaleResult {
  const n = Math.max(1, Math.round(i.nodes));
  const share = Math.min(0.9, Math.max(0, i.cvmShare));
  const arrays = Math.max(1, Math.round(i.arrays ?? 1));
  return {
    hci: {
      controllers: n,
      rawTB: n * i.drivesPerNode * i.driveTB,
      hostsPerController: 1,
      vmNodeEquivalents: n * (1 - share),
      controllerNodeEquivalents: n * share,
    },
    tier3: { controllers: 2 * arrays, hostsPerController: n / (2 * arrays), hosts: n },
  };
}

export interface JoinStep {
  id: string;
  text: string;
  /** The new node counts toward capacity and controllers from this step on. */
  joined: boolean;
  balancing: boolean;
}

/** Adding a node, step by step (simplified). */
export const JOIN_STEPS: JoinStep[] = [
  { id: 'rack', text: 'Rack and cable the new node. Workloads keep running.', joined: false, balancing: false },
  { id: 'expand', text: 'Prism finds the node and Expand Cluster adds it, imaging it with the cluster’s software if needed.', joined: false, balancing: false },
  { id: 'join', text: 'Its CVM joins the cluster: the storage pool grows and there is one more storage controller.', joined: true, balancing: false },
  { id: 'balance', text: 'Disk balancing moves some existing data onto the new drives in the background.', joined: true, balancing: true },
  { id: 'done', text: 'Done. More capacity and more controller, and no VM was stopped.', joined: true, balancing: false },
];
