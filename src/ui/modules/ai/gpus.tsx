// Enterprise AI, GPUs tab: four ways NAI fits models onto GPUs. Share a GPU (NVIDIA MIG slices),
// span GPUs (tensor parallelism), span nodes (pipeline parallelism, tech preview) and hibernate an
// endpoint to free its GPUs. Sizes and names are examples; claims are in docs/facts.md (OWN-2, AI-1,
// AI-2, AI-6, AI-11 to AI-13).
import type { ComponentChildren } from 'preact';
import { useEnum } from '../../../state/route';
import { NodeFrame } from '../../components/parts';
import { Choice, prog } from '../../components/show';
import { Box, Gpu, Preview, Story, W, fly, pts, ramp, type Pt, type StoryStep } from './kit';

const GB = 80; // one GPU's memory in every scene here

// ── Share a GPU: MIG slices ──────────────────────────────────────────────────────────────────────
const SL_AT = [0, 5, 10, 16];
const SL_STEPS: StoryStep[] = [
  {
    tone: 'warn',
    k: 'A small model takes a whole GPU',
    text: 'Kubernetes hands out GPUs whole. An embedding model that needs 8 GB takes all 80 GB, so 72 GB sits idle while two more small models wait for a GPU of their own.',
  },
  {
    tone: 'ink',
    k: 'MIG cuts the GPU into slices',
    text: 'With NVIDIA Multi-Instance GPU (MIG), supported from NAI 2.5, one GPU becomes several slices. Each slice has its own share of the memory and is presented to Kubernetes as an independent GPU.',
  },
  {
    tone: 'flow',
    k: 'Each small model takes a slice',
    text: 'The embedding model keeps one slice and the two waiting models get one each. All three answer side by side on a single GPU, each inside its own slice.',
  },
  {
    tone: 'ok',
    k: 'The spare slice is not wasted',
    text: 'One slice is still free. Because Kubernetes sees it as a GPU, another model, or any other workload that asks for a GPU, can take it.',
  },
];
const SLICES = 4;
const SLICE_GB = GB / SLICES;
const SL_MIG = 5.6; // when the GPU is cut
const SL_FLIGHT = 1.2;
const TENANTS = [
  { t: 'Embedding model', pod: 'Embedding', gb: 8, go: 0.6 },
  { t: 'Small language model', pod: 'Small LLM', gb: 16, go: 10.5 },
  { t: 'Another team’s model', pod: 'Other team', gb: 12, go: 12.2 },
  { t: 'Another GPU workload', pod: 'Other workload', gb: 20, go: 17.0 },
];
const SL_NODE = { x: 290, y: 52, w: 654, h: 280 };
const SL_GPU = { x: SL_NODE.x + 16, y: 160, w: SL_NODE.w - 32 };
const SL_BAR = { x: SL_GPU.x + 8, w: SL_GPU.w - 16 };
const slotX = (i: number) => SL_BAR.x + (i * SL_BAR.w) / SLICES;
const SLOT_W = SL_BAR.w / SLICES;
const tenantY = (i: number) => 52 + i * 74;
const slPath = (i: number): Pt[] => {
  const cy = tenantY(i) + 28;
  const px = slotX(i) + SLOT_W / 2;
  return [
    [246, cy],
    [270, cy],
    [270, 34],
    [px, 34],
    [px, 109],
  ];
};

