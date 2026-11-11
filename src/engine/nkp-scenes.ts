// Kubernetes Platform: the arithmetic behind three scenes, so a test can hold it. Where pods sit as
// a cluster scales out and back in, where they move while workers are replaced in an upgrade, and
// which job holds each GPU. Pure; the pictures are in src/ui/modules/nkp/.

const part = (t: number, a: number, b: number) => (b <= a ? (t >= b ? 1 : 0) : Math.max(0, Math.min(1, (t - a) / (b - a))));

/** A worker runs at most this many pods in these scenes. */
export const SLOTS = 4;

// ── Scale: three workers, five more pods arrive, a fourth worker is added and later removed ──
export const SCALE = { arrive: [5.5, 5.9, 6.3, 6.7, 7.1], add: 10.8, ready: 12.6, land: [13.0, 13.4], leave: [16.5, 16.7, 16.9, 17.1, 17.3, 17.5], drain: 18.3, gone: 19.5 };

export function scaleState(t: number): { pods: number[]; waiting: number; has4: boolean; total: number } {
  const arrived = SCALE.arrive.filter((a) => t >= a).length;
  const landed = SCALE.land.filter((a) => t >= a).length;
  const left = SCALE.leave.filter((a) => t >= a).length;
  // nine to start; three arrivals fill the workers; the added worker takes the two that waited
  const base = [3, 3, 3].map((n, i) => n + (arrived > i ? 1 : 0));
  // six pods finish: both on worker 4, then two, one and one from the others
  const done = [Math.min(2, Math.max(0, left - 2)), Math.max(0, Math.min(1, left - 4)), Math.max(0, Math.min(1, left - 5)), Math.min(2, left)];
  const pods = [base[0] - done[0], base[1] - done[1], base[2] - done[2], landed - done[3]];
  return { pods, waiting: Math.max(0, arrived - 3) - landed, has4: t >= SCALE.add && t < SCALE.gone, total: pods.reduce((a, b) => a + b, 0) };
}

// ── Upgrade: workers are drained and replaced one at a time ──
export const UPGRADE = { drain: (i: number) => 15.4 + i * 2.4, drained: (i: number) => 16.4 + i * 2.4, back: (i: number) => 17.0 + i * 2.4 };

/** Pods on each of the three workers during the upgrade: six in total, all the time. */
export function upgradePods(t: number): number[] {
  const p = [2, 2, 2];
  for (let i = 0; i < 3; i++) {
    if (t < UPGRADE.drain(i)) break;
    const n = Math.round(p[i] * part(t, UPGRADE.drain(i), UPGRADE.drained(i)));
    const others = [0, 1, 2].filter((k) => k !== i).sort((a, b) => p[a] - p[b]);
    for (let k = 0; k < n; k++) p[others[k % 2]]++;
    p[i] -= n;
  }
  return p;
}

// ── AI platform: eight GPUs, three already busy, three jobs ──
export const GPU_JOBS = { admit: [5.6, 6.2, 6.8], note: 10.6, pipe: 11.4, pipeDone: 17.2, train: 18.0 };
export type GpuOwner = 'busy' | 'Notebook' | 'Pipeline' | 'Training' | null;

/** Who holds each of the eight GPUs at time t. */
export function gpuOwners(t: number): GpuOwner[] {
  const g: GpuOwner[] = ['busy', 'busy', 'busy', null, null, null, null, null];
  if (t >= GPU_JOBS.note) g[3] = 'Notebook';
  if (t >= GPU_JOBS.pipe && t < GPU_JOBS.pipeDone) g[4] = g[5] = 'Pipeline';
  if (t >= GPU_JOBS.train) g[4] = g[5] = g[6] = g[7] = 'Training';
  return g;
}
