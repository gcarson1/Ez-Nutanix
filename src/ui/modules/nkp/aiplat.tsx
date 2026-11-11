// Kubernetes Platform, AI platform tab: two teams' AI jobs queue against quotas (Kueue), a scheduler
// places them on shared GPU nodes (KAI Scheduler, with Kubernetes Dynamic Resource Allocation), and a
// job that needs four GPUs together waits until it can have all four. Teams, jobs and counts are
// examples; claims are in docs/facts.md (NKP-23).
import { prog } from '../../components/show';
import { Story, W, type StoryStep } from '../ai/kit';
import { Row } from './parts';

const AT = [0, 5, 10, 15, 22];
const STEPS: StoryStep[] = [
  { tone: 'ink', k: 'GPUs are scarce, and teams share them', text: 'Two teams want the same eight GPUs: a notebook, a pipeline step and a training job that needs four GPUs at once. Three GPUs are already busy.' },
  { tone: 'flow', k: 'Jobs queue against each team’s quota', text: 'With Kueue, each team’s jobs wait in a queue and are admitted against that team’s quota of GPUs, so one team cannot take the whole cluster.' },
  {
    tone: 'flow',
    k: 'The scheduler hands out GPUs',
    text: 'NKP 2.19 supports GPU scheduling and slicing through Kubernetes Dynamic Resource Allocation, for NVIDIA and AMD GPUs. KAI Scheduler places the notebook and the pipeline step on free GPUs.',
  },
  {
    tone: 'warn',
    k: 'All four GPUs, or none',
    text: 'The training job needs four GPUs together and only two are free. Starting it on two would waste them, so it waits. When the pipeline step finishes, four are free and it starts on all four at once.',
  },
  {
    tone: 'ok',
    k: 'A catalog for AI teams',
    text: 'These come from the curated AI application catalog in NKP 2.19 for Pro and Ultimate: KAI Scheduler, Kueue, Slurm Operator, Kubeflow Pipelines, JupyterHub and Milvus Operator. NVIDIA multi-instance GPU partitioning is not included.',
  },
];
const T = { admit: [5.6, 6.2, 6.8], note: 10.6, pipe: 11.4, pipeDone: 17.2, train: 18.0 };
const JOBS = [
  { team: 'A', t: 'Notebook', s: 'JupyterHub · 1 GPU', n: 1 },
  { team: 'B', t: 'Pipeline step', s: 'Kubeflow Pipelines · 2 GPUs', n: 2 },
  { team: 'A', t: 'Training job', s: 'needs 4 GPUs together', n: 4 },
];
const jobY = (i: number) => 44 + i * 78;
const GPU = { x0: 664, y0: 70, w: 58, h: 58, gap: 10 };
const gpuXY = (g: number): [number, number] => [GPU.x0 + (g % 4) * (GPU.w + GPU.gap), GPU.y0 + Math.floor(g / 4) * 112];
const CATALOG = ['KAI Scheduler', 'Kueue', 'Slurm Operator', 'Kubeflow Pipelines', 'JupyterHub', 'Milvus Operator'];

/** Who holds each of the eight GPUs at time t: existing work on three, then the three jobs. */
function owners(t: number): (string | null)[] {
  const g: (string | null)[] = ['busy', 'busy', 'busy', null, null, null, null, null];
  if (t >= T.note) g[3] = 'Notebook';
  if (t >= T.pipe && t < T.pipeDone) g[4] = g[5] = 'Pipeline';
  if (t >= T.train) g[4] = g[5] = g[6] = g[7] = 'Training';
  return g;
}

