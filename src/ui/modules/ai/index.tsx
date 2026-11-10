// Enterprise AI (NAI), two tabs. Model endpoint: pick where the endpoint runs and how many model
// replicas it has, then watch the model load, apps' requests reach one endpoint and be spread over the
// replicas, and one replica stop while the others carry on (scheduling in src/engine/ai-endpoint.ts).
// Agent Gateway: see gateway.tsx.
import { useEnum } from '../../../state/route';
import { useMemo } from 'preact/hooks';
import { REPLICA_OPTS, SERVE_TIMES, SITE, WHERES, planServing, type Job, type ServePlan, type Where } from '../../../engine/ai-endpoint';
import { paced, useClock, useRestartOn } from '../../components/clock';
import { NodeFrame } from '../../components/parts';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, Tabs, ease, phaseAt, prog } from '../../components/show';
import GatewayView from './gateway';
import './style.css';

type Pt = [number, number];

const W = 960;
const H = 416;
const CY = 197;
const BX = 208;
const APPS = { x: 16, y: CY - 36, w: 176, h: 72 };
const EP = { x: 244, y: CY - 52, w: 184, h: 104 };
const EP_CX = EP.x + EP.w / 2;
const ELBOW = 520;
const RX = 560;
const RW = 370;
const RH = 58;
const RG = 6;
/** Inside a node frame (offsets from the frame): the pod, its work bar, and the GPU chip. */
const POD = { dx: 10, dy: 24, w: 116, h: 28 };
const BAR = { x0: 18, x1: 118 };
const CHIP = { dx: 134, dy: 24, w: 226, h: 28 };
/** Example sizes, not a spec: a 48 GB GPU; the big model takes all of it, the small one a 12 GB MIG slice. */
const GPU_GB = 48;
const SLICE_GB = 12;
const SMALL_Y = 344;
const LOAD = { start: 0.3, flight: 1.5 };
/** Model copies travel along the top of the site and down its right-hand gutter. */
const LOAD_Y = 58;
const GUTTER = 940;
const T = SERVE_TIMES;

const repY = (r: number, n: number) => CY - (n * RH + (n - 1) * RG) / 2 + r * (RH + RG);
const modelBox = (online: boolean) => (online ? { x: 16, y: 40, w: 176, h: 88 } : { x: 244, y: 46, w: 184, h: 84 });

function along(pts: Pt[], f: number): Pt {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = Math.max(0, Math.min(1, f)) * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const k = seg[i] ? d / seg[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
    }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}

/** Endpoint to a replica's work bar. */
function fan(r: number, n: number): Pt[] {
  const y = repY(r, n) + POD.dy + 21;
  return [[EP_CX, CY], [ELBOW, CY], [ELBOW, y], [RX + BAR.x0, y]];
}
const IN: Pt[] = [[APPS.x + APPS.w, CY], [EP_CX, CY]];

/** A GPU chip: whole GPU or MIG slice, with the GPU memory allocated against its capacity. */
function GpuChip({ x, y, kind, used, cap, off }: { x: number; y: number; kind: string; used: number; cap: number; off?: boolean }) {
  return (
    <g style={{ opacity: off ? 0.4 : 1 }}>
      <rect class="ai-gchip" x={x} y={y} width={CHIP.w} height={CHIP.h} rx={4} />
      <text class="d-fine" x={x + 8} y={y + 13} style={{ fontWeight: 600 }}>
        {kind}
      </text>
      <text class="d-fine muted" x={x + CHIP.w - 8} y={y + 13} text-anchor="end">
        {Math.round(used)} GB of {cap} GB
      </text>
      <rect class="ai-bar" x={x + 8} y={y + 19} width={CHIP.w - 16} height={5} />
      <rect class="ai-mem" x={x + 8} y={y + 19} width={(CHIP.w - 16) * (used / GPU_GB)} height={5} />
    </g>
  );
}

/** Where a request (or its answer) is at time t, or null when it is not on screen. */
function dotAt(j: Job, t: number, n: number): { p: Pt; answer: boolean } | null {
  if (t < j.sent || t >= j.back) return null;
  if (t < j.arrive) return { p: along(IN, ease(prog(t, j.sent, j.arrive))), answer: false };
  if (t < j.dispatch) return null; // waiting: drawn in the endpoint's queue
  const path = fan(j.replica, n);
  if (t < j.begin) return { p: along(path, prog(t, j.dispatch, j.begin)), answer: false };
  const y = repY(j.replica, n) + POD.dy + 21;
  if (t < j.done) return { p: [RX + BAR.x0 + (BAR.x1 - BAR.x0) * prog(t, j.begin, j.done), y], answer: false };
  const home = j.done + T.hop;
  if (t < home) return { p: along([[RX + BAR.x1, y], ...path.slice().reverse()], prog(t, j.done, home)), answer: true };
  return { p: along(IN.slice().reverse() as Pt[], ease(prog(t, home, j.back))), answer: true };
}

