// Enterprise AI, Models and data tab: fine-tuning with LoRA, roles and model sharing, and answers
// grounded in your own documents. Teams, models, documents and the policy text are examples; claims
// are in docs/facts.md (AI-7 to AI-10, AI-16 to AI-18).
import type { ComponentChildren } from 'preact';
import { useEnum } from '../../../state/route';
import { NodeFrame } from '../../components/parts';
import { Choice, pathLength, prog } from '../../components/show';
import { Box, Cross, Gpu, Story, W, along, fly, pts, type Pt, type StoryStep } from './kit';

// ── Fine-tuning with LoRA ────────────────────────────────────────────────────────────────────────
const FT_AT = [0, 5, 11, 16.5, 22];
const FT_STEPS: StoryStep[] = [
  {
    tone: 'ink',
    k: 'Start with a smaller model and your data',
    text: 'Fine-tuning teaches a model your domain. In NAI 2.8 it is generally available for supported models under 8 billion parameters, trained on your own domain-specific data.',
  },
  {
    tone: 'flow',
    k: 'LoRA trains a small add-on',
    text: 'Low-Rank Adaptation (LoRA) leaves the base model as it is and trains a small add-on beside it. That takes far less GPU time and memory than retraining the whole model.',
  },
  {
    tone: 'ink',
    k: 'Watch the metrics, pause and resume',
    text: 'You follow the training metrics while the job runs, and you can pause it and resume it later.',
  },
  {
    tone: 'ok',
    k: 'Saved, then imported',
    text: 'The tuned model is saved to NFS storage and imported straight into NAI, where it sits beside your other models.',
  },
  {
    tone: 'ok',
    k: 'Serve it like any other model',
    text: 'The tuned model runs as a normal endpoint. Nutanix’s aim is accuracy on your task from a smaller model, on fewer GPUs than a much larger general model would need.',
  },
];
const FT = {
  run: [5.4, 10.6],
  resume: [13, 16],
  save: [16.9, 18],
  imp: [18.6, 19.6],
  serve: [22.4, 23.2],
};
/** Training progress 0..1: runs to 60%, pauses, then finishes. */
const ftProgress = (t: number) => (t < FT.resume[0] ? 0.6 * prog(t, FT.run[0], FT.run[1]) : 0.6 + 0.4 * prog(t, FT.resume[0], FT.resume[1]));
const lossAt = (p: number) => 0.12 + 0.88 * Math.exp(-3.5 * p);
const CHART = { x: 270, y: 168, w: 350, h: 60 };