export default function AiPlatformView() {
  return (
    <Story
      steps={STEPS}
      at={AT}
      end={28}
      poster={21}
      label="AI platform"
      why="Example teams, jobs, quotas and GPU counts, with times compressed. Queueing against quotas is what Kueue does and all-or-nothing placement is gang scheduling in general; how each is configured is up to you. The AI catalog is for NKP Pro and Ultimate."
      legend={[
        { color: 'var(--ink)', label: 'GPU in use' },
        { color: 'var(--warn)', label: 'Job waiting' },
        { color: 'var(--ok)', label: 'Job running' },
      ]}
      kpis={(t) => {
        const g = owners(t);
        const used = g.filter(Boolean).length;
        const running = [t >= T.note, t >= T.pipe && t < T.pipeDone, t >= T.train].filter(Boolean).length;
        const waiting = t < T.admit[0] ? 0 : [t < T.note, t < T.pipe, t < T.train].filter(Boolean).length;
        return [
          { k: 'GPUs in use', v: `${used} of 8`, tone: used === 8 ? 'ok' : undefined },
          { k: 'Jobs running', v: running },
          { k: 'Jobs waiting', v: waiting, tone: waiting ? 'warn' : undefined, sub: t >= T.pipe && t < T.train ? 'for four GPUs together' : undefined },
          { k: 'GPU vendors', v: 'NVIDIA and AMD', sub: 'through Dynamic Resource Allocation' },
        ];
      }}
    >
      {(t, phase) => {
        const g = owners(t);
        const state = (i: number) => {
          if (i === 0) return t >= T.note ? { l: '✓ running on 1 GPU', tone: 'ok' } : t >= T.admit[0] ? { l: 'admitted, waiting for a GPU', tone: 'warn' } : { l: 'submitted', tone: '' };
          if (i === 1)
            return t >= T.pipeDone
              ? { l: '✓ finished', tone: 'ok' }
              : t >= T.pipe
                ? { l: '✓ running on 2 GPUs', tone: 'ok' }
                : t >= T.admit[1]
                  ? { l: 'admitted, waiting for GPUs', tone: 'warn' }
                  : { l: 'submitted', tone: '' };
          return t >= T.train
            ? { l: '✓ running on 4 GPUs', tone: 'ok' }
            : t >= T.pipe
              ? { l: 'waiting: needs 4, 2 are free', tone: 'warn' }
              : t >= T.admit[2]
                ? { l: 'admitted, waiting for GPUs', tone: 'warn' }
                : { l: 'submitted', tone: '' };
        };
        return (
          <svg
            class="diagram nk-svg"
            viewBox={`0 0 ${W} 322`}
            role="img"
            aria-label="Two teams submit three AI jobs. Kueue admits them against each team's quota, and the scheduler places them on eight shared GPUs. A training job that needs four GPUs together waits until four are free, then starts on all four at once."
          >
            <text class="muted ai-cap" x={16} y={30}>
              AI jobs
            </text>
            {JOBS.map((j, i) => {
              const s = state(i);
              return (
                <g key={j.t}>
                  <rect class={`ai-box${s.tone === 'ok' ? ' ok' : s.tone === 'warn' ? ' warn' : ''}`} x={16} y={jobY(i)} width={250} height={66} rx={6} />
                  <text class="d-label" x={28} y={jobY(i) + 21} style={{ fontWeight: 600 }}>
                    Team {j.team} · {j.t}
                  </text>
                  <text class="d-sub muted" x={28} y={jobY(i) + 38}>
                    {j.s}
                  </text>
                  <text class={`d-sub ${s.tone ? `${s.tone}-fill` : 'muted'}`} x={28} y={jobY(i) + 55} style={{ fontWeight: s.tone ? 600 : 400 }}>
                    {s.l}
                  </text>
                  <line class="ai-wire" x1={266} x2={310} y1={jobY(i) + 33} y2={jobY(i) + 33} />
                </g>
              );
            })}
            <rect class="ai-ep" x={310} y={32} width={300} height={246} rx={8} />
            <text class="ai-site-t" x={324} y={54}>
              NKP AI platform
            </text>
            <text class="d-sub muted" x={324} y={72}>
              from the AI application catalog
            </text>
            <Row x={324} y={104} label="Kueue · queues and quotas" on={phase === 1} />
            <text class="d-fine muted" x={340} y={122}>
              Team A: 5 GPUs · Team B: 2 GPUs
            </text>
            <Row x={324} y={154} label="KAI Scheduler · places GPU jobs" on={phase === 2 || (phase === 3 && t >= T.train - 0.4)} tone="ok" />
            <text class="d-fine muted" x={340} y={172}>
              all four together, or wait
            </text>
            <Row x={324} y={204} label="Dynamic Resource Allocation" on={phase >= 2} tone="ok" />
            <text class="d-fine muted" x={340} y={222}>
              GPUs handed to pods · NVIDIA and AMD
            </text>
            <text class="d-fine muted" x={324} y={262}>
              NVIDIA MIG partitioning: not in NKP 2.19
            </text>
            <line class="ai-wire" x1={610} x2={GPU.x0 - 14} y1={155} y2={155} />
            {['gpu-node-1 · NVIDIA', 'gpu-node-2 · AMD'].map((n, r) => (
              <g key={n}>
                <rect class="nk-isl" x={GPU.x0 - 14} y={GPU.y0 - 38 + r * 112} width={294} height={104} rx={6} />
                <text class="d-sub" x={GPU.x0 - 2} y={GPU.y0 - 18 + r * 112} style={{ fontWeight: 600 }}>
                  {n}
                </text>
              </g>
            ))}
            {g.map((o, k) => {
              const [x, y] = gpuXY(k);
              return (
                <g key={k}>
                  <rect class={`nk-gpu${o ? ' on' : ''}`} x={x} y={y} width={GPU.w} height={GPU.h} rx={4} />
                  <text class={`d-fine${o ? ' ai-on-ink' : ' muted'}`} x={x + GPU.w / 2} y={y + 24} text-anchor="middle" style={{ fontWeight: 600 }}>
                    GPU {k + 1}
                  </text>
                  <text class={`d-fine${o ? ' ai-on-ink' : ' muted'}`} x={x + GPU.w / 2} y={y + 42} text-anchor="middle">
                    {o === 'busy' ? 'in use' : o ? o.slice(0, 8) : 'free'}
                  </text>
                </g>
              );
            })}
            {phase === 4 && (
              <g style={{ opacity: prog(t, AT[4], AT[4] + 0.5) }}>
                {CATALOG.map((c, i) => (
                  <g key={c}>
                    <rect class="nk-chip ok" x={16 + i * 156} y={288} width={148} height={26} rx={4} />
                    <text class="d-fine" x={90 + i * 156} y={305} text-anchor="middle" style={{ fontWeight: 600 }}>
                      {c}
                    </text>
                  </g>
                ))}
              </g>
            )}
          </svg>
        );
      }}
    </Story>
  );
}