function Picture({ where, plan, t }: { where: Where; plan: ServePlan; t: number }) {
  const site = SITE[where];
  const n = plan.replicas;
  const { stop } = plan;
  const mb = modelBox(site.online);
  const loaded = LOAD.start + LOAD.flight;
  const stopped = (r: number) => r === stop.replica && t >= stop.from && t < stop.to;
  const waiting = plan.jobs.filter((j) => t >= j.arrive && t < j.dispatch);
  const gpuC = (r: number): Pt => [RX + CHIP.dx + CHIP.w / 2, repY(r, n) + CHIP.dy + CHIP.h / 2];
  const loadPath = (r: number): Pt[] => {
    const [gx, gy] = gpuC(r);
    return [[mb.x + mb.w, LOAD_Y], [GUTTER, LOAD_Y], [GUTTER, gy], [gx + CHIP.w / 2, gy]];
  };

  return (
    <svg
      class="diagram ai-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`A model endpoint in ${site.label.toLowerCase()} with ${n} replica${n > 1 ? 's' : ''}. Apps send requests to one endpoint, which spreads them over the replicas. When ${n > 1 ? 'one replica stops, the others keep answering' : 'the only replica stops, requests wait until it is back'}.`}
    >
      {/* the site boundary */}
      <rect class={`ai-site${site.online ? '' : ' off'}`} x={BX} y={14} width={W - BX - 6} height={H - 28} />
      <text class="d-label" x={BX + 20} y={38}>
        <tspan class={site.online ? 'ai-site-t' : 'ai-site-t warn-fill'}>{site.online ? site.title : `✕ ${site.title}`}</tspan>
        <tspan class="muted"> · {site.runsOn}</tspan>
      </text>

      {/* model source, or the unreachable internet */}
      {!site.online && (
        <g>
          <rect class="ai-net" x={16} y={40} width={176} height={64} />
          <text x={104} y={66} text-anchor="middle" class="muted d-title" style={{ fontWeight: 600 }}>
            Internet
          </text>
          <text x={104} y={88} text-anchor="middle" class="muted d-sub">
            ✕ not connected
          </text>
        </g>
      )}
      <rect class="ai-box" x={mb.x} y={mb.y} width={mb.w} height={mb.h} />
      <text x={mb.x + mb.w / 2} y={mb.y + 20} text-anchor="middle" class="muted ai-cap">
        {site.online ? 'Model source' : 'Model files'}
      </text>
      {site.model.map((l, i) => (
        <text class="d-label" key={l} x={mb.x + mb.w / 2} y={mb.y + 40 + i * 18} text-anchor="middle" style={{ fontWeight: 600 }}>
          {l}
        </text>
      ))}
      <text x={mb.x + mb.w / 2} y={mb.y + 76} text-anchor="middle" class="muted d-sub">
        {site.modelHow}
      </text>
      {t < loaded + 0.6 &&
        Array.from({ length: n }, (_, r) => <polyline key={r} points={loadPath(r).map((q) => q.join(',')).join(' ')} class="ai-load" />)}

      {/* apps and the endpoint */}
      <rect class="ai-box" x={APPS.x} y={APPS.y} width={APPS.w} height={APPS.h} />
      <text class="d-title" x={APPS.x + APPS.w / 2} y={APPS.y + 31} text-anchor="middle" style={{ fontWeight: 600 }}>
        Apps and agents
      </text>
      <text x={APPS.x + APPS.w / 2} y={APPS.y + 51} text-anchor="middle" class="muted d-sub">
        send prompts
      </text>
      <line x1={APPS.x + APPS.w} y1={CY} x2={EP.x} y2={CY} class="ai-wire" />
      {Array.from({ length: n }, (_, r) => {
        const p = fan(r, n);
        return <polyline key={r} points={[[EP.x + EP.w, CY], ...p.slice(1, 3), [RX, p[3][1]]].map((q) => q.join(',')).join(' ')} class={`ai-wire${stopped(r) ? ' cut' : ''}`} />;
      })}
      <rect class="ai-ep" x={EP.x} y={EP.y} width={EP.w} height={EP.h} />
      <text class="d-title" x={EP_CX} y={EP.y + 24} text-anchor="middle" style={{ fontWeight: 600 }}>
        Inference endpoint
      </text>
      <text x={EP_CX} y={EP.y + 41} text-anchor="middle" class="muted d-sub">
        one address · checks the token
      </text>
      <text x={EP.x + 14} y={EP.y + 88} class={`${waiting.length ? 'warn-fill' : 'muted'} d-sub`} style={{ fontWeight: waiting.length ? 600 : 400 }}>
        {waiting.length ? 'waiting' : 'no queue'}
      </text>
      {waiting.slice(0, 7).map((j, i) => (
        <circle key={j.id} cx={EP.x + 74 + i * 15} cy={EP.y + 84} r={5.5} class="ai-req" />
      ))}
      {waiting.length > 7 && (
        <text x={EP.x + EP.w - 8} y={EP.y + 88} text-anchor="end" class="warn-fill d-fine" style={{ fontWeight: 600 }}>
          +{waiting.length - 7}
        </text>
      )}

      {/* replicas */}
      {Array.from({ length: n }, (_, r) => {
        const y = repY(r, n);
        const off = stopped(r);
        const job = plan.jobs.find((j) => j.replica === r && t >= j.begin && t < j.done);
        const ready = t >= LOAD.start + LOAD.flight + r * 0.08;
        const state = off ? '✕ stopped' : !ready ? 'loading the model' : job ? 'answering' : 'ready';
        const a = LOAD.start + r * 0.08 + LOAD.flight;
        const used = GPU_GB * ease(prog(t, a, a + 0.5));
        return (
          <NodeFrame key={r} x={RX} y={y} w={RW} h={RH} title={`gpu-node-${r + 1}`} status={state} tone={off ? 'bad' : undefined}>
            <rect class="ai-pod" x={RX + POD.dx} y={y + POD.dy} width={POD.w} height={POD.h} rx={4} style={{ opacity: off ? 0.4 : 1 }} />
            <text class="d-sub" x={RX + POD.dx + 8} y={y + POD.dy + 13}>
              Pod · Replica {r + 1}
            </text>
            <rect class="ai-bar" x={RX + BAR.x0} y={y + POD.dy + 19} width={BAR.x1 - BAR.x0} height={4} />
            {job && <rect class="ai-bar-on" x={RX + BAR.x0} y={y + POD.dy + 19} width={(BAR.x1 - BAR.x0) * prog(t, job.begin, job.done)} height={4} />}
            <GpuChip x={RX + CHIP.dx} y={y + CHIP.dy} kind="Whole GPU" used={used} cap={GPU_GB} off={off} />
          </NodeFrame>
        );
      })}

      {/* another endpoint: a small model on a MIG slice of a GPU */}
      <text class="muted d-fine" x={RX} y={SMALL_Y - 6}>
        Another endpoint: a small model that does not need a full GPU
      </text>
      <NodeFrame x={RX} y={SMALL_Y} w={RW} h={RH} title={`gpu-node-${n + 1}`} status={t >= loaded ? 'ready' : 'loading the model'}>
        <rect class="ai-pod" x={RX + POD.dx} y={SMALL_Y + POD.dy} width={POD.w} height={POD.h} rx={4} />
        <text class="d-sub" x={RX + POD.dx + 8} y={SMALL_Y + POD.dy + 13}>
          Pod · Embedding
        </text>
        <GpuChip x={RX + CHIP.dx} y={SMALL_Y + CHIP.dy} kind="MIG slice" used={SLICE_GB * ease(prog(t, loaded, loaded + 0.5))} cap={GPU_GB} />
      </NodeFrame>

      {/* the model copies flying in */}
      {Array.from({ length: n }, (_, r) => {
        const a = LOAD.start + r * 0.08;
        if (t < a || t >= a + LOAD.flight) return null;
        const [x, y] = along([...loadPath(r), gpuC(r)], ease(prog(t, a, a + LOAD.flight)));
        return <rect key={r} class="ai-model" x={x - 9} y={y - 9} width={18} height={18} rx={3} />;
      })}

      {/* requests and answers */}
      {plan.jobs.map((j) => {
        const d = dotAt(j, t, n);
        return d && <circle key={j.id} cx={d.p[0]} cy={d.p[1]} r={6} class={d.answer ? 'ai-ans' : 'ai-req'} />;
      })}
    </svg>
  );
}