function SliceScene({ top }: { top: ComponentChildren }) {
  return (
    <Story
      steps={SL_STEPS}
      at={SL_AT}
      end={22}
      poster={21}
      label="Sharing a GPU"
      top={top}
      why="Example sizes: an 80 GB GPU cut into four 20 GB slices, and example models. The slice sizes on offer depend on the GPU model, and a vGPU is another way to give a model part of a GPU."
      legend={[
        { color: 'var(--ink)', label: 'GPU memory in use' },
        { color: 'var(--ink-line)', label: 'Taken but idle', dashed: true },
      ]}
      kpis={(t, phase) => {
        const on = TENANTS.filter((m) => t >= m.go + SL_FLIGHT);
        const used = on.reduce((a, m) => a + m.gb, 0);
        const waiting = TENANTS.slice(1, 3).filter((m) => t < m.go + SL_FLIGHT).length;
        return [
          {
            k: 'Running on this GPU',
            v: on.length,
            sub: on.length > 1 ? 'side by side' : 'the rest wait',
            tone: on.length > 1 ? 'ok' : undefined,
          },
          {
            k: 'Waiting for a GPU',
            v: waiting,
            tone: waiting && phase === 0 ? 'warn' : undefined,
          },
          {
            k: 'GPU memory in use',
            v: `${used} of ${GB} GB`,
            sub: on.length && t < SL_MIG ? '72 GB taken but idle' : undefined,
          },
          {
            k: 'Slices',
            v: t >= SL_MIG ? `${Math.min(on.length, SLICES)} of ${SLICES} used` : 'Not sliced',
            sub: 'MIG, from NAI 2.5',
          },
        ];
      }}
    >
      {(t, phase) => {
        const cut = t >= SL_MIG;
        const landed = (i: number) => t >= TENANTS[i].go + SL_FLIGHT;
        const parts = TENANTS.flatMap((m, i) =>
          landed(i)
            ? [
                {
                  at: i * SLICE_GB,
                  gb: m.gb * prog(t, m.go + SL_FLIGHT, m.go + SL_FLIGHT + 0.5),
                  label: `${m.gb} GB`,
                },
              ]
            : [],
        );
        const idle =
          landed(0) && !cut
            ? [
                {
                  at: 8,
                  gb: 72 * (1 - prog(t, SL_AT[1] + 0.2, SL_MIG)),
                  label: '72 GB taken, sitting idle',
                  kind: 'idle' as const,
                },
              ]
            : [];
        return (
          <svg
            class="diagram ai-svg"
            viewBox={`0 0 ${W} 348`}
            role="img"
            aria-label="One GPU. First a small embedding model takes the whole GPU and most of its memory sits idle while two other models wait. Then MIG cuts the GPU into four slices, each model takes a slice, and the spare slice goes to another workload."
          >
            <text class="muted ai-cap" x={16} y={40}>
              Models to serve
            </text>
            {TENANTS.map((m, i) => {
              if (i === 3 && t < SL_AT[3] + 0.3) return null;
              const run = landed(i);
              const state = run ? (cut ? `running on slice ${i + 1}` : 'running on the whole GPU') : phase === 0 && i > 0 ? 'waiting: no GPU free' : i === 3 ? 'asks for a GPU' : 'next in line';
              return <Box key={m.t} x={16} y={tenantY(i)} w={230} h={56} t={m.t} state={`needs ${m.gb} GB · ${state}`} tone={run ? 'ok' : phase === 0 && i > 0 ? 'warn' : undefined} />;
            })}
            <NodeFrame x={SL_NODE.x} y={SL_NODE.y} w={SL_NODE.w} h={SL_NODE.h} title="gpu-node-1" status="Kubernetes worker · one 80 GB GPU">
              <g>
                {TENANTS.map(
                  (m, i) =>
                    landed(i) && (
                      <g key={m.t}>
                        <rect class="ai-pod" x={slotX(i) + 4} y={92} width={SLOT_W - 8} height={34} rx={4} />
                        <text class="d-sub" x={slotX(i) + SLOT_W / 2} y={113} text-anchor="middle">
                          Pod · {m.pod}
                        </text>
                        <line class="ai-wire" x1={slotX(i) + SLOT_W / 2} x2={slotX(i) + SLOT_W / 2} y1={126} y2={160} />
                      </g>
                    ),
                )}
                <Gpu x={SL_GPU.x} y={SL_GPU.y} w={SL_GPU.w} name="GPU" cap={GB} parts={[...parts, ...idle]} cells={cut ? SLICES : undefined} bar={48} />
                {cut &&
                  Array.from({ length: SLICES }, (_, i) => (
                    <g key={i} style={{ opacity: prog(t, SL_MIG, SL_MIG + 0.4) }}>
                      <text class="d-fine" x={slotX(i) + SLOT_W / 2} y={268} text-anchor="middle" style={{ fontWeight: 600 }}>
                        Slice {i + 1} · {SLICE_GB} GB
                      </text>
                      <text class="d-fine muted" x={slotX(i) + SLOT_W / 2} y={286} text-anchor="middle">
                        {landed(i) ? 'in use' : 'free'}
                      </text>
                    </g>
                  ))}
                {!cut && (
                  <text class="d-fine muted" x={SL_BAR.x} y={268}>
                    One GPU goes to one pod
                  </text>
                )}
              </g>
            </NodeFrame>
            {TENANTS.map((m, i) => {
              const p = fly(t, m.go, m.go + SL_FLIGHT, slPath(i));
              return (
                p && (
                  <g key={m.t}>
                    <polyline points={pts(slPath(i))} class="ai-load" />
                    <rect class="ai-model" x={p[0] - 9} y={p[1] - 9} width={18} height={18} rx={3} />
                  </g>
                )
              );
            })}
          </svg>
        );
      }}
    </Story>
  );
}