function TuneScene({ top }: { top: ComponentChildren }) {
  return (
    <Story
      steps={FT_STEPS}
      at={FT_AT}
      end={28}
      poster={27}
      label="Fine-tuning"
      top={top}
      why="An example job with times compressed; the loss curve and the GPU counts are illustrative. How much a tuned small model saves depends on the task and the models compared."
      legend={[
        { color: 'var(--ink)', label: 'Trained by LoRA' },
        {
          color: 'var(--ink-line)',
          label: 'Base model, unchanged',
          dashed: true,
        },
      ]}
      kpis={(t) => {
        const p = ftProgress(t);
        const paused = t >= FT_AT[2] && t < FT.resume[0];
        return [
          {
            k: 'Training',
            v: `${Math.round(p * 100)}%`,
            sub: paused ? 'paused' : p >= 1 ? 'done' : p > 0 ? 'running' : 'not started',
            tone: p >= 1 ? 'ok' : undefined,
          },
          { k: 'Base model', v: 'Unchanged', sub: 'under 8B parameters' },
          {
            k: 'Tuned model',
            v: p === 0 ? 'Not started' : t < 16 ? 'In training' : t < FT.save[1] ? 'Trained' : t < FT.imp[1] ? 'Saved on NFS' : t < FT.serve[1] ? 'In NAI' : 'Serving',
            tone: t >= FT.serve[1] ? 'ok' : undefined,
          },
          { k: 'Availability', v: 'GA', sub: 'NAI 2.8, models under 8B' },
        ];
      }}
    >
      {(t, phase) => {
        const p = ftProgress(t);
        const paused = t >= FT_AT[2] && t < FT.resume[0];
        const loaded = t >= 2;
        const data = fly(t, 0.6, 1.6, [
          [206, 62],
          [228, 62],
          [228, 81],
          [270, 81],
        ]);
        const base = fly(t, 1.0, 2.0, [
          [206, 150],
          [228, 150],
          [228, 81],
          [270, 81],
        ]);
        const saved = fly(t, FT.save[0], FT.save[1], [
          [640, 81],
          [670, 81],
          [670, 62],
          [700, 62],
        ]);
        const imported = fly(t, FT.imp[0], FT.imp[1], [
          [822, 92],
          [822, 164],
        ]);
        const served = fly(t, FT.serve[0], FT.serve[1], [
          [822, 248],
          [822, 276],
        ]);
        const curve: Pt[] = Array.from({ length: 41 }, (_, i) => (i / 40) * p).map((q) => [CHART.x + 8 + q * (CHART.w - 16), CHART.y + 8 + (1 - lossAt(q)) * (CHART.h - 16)]);
        const status = !loaded ? 'no job yet' : p === 0 ? 'fine-tuning job · ready' : paused ? 'fine-tuning job · paused' : p < 1 ? 'fine-tuning job · running' : 'fine-tuning job · done';
        return (
          <svg
            class="diagram ai-svg"
            viewBox={`0 0 ${W} 356`}
            role="img"
            aria-label="Fine-tuning with LoRA. Your data and a base model under 8 billion parameters go to a training job on a GPU node. The base model stays unchanged while a small add-on is trained, with metrics shown and the job paused and resumed. The tuned model is saved to NFS storage, imported into NAI and served as an endpoint."
          >
            <Box x={16} y={32} w={190} h={60} t="Your data" s="domain-specific examples" />
            <Box x={16} y={120} w={190} h={60} t="Base model" s="under 8B parameters" />
            <polyline points="206,62 228,62 228,81 250,81" class="ai-wire" />
            <polyline points="206,150 228,150 228,81" class="ai-wire" />
            <NodeFrame x={250} y={24} w={390} h={224} title="gpu-node-1" status={status} tone={paused ? 'warn' : undefined}>
              <g>
                <g style={{ opacity: loaded ? 1 : 0.35 }}>
                  <rect class="ai-idle" x={270} y={56} width={240} height={50} rx={4} />
                  <text class="d-label" x={282} y={77} style={{ fontWeight: 600 }}>
                    Base model
                  </text>
                  <text class="d-fine muted" x={282} y={95}>
                    not changed by training
                  </text>
                  <rect class="ai-bar" x={516} y={56} width={104} height={30} rx={4} />
                  <rect class="ai-mem" x={516} y={56} width={104 * p} height={30} rx={4} />
                  <text class="d-fine" x={568} y={102} text-anchor="middle" style={{ fontWeight: 600 }}>
                    LoRA add-on
                  </text>
                </g>
                <text class="d-fine muted" x={270} y={132}>
                  Training{paused ? ' · paused, resume any time' : ''}
                </text>
                <text class="d-fine" x={620} y={132} text-anchor="end" style={{ fontWeight: 600 }}>
                  {Math.round(p * 100)}%
                </text>
                <rect class="ai-bar" x={270} y={140} width={350} height={6} rx={3} />
                <rect class={paused ? 'ai-bar-warn' : 'ai-mem'} x={270} y={140} width={350 * p} height={6} rx={3} />
                <rect class="ai-pod" x={CHART.x} y={CHART.y} width={CHART.w} height={CHART.h} rx={4} />
                <text class="d-fine muted" x={CHART.x + CHART.w - 8} y={CHART.y + 16} text-anchor="end">
                  Training loss · lower is better
                </text>
                {p > 0 && <polyline points={pts(curve)} class="ai-curve" />}
                {p > 0 && <circle cx={curve[40][0]} cy={curve[40][1]} r={3.5} class="ink-fill" />}
              </g>
            </NodeFrame>
            <polyline points="640,81 670,81 670,62 700,62" class="ai-wire" />
            <Box x={700} y={32} w={244} h={60} t="NFS storage" state={t >= FT.save[1] ? '✓ tuned model saved here' : 'for the tuned model'} tone={t >= FT.save[1] ? 'ok' : undefined} />
            <line class="ai-wire" x1={822} x2={822} y1={92} y2={120} />
            <rect class="ai-box" x={700} y={120} width={244} height={128} rx={6} />
            <text class="d-label" x={712} y={140} style={{ fontWeight: 600 }}>
              Models in NAI
            </text>
            <rect class="ai-pod" x={712} y={152} width={220} height={36} rx={4} />
            <text class="d-sub" x={722} y={175}>
              Base model
            </text>
            {t >= FT.imp[1] && (
              <g>
                <rect class="ai-pod sel" x={712} y={196} width={220} height={36} rx={4} />
                <text class="d-sub" x={722} y={219} style={{ fontWeight: 600 }}>
                  Tuned model · yours
                </text>
              </g>
            )}
            {phase === 4 && (
              <g style={{ opacity: prog(t, FT_AT[4], FT_AT[4] + 0.4) }}>
                <text class="muted ai-cap" x={250} y={276}>
                  GPUs for the same task, as an example
                </text>
                {[
                  { l: 'A much larger general model', n: 4, y: 286 },
                  { l: 'Your tuned small model', n: 1, y: 316 },
                ].map((r) => (
                  <g key={r.l}>
                    <text class="d-sub" x={250} y={r.y + 16} style={{ fontWeight: r.n === 1 ? 600 : 400 }}>
                      {r.l}
                    </text>
                    {Array.from({ length: r.n }, (_, i) => (
                      <g key={i}>
                        <rect class="ai-gchip" x={452 + i * 48} y={r.y} width={42} height={22} rx={3} />
                        <text class="d-fine" x={473 + i * 48} y={r.y + 15} text-anchor="middle">
                          GPU
                        </text>
                      </g>
                    ))}
                  </g>
                ))}
              </g>
            )}
            <line class="ai-wire" x1={822} x2={822} y1={248} y2={276} />
            <Box x={700} y={276} w={244} h={60} t="Inference endpoint" state={t >= FT.serve[1] ? '✓ serving the tuned model' : 'not created yet'} tone={t >= FT.serve[1] ? 'ok' : undefined} dim={t < FT.serve[1]} />
            {[data, base, saved, imported, served].map((q, i) => q && <rect key={i} class="ai-model" x={q[0] - 9} y={q[1] - 9} width={18} height={18} rx={3} />)}
          </svg>
        );
      }}
    </Story>
  );
}