function EndpointView() {
  const [where, setWhere] = useEnum<Where>('w', 'dc', WHERES);
  const [repS, setRep] = useEnum<'1' | '2' | '4'>('r', '2', ['1', '2', '4']);
  const n = Number(repS);
  const plan = useMemo(() => planServing(n), [n]);
  const site = SITE[where];
  const load =
    (n === 1 ? 'The replica loads the model' : `Each of the ${n} replicas loads its own copy of the model`) +
    (site.online ? ', downloaded from NVIDIA Inference Microservices (NIM) or Hugging Face, or uploaded by you, and takes its share of the GPU\u2019s memory.' : ' from files brought into the site. Nothing is downloaded, and nothing needs the internet later. A model that does not need a whole GPU can take a slice instead.');
  const captions: { tone: Tone | 'ink'; k: string; text: string }[] = [
    { tone: 'ink' as const, k: 'The model loads', text: load },
    n === 1
      ? { tone: 'warn' as const, k: 'Requests queue', text: 'Apps call one endpoint address with an API token. With one replica, every request waits its turn at the same model server, so a queue builds in busy moments.' }
      : { tone: 'flow' as const, k: 'Requests spread', text: `Apps call one endpoint address with an API token. The endpoint spreads the requests over the ${n} replicas, so they are answered side by side${plan.maxWait.busy > 0.05 ? ', with a short wait in busy moments' : ' and none has to wait'}.` },
    n === 1
      ? { tone: 'bad' as const, k: 'The only replica stops', text: 'It stops for an update or a node fault. Nothing can answer, so requests wait, or fail, until it is back.' }
      : { tone: 'warn' as const, k: 'One replica stops', text: `Replica 1 stops for an update or a node fault. The endpoint sends requests only to the other ${n - 1}, ${plan.maxWait.stop > 0.05 ? 'so answers come a little slower' : 'and apps do not notice'}.` },
    n === 1
      ? { tone: 'ok' as const, k: 'The replica returns', text: 'The replica is back and works through the waiting requests. With one replica, every stop means a pause for the apps.' }
      : { tone: 'ok' as const, k: 'Replica 1 returns', text: 'Replica 1 is back and takes its share again. The endpoint kept answering the whole time.' },
  ];
  const starts = [0, T.start, plan.stop.from, plan.stop.to];
  const clock = useClock({ rate: 1, duration: plan.end, keys: true, poster: plan.stop.from + 2.2, steps: paced(starts, captions.map((c) => [c.k, c.text])) });
  useRestartOn(clock, [where, n]);
  const t = clock.t;
  const phase = phaseAt(starts, t);
  const up = phase === 0 ? 0 : n - (phase === 2 ? 1 : 0);
  const waiting = plan.jobs.filter((j) => t >= j.arrive && t < j.dispatch).length;
  const caption = captions[phase];

  return (
    <Show clock={clock}
      top={
        <>
          <Choice<Where>
            label="Where it runs"
            value={where}
            onChange={setWhere}
            options={WHERES.map((w) => ({ value: w, label: SITE[w].label }))}
          />
          <Choice<'1' | '2' | '4'> label="Model replicas" value={repS} onChange={setRep} options={REPLICA_OPTS.map((r) => ({ value: String(r) as '1' | '2' | '4', label: String(r) }))} />
        </>
      }
      foot={
        <>
          <Follow tone={caption.tone} k={caption.k}>
            <p>{caption.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Replicas answering', v: phase === 0 ? 'Loading' : `${up} of ${n}`, tone: phase === 0 ? undefined : up === n ? 'ok' : up === 0 ? 'bad' : 'warn' },
              { k: 'Requests waiting', v: waiting, tone: waiting ? 'warn' : undefined },
              { k: 'GPU per replica', v: 'Full or a slice', sub: 'MIG slices for small models', tip: 'A replica can use whole GPUs (several, for a large model) or, from NAI 2.5, an NVIDIA MIG slice of one, so embedding models and small language models that do not need a full GPU can share it. vGPU is supported too.' },
              { k: 'Prompts stay in', v: site.stays, sub: site.online ? undefined : 'no internet needed', tip: 'Prompts, answers and model files stay on infrastructure you control. In public cloud that is your own account and region.' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <Picture where={where} plan={plan} t={t} />
      </div>
      <Legend
        items={[
          { color: 'var(--flow)', label: 'Request' },
          { color: 'var(--ok)', label: 'Answer' },
          { color: 'var(--ink)', label: 'GPU memory allocated' },
          { color: 'var(--bad)', label: 'Stopped replica' },
        ]}
      />
      <PlayBar
        clock={clock}
        label="Model endpoint animation"
        extra={<Illus why="Simplified and compressed: real model servers work on many requests at once by batching them, a replica can span several GPUs for supported models, and times are not to scale. GPU sizes and memory figures are examples: a model needs more GPU memory at run time than its file size, and a MIG slice (or vGPU) is how a small model shares a GPU. The point is how one endpoint spreads requests over replicas." />}
      />
    </Show>
  );
}

type TabId = 'ep' | 'gw';
const TABS: { id: TabId; label: string }[] = [
  { id: 'ep', label: 'Model endpoint' },
  { id: 'gw', label: 'Agent Gateway' },
];

export default function Ai() {
  const [tab, setTab] = useEnum<TabId>('tab', 'ep', ['ep', 'gw']);
  return (
    <Tabs label="Enterprise AI topics" value={tab} tabs={TABS} onChange={setTab}>
      {tab === 'ep' && <EndpointView />}
      {tab === 'gw' && <GatewayView />}
    </Tabs>
  );
}