// ── Span GPUs: tensor parallelism ────────────────────────────────────────────────────────────────
const MG_AT = [0, 5.5, 11];
const MG_STEPS: StoryStep[] = [
  {
    tone: 'bad',
    k: 'Too big for one GPU',
    text: 'This model needs 280 GB of GPU memory and one GPU has 80 GB. It cannot load, however many other GPUs sit unused beside it.',
  },
  {
    tone: 'ink',
    k: 'Tensor parallelism splits the model',
    text: 'NAI 2.8 serves one supported model across several GPUs. Tensor parallelism divides the model’s work between them: each of the four GPUs holds a part, and together they are still a single replica.',
  },
  {
    tone: 'flow',
    k: 'Every GPU works on every request',
    text: 'A prompt arrives at the one replica, all four GPUs compute on it together, and the answer goes back. Apps still call a single endpoint address.',
  },
];
const MG_NEED = 280;
const MG_NODE = { x: 280, y: 24, w: 664, h: 280 };
const MG_GPUS: Pt[] = [
  [300, 112],
  [620, 112],
  [300, 208],
  [620, 208],
];
const MG_SPLIT = { a: 5.9, b: 7.3 };
const MG_REQ = [11.5, 13.7, 15.9];
const MG_IN: Pt[] = [
  [226, 238],
  [254, 238],
  [254, 74],
  [300, 74],
];
const MG_T = { travel: 0.7, work: 1.0 };

