// Enterprise AI (NAI): where a model endpoint runs, and how one endpoint spreads requests over
// its model replicas, including while one replica is stopped. Pure.
// Facts behind the sites are in docs/research/E-platform-services.md (row 7a).

export type Where = 'dc' | 'cloud' | 'airgap';
export const WHERES: readonly Where[] = ['dc', 'cloud', 'airgap'];
export const REPLICA_OPTS = [1, 2, 4] as const;

export interface Site {
  label: string;
  /** Heading of the boundary drawn around the endpoint. */
  title: string;
  /** The Kubernetes it runs on, in plain words. */
  runsOn: string;
  /** False when the site has no internet connection. */
  online: boolean;
  /** Where the model comes from, two short lines. */
  model: [string, string];
  modelHow: string;
  /** Where prompts, answers and model files stay. */
  stays: string;
}

export const SITE: Record<Where, Site> = {
  dc: {
    label: 'Your data center',
    title: 'YOUR DATA CENTER',
    runsOn: 'Kubernetes (NKP) on Nutanix servers with GPUs',
    online: true,
    model: ['NVIDIA NIM or', 'Hugging Face'],
    modelHow: 'downloaded',
    stays: 'Your data center',
  },
  cloud: {
    label: 'Public cloud',
    title: 'YOUR CLOUD ACCOUNT',
    runsOn: 'Amazon EKS, Azure AKS or Google GKE, on cloud GPU instances',
    online: true,
    model: ['NVIDIA NIM or', 'Hugging Face'],
    modelHow: 'downloaded',
    stays: 'Your cloud account',
  },
  airgap: {
    // Air-gapped means no outside connection, so it applies to your own data center (NKP), not a hyperscaler.
    label: 'Air-gapped site',
    title: 'AIR-GAPPED SITE · NO INTERNET',
    runsOn: 'Kubernetes (NKP) on Nutanix servers with GPUs',
    online: false,
    // Pulling from Hugging Face needs the internet; air-gapped NIM or your own files do not.
    model: ['Air-gapped NIM', 'or your own files'],
    modelHow: 'brought into the site',
    stays: 'Your site, offline',
  },
};

/** Timing of the serving loop, in seconds. */
export interface ServeTimes {
  /** When the first request is sent. */
  start: number;
  /** Time between two requests. */
  gap: number;
  /** App to endpoint (and back). */
  travel: number;
  /** Endpoint to replica (and back). */
  hop: number;
  /** How long a replica works on one request. */
  work: number;
  /** Requests sent before a replica stops, and while it is stopped. */
  busy: number;
  during: number;
  /** How long the replica stays stopped. */
  stopFor: number;
  /** Pause between the two batches. */
  pause: number;
}

export const SERVE_TIMES: ServeTimes = { start: 2.2, gap: 0.5, travel: 0.6, hop: 0.35, work: 0.8, busy: 8, during: 6, stopFor: 3, pause: 0.6 };

export interface Job {
  id: number;
  batch: 'busy' | 'stop';
  /** The app sends it. */
  sent: number;
  /** It reaches the endpoint. */
  arrive: number;
  /** The endpoint sends it on to a replica. */
  dispatch: number;
  replica: number;
  /** The replica works on it from begin to done. */
  begin: number;
  done: number;
  /** The answer is back at the app. */
  back: number;
}

export interface ServePlan {
  replicas: number;
  jobs: Job[];
  /** One replica is stopped from `from` to `to`. */
  stop: { replica: number; from: number; to: number };
  /** Longest time a request waited at the endpoint, per batch. */
  maxWait: { busy: number; stop: number };
  end: number;
}

/**
 * Requests leave the endpoint in the order they arrived. Each goes to the replica that can take it
 * soonest (ties go to the one idle longest), a replica works on one request at a time, and a
 * stopped replica gets nothing that would overlap its stop.
 */
export function planServing(replicas: number, T: ServeTimes = SERVE_TIMES): ServePlan {
  const R = Math.max(1, Math.round(replicas));
  const free = Array.from({ length: R }, () => 0);
  let last = 0;
  const jobs: Job[] = [];

  const run = (sends: number[], batch: Job['batch'], stop: { replica: number; from: number; to: number } | null) => {
    for (const sent of sends) {
      const arrive = sent + T.travel;
      let best = { r: 0, d: Infinity };
      for (let r = 0; r < R; r++) {
        let d = Math.max(arrive, last, free[r] - T.hop);
        if (stop && r === stop.replica && d < stop.to && d + T.hop + T.work > stop.from) d = Math.max(d, stop.to);
        if (d < best.d - 1e-9 || (Math.abs(d - best.d) < 1e-9 && free[r] < free[best.r])) best = { r, d };
      }
      const { r, d } = best;
      const begin = d + T.hop;
      const done = begin + T.work;
      free[r] = done;
      last = d;
      jobs.push({ id: jobs.length, batch, sent, arrive, dispatch: d, replica: r, begin, done, back: done + T.hop + T.travel });
    }
  };

  run(Array.from({ length: T.busy }, (_, i) => T.start + i * T.gap), 'busy', null);
  const from = Math.max(...jobs.map((j) => j.done)) + T.pause;
  const stop = { replica: 0, from, to: from + T.stopFor };
  run(Array.from({ length: T.during }, (_, i) => from + 0.4 + i * T.gap), 'stop', stop);

  const wait = (b: Job['batch']) => Math.max(0, ...jobs.filter((j) => j.batch === b).map((j) => j.dispatch - j.arrive));
  return { replicas: R, jobs, stop, maxWait: { busy: wait('busy'), stop: wait('stop') }, end: Math.max(...jobs.map((j) => j.back)) + 0.6 };
}
