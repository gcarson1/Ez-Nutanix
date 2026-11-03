// Agent Gateway (NAI): apps and agents call one gateway address; it routes model requests to NAI
// endpoints, a remote NAI cluster or an external provider, falls back when one fails, caps a runaway
// agent with its rate limit, and lets agents reach tools through the MCP Gateway, which adds the API
// key, enforces tool permissions and logs every call. Claims are in docs/facts.md section 16.
import { paced, useClock } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Kpis, Show, pathLength, phaseAt, prog } from '../../components/show';

type Pt = [number, number];

const P = [0, 4.0, 8.0, 12.0, 16.0, 20.4];
const END = 24.6;
const STEPS_TEXT: { tone: Tone | 'ink'; k: string; text: string }[] = [
  { tone: 'ink', k: 'One front door', text: 'Apps and agents call one Agent Gateway address with one standard API instead of connecting to each model provider. The gateway passes each request on to a model.' },
  { tone: 'flow', k: 'Semantic routing, planned for NAI 2.10', text: 'Behind that address sit your own NAI endpoints, a remote NAI cluster and external providers’ APIs. Semantic routing, planned for NAI 2.10, picks the model for each request by policy: the finance app’s sensitive questions stay on your own NAI endpoint, while other work can go elsewhere. Apps keep the same API whichever one answers.' },
  { tone: 'warn', k: 'A provider fails', text: 'When a provider fails or runs over its budget, the gateway sends its traffic to a healthy fallback, so agents stay online.' },
  { tone: 'warn', k: 'A runaway agent is capped', text: 'The coding agent gets stuck in a loop and floods requests. Its token-based rate limit stops the excess at the gateway, and the other apps keep their share.' },
  { tone: 'ink', k: 'Tools through the MCP Gateway', text: 'Agents reach tools and data through the MCP Gateway, which adds each server’s API key itself. It allows only the tool actions granted, such as reading customer records but not changing them.' },
  { tone: 'ok', k: 'Every call is logged', text: 'Every MCP request is recorded with the tool called and its latency, a full audit trail for AI governance.' },
];
const STEPS = paced(P, STEPS_TEXT.map((c) => [c.k, c.text]));

// ── geometry ──
const W = 960;
const H = 352;
const AGENTS = ['Support agent', 'Finance app', 'Coding agent'];
const agentY = (i: number) => 56 + i * 92;
const agentCy = (i: number) => agentY(i) + 28;
const GW = { x: 300, y: 24, w: 280, h: 316 };
const UE_Y = 116; // the unified endpoint's lane
const MCP_Y = 284; // the MCP Gateway's lane, clear of the agents' own wires
const PROVIDERS = [
  { t: 'NAI endpoint', s: 'your data center · GPUs' },
  { t: 'Remote NAI cluster', s: 'another NAI cluster, registered as a provider' },
  { t: 'External provider API', s: 'for example Anthropic' },
];
const provCy = (k: number) => 56 + k * 50;
const TOOLS = [
  { t: 'Ticket system', s: 'MCP server · read and write' },
  { t: 'Customer database', s: 'MCP server · read only for agents' },
];
const toolCy = (k: number) => 236 + k * 54;
const SPEED = 300; // diagram units per second for requests
const FAIL = { from: 8.2, to: 12.0 }; // the NAI endpoint is down

interface Trip {
  kind: 'model' | 'tool';
  agent: number;
  to: number;
  at: number;
  /** Stopped at the gateway: by the rate limit (model) or a tool permission (tool). */
  deny?: boolean;
  /** For tool calls: what the audit log shows. */
  log?: string;
}