function MultiScene({ top }: { top: ComponentChildren }) {
  return (
    <Story
      steps={MG_STEPS}
      at={MG_AT}
      end={18.6}
      poster={17}
      label="One model across several GPUs"
      top={top}
      why="Example sizes: a model that needs 280 GB on four 80 GB GPUs. Which models can be split, and across how many GPUs, depends on the model and the inference engine. Times are not to scale."
      legend={[
        { color: 'var(--ink)', label: 'GPU memory in use' },
        { color: 'var(--flow)', label: 'Request' },
        { color: 'var(--ok)', label: 'Answer' },
      ]}
      kpis={(t, phase) => {
        const placed = phase === 0 ? Math.round(GB * prog(t, 1.7, 2.3)) : Math.round(ramp(t, MG_SPLIT.a, MG_SPLIT.b, GB, MG_NEED));
        const busy = MG_REQ.some((r) => t >= r + MG_T.travel && t < r + MG_T.travel + MG_T.work);
        const split = t >= MG_SPLIT.b;
        const full = phase === 0 && t >= 2.3;
        return [
          {
            k: 'GPUs holding the model',
            v: split ? '4 of 4' : full ? '1 of 4' : phase === 0 ? 'Loading' : 'Splitting',
            tone: split ? 'ok' : full ? 'bad' : undefined,
            sub: split ? 'one replica' : full ? 'it does not fit' : undefined,
          },
          {
            k: 'Model memory loaded',
            v: `${placed} of ${MG_NEED} GB`,
            tone: placed >= MG_NEED ? 'ok' : undefined,
          },
          {
            k: 'GPUs working on a request',
            v: busy ? 4 : 0,
            tone: busy ? 'flow' : undefined,
            sub: 'all at once',
          },
          { k: 'Endpoint addresses', v: 1 },
        ];
      }}
    >
      {(t, phase) => {
        const load = fly(t, 0.5, 1.7, [
          [226, 76],
          [262, 76],
          [262, 151],
          [300, 151],
        ]);
        const gb = (k: number) => (phase === 0 ? (k === 0 ? GB * prog(t, 1.7, 2.3) : 0) : ramp(t, MG_SPLIT.a, MG_SPLIT.b, k === 0 ? GB : 0, MG_NEED / 4));
        const split = t >= MG_SPLIT.b;
        const req = MG_REQ.find((r) => t >= r && t < r + 2 * MG_T.travel + MG_T.work);
        const worked = req === undefined ? 0 : prog(t, req + MG_T.travel, req + MG_T.travel + MG_T.work);
        const work = worked < 1 ? worked : 0; // the bars clear once the answer leaves
        const dot = req === undefined ? null : (fly(t, req, req + MG_T.travel, MG_IN) ?? fly(t, req + MG_T.travel + MG_T.work, req + 2 * MG_T.travel + MG_T.work, MG_IN.slice().reverse() as Pt[]));
        const back = req !== undefined && t >= req + MG_T.travel + MG_T.work;
        return (
          <svg
            class="diagram ai-svg"
            viewBox={`0 0 ${W} 328`}
            role="img"
            aria-label="A large model needs more memory than one GPU has. Tensor parallelism splits it across the four GPUs of one node as a single replica, and all four GPUs work on each request together."
          >
            <Box
              x={16}
              y={40}
              w={210}
              h={72}
              t="Large model"
              s={`needs ${MG_NEED} GB of GPU memory`}
              state={phase === 0 ? (t >= 2.3 ? '✕ does not fit one GPU' : 'loading') : split ? 'loaded across 4 GPUs' : 'splitting'}
              tone={phase === 0 && t >= 2.3 ? 'bad' : split ? 'ok' : undefined}
            />
            <Box x={16} y={210} w={210} h={56} t="Apps and agents" s="send prompts" />
            <polyline points={pts(MG_IN)} class="ai-wire" />
            <NodeFrame x={MG_NODE.x} y={MG_NODE.y} w={MG_NODE.w} h={MG_NODE.h} title="gpu-node-1" status="four 80 GB GPUs">
              <g>
                <rect class="ai-pod" x={300} y={56} width={624} height={36} rx={4} />
                <text class="d-sub" x={312} y={78}>
                  Pod · one replica of the model
                </text>
                <text class="d-sub muted" x={912} y={78} text-anchor="end">
                  {split ? (work > 0 && work < 1 ? 'answering on 4 GPUs' : 'ready on 4 GPUs') : phase === 0 ? 'cannot start' : 'loading'}
                </text>
                {MG_GPUS.map(([x, y], k) => {
                  const full = phase === 0 && k === 0 && t >= 2.3;
                  return (
                    <Gpu
                      key={k}
                      x={x}
                      y={y}
                      w={304}
                      name={`GPU ${k + 1}`}
                      cap={GB}
                      parts={[
                        {
                          at: 0,
                          gb: gb(k),
                          label: phase === 0 ? 'Model' : `Part ${k + 1} of 4`,
                        },
                      ]}
                      right={full ? `✕ full · ${MG_NEED - GB} GB left over` : undefined}
                      tone={full ? 'bad' : undefined}
                      work={split ? work : 0}
                      bar={44}
                    />
                  );
                })}
              </g>
            </NodeFrame>
            {load && <rect class="ai-model" x={load[0] - 9} y={load[1] - 9} width={18} height={18} rx={3} />}
            {dot && <circle cx={dot[0]} cy={dot[1]} r={6} class={back ? 'ai-ans' : 'ai-req'} />}
          </svg>
        );
      }}
    </Story>
  );
}