// ── Roles and model sharing ──────────────────────────────────────────────────────────────────────
const RL_AT = [0, 5, 10.5, 16];
const RL_STEPS: StoryStep[] = [
  {
    tone: 'ink',
    k: 'One catalog, several teams',
    text: 'The platform admin imports models into NAI’s catalog and can see and manage all of them. The question is what each team should see and be allowed to do.',
  },
  {
    tone: 'flow',
    k: 'Share only the models a team needs',
    text: 'Model sharing gives specific users or groups access to selected models without exposing the whole catalog. The Finance team gets two of the four.',
  },
  {
    tone: 'ok',
    k: 'A role decides the actions',
    text: 'Roles are predefined or custom and control individual actions. This custom role lets the Finance team create endpoints and API keys, using the models shared with it.',
  },
  {
    tone: 'bad',
    k: 'Everything else is refused',
    text: 'A role also limits users to specific resources, or to the ones they own. Changing another team’s endpoint is refused, and so is opening a model that was not shared.',
  },
];
const ACTORS = [
  { t: 'Platform admin', s: 'manages NAI', y: 32 },
  { t: 'Finance team', s: 'custom role', y: 140 },
  { t: 'Data science team', s: 'owns its own endpoint', y: 248 },
];
const MODELS = ['General chat model', 'Finance-tuned model', 'Embedding model', 'Code model'];
const modelY = (i: number) => 36 + i * 48;
const EP_Y = [254, 302]; // the Data science endpoint, then the one Finance creates
const NAI = { x: 290, y: 20, w: 260, h: 316 };
const GATE_Y = 178;
const RULES = ['Can create endpoints', 'Can create API keys', 'Cannot import or delete models', 'Cannot change other teams’ endpoints'];
interface Ask {
  actor: number;
  at: number;
  /** A model row (0..3) or an endpoint row (4, 5). */
  to: number;
  deny?: string;
  /** Which of the role's rules this exercises. */
  rule?: number;
  share?: boolean;
}
const ASKS: Ask[] = [
  ...[0, 1, 2, 3].map((to, k) => ({ actor: 0, at: 0.6 + k * 0.6, to })),
  { actor: 0, at: 5.5, to: 1, share: true },
  { actor: 0, at: 6.7, to: 2, share: true },
  { actor: 1, at: 11.0, to: 1, rule: 0 },
  { actor: 1, at: 13.2, to: 5, rule: 1 },
  { actor: 1, at: 16.5, to: 4, deny: 'Refused: not their endpoint', rule: 3 },
  { actor: 1, at: 18.8, to: 3, deny: 'Refused: model not shared' },
];
const rowY = (to: number) => (to < 4 ? modelY(to) + 20 : EP_Y[to - 4] + 20);
function askPath(a: Ask): Pt[] {
  const y0 = ACTORS[a.actor].y + 30;
  const start: Pt[] = [
    [226, y0],
    [258, y0],
    [258, GATE_Y],
    [NAI.x, GATE_Y],
  ];
  return a.deny ? start : [...start, [NAI.x + NAI.w, GATE_Y], [584, GATE_Y], [584, rowY(a.to)], [620, rowY(a.to)]];
}
const RL_SPEED = 300;
const ASK_PATHS = ASKS.map((a) => {
  const p = askPath(a);
  const dur = pathLength((f) => along(p, f)) / RL_SPEED;
  return { a, p, dur, done: a.at + dur };
});

