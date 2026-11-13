// Enterprise AI, Overview tab: NAI in one loop, as a situation. Four teams each reach AI their own way
// (one sends customer data to a public service, one is told no); NAI arrives on Kubernetes you control;
// a model from its catalog becomes an endpoint with replicas on GPUs; apps call it and agents go
// through Agent Gateway; roles, sharing and monitoring govern it; every team ends up on one platform.
// The other tabs show each part in detail. Claims: research row 7a, facts REV-5, AGW-1 to AGW-5,
// AI-8 to AI-10 and AI-19.
import { NodeFrame } from '../../components/parts';
import { ease, prog } from '../../components/show';
import { Gpu, Story, W, fly, pts, type Pt, type StoryStep } from './kit';

const S = [0, 8, 15, 22, 30, 38];
const END = 46;
const STEPS: StoryStep[] = [
  {
    tone: 'warn',
    k: 'Every team wants AI',
    text: 'Every team wants AI on company data, and each finds its own way. Support sends customer data to a public AI service, the finance team is told no, a coding agent runs on its own key, and the platform team cannot see any of it.',
  },
  {
    tone: 'ink',
    k: 'NAI on Kubernetes you control',
    text: 'Nutanix Enterprise AI (NAI) runs on Kubernetes you control: NKP on Nutanix in your data center, Amazon EKS, Azure AKS or Google GKE in your own cloud account, or a site with no internet at all. Here it runs in the data center, on servers with GPUs.',
  },
  {
    tone: 'flow',
    k: 'A model becomes an endpoint',
    text: 'The admin picks a model from NAI’s catalog: an NVIDIA NIM package, a Hugging Face model or your own files. NAI deploys it as an endpoint with one address, and a copy of the model, a replica, on each of two GPUs.',
  },
  {
    tone: 'flow',
    k: 'Apps and agents connect',
    text: 'Apps call the endpoint with an API token, so support’s questions are now answered inside the company. Agents go through Agent Gateway: one address for every model, with fallback and rate limits, and an MCP Gateway that checks each tool call and logs it.',
  },
  {
    tone: 'ok',
    k: 'Governed',
    text: 'Roles decide who may create endpoints and API keys, models are shared only with the teams that need them, and GPU and model use is monitored. In the Agent app, the finance analyst’s answers come from the team’s own documents, with citations.',
  },
  {
    tone: 'ok',
    k: 'One platform for every team',
    text: 'Every team now uses AI on one platform the company controls. Prompts and data stay on your infrastructure, the same NAI can run in your cloud account or at an air-gapped site, and it is licensed by GPU memory, not by tokens.',
  },
];

// ── geometry ──
const H = 398;
const CARD = { y: 8, h: 82, w: 231, gap: 12 };
const cardX = (i: number) => i * (CARD.w + CARD.gap);
const cardCx = (i: number) => cardX(i) + CARD.w / 2;
const LAYER = { y: 112, h: 150 };
const BAND = { y: LAYER.y + 34, h: 96, gap: 10 };
const BW = (W - 24 - 3 * BAND.gap) / 4;
const bandX = (k: number) => 12 + k * (BW + BAND.gap);
const bandCx = (k: number) => bandX(k) + BW / 2;
const SITE = { y: 290, h: 102 };
const DC = { x: 0, w: 560 };
const GPU_Y = SITE.y + 46;
const GPU_W = 260;
const gpuX = (g: number) => 12 + g * (GPU_W + 16);
const gpuCx = (g: number) => gpuX(g) + GPU_W / 2;
const LANE_TOP = 100; // between the teams and NAI
const LANE_IN = 254; // inside NAI, under its bands
const LANE_LOW = 276; // between NAI and the servers
const GB = 80;
const MODEL_GB = 60;

const TEAMS = ['Support assistant', 'Finance analyst', 'Coding agent', 'Platform admin'];
const TEAM_SUB = ['an app for customers', 'works with private figures', 'writes code with tools', 'runs the AI platform'];
const BANDS = [
  { t: 'Model catalog', l: ['NVIDIA NIM, Hugging Face', 'or your own files'] },
  { t: 'Endpoints', l: ['one address, API tokens', 'replicas on GPUs'] },
  { t: 'Agent Gateway', l: ['one API for every model', 'fallback, limits, MCP tools'] },
  { t: 'Governance', l: ['roles, model sharing', 'API keys, monitoring'] },
];