// ── Span nodes: pipeline parallelism (tech preview) ──────────────────────────────────────────────
const ND_AT = [0, 5, 10.5, 17];
const ND_STEPS: StoryStep[] = [
  {
    tone: 'bad',
    k: 'Too big for one node',
    text: 'A frontier-class model with 100B+ parameters can need more GPU memory than a whole node has. Here it needs 420 GB and each node has two 80 GB GPUs.',
  },
  {
    tone: 'ink',
    k: 'Pipeline parallelism splits it into stages',
    text: 'A tech preview in NAI 2.8 splits the model’s computation into sequential stages across worker nodes, using the vLLM inference engine. Each node holds one stage on its GPUs.',
  },
  {
    tone: 'flow',
    k: 'A request passes through every stage',
    text: 'The prompt enters stage 1, moves to the next node for stage 2 and on to stage 3, and then the answer comes back. Each hop between nodes adds a little time to a single request.',
  },
  {
    tone: 'ok',
    k: 'Built for throughput',
    text: 'Several requests are in the pipeline at once, one per stage, so total capacity is high even though each request takes longer. It is a tech preview, not for production use.',
  },
];
const ND_NEED = 420;
const ND_X = [262, 492, 722];
const ND = { y: 112, w: 216, h: 236 };
const ND_LANE = ND.y + 55; // requests travel along the foot of each pod
const ND_SPLIT = { a: 5.4, b: 6.8 };
const ND_T = { in: 0.4, work: 0.8, hop: 0.3, back: 1.0 };
const ND_REQ = [11.0, 17.3, 18.4, 19.5, 20.6];
const ND_LEN = ND_T.in + 3 * ND_T.work + 2 * ND_T.hop + ND_T.back;
const ND_BACK: Pt[] = [
  [830, 348],
  [830, 362],
  [131, 362],
  [131, 195],
];
/** Where request r is at t: on its way in, working in a stage (0..2), hopping, or coming back. */
function ndAt(t: number, sent: number): { p: Pt; stage?: number; work?: number; answer?: boolean } | null {
  let a = sent;
  if (t < a || t >= sent + ND_LEN) return null;
  if (t < a + ND_T.in) return { p: [246 + 26 * prog(t, a, a + ND_T.in), ND_LANE] };
  a += ND_T.in;
  for (let s = 0; s < 3; s++) {
    const x0 = ND_X[s] + 10;
    if (t < a + ND_T.work) {
      const f = prog(t, a, a + ND_T.work);
      return { p: [x0 + 10 + 176 * f, ND_LANE], stage: s, work: f };
    }
    a += ND_T.work;
    if (s < 2) {
      if (t < a + ND_T.hop)
        return {
          p: [ND_X[s] + ND.w - 10 + 34 * prog(t, a, a + ND_T.hop), ND_LANE],
        };
      a += ND_T.hop;
    }
  }
  const p = fly(t, a, a + ND_T.back, ND_BACK);
  return p && { p, answer: true };
}