function RolesScene({ top }: { top: ComponentChildren }) {
  return (
    <Story
      steps={RL_STEPS}
      at={RL_AT}
      end={22}
      poster={20.2}
      label="Roles and model sharing"
      top={top}
      why="Example teams, models and one example custom role, with times compressed. The actions a role can allow or deny are set in NAI’s role settings."
      legend={[
        { color: 'var(--flow)', label: 'Request' },
        { color: 'var(--ok)', label: 'Allowed' },
        { color: 'var(--bad)', label: 'Refused' },
      ]}
      kpis={(t) => {
        const shared = ASK_PATHS.filter(({ a, done }) => a.share && t >= done).length;
        const ok = ASK_PATHS.filter(({ a, done }) => a.actor === 1 && !a.deny && t >= done).length;
        const no = ASK_PATHS.filter(({ a, done }) => a.deny && t >= done).length;
        return [
          { k: 'Models in the catalog', v: 4 },
          {
            k: 'Models Finance can see',
            v: `${shared} of 4`,
            tone: shared ? 'ok' : undefined,
          },
          { k: 'Finance requests allowed', v: ok, tone: ok ? 'ok' : undefined },
          {
            k: 'Finance requests refused',
            v: no,
            tone: no ? 'bad' : undefined,
          },
        ];
      }}
    >
      {(t, phase) => {
        const sharedAt = (m: number) => ASK_PATHS.find(({ a }) => a.share && a.to === m)?.done;
        const isShared = (m: number) => t >= (sharedAt(m) ?? Infinity);
        const used = (rule: number) => ASK_PATHS.some(({ a, done }) => a.rule === rule && t >= done - 0.2);
        const made = t >= ASK_PATHS[6].done;
        const refusal = ASK_PATHS.find(({ a, done }) => a.deny && t >= done && t < done + 1.8);
        return (
          <svg
            class="diagram ai-svg"
            viewBox={`0 0 ${W} 356`}
            role="img"
            aria-label="Three teams, NAI in the middle and a catalog of four models. The admin shares two models with the Finance team. Finance's custom role lets it create an endpoint and API keys from those models; changing another team's endpoint or opening a model that was not shared is refused."
          >
            {ACTORS.map((a) => (
              <g key={a.t}>
                <Box x={16} y={a.y} w={210} h={60} t={a.t} s={a.s} />
                <polyline
                  points={pts([
                    [226, a.y + 30],
                    [258, a.y + 30],
                    [258, GATE_Y],
                    [NAI.x, GATE_Y],
                  ])}
                  class="ai-wire"
                />
              </g>
            ))}
            {[0, 1, 2, 3, 4, 5].map((to) =>
              to === 5 && !made ? null : (
                <polyline
                  key={to}
                  points={pts([
                    [NAI.x + NAI.w, GATE_Y],
                    [584, GATE_Y],
                    [584, rowY(to)],
                    [620, rowY(to)],
                  ])}
                  class="ai-wire"
                />
              ),
            )}
            <rect class="ai-ep" x={NAI.x} y={NAI.y} width={NAI.w} height={NAI.h} rx={8} />
            <text class="ai-site-t" x={NAI.x + 14} y={NAI.y + 22}>
              Nutanix Enterprise AI
            </text>
            <text class="d-sub muted" x={NAI.x + 14} y={NAI.y + 40}>
              checks the role and what is shared
            </text>
            <g style={{ opacity: phase >= 2 ? 1 : 0.45 }}>
              <text class="d-label" x={NAI.x + 14} y={92} style={{ fontWeight: 600 }}>
                Finance team’s custom role
              </text>
              {RULES.map((r, i) => {
                const on = phase >= 2 && used(i);
                return (
                  <g key={r}>
                    <circle cx={NAI.x + 19} cy={110 + i * 22} r={4.5} class={on ? `ai-dot on ${i < 2 ? 'ok' : 'bad'}` : 'ai-dot'} />
                    <text class={`d-fine${on ? '' : ' muted'}`} x={NAI.x + 30} y={114 + i * 22} style={{ fontWeight: on ? 600 : 400 }}>
                      {r}
                    </text>
                  </g>
                );
              })}
            </g>
            <text class="d-label" x={NAI.x + 14} y={228} style={{ fontWeight: 600 }}>
              Shared with the Finance team
            </text>
            {[1, 2].map((m, i) => (
              <text key={m} class={`d-sub${isShared(m) ? '' : ' muted'}`} x={NAI.x + 14} y={248 + i * 18}>
                {isShared(m) ? `✓ ${MODELS[m]}` : i === 0 && !isShared(2) ? 'nothing yet' : ''}
              </text>
            ))}
            {refusal && (
              <g>
                <Cross x={NAI.x - 10} y={GATE_Y} />
                <text class="d-sub bad-fill" x={NAI.x + 14} y={312} style={{ fontWeight: 600 }}>
                  {refusal.a.deny}
                </text>
              </g>
            )}
            <text class="muted ai-cap" x={620} y={26}>
              Model catalog
            </text>
            {MODELS.map((m, i) => (
              <g key={m}>
                <Box x={620} y={modelY(i)} w={324} h={40} t={m} dim={phase >= 1 && !isShared(i) && t >= (sharedAt(2) ?? 0)} />
                {phase >= 1 && (isShared(i) || t >= (sharedAt(2) ?? Infinity)) && (
                  <text class={`d-fine ${isShared(i) ? 'ok-fill' : 'muted'}`} x={932} y={modelY(i) + 24} text-anchor="end" style={{ fontWeight: isShared(i) ? 600 : 400 }}>
                    {isShared(i) ? '✓ shared with Finance' : 'not shared'}
                  </text>
                )}
              </g>
            ))}
            <text class="muted ai-cap" x={620} y={244}>
              Endpoints
            </text>
            <Box x={620} y={EP_Y[0]} w={324} h={40} t="Data science endpoint" />
            <text class="d-fine muted" x={932} y={EP_Y[0] + 24} text-anchor="end">
              owned by Data science
            </text>
            {made && (
              <g>
                <Box x={620} y={EP_Y[1]} w={324} h={40} t="Finance endpoint" />
                <text class="d-fine ok-fill" x={932} y={EP_Y[1] + 24} text-anchor="end" style={{ fontWeight: 600 }}>
                  ✓ {t >= ASK_PATHS[7].done ? 'created, with its API key' : 'created by Finance'}
                </text>
              </g>
            )}
            {ASK_PATHS.map(({ a, p, dur }, k) => {
              if (t < a.at || t > a.at + dur) return null;
              const [x, y] = along(p, (t - a.at) / dur);
              return <circle key={k} cx={x} cy={y} r={6} class="ai-req" />;
            })}
          </svg>
        );
      }}
    </Story>
  );
}