// ── timing ──
const LEAK = [2.6, 4.6, 6.2]; // support's prompts going to the public service
const LAYER_IN = S[1] + 2.6;
const LOAD = [S[2] + 1.0, S[2] + 1.4]; // the two copies of the model leave the catalog
const FLIGHT = 1.8;
const LANDED = LOAD.map((a) => a + FLIGHT);
const TRIP = { out: 1.6, hold: 0.7 };
const tripEnd = (a: number) => a + 2 * TRIP.out + TRIP.hold;
/** Who asks, when, and which GPU answers. */
const TRIPS = [
  { team: 0, at: S[3] + 0.6, gpu: 0 },
  { team: 0, at: S[3] + 2.2, gpu: 1 },
  { team: 2, at: S[3] + 3.4, gpu: 1 },
  { team: 1, at: S[4] + 1.6, gpu: 0 },
  { team: 0, at: S[5] + 0.6, gpu: 0 },
  { team: 1, at: S[5] + 1.0, gpu: 1 },
  { team: 2, at: S[5] + 1.4, gpu: 0 },
];
const GW_AT = tripEnd(TRIPS[2].at) - 0.6; // the agent's request, rate-limited and its tokens tracked at the gateway
const ADMIN_OK = S[4] + 1.0;
/** When each team is on the platform: support's first answer, finance's answer, the agent's request through the gateway, the admin's roles. */
const ON_BY_TEAM = [tripEnd(TRIPS[0].at), tripEnd(TRIPS[3].at), GW_AT, ADMIN_OK];

function path(team: number, gpu: number): Pt[] {
  const x0 = cardCx(team);
  const head: Pt[] =
    team === 2
      ? [
          [x0, CARD.y + CARD.h],
          [x0, LANE_IN],
          [bandCx(1), LANE_IN],
        ] // through Agent Gateway, then the endpoint
      : [
          [x0, CARD.y + CARD.h],
          [x0, LANE_TOP],
          [bandCx(1), LANE_TOP],
          [bandCx(1), LANE_IN],
        ];
  return [...head, [bandCx(1), LANE_LOW], [gpuCx(gpu), LANE_LOW], [gpuCx(gpu), GPU_Y]];
}
const LOAD_PATH = (g: number): Pt[] => [
  [bandCx(0), BAND.y + BAND.h - 20],
  [bandCx(0), LANE_IN],
  [bandCx(1), LANE_IN],
  [bandCx(1), LANE_LOW],
  [gpuCx(g), LANE_LOW],
  [gpuCx(g), GPU_Y + 30],
];
const LEAK_PATH: Pt[] = [
  [cardCx(0), CARD.y + CARD.h],
  [cardCx(0), 184],
  [700, 184],
];

/** A team's status line(s), and its tone. */
function teamState(i: number, t: number): { l: string[]; tone?: 'ok' | 'warn' | 'bad' } {
  if (t >= ON_BY_TEAM[i]) {
    return [
      { l: ['✓ answered by your own endpoint'], tone: 'ok' as const },
      { l: ['✓ answer cites the policy doc'], tone: 'ok' as const },
      { l: ['✓ through Agent Gateway:', 'rate-limited, tokens tracked'], tone: 'ok' as const },
      { l: ['✓ roles set, model shared', 'with Finance'], tone: 'ok' as const },
    ][i];
  }
  if (t < S[1]) {
    return [
      { l: ['sends customer data to a', 'public AI service'], tone: 'warn' as const },
      { l: ['✕ told no: its data must not', 'leave the company'], tone: 'bad' as const },
      { l: ['its own API key: no limit,', 'no log of tool calls'], tone: 'warn' as const },
      { l: ['no view of who uses which', 'model, or what it costs'], tone: 'warn' as const },
    ][i];
  }
  if (i === 3) return { l: [t < S[2] ? 'installs NAI on Kubernetes' : t < S[3] ? 'picks a model, deploys it' : 'sees GPU and model use'] };
  // Before the endpoint exists every team waits; once it does, each is on its way to it.
  if (t < LANDED[1] + 0.5) return { l: ['waiting for a private endpoint'] };
  return { l: [['connecting to the endpoint', 'endpoint ready, no access yet', 'connecting through Agent Gateway'][i]] };
}