function NodesScene({ top }: { top: ComponentChildren }) {
  return (
    <Story
      steps={ND_STEPS}
      at={ND_AT}
      end={25.2}
      poster={21.2}
      label="One model across several nodes"
      top={top}
      why="Example sizes and three stages; the real split depends on the model and the cluster. Times are not to scale. Multi-node serving is a tech preview in NAI 2.8."
      legend={[
        { color: 'var(--ink)', label: 'GPU memory in use' },
        { color: 'var(--flow)', label: 'Request' },
        { color: 'var(--ok)', label: 'Answer' },
      ]}
      kpis={(t, phase) => {
        const inFlight = ND_REQ.filter((r) => t >= r + ND_T.in && t < r + ND_LEN - ND_T.back).length;
        const split = t >= ND_SPLIT.b;
        const full = phase === 0 && t >= 2.2;
        return [
          {
            k: 'Nodes holding the model',
            v: split ? '3 of 3' : full ? '1 of 3' : phase === 0 ? 'Loading' : 'Splitting',
            tone: split ? 'ok' : full ? 'bad' : undefined,
            sub: split ? 'one stage each' : full ? 'it does not fit' : undefined,
          },
          { k: 'Stages per request', v: 3, sub: 'one after another' },
          {
            k: 'Requests in the pipeline',
            v: inFlight,
            tone: inFlight > 1 ? 'ok' : inFlight ? 'flow' : undefined,
          },
          { k: 'Availability', v: 'Tech preview', sub: 'NAI 2.8, vLLM engine' },
        ];
      }}
    >
      {(t, phase) => {
        const load = fly(t, 0.5, 1.6, [
          [246, 52],
          [254, 52],
          [254, 100],
          [370, 100],
          [370, 220],
        ]);
        const gb = (n: number) => (phase === 0 ? (n === 0 ? GB * prog(t, 1.6, 2.2) : 0) : ramp(t, ND_SPLIT.a, ND_SPLIT.b, n === 0 ? GB : 0, ND_NEED / 6));
        const split = t >= ND_SPLIT.b;
        const reqs = ND_REQ.map((r) => ndAt(t, r));
        const workAt = (n: number) => reqs.find((r) => r?.stage === n)?.work ?? 0;
        return (
          <svg
            class="diagram ai-svg"
            viewBox={`0 0 ${W} 376`}
            role="img"
            aria-label="A very large model needs more GPU memory than one node has. Pipeline parallelism, a tech preview, splits it into three stages on three nodes. Each request passes through the stages in turn, and several requests are in the pipeline at once."
          >
            <Box
              x={16}
              y={16}
              w={230}
              h={72}
              t="Frontier-class model"
              s="100B+ parameters"
              state={phase === 0 ? (t >= 2.2 ? '✕ does not fit one node' : `needs ${ND_NEED} GB of GPU memory`) : split ? 'loaded as 3 stages' : 'splitting into stages'}
              tone={phase === 0 && t >= 2.2 ? 'bad' : split ? 'ok' : undefined}
            />
            <text class="d-label" x={262} y={40} style={{ fontWeight: 600 }}>
              Multi-node serving
            </text>
            <text class="d-sub muted" x={262} y={58}>
              pipeline parallelism · vLLM inference engine
            </text>
            <Preview x={856} y={24} />
            <Box x={16} y={139} w={230} h={56} t="Apps and agents" s="send prompts" />
            <line class="ai-wire" x1={246} x2={262} y1={ND_LANE} y2={ND_LANE} />
            <polyline points={pts(ND_BACK)} class="ai-net" />
            {ND_X.map((x, n) => {
              const full = phase === 0 && n === 0 && t >= 2.2;
              const w = split ? workAt(n) : 0;
              return (
                <g key={n}>
                  {n < 2 && <line class="ai-wire" x1={x + ND.w} x2={ND_X[n + 1]} y1={ND_LANE} y2={ND_LANE} />}
                  <NodeFrame x={x} y={ND.y} w={ND.w} h={ND.h} title={`gpu-node-${n + 1}`} status={full ? `✕ ${ND_NEED - 2 * GB} GB left over` : undefined} tone={full ? 'bad' : undefined}>
                    <g>
                      <rect class="ai-pod" x={x + 10} y={ND.y + 26} width={196} height={38} rx={4} />
                      <rect class="ai-bar" x={x + 20} y={ND.y + 53} width={176} height={4} />
                      {w > 0 && <rect class="ai-bar-on" x={x + 20} y={ND.y + 53} width={176 * w} height={4} />}
                      <text class="d-sub" x={x + 20} y={ND.y + 43}>
                        {phase === 0 ? (n === 0 ? 'Pod · whole model' : 'no pod') : `Pod · stage ${n + 1} of 3`}
                      </text>
                      {[0, 1].map((g) => (
                        <Gpu
                          key={g}
                          x={x + 10}
                          y={ND.y + 74 + g * 78}
                          w={196}
                          name={`GPU ${g + 1}`}
                          cap={GB}
                          parts={[
                            {
                              at: 0,
                              gb: gb(n),
                              label: phase === 0 ? 'Model' : `Stage ${n + 1}`,
                            },
                          ]}
                          work={w}
                          bar={32}
                        />
                      ))}
                    </g>
                  </NodeFrame>
                </g>
              );
            })}
            {load && <rect class="ai-model" x={load[0] - 9} y={load[1] - 9} width={18} height={18} rx={3} />}
            {reqs.map((r, k) => r && <circle key={k} cx={r.p[0]} cy={r.p[1]} r={6} class={r.answer ? 'ai-ans' : 'ai-req'} />)}
          </svg>
        );
      }}
    </Story>
  );
}