const TRIPS: Trip[] = [
  // one front door: everything goes to the NAI endpoint
  ...[0.6, 1.4, 2.2, 3.0].map((at, k) => ({ kind: 'model' as const, agent: k % 2, to: 0, at })),
  // semantic routing: the finance app's sensitive questions stay on the NAI endpoint, other work goes elsewhere
  ...[4.2, 4.8, 5.4, 6.0, 6.6, 7.2].map((at, k) => ({ kind: 'model' as const, agent: k % 3, to: [1, 0, 2][k % 3], at })),
  // the NAI endpoint fails: what would have gone there goes to the remote NAI cluster
  ...[8.6, 9.2, 9.8, 10.4, 11.0].map((at, k) => ({ kind: 'model' as const, agent: k % 3, to: k % 2 ? 2 : 1, at })),
  // a runaway agent: two requests within its limit, then the rest stopped; the others still get through
  ...Array.from({ length: 8 }, (_, k) => ({ kind: 'model' as const, agent: 2, to: 0, at: 12.4 + k * 0.22, deny: k >= 2 })),
  { kind: 'model', agent: 0, to: 0, at: 13.1 },
  { kind: 'model', agent: 1, to: 2, at: 14.4 },
  // tools through the MCP Gateway
  { kind: 'tool', agent: 0, to: 0, at: 16.4, log: 'support-agent · tickets.search · 110 ms' },
  { kind: 'tool', agent: 0, to: 1, at: 18.0, deny: true, log: 'support-agent · customers.update · denied' },
  { kind: 'tool', agent: 1, to: 1, at: 20.6, log: 'finance-app · customers.read · 95 ms' },
];

function path(tr: Trip): Pt[] {
  const y0 = agentCy(tr.agent);
  const lane = tr.kind === 'model' ? UE_Y : MCP_Y;
  const start: Pt[] = [[192, y0], [250, y0], [250, lane], [GW.x, lane]];
  if (tr.deny) return start;
  const y1 = tr.kind === 'model' ? provCy(tr.to) : toolCy(tr.to);
  return [...start, [GW.x + GW.w, lane], [640, lane], [640, y1], [690, y1]];
}

/** A point a fraction f of the way along a polyline. */
function along(p: Pt[], f: number): Pt {
  const seg = p.slice(1).map((q, i) => Math.hypot(q[0] - p[i][0], q[1] - p[i][1]));
  let d = f * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const r = seg[i] ? Math.min(1, d / seg[i]) : 0;
      return [p[i][0] + (p[i + 1][0] - p[i][0]) * r, p[i][1] + (p[i + 1][1] - p[i][1]) * r];
    }
    d -= seg[i];
  }
  return p[p.length - 1];
}

const len = (p: Pt[]) => pathLength((f) => along(p, f));
const TRIP_PATHS = TRIPS.map((tr, k) => {
  const p = path(tr);
  // `gate`: when the dot reaches the gateway's edge (the whole trip, for one stopped there)
  return { tr, k, p, dur: len(p) / SPEED, gate: tr.at + len(path({ ...tr, deny: true })) / SPEED };
});
/** When each trip ends (it arrives, or it is stopped at the gateway). */
const doneAt = (k: number) => TRIP_PATHS[k].tr.at + TRIP_PATHS[k].dur;

function Box({ x, y, w, h, t, s, cls = 'ai-box', sub }: { x: number; y: number; w: number; h: number; t: string; s: string; cls?: string; sub?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} class={cls} />
      <text x={x + 12} y={y + 19} style={{ fontSize: '13px', fontWeight: 600 }}>
        {t}
      </text>
      <text x={x + 12} y={y + 35} class={sub ? 'bad-fill' : 'muted'} style={{ fontSize: '11.5px' }}>
        {sub ?? s}
      </text>
    </g>
  );
}

/** A small label inside the gateway that lights up when that capability is at work. */
function Chip({ x, y, label, on, tone = 'flow' }: { x: number; y: number; label: string; on: boolean; tone?: 'flow' | 'warn' | 'bad' | 'ok' }) {
  const w = label.length * 6.4 + 18;
  return (
    <g>
      <rect x={x} y={y} width={w} height={20} rx={3} class={on ? `ai-chip on ${tone}` : 'ai-chip'} />
      <text x={x + 9} y={y + 14} class={on ? undefined : 'muted'} style={{ fontSize: '11px', fontWeight: on ? 600 : 400 }}>
        {label}
      </text>
    </g>
  );
}