function Diagram({ t, sc }: { t: number; sc: number }) {
  const layer = ease(prog(t, LAYER_IN, LAYER_IN + 1.2));
  const siteIn = (k: number) => ease(prog(t, S[1] + 0.4 + k * 0.4, S[1] + 1.2 + k * 0.4));
  const publicOut = 1 - ease(prog(t, S[1], S[1] + 0.8));
  const loaded = (g: number) => prog(t, LANDED[g], LANDED[g] + 0.5);
  const ready = t >= LANDED[1] + 0.5;
  const gwOk = t >= GW_AT;
  const bandOn = (k: number) => sc === 5 || (sc === 2 && k <= 1) || (sc === 3 && (k === 1 || k === 2)) || (sc === 4 && (k === 1 || k === 3));
  const bandState = [
    sc >= 2 && t >= LOAD[0] ? '✓ model picked' : '',
    ready ? '✓ 1 endpoint, 2 replicas' : '',
    gwOk ? '✓ agent rate-limited, tracked' : sc >= 3 ? 'agents come through here' : '',
    t >= ADMIN_OK ? '✓ model shared with Finance' : '',
  ];
  // what each GPU is working on: a request that has reached it and not yet left
  const work = (g: number) => {
    const tr = TRIPS.find((r) => r.gpu === g && t >= r.at + TRIP.out && t < r.at + TRIP.out + TRIP.hold);
    return tr ? prog(t, tr.at + TRIP.out, tr.at + TRIP.out + TRIP.hold) : 0;
  };
  return (
    <svg
      class="diagram ai-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Four teams each reach AI their own way, and support's customer data leaves for a public AI service. Nutanix Enterprise AI then runs on Kubernetes in the data center: a model from its catalog becomes an endpoint with a replica on each of two GPUs, apps call it, agents go through Agent Gateway, and roles and model sharing govern it, so every team uses AI on one platform the company controls."
    >
      {/* the first scene's line, where NAI will be */}
      {sc === 0 && (
        <text x={W / 2} y={262} text-anchor="middle" class="halo d-title" style={{ fontWeight: 600, opacity: ease(prog(t, 1.2, 2.2)) }}>
          Every team wants AI on company data. Each finds its own way.
        </text>
      )}

      {/* the public AI service, outside the company */}
      {publicOut > 0 && (
        <g style={{ opacity: publicOut * ease(prog(t, 0.8, 1.6)) }}>
          <polyline points={pts(LEAK_PATH)} class="ai-wire leak" />
          <rect x={700} y={152} width={248} height={64} rx={6} class="ai-box leak" />
          <text class="d-label" x={714} y={176} style={{ fontWeight: 600 }}>
            Public AI service
          </text>
          <text class="d-sub warn-fill" x={714} y={196} style={{ fontWeight: 600 }}>
            {t >= LEAK[0] + 1.6 ? 'outside the company: has your data' : 'outside the company'}
          </text>
        </g>
      )}

      {/* the teams */}
      {TEAMS.map((name, i) => {
        const st = teamState(i, t);
        const x = cardX(i);
        return (
          <g key={name} style={{ opacity: ease(prog(t, 0.2 + i * 0.3, 0.9 + i * 0.3)) }}>
            <rect x={x} y={CARD.y} width={CARD.w} height={CARD.h} rx={6} class={`ai-box${st.tone === 'ok' ? ' ok' : ''}`} />
            <text class="d-label" x={x + 12} y={CARD.y + 21} style={{ fontWeight: 600 }}>
              {name}
            </text>
            <text class="muted d-sub" x={x + 12} y={CARD.y + 38}>
              {TEAM_SUB[i]}
            </text>
            {st.l.map((line, n) => (
              <text key={n} class={`d-sub ${st.tone ? `${st.tone}-fill` : 'muted'}`} x={x + 12} y={CARD.y + 57 + n * 16} style={{ fontWeight: st.tone ? 600 : 400 }}>
                {line}
              </text>
            ))}
          </g>
        );
      })}

      {/* NAI */}
      {layer > 0 && (
        <g style={{ opacity: layer, transform: `translateY(${(1 - layer) * -16}px)` }}>
          <rect x={0} y={LAYER.y} width={W} height={LAYER.h} rx={6} class="ai-ep" />
          <text class="d-title" x={12} y={LAYER.y + 23} style={{ fontWeight: 650 }}>
            Nutanix Enterprise AI
          </text>
          <text x={W - 12} y={LAYER.y + 23} text-anchor="end" class="muted d-sub">
            on Kubernetes you control
          </text>
          {BANDS.map((b, k) => {
            const on = bandOn(k);
            return (
              <g key={b.t}>
                <rect x={bandX(k)} y={BAND.y} width={BW} height={BAND.h} rx={4} class={`ai-band${on ? ' on' : ''}`} />
                <text x={bandX(k) + 10} y={BAND.y + 21} class={`d-label ai-band-t${on ? ' on' : ''}`} style={{ fontWeight: 600 }}>
                  {b.t}
                </text>
                {b.l.map((l, n) => (
                  <text key={l} x={bandX(k) + 10} y={BAND.y + 40 + n * 16} class={`d-sub ai-band-t${on ? ' on' : ' muted'}`}>
                    {l}
                  </text>
                ))}
                {bandState[k] && (
                  <text x={bandX(k) + 10} y={BAND.y + 84} class={`d-sub ai-band-t${on ? ' on' : ''}`} style={{ fontWeight: 600 }}>
                    {bandState[k]}
                  </text>
                )}
              </g>
            );
          })}
          <polyline
            points={pts([
              [bandCx(1), BAND.y + BAND.h],
              [bandCx(1), LAYER.y + LAYER.h],
            ])}
            class="ai-wire"
          />
        </g>
      )}

      {/* where it runs: the data center, or your cloud account, or an air-gapped site */}
      <g style={{ opacity: siteIn(0) }}>
        {layer > 0 && <line x1={bandCx(1)} x2={bandCx(1)} y1={LAYER.y + LAYER.h} y2={SITE.y} class="ai-wire" style={{ opacity: layer }} />}
        <NodeFrame x={DC.x} y={SITE.y} w={DC.w} h={SITE.h} title="Your data center" status={sc === 5 ? '✓ prompts and data stay here' : 'NKP on Nutanix servers with GPUs'} tone={sc === 5 ? 'ok' : undefined}>
          <g>
            {[0, 1].map((g) => (
              <Gpu
                key={g}
                x={gpuX(g)}
                y={GPU_Y}
                w={GPU_W}
                name={`GPU ${g + 1}`}
                cap={GB}
                parts={loaded(g) > 0 ? [{ at: 0, gb: MODEL_GB * loaded(g), label: `Replica ${g + 1}` }] : []}
                right={loaded(g) > 0 ? undefined : 'free'}
                work={work(g)}
                bar={16}
              />
            ))}
          </g>
        </NodeFrame>
      </g>
      {[
        { x: 580, t: 'Your cloud account', s: 'EKS, AKS or GKE' },
        { x: 780, t: 'Air-gapped site', s: 'NKP, no internet' },
      ].map((o, k) => (
        <g key={o.t} style={{ opacity: siteIn(k + 1) * (sc === 5 ? 1 : 0.55) }}>
          <text x={o.x} y={SITE.y - 6} class="muted d-fine">
            or
          </text>
          <rect x={o.x} y={SITE.y} width={180} height={SITE.h} rx={6} class="ai-box" />
          <text class="d-label" x={o.x + 12} y={SITE.y + 21} style={{ fontWeight: 600 }}>
            {o.t}
          </text>
          <text class="muted d-sub" x={o.x + 12} y={SITE.y + 38}>
            {o.s}
          </text>
          {sc === 5 && (
            <text class="ok-fill d-sub" x={o.x + 12} y={SITE.y + 64} style={{ fontWeight: 600 }}>
              ✓ NAI can run here too
            </text>
          )}
        </g>
      ))}

      {/* things in flight: support's data leaving, the model's copies, requests and answers */}
      {sc === 0 &&
        LEAK.map((a, k) => {
          const p = fly(t, a, a + 1.6, LEAK_PATH);
          return p && <circle key={k} cx={p[0]} cy={p[1]} r={6} class="ai-leak" />;
        })}
      {LOAD.map((a, g) => {
        const p = fly(t, a, a + FLIGHT, LOAD_PATH(g));
        return p && <rect key={g} class="ai-model" x={p[0] - 9} y={p[1] - 9} width={18} height={18} rx={3} />;
      })}
      {TRIPS.map((r, k) => {
        const p = path(r.team, r.gpu);
        const out = fly(t, r.at, r.at + TRIP.out, p);
        const back = fly(t, r.at + TRIP.out + TRIP.hold, tripEnd(r.at), p.slice().reverse() as Pt[]);
        const q = out ?? back;
        return q && <circle key={k} cx={q[0]} cy={q[1]} r={6} class={out ? 'ai-req' : 'ai-ans'} />;
      })}
    </svg>
  );
}