// ── Grounded answers ─────────────────────────────────────────────────────────────────────────────
const RG_AT = [0, 5.5, 11, 16.5];
const RG_STEPS: StoryStep[] = [
  {
    tone: 'warn',
    k: 'A model only knows its training',
    text: 'Ask about your own policies and a model can only answer in general terms, because your documents were never part of its training.',
  },
  {
    tone: 'ink',
    k: 'Upload your documents',
    text: 'In NAI 2.8 the Agent app accepts document uploads: the policies, runbooks and price lists the model has never seen become material it can draw on.',
  },
  {
    tone: 'flow',
    k: 'The question goes with the matching passages',
    text: 'When you ask, the passages in your documents that match are passed to the model together with the question, so it answers from them.',
  },
  {
    tone: 'ok',
    k: 'The answer cites its source',
    text: 'The answer is grounded in your documents and carries citations that link back to the source content, so anyone can check where it came from.',
  },
];
const DOCS = ['HR policy', 'Runbook', 'Price list'];
const docX = (i: number) => 16 + i * 74;
const slotDoc = (i: number): Pt => [316 + i * 52, 96];
const RG = {
  ask1: 0.5,
  up: [5.9, 6.5, 7.1],
  ask2: 11.3,
  send: 13.0,
  back: 16.7,
  shown: 17.9,
};
const Q_IN: Pt[] = [
  [236, 64],
  [300, 64],
];
const TO_MODEL: Pt[] = [
  [550, 75],
  [620, 75],
];
const TO_CARD: Pt[] = [
  [425, 220],
  [425, 244],
];