function GatewayDiagram({ t }: { t: number }) {
  const phase = phaseAt(P, t);
  const down = t >= FAIL.from && t < FAIL.to;
  const near = (k: number, len = 0.9) => {
    const d = doneAt(k);
    return t >= d - 0.15 && t < d + len;
  };
  const denyNow = TRIP_PATHS.some(({ tr }, k) => tr.deny && tr.kind === 'model' && near(k));
  const keyNow = TRIP_PATHS.some(({ tr, gate }, k) => tr.kind === 'tool' && !tr.deny && t >= gate && t < doneAt(k) + 0.6);
  const permNow = TRIP_PATHS.some(({ tr }, k) => tr.kind === 'tool' && tr.deny && near(k, 1.4));
  const logged = TRIP_PATHS.filter(({ tr, k }) => tr.log && t >= doneAt(k));
  const looping = t >= 12.2 && t < 15.2;

  return (
    <svg class="diagram ai-svg gw-dia" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Apps and agents call one Agent Gateway. Its unified endpoint routes model requests by policy (semantic routing) to an NAI endpoint, a remote NAI cluster or an external provider, falls back when one fails and rate-limits a runaway agent. Its MCP Gateway adds API keys, enforces tool permissions and logs every tool call.">
      {/* wires */}
      {AGENTS.map((_, i) => (
        <g key={i}>
          <polyline points={`192,${agentCy(i)} 250,${agentCy(i)} 250,${UE_Y} ${GW.x},${UE_Y}`} class="ai-wire" />
          <polyline points={`250,${agentCy(i)} 250,${MCP_Y} ${GW.x},${MCP_Y}`} class="ai-wire" />
        </g>
      ))}
      {PROVIDERS.map((_, k) => (
        <polyline key={k} points={`${GW.x + GW.w},${UE_Y} 640,${UE_Y} 640,${provCy(k)} 690,${provCy(k)}`} class={`ai-wire${k === 0 && down ? ' cut' : ''}`} />
      ))}
      {TOOLS.map((_, k) => (
        <polyline key={k} points={`${GW.x + GW.w},${MCP_Y} 640,${MCP_Y} 640,${toolCy(k)} 690,${toolCy(k)}`} class="ai-wire" />
      ))}

      {/* apps and agents */}
      {AGENTS.map((a, i) => (
        <Box key={a} x={16} y={agentY(i)} w={176} h={56} t={a} s={i === 2 ? 'writes code with tools' : i ? 'calls a model' : 'answers customers'} sub={i === 2 && looping ? 'stuck in a loop' : undefined} />
      ))}

      {/* the gateway: unified endpoint for models, MCP Gateway for tools */}
      <rect x={GW.x} y={GW.y} width={GW.w} height={GW.h} rx={8} class="ai-ep" />
      <text x={GW.x + 14} y={GW.y + 20} class="ai-site-t">
        AGENT GATEWAY
      </text>
      <line x1={GW.x + 1} x2={GW.x + GW.w - 1} y1={186} y2={186} class="ai-net" />
      <text x={GW.x + 14} y={66} style={{ fontSize: '13px', fontWeight: 600 }}>
        Unified endpoint
      </text>
      <text x={GW.x + 14} y={82} class="muted" style={{ fontSize: '11.5px' }}>
        one standard API for every model
      </text>
      <Chip x={GW.x + 14} y={128} label="Semantic routing" on={phase === 1} />
      <Chip x={GW.x + 144} y={128} label="Fallback" on={down} tone="warn" />
      <Chip x={GW.x + 14} y={154} label="Rate limit per client" on={denyNow} tone="bad" />
      <text x={GW.x + 14} y={208} style={{ fontSize: '13px', fontWeight: 600 }}>
        MCP Gateway
      </text>
      <text x={GW.x + 14} y={224} class="muted" style={{ fontSize: '11.5px' }}>
        tools and data for agents
      </text>
      <Chip x={GW.x + 14} y={236} label="API keys added here" on={keyNow} tone="ok" />
      <Chip x={GW.x + 150} y={236} label="Tool permissions" on={permNow} tone="bad" />
      {logged.map(({ tr, k }, row) => (
        <text key={k} x={GW.x + 14} y={306 + row * 13} class={tr.deny ? 'mono bad-fill' : 'mono muted'} style={{ fontSize: '10.5px', opacity: prog(t, doneAt(k), doneAt(k) + 0.3) }}>
          {tr.log}
        </text>
      ))}

      {/* model providers and MCP servers */}
      {PROVIDERS.map((p, k) => (
        <Box key={p.t} x={690} y={provCy(k) - 22} w={254} h={44} t={p.t} s={p.s} cls={k === 0 && down ? 'ai-box gw-down' : 'ai-box'} sub={k === 0 && down ? 'unavailable' : undefined} />
      ))}
      {TOOLS.map((tl, k) => (
        <Box key={tl.t} x={690} y={toolCy(k) - 22} w={254} h={44} t={tl.t} s={tl.s} />
      ))}
      <text x={690} y={22} class="muted ai-cap">
        MODEL PROVIDERS
      </text>
      <text x={690} y={203} class="muted ai-cap">
        TOOLS AND DATA (MCP SERVERS)
      </text>

      {/* requests and tool calls in flight, and the ones stopped at the gateway */}
      {TRIP_PATHS.map(({ tr, p, dur }, k) => {
        if (t < tr.at) return null;
        if (t <= tr.at + dur) {
          const [x, y] = along(p, (t - tr.at) / dur);
          return <circle key={k} cx={x} cy={y} r={6} class={tr.kind === 'tool' ? 'gw-tool' : 'ai-req'} />;
        }
        if (tr.deny && t < tr.at + dur + 0.7) {
          const [x, y] = p[p.length - 1];
          return <path key={k} d={`M${x - 11} ${y - 5} l10 10 m0 -10 l-10 10`} class="gw-x" />;
        }
        return null;
      })}
      {permNow && (
        <text x={GW.x + 14} y={MCP_Y - 10} class="bad-fill" style={{ fontSize: '11px', fontWeight: 600 }}>
          Support agent: write not allowed
        </text>
      )}
    </svg>
  );
}