export default function OverviewView() {
  return (
    <Story
      steps={STEPS}
      at={S}
      end={END}
      poster={END - 1}
      label="Enterprise AI overview"
      why="A simplified story with example teams, a model and times compressed. Agent Gateway is licensed separately, and it can also register a remote NAI cluster as a provider. The other tabs show each part in detail: endpoints and replicas, GPUs, faster answers, models and data, and Agent Gateway."
      legend={[
        { color: 'var(--warn)', label: 'Data leaving the company' },
        { color: 'var(--ink)', label: 'Model, and GPU memory it takes' },
        { color: 'var(--flow)', label: 'Request' },
        { color: 'var(--ok)', label: 'Answer' },
      ]}
      kpis={(t, sc) => {
        const on = ON_BY_TEAM.filter((a) => t >= a).length;
        const inside = t >= TRIPS[0].at + TRIP.out;
        return [
          {
            k: 'Where prompts go',
            v: sc === 0 ? 'Outside the company' : inside ? 'Your data center' : 'Nowhere yet',
            tone: sc === 0 ? 'warn' : inside ? 'ok' : undefined,
            sub: sc === 0 ? 'to a public AI service' : inside ? 'infrastructure you control' : undefined,
          },
          { k: 'Teams on one platform', v: `${on} of 4`, tone: on === 4 ? 'ok' : undefined },
          { k: 'Endpoint replicas', v: LANDED.filter((a) => t >= a).length, sub: 'one endpoint, one address' },
        ];
      }}
    >
      {(t, sc) => <Diagram t={t} sc={sc} />}
    </Story>
  );
}