// ── Hibernate an endpoint to free its GPUs ───────────────────────────────────────────────────────
const HB_AT = [0, 5, 10, 16];
const HB_STEPS: StoryStep[] = [
  {
    tone: 'warn',
    k: 'Every GPU is taken',
    text: 'The reporting endpoint holds both GPUs, although nobody uses it until month end. A team wants to test a new model and there is no GPU free for it.',
  },
  {
    tone: 'ink',
    k: 'Hibernate the idle endpoint',
    text: 'Hibernating quiesces the endpoint and releases its compute and GPU resources. Its configuration is kept, so nothing has to be deleted and rebuilt later.',
  },
  {
    tone: 'flow',
    k: 'The freed GPUs run the test',
    text: 'The test endpoint starts on one of the freed GPUs. No new hardware was needed, and the reporting endpoint is not lost.',
  },
  {
    tone: 'ok',
    k: 'Resume when it is needed',
    text: 'At month end the test endpoint is hibernated in turn, and the reporting endpoint resumes on its GPUs with the configuration it had.',
  },
];
const HB = {
  sleep: [5.5, 6.7],
  test: [10.4, 11.6],
  testOff: [16.4, 17.4],
  wake: [17.8, 19.0],
};
const HB_NODE_Y = [40, 196];
const hbGpuCy = (n: number) => HB_NODE_Y[n] + 77;

