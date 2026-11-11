// Enterprise AI, Faster answers tab: speculative decoding (a small draft model guesses tokens, the
// large model checks them) and KV-cache offload (a conversation's notes move to host memory instead
// of being evicted; tech preview). The sentence, sizes and timings are examples; claims are in
// docs/facts.md (AI-4, AI-5, AI-14, AI-15).
import type { ComponentChildren } from 'preact';
import { SPEC_EXAMPLE, specExample } from '../../../engine/ai-speed';
import { useEnum } from '../../../state/route';
import { NodeFrame } from '../../components/parts';
import { Choice, prog } from '../../components/show';
import { Box, Preview, Story, W, fly, pts, type Pt, type StoryStep } from './kit';

// ── Speculative decoding ─────────────────────────────────────────────────────────────────────────
const TOKENS = SPEC_EXAMPLE.tokens;
const WRONG = SPEC_EXAMPLE.wrong;
const ROUNDS = specExample();
const SP_AT = [0, 7.5, 10, 12.5, 17];
const SP_STEPS: StoryStep[] = [
  {
    tone: 'ink',
    k: 'One token per pass',
    text: 'A language model writes its answer one token (a word or part of one) at a time, and every token takes a full pass through the large model. Twelve tokens, twelve passes.',
  },
  {
    tone: 'flow',
    k: 'A small draft model guesses ahead',
    text: 'With speculative decoding, a lightweight draft model runs first and guesses the next few tokens. It is far smaller than the main model, so its guesses cost little.',
  },
  {
    tone: 'ok',
    k: 'The large model checks them in one pass',
    text: 'The large model checks all the guesses together in a single pass and keeps the ones it agrees with: three tokens for the price of one pass.',
  },
  {
    tone: 'warn',
    k: 'A wrong guess costs little',
    text: 'When a guess is wrong, the large model writes its own token there and the guesses after it are dropped. The large model still decides every token of the answer.',
  },
  {
    tone: 'ok',
    k: 'The same answer in fewer passes',
    text: `Here the answer took ${ROUNDS.length} passes through the large model instead of ${TOKENS.length}. Nutanix says speculative decoding speeds up token generation by up to 2.5x in NAI 2.8.`,
  },
];
/** Per round of the example (a unit test holds it at five): when the guesses start, when the large model checks, and when the result shows. */
const SP_T = [
  [8.0, 10.4, 10.9],
  [12.9, 14.0, 14.5],
  [17.3, 18.1, 18.5],
  [18.9, 19.7, 20.1],
  [20.5, 21.1, 21.5],
];
const ALONE = { start: 0.8, per: 0.5 };
const CHIP = { w: 70, h: 28, gap: 6, x0: 24 };
const chipX = (i: number) => CHIP.x0 + i * (CHIP.w + CHIP.gap);
const BARS = { x: 200, w: 672 };

type TokenState = {
  kind: 'guess' | 'kept' | 'fixed' | 'dropped';
  text: string;
  fade?: number;
};
/** What the lower lane shows for token i at time t. */
function tokenAt(i: number, t: number): TokenState | null {
  let out: TokenState | null = null;
  ROUNDS.forEach((r, k) => {
    const j = i - r.from;
    if (j < 0 || j >= r.guesses) return;
    const [g, , d] = SP_T[k];
    if (t < g + j * 0.2) return;
    const guess = WRONG[i] ?? TOKENS[i];
    if (t < d) out = { kind: 'guess', text: guess };
    else if (j < r.accepted) out = { kind: 'kept', text: TOKENS[i] };
    else if (j === r.accepted) out = { kind: 'fixed', text: TOKENS[i] };
    else out = t < d + 0.8 ? { kind: 'dropped', text: guess, fade: 1 - prog(t, d, d + 0.8) } : null;
  });
  return out;
}

function Lamp({ x, y, t, on, tone }: { x: number; y: number; t: string; on: boolean; tone: 'ink' | 'flow' }) {
  return (
    <g>
      <rect x={x} y={y} width={140} height={28} rx={4} class={on ? `ai-lamp on ${tone}` : 'ai-lamp'} />
      <text x={x + 70} y={y + 18} text-anchor="middle" class={`d-sub${on ? '' : ' muted'}`} style={{ fontWeight: on ? 600 : 400 }}>
        {t}
        {on ? ' · working' : ''}
      </text>
    </g>
  );
}