export default function GatewayView() {
  // The poster shows the blocked write, its red chip and the first two log rows.
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: 19.4, steps: STEPS });
  const t = clock.t;
  const phase = phaseAt(P, t);
  const c = STEPS_TEXT[phase];
  const healthy = t >= FAIL.from && t < FAIL.to ? 2 : 3;
  const stopped = TRIP_PATHS.filter(({ tr }, k) => tr.deny && tr.kind === 'model' && t >= doneAt(k)).length;
  const logged = TRIP_PATHS.filter(({ tr }, k) => tr.log && t >= doneAt(k)).length;
  return (
    <Show
      foot={
        <>
          <Follow tone={c.tone} k={c.k}>
            <p>{c.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Address apps call', v: 1, sub: 'one standard API' },
              { k: 'Providers answering', v: `${healthy} of 3`, tone: healthy < 3 ? 'warn' : 'ok', sub: healthy < 3 ? 'traffic on the fallback' : undefined },
              { k: 'Requests stopped', v: stopped, tone: stopped ? 'warn' : undefined, sub: 'by the runaway agent’s rate limit' },
              { k: 'Tool calls logged', v: logged, sub: 'tool and latency recorded' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <GatewayDiagram t={t} />
      </div>
      <Legend
        items={[
          { color: 'var(--flow)', label: 'Model request' },
          { color: 'var(--ink)', label: 'Tool call' },
          { color: 'var(--bad)', label: 'Stopped at the gateway' },
        ]}
      />
      <PlayBar
        clock={clock}
        label="Agent Gateway animation"
        extra={<Illus why="Example apps, providers, tools and log lines, with times compressed. Agent Gateway is licensed separately and its MCP Gateway is generally available; semantic routing is shown as planned for NAI 2.10. Rate limits can be global or set per client by API key or request header." />}
      />
    </Show>
  );
}