function HibernateScene({ top }: { top: ComponentChildren }) {
  return (
    <Story
      steps={HB_STEPS}
      at={HB_AT}
      end={22}
      poster={21}
      label="Endpoint hibernation"
      top={top}
      why="Example endpoints and sizes, with times compressed. Hibernation has been in NAI since 2.3; NAI 2.8 also lets you change a hibernated endpoint’s parameters before resuming it."
      legend={[
        { color: 'var(--ink)', label: 'GPU memory in use' },
        {
          color: 'var(--line-2)',
          label: 'Hibernated: configuration kept',
          dashed: true,
        },
      ]}
      kpis={(t) => {
        const aOn = t < HB.sleep[0] || t >= HB.wake[1];
        const aOff = t >= HB.sleep[1] && t < HB.wake[0];
        const bOn = t >= HB.test[1] && t < HB.testOff[0];
        const free = aOff ? (bOn || (t >= HB.test[0] && t < HB.testOff[1]) ? 1 : 2) : 0;
        return [
          { k: 'GPUs free', v: `${free} of 2`, tone: free ? 'ok' : undefined },
          {
            k: 'Reporting endpoint',
            v: aOn ? 'Running' : aOff ? 'Hibernated' : t < HB.wake[0] ? 'Hibernating' : 'Resuming',
            sub: aOff ? 'configuration kept' : undefined,
          },
          {
            k: 'Test endpoint',
            v: bOn ? 'Running' : t < HB.test[0] ? 'Waiting' : t < HB.test[1] ? 'Starting' : t < HB.testOff[1] ? 'Hibernating' : 'Hibernated',
            tone: t < HB.sleep[1] ? 'warn' : bOn ? 'ok' : undefined,
            sub: t >= HB.sleep[1] && t < HB.test[0] ? 'a GPU is free' : undefined,
          },
          { k: 'In NAI since', v: '2.3' },
        ];
      }}
    >
      {(t) => {
        const a = t < HB.wake[0] ? 1 - prog(t, HB.sleep[0], HB.sleep[1]) : prog(t, HB.wake[0], HB.wake[1]);
        const b = t < HB.testOff[0] ? prog(t, HB.test[0], HB.test[1]) : 1 - prog(t, HB.testOff[0], HB.testOff[1]);
        const aOff = a === 0;
        const bOff = t >= HB.testOff[1];
        const aState =
          a === 1 ? (t < HB.sleep[0] ? 'running · no requests until month end' : 'running again · same configuration') : aOff ? 'hibernated · configuration kept' : t < HB.wake[0] ? 'releasing its GPUs' : 'resuming';
        const bState =
          b === 1
            ? 'running · answering test prompts'
            : bOff
              ? 'hibernated · configuration kept'
              : b > 0
                ? t < HB.testOff[0]
                  ? 'starting'
                  : 'releasing its GPU'
                : t < HB.sleep[1]
                  ? '✕ waiting: no GPU free'
                  : 'a GPU is free';
        return (
          <svg
            class="diagram ai-svg"
            viewBox={`0 0 ${W} 344`}
            role="img"
            aria-label="Two endpoints and two GPUs. An idle reporting endpoint holds both GPUs. It is hibernated, which frees the GPUs but keeps its configuration, a test endpoint runs on a freed GPU, and later the reporting endpoint resumes."
          >
            <text class="muted ai-cap" x={16} y={44}>
              Endpoints
            </text>
            <Box x={16} y={56} w={264} h={76} t="Reporting endpoint" s="2 replicas of one model" state={aState} tone={a === 1 && t >= HB.wake[1] ? 'ok' : undefined} cls={aOff ? 'ai-box ai-hib' : 'ai-box'} />
            <Box x={16} y={212} w={264} h={76} t="Test endpoint" s="a new model to try" state={bState} tone={b === 1 ? 'ok' : t < HB.sleep[1] ? 'warn' : undefined} cls={bOff ? 'ai-box ai-hib' : 'ai-box'} />
            {[0, 1].map((n) => (
              <polyline
                key={n}
                points={pts([
                  [280, 94],
                  [304, 94],
                  [304, hbGpuCy(n)],
                  [340, hbGpuCy(n)],
                ])}
                class={`ai-wire${a < 1 ? ' idle' : ''}`}
              />
            ))}
            <polyline
              points={pts([
                [280, 250],
                [320, 250],
                [320, hbGpuCy(0) + 14],
                [340, hbGpuCy(0) + 14],
              ])}
              class={`ai-wire${b < 1 ? ' idle' : ''}`}
            />
            {[0, 1].map((n) => {
              const parts = [{ at: 0, gb: GB * a, label: `Reporting · replica ${n + 1}` }, ...(n === 0 ? [{ at: 0, gb: 60 * b, label: 'Test model' }] : [])];
              const used = Math.round(GB * a + (n === 0 ? 60 * b : 0));
              return (
                <NodeFrame key={n} x={340} y={HB_NODE_Y[n]} w={604} h={124} title={`gpu-node-${n + 1}`}>
                  <g>
                    <Gpu x={352} y={HB_NODE_Y[n] + 34} w={580} name="GPU" cap={GB} parts={parts} right={used === 0 ? 'free' : undefined} bar={44} />
                  </g>
                </NodeFrame>
              );
            })}
          </svg>
        );
      }}
    </Story>
  );
}

// ── the tab ──────────────────────────────────────────────────────────────────────────────────────
type GpuUse = 'slice' | 'multi' | 'nodes' | 'hib';
const USES: { value: GpuUse; label: string }[] = [
  { value: 'slice', label: 'Share a GPU' },
  { value: 'multi', label: 'Span GPUs' },
  { value: 'nodes', label: 'Span nodes' },
  { value: 'hib', label: 'Hibernate' },
];

export default function GpusView() {
  const [use, setUse] = useEnum<GpuUse>('g', 'slice', ['slice', 'multi', 'nodes', 'hib']);
  const top = <Choice<GpuUse> label="GPU use" value={use} onChange={setUse} options={USES} />;
  // Each scene has its own clock, so a new choice starts from the top.
  if (use === 'multi') return <MultiScene key="multi" top={top} />;
  if (use === 'nodes') return <NodesScene key="nodes" top={top} />;
  if (use === 'hib') return <HibernateScene key="hib" top={top} />;
  return <SliceScene key="slice" top={top} />;
}