function Doc({ x, y, w = 60, h = 76, hl, on = true }: { x: number; y: number; w?: number; h?: number; hl?: boolean; on?: boolean }) {
  const rows = Math.floor((h - 14) / 9);
  return (
    <g style={{ opacity: on ? 1 : 0.3 }}>
      <rect class={`ai-doc${hl ? ' hl' : ''}`} x={x} y={y} width={w} height={h} rx={3} />
      {Array.from({ length: rows }, (_, r) => (
        <line key={r} class={hl && r === 2 ? 'ai-doc-l hl' : 'ai-doc-l'} x1={x + 7} x2={x + w - (r % 3 === 2 ? 16 : 7)} y1={y + 11 + r * 9} y2={y + 11 + r * 9} />
      ))}
    </g>
  );
}

function GroundScene({ top }: { top: ComponentChildren }) {
  return (
    <Story
      steps={RG_STEPS}
      at={RG_AT}
      end={23}
      poster={22}
      label="Grounded answers"
      top={top}
      why="Example documents, question and policy text, with times compressed. How the matching passages are found is simplified to a single step."
      legend={[
        { color: 'var(--flow)', label: 'Question' },
        { color: 'var(--ok)', label: 'Answer' },
        { color: 'var(--ink)', label: 'Passage from your document' },
      ]}
      kpis={(t) => {
        const up = RG.up.filter((u) => t >= u + 1).length;
        const general = t >= 3.4 && t < RG_AT[1];
        const grounded = t >= RG.shown;
        return [
          { k: 'Documents uploaded', v: `${up} of 3` },
          {
            k: 'Answer comes from',
            v: grounded ? 'Your documents' : general ? 'Training only' : 'No answer yet',
            tone: grounded ? 'ok' : general ? 'warn' : undefined,
          },
          {
            k: 'Citations in the answer',
            v: grounded ? 1 : 0,
            tone: grounded ? 'ok' : undefined,
            sub: grounded ? 'links to the source' : undefined,
          },
          { k: 'In NAI', v: '2.8', sub: 'document upload in the Agent app' },
        ];
      }}
    >
      {(t, phase) => {
        const uploaded = (i: number) => t >= RG.up[i] + 1;
        const general = t >= 3.4 && t < RG_AT[1];
        const grounded = t >= RG.shown;
        const found = t >= RG.ask2 + 0.6;
        // the first question (general) and the second (grounded): out to the model and back
        const q1 = fly(t, RG.ask1, RG.ask1 + 0.6, Q_IN) ?? fly(t, RG.ask1 + 0.6, RG.ask1 + 1.2, TO_MODEL);
        const a1 = fly(t, 2.4, 3.0, TO_MODEL.slice().reverse() as Pt[]) ?? fly(t, 3.0, 3.4, TO_CARD);
        const q2 = fly(t, RG.ask2, RG.ask2 + 0.6, Q_IN) ?? fly(t, RG.send, RG.send + 0.7, TO_MODEL);
        const a2 = fly(t, RG.back, RG.back + 0.7, TO_MODEL.slice().reverse() as Pt[]) ?? fly(t, RG.back + 0.7, RG.shown, TO_CARD);
        const work = Math.max(prog(t, 1.7, 2.4) < 1 ? prog(t, 1.7, 2.4) : 0, prog(t, RG.send + 0.7, RG.back) < 1 ? prog(t, RG.send + 0.7, RG.back) : 0);
        return (
          <svg
            class="diagram ai-svg"
            viewBox={`0 0 ${W} 364`}
            role="img"
            aria-label="You ask a question in the Agent app. Without your documents the model gives a general answer. After you upload documents, the matching passage is sent to the model with the question, and the answer comes back with a citation linking to the source document."
          >
            <Box x={16} y={28} w={220} h={72} t="You, in the Agent app" s="“How long is parental" s2="leave here?”" />
            <polyline points={pts(Q_IN)} class="ai-wire" />
            <text class="muted ai-cap" x={16} y={132}>
              Your documents
            </text>
            {DOCS.map((d, i) => (
              <g key={d}>
                <Doc x={docX(i)} y={142} />
                <text class="d-fine" x={docX(i) + 30} y={234} text-anchor="middle">
                  {d}
                </text>
              </g>
            ))}
            <rect class="ai-ep" x={300} y={20} width={250} height={200} rx={8} />
            <text class="ai-site-t" x={314} y={42}>
              Agent app
            </text>
            <text class="d-sub muted" x={314} y={60}>
              part of Nutanix Enterprise AI
            </text>
            <text class="d-fine muted" x={316} y={86}>
              {DOCS.some((_, i) => uploaded(i)) ? 'Uploaded documents' : 'No documents uploaded yet'}
            </text>
            {DOCS.map((d, i) => uploaded(i) && <Doc key={d} x={slotDoc(i)[0]} y={slotDoc(i)[1]} w={40} h={50} hl={i === 0 && found} />)}
            <circle cx={321} cy={170} r={4.5} class={found && phase >= 2 ? 'ai-dot on flow' : 'ai-dot'} />
            <text class={`d-fine${found && phase >= 2 ? '' : ' muted'}`} x={332} y={174} style={{ fontWeight: found && phase >= 2 ? 600 : 400 }}>
              Finds the matching passages
            </text>
            <circle cx={321} cy={192} r={4.5} class={grounded ? 'ai-dot on ok' : 'ai-dot'} />
            <text class={`d-fine${grounded ? '' : ' muted'}`} x={332} y={196} style={{ fontWeight: grounded ? 600 : 400 }}>
              Adds citations to the answer
            </text>
            <polyline points={pts(TO_MODEL)} class="ai-wire" />
            <NodeFrame x={620} y={20} w={324} h={112} title="gpu-node-1" status="model endpoint">
              <g>
                <Gpu x={632} y={50} w={300} name="GPU" cap={80} parts={[{ at: 0, gb: 60, label: 'Model' }]} work={work} bar={28} />
              </g>
            </NodeFrame>
            <text class="d-fine muted" x={620} y={152}>
              {phase >= 2 && t >= RG.send + 0.7 ? 'Reads the question and the passage together' : 'Knows only what it was trained on'}
            </text>
            <line class="ai-wire" x1={425} x2={425} y1={220} y2={244} />
            <rect class={`ai-box${general ? ' warn' : ''}`} x={300} y={244} width={644} height={104} rx={6} />
            <text class="d-label" x={316} y={266} style={{ fontWeight: 600 }}>
              Answer
            </text>
            {general && (
              <g>
                <text class="d-label" x={316} y={292}>
                  “Parental leave varies from employer to employer.”
                </text>
                <text class="d-sub warn-fill" x={316} y={320} style={{ fontWeight: 600 }}>
                  General answer: nothing here comes from your policy
                </text>
              </g>
            )}
            {grounded && (
              <g>
                <text class="d-label" x={316} y={292}>
                  “Parental leave here is 16 weeks at full pay.”{' '}
                  <tspan class="ai-cite" style={{ fontWeight: 600 }}>
                    [1]
                  </tspan>
                </text>
                <text class="d-sub" x={316} y={320}>
                  <tspan class="ai-cite" style={{ fontWeight: 600 }}>
                    [1] HR policy, section 4.2
                  </tspan>
                  <tspan class="muted"> · the citation links back to the source</tspan>
                </text>
                <polyline
                  points={pts([
                    [310, 316],
                    [284, 316],
                    [284, 121],
                    [314, 121],
                  ])}
                  class="ai-load"
                />
              </g>
            )}
            {!general && !grounded && (
              <text class="d-sub muted" x={316} y={292}>
                {phase === 1 ? 'Ask again once the documents are uploaded' : 'Waiting for the model'}
              </text>
            )}
            {DOCS.map((d, i) => {
              const p = fly(t, RG.up[i], RG.up[i] + 1, [
                [docX(i) + 30, 180],
                [docX(i) + 30, 118],
                [268, 118],
                [268, 121],
                [slotDoc(i)[0] + 20, 121],
              ]);
              return p && <rect key={d} class="ai-doc fly" x={p[0] - 10} y={p[1] - 13} width={20} height={26} rx={2} />;
            })}
            {q1 && <circle cx={q1[0]} cy={q1[1]} r={6} class="ai-req" />}
            {a1 && <circle cx={a1[0]} cy={a1[1]} r={6} class="ai-ans" />}
            {q2 && (
              <g>
                {t >= RG.send && <rect class="ai-model" x={q2[0] - 20} y={q2[1] - 6} width={12} height={12} rx={2} />}
                <circle cx={q2[0]} cy={q2[1]} r={6} class="ai-req" />
              </g>
            )}
            {a2 && <circle cx={a2[0]} cy={a2[1]} r={6} class="ai-ans" />}
          </svg>
        );
      }}
    </Story>
  );
}

// ── the tab ──────────────────────────────────────────────────────────────────────────────────────
type Topic = 'tune' | 'iam' | 'rag';
const TOPICS: { value: Topic; label: string }[] = [
  { value: 'tune', label: 'Fine-tuning' },
  { value: 'iam', label: 'Roles and sharing' },
  { value: 'rag', label: 'Grounded answers' },
];

export default function OwnView() {
  const [topic, setTopic] = useEnum<Topic>('o', 'tune', ['tune', 'iam', 'rag']);
  const top = <Choice<Topic> label="Capability" value={topic} onChange={setTopic} options={TOPICS} />;
  if (topic === 'iam') return <RolesScene key="iam" top={top} />;
  if (topic === 'rag') return <GroundScene key="rag" top={top} />;
  return <TuneScene key="tune" top={top} />;
}