function SpecScene({ top }: { top: ComponentChildren }) {
  return (
    <Story
      steps={SP_STEPS}
      at={SP_AT}
      end={24.5}
      poster={23.6}
      label="Speculative decoding"
      top={top}
      why="An example sentence with two wrong guesses, a draft model that guesses three tokens ahead, and times compressed. Passes are counted, not timed: the real speed-up depends on the models and the prompt, and Nutanix’s figure is up to 2.5x."
      legend={[
        { color: 'var(--ink)', label: 'Written by the large model' },
        { color: 'var(--flow)', label: 'Draft model’s guess', dashed: true },
        { color: 'var(--warn)', label: 'Guess corrected' },
      ]}
      kpis={(t) => {
        const alone = Math.min(TOKENS.length, Math.max(0, Math.floor((t - ALONE.start) / ALONE.per) + 1));
        const done = ROUNDS.filter((_, k) => t >= SP_T[k][2]);
        const kept = done.reduce((a, r) => a + r.accepted, 0);
        const guessed = done.reduce((a, r) => a + r.guesses, 0);
        return [
          {
            k: 'Passes, large model alone',
            v: t < ALONE.start ? 0 : alone,
            sub: 'one per token',
          },
          {
            k: 'Passes with a draft model',
            v: done.length,
            tone: done.length === ROUNDS.length ? 'ok' : undefined,
            sub: done.length === ROUNDS.length ? 'for the same 12 tokens' : undefined,
          },
          { k: 'Guesses kept', v: `${kept} of ${guessed}` },
          {
            k: 'Nutanix’s figure',
            v: 'Up to 2.5x',
            sub: 'faster token generation',
          },
        ];
      }}
    >
      {(t, phase) => {
        const alone = t < ALONE.start ? 0 : Math.min(TOKENS.length, Math.floor((t - ALONE.start) / ALONE.per) + 1);
        const aloneBusy = t >= ALONE.start - 0.3 && t < ALONE.start + TOKENS.length * ALONE.per;
        const k = SP_T.findIndex(([g, , d]) => t >= g && t < d);
        const drafting = k >= 0 && t < SP_T[k][0] + ROUNDS[k].guesses * 0.2 + 0.3;
        const checking = k >= 0 && t >= SP_T[k][1];
        const passes = ROUNDS.filter((_, r) => t >= SP_T[r][2]).length;
        const unit = BARS.w / TOKENS.length;
        return (
          <svg
            class="diagram ai-svg"
            viewBox={`0 0 ${W} 356`}
            role="img"
            aria-label="The same twelve-token answer written twice. Alone, the large model takes twelve passes, one per token. With speculative decoding a small draft model guesses three tokens at a time and the large model checks them in one pass, keeping the right ones and correcting the wrong ones, so it takes five passes."
          >
            {/* the large model alone */}
            <text class="d-label" x={CHIP.x0} y={32} style={{ fontWeight: 600 }}>
              Large model alone
            </text>
            <text class="d-sub muted" x={CHIP.x0} y={49}>
              one pass through the large model for every token
            </text>
            <Lamp x={796} y={20} t="Large model" on={aloneBusy} tone="ink" />
            {TOKENS.map((tok, i) => (
              <g key={i}>
                <rect class="ai-tok" x={chipX(i)} y={60} width={CHIP.w} height={CHIP.h} rx={4} />
                {i < alone && (
                  <g>
                    <rect class="ai-tok on" x={chipX(i)} y={60} width={CHIP.w} height={CHIP.h} rx={4} />
                    <text class="d-sub" x={chipX(i) + CHIP.w / 2} y={79} text-anchor="middle">
                      {tok}
                    </text>
                  </g>
                )}
              </g>
            ))}
            <line class="ai-net" x1={CHIP.x0} x2={W - 24} y1={108} y2={108} />

            {/* with a draft model */}
            <g style={{ opacity: phase === 0 ? 0.45 : 1 }}>
              <text class="d-label" x={CHIP.x0} y={136} style={{ fontWeight: 600 }}>
                With speculative decoding
              </text>
              <text class="d-sub muted" x={CHIP.x0} y={153}>
                a small draft model guesses, the large model checks
              </text>
              <Lamp x={640} y={124} t="Draft model" on={drafting} tone="flow" />
              <Lamp x={796} y={124} t="Large model" on={checking} tone="ink" />
              {TOKENS.map((_, i) => {
                const s = tokenAt(i, t);
                return (
                  <g key={i}>
                    <rect class="ai-tok" x={chipX(i)} y={164} width={CHIP.w} height={CHIP.h} rx={4} />
                    {s && (
                      <g style={{ opacity: s.fade ?? 1 }}>
                        <rect class={`ai-tok ${s.kind === 'guess' || s.kind === 'dropped' ? 'guess' : s.kind === 'fixed' ? 'on fixed' : 'on'}`} x={chipX(i)} y={164} width={CHIP.w} height={CHIP.h} rx={4} />
                        <text
                          class={`d-sub${s.kind === 'guess' || s.kind === 'dropped' ? ' muted' : ''}`}
                          x={chipX(i) + CHIP.w / 2}
                          y={183}
                          text-anchor="middle"
                          style={{
                            textDecoration: s.kind === 'dropped' ? 'line-through' : undefined,
                          }}
                        >
                          {s.text}
                        </text>
                        <text class={`d-fine ${s.kind === 'fixed' ? 'warn-fill' : 'muted'}`} x={chipX(i) + CHIP.w / 2} y={208} text-anchor="middle" style={{ fontWeight: s.kind === 'fixed' ? 600 : 400 }}>
                          {s.kind === 'guess' ? 'guess' : s.kind === 'kept' ? 'kept' : s.kind === 'fixed' ? `not “${WRONG[i]}”` : 'dropped'}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
              {k >= 0 && checking && <rect class="ai-check" x={chipX(ROUNDS[k].from) - 3} y={161} width={ROUNDS[k].guesses * (CHIP.w + CHIP.gap) - CHIP.gap + 6} height={CHIP.h + 6} rx={6} />}
            </g>

            {/* passes through the large model, side by side */}
            <text class="muted ai-cap" x={CHIP.x0} y={246}>
              Passes through the large model
            </text>
            {[
              { l: 'Alone', n: alone, y: 258 },
              { l: 'With a draft model', n: passes, y: 294 },
            ].map((b) => (
              <g key={b.l}>
                <text class="d-sub" x={CHIP.x0} y={b.y + 16}>
                  {b.l}
                </text>
                <rect class="ai-bar" x={BARS.x} y={b.y} width={BARS.w} height={24} rx={3} />
                {Array.from({ length: b.n }, (_, i) => (
                  <rect key={i} class="ai-mem" x={BARS.x + i * unit + 1} y={b.y} width={unit - 2} height={24} rx={3} />
                ))}
                {b.n > 0 && (
                  <text class="d-sub" x={BARS.x + b.n * unit + 8} y={b.y + 16} style={{ fontWeight: 600 }}>
                    {b.n}
                  </text>
                )}
              </g>
            ))}
            {passes === ROUNDS.length && (
              <text class="d-sub ok-fill" x={BARS.x} y={340} style={{ fontWeight: 600 }}>
                ✓ Same {TOKENS.length} tokens in {ROUNDS.length} passes
              </text>
            )}
          </svg>
        );
      }}
    </Story>
  );
}

// ── KV-cache offload (tech preview) ──────────────────────────────────────────────────────────────
const KV_AT = [0, 6, 11.5, 16.5, 22];
const KV_STEPS: StoryStep[] = [
  {
    tone: 'ink',
    k: 'The model keeps notes on what it has read',
    text: 'As a model reads a conversation it keeps its working notes, the KV cache, in GPU memory. A follow-up question reuses them, so nothing is recomputed and the first token comes quickly.',
  },
  {
    tone: 'flow',
    k: 'More conversations, more notes',
    text: 'Every active conversation adds its own notes, and they grow as its history grows. The GPU memory left over after the model itself fills up.',
  },
  {
    tone: 'warn',
    k: 'Full: old notes would be evicted',
    text: 'When the cache is full, the inference engine starts evicting parts of it. Chat A’s notes would go first, and its next question would mean recomputing its whole history.',
  },
  {
    tone: 'ink',
    k: 'Offload moves them to host memory',
    text: 'With KV-cache offload, a tech preview in NAI 2.8 for local endpoints, the notes move to the server’s host (CPU) memory instead of being thrown away. The GPU has room again.',
  },
  {
    tone: 'ok',
    k: 'Chat A returns and starts fast',
    text: 'When chat A asks again, its notes come back from host memory, so the answer starts quickly: a fast time to first token. This is a tech preview, not for production use.',
  },
];
const KV = { x: 290, w: 634, gpuY: 78, hostY: 228, h: 48, model: 50, cap: 80 };
const KPX = KV.w / KV.cap;
const NOTE_W = 10 * KPX;
const slotGpu = (s: number): Pt => [KV.x + (KV.model + s * 10) * KPX, KV.gpuY];
const slotHost = (s: number): Pt => [KV.x + 8 + s * (NOTE_W + 8), KV.hostY];
const chatY = (i: number) => 40 + i * 72;
const chatPath = (i: number): Pt[] => [
  [216, chatY(i) + 28],
  [244, chatY(i) + 28],
  [244, KV.gpuY + 24],
  [KV.x, KV.gpuY + 24],
];
const lerp = (a: Pt, b: Pt, f: number): Pt => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
/** Each chat's prompts: when it is sent and how long before the answer starts. Short when its notes are reused; the last waits for chat A's notes to come back from host memory. */
const KV_ASKS = [
  { chat: 0, at: 0.5, wait: 1.2 },
  { chat: 0, at: 3.0, wait: 0.3 },
  { chat: 1, at: 6.4, wait: 1.2 },
  { chat: 2, at: 7.8, wait: 1.2 },
  { chat: 1, at: 11.9, wait: 1.2 },
  { chat: 0, at: 22.4, wait: 1.6 },
];
const KV_TRAVEL = 0.8;

function KvScene({ top }: { top: ComponentChildren }) {
  return (
    <Story
      steps={KV_STEPS}
      at={KV_AT}
      end={28}
      poster={26.5}
      label="KV-cache offload"
      top={top}
      why="Example sizes: an 80 GB GPU with a 50 GB model, and three conversations whose notes take 10 GB each. Real cache sizes depend on the model and how long each conversation is. KV-cache offload is a tech preview in NAI 2.8."
      legend={[
        { color: 'var(--ink)', label: 'Model weights' },
        { color: 'var(--flow)', label: 'A conversation’s notes (KV cache)' },
        { color: 'var(--ok)', label: 'Answer' },
      ]}
      kpis={(t, phase) => {
        const inGpu = (t >= 2 ? (t < 16.9 || t >= 24.6 ? 10 : 0) : 0) + (t >= 7.9 ? (t >= 19 ? 20 : 10) : 0) + (t >= 9.3 ? (t < 23.2 ? 10 : 0) : 0);
        const inHost = (t >= 18.1 && t < 23.6 ? 1 : 0) + (t >= 24.2 ? 1 : 0);
        return [
          {
            k: 'GPU memory for notes',
            v: `${inGpu} of 30 GB`,
            tone: inGpu >= 30 && phase === 2 ? 'warn' : undefined,
            sub: inGpu >= 30 ? 'full' : undefined,
          },
          { k: 'Chats with notes in host memory', v: inHost },
          {
            k: 'Chat A’s next answer',
            v: t < 2 ? 'First read' : phase === 2 ? 'Would start slow' : 'Starts fast',
            tone: t < 2 ? undefined : phase === 2 ? 'warn' : 'ok',
            sub: t < 2 ? 'no notes yet' : phase === 2 ? 'if its notes were evicted' : phase >= 3 ? 'its notes were kept' : 'its notes are in GPU memory',
          },
          {
            k: 'Availability',
            v: 'Tech preview',
            sub: 'NAI 2.8, local endpoints',
          },
        ];
      }}
    >
      {(t, phase) => {
        // where each chat's notes are, and how wide (in 10 GB slots)
        const a: { p: Pt; w: number } | null =
          t < 1.3
            ? null
            : t < 16.9
              ? { p: slotGpu(0), w: prog(t, 1.3, 2) }
              : t < 23.6
                ? {
                    p: lerp(slotGpu(0), slotHost(0), prog(t, 16.9, 18.1)),
                    w: 1,
                  }
                : {
                    p: lerp(slotHost(0), slotGpu(2), prog(t, 23.6, 24.6)),
                    w: 1,
                  };
        const grow = prog(t, 18.3, 19);
        const b =
          t < 7.2
            ? null
            : {
                p: lerp(slotGpu(1), slotGpu(0), grow),
                w: prog(t, 7.2, 7.9) * (1 + grow),
              };
        const c = t < 8.6 ? null : t < 23.2 ? { p: slotGpu(2), w: prog(t, 8.6, 9.3) } : { p: lerp(slotGpu(2), slotHost(1), prog(t, 23.2, 24.2)), w: 1 };
        const doomed = phase === 2 && t >= 12.7;
        const reusedA = (t >= 3.8 && t < 4.8) || (t >= 24.6 && t < 26);
        const notes = [
          { n: 'Chat A', s: a, warn: doomed, hot: reusedA },
          { n: 'Chat B', s: b },
          { n: 'Chat C', s: c },
        ];
        const hostBusy = (a && a.p[1] > KV.gpuY + 20) || (c && c.p[1] > KV.gpuY + 20);
        return (
          <svg
            class="diagram ai-svg"
            viewBox={`0 0 ${W} 344`}
            role="img"
            aria-label="Three conversations and one GPU. Each conversation's notes, the KV cache, sit in GPU memory beside the model and fill it up. Instead of evicting chat A's notes, KV-cache offload moves them to host memory, and they come back when chat A asks again, so its answer starts fast."
          >
            {['Chat A', 'Chat B', 'Chat C'].map((n, i) => (
              <g key={n}>
                <Box
                  x={16}
                  y={chatY(i)}
                  w={200}
                  h={56}
                  t={n}
                  state={
                    i === 0 && phase === 2 && doomed ? 'next answer would start slow' : i === 0 && (reusedA || t >= 26) ? '✓ answer starts fast' : i === 0 && t >= 4.8 && t < 22 ? 'quiet for now' : 'a long conversation'
                  }
                  tone={i === 0 && phase === 2 && doomed ? 'warn' : i === 0 && (reusedA || t >= 26) ? 'ok' : undefined}
                />
                <polyline points={pts(chatPath(i))} class="ai-wire" />
              </g>
            ))}
            <NodeFrame x={270} y={24} w={674} h={296} title="gpu-node-1" status="one 80 GB GPU">
              <g>
                <text class="d-label" x={KV.x} y={68} style={{ fontWeight: 600 }}>
                  GPU memory
                </text>
                <rect class="ai-bar" x={KV.x} y={KV.gpuY} width={KV.w} height={KV.h} rx={3} />
                <rect class="ai-mem" x={KV.x} y={KV.gpuY} width={KV.model * KPX} height={KV.h} rx={3} />
                <text class="d-sub ai-on-ink" x={KV.x + (KV.model * KPX) / 2} y={KV.gpuY + 29} text-anchor="middle">
                  Model weights · 50 GB
                </text>
                <text class="d-fine muted" x={KV.x + KV.model * KPX + 4} y={KV.gpuY + KV.h + 16}>
                  KV cache: notes on text already read · 30 GB
                </text>
                <text class="d-label" x={KV.x} y={218} style={{ fontWeight: 600 }}>
                  Host memory (CPU RAM)
                </text>
                <Preview x={836} y={202} />
                <rect class="ai-bar" x={KV.x} y={KV.hostY} width={KV.w} height={KV.h} rx={3} />
                {!hostBusy && (
                  <text class="d-sub muted" x={KV.x + KV.w / 2} y={KV.hostY + 29} text-anchor="middle">
                    free
                  </text>
                )}
                <text class="d-fine muted" x={KV.x} y={KV.hostY + KV.h + 16}>
                  {phase >= 3 ? 'Offloaded notes wait here until their conversation continues' : 'Not used for the cache without offload'}
                </text>
                {notes.map(
                  ({ n, s, warn, hot }) =>
                    s &&
                    s.w > 0.05 && (
                      <g key={n}>
                        <rect class={`ai-note${warn ? ' doomed' : ''}${hot ? ' hot' : ''}`} x={s.p[0] + 2} y={s.p[1] + 4} width={NOTE_W * s.w - 4} height={KV.h - 8} rx={3} />
                        {s.w > 0.7 && (
                          <text class="d-fine" x={s.p[0] + (NOTE_W * s.w) / 2} y={s.p[1] + 28} text-anchor="middle" style={{ fontWeight: 600 }}>
                            {n}
                          </text>
                        )}
                      </g>
                    ),
                )}
                {doomed && (
                  <text class="d-fine warn-fill" x={slotGpu(0)[0] + NOTE_W / 2} y={KV.gpuY - 6} text-anchor="middle" style={{ fontWeight: 600 }}>
                    would be evicted
                  </text>
                )}
              </g>
            </NodeFrame>
            {KV_ASKS.map((q, i) => {
              const path = chatPath(q.chat);
              const out = fly(t, q.at, q.at + KV_TRAVEL, path);
              const back = fly(t, q.at + KV_TRAVEL + q.wait, q.at + 2 * KV_TRAVEL + q.wait, path.slice().reverse() as Pt[]);
              const p = out ?? back;
              return p && <circle key={i} cx={p[0]} cy={p[1]} r={6} class={out ? 'ai-req' : 'ai-ans'} />;
            })}
          </svg>
        );
      }}
    </Story>
  );
}

// ── the tab ──────────────────────────────────────────────────────────────────────────────────────
type Technique = 'spec' | 'kv';
const TECHNIQUES: { value: Technique; label: string }[] = [
  { value: 'spec', label: 'Speculative decoding' },
  { value: 'kv', label: 'KV-cache offload' },
];

export default function SpeedView() {
  const [how, setHow] = useEnum<Technique>('f', 'spec', ['spec', 'kv']);
  const top = <Choice<Technique> label="Technique" value={how} onChange={setHow} options={TECHNIQUES} />;
  return how === 'kv' ? <KvScene key="kv" top={top} /> : <SpecScene key="spec" top={top} />;
}
