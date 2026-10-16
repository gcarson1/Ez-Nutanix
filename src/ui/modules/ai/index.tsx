// Enterprise AI (NAI): a mock "deploy a model endpoint" wizard. Each choice redraws the
// resulting architecture straight away; Deploy marks it ready. Logic in engine/ai-endpoint.ts.
import { useEffect, useState } from 'preact/hooks';
import { useBool, useEnum, useNum } from '../../../state/route';
import { Chip, Field, Follow, Illus, Seg, Stat, Toggle } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { SOURCE_LABEL, TARGET_LABEL, airgapBlocked, architecture, sourceBlocked, type Source, type Target } from '../../../engine/ai-endpoint';
import './style.css';

const STEPS = ['Where', 'Model', 'Size', 'Access', 'Review'] as const;
type Focus = 'where' | 'model' | 'size' | 'access' | 'all';
const FOCUS: Focus[] = ['where', 'model', 'size', 'access', 'all'];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Box positions for the wide (row) layout and the narrow (phone, stacked) layout. */
function layout(narrow: boolean, gateway: boolean, replicas: number) {
  if (!narrow) {
    const ep: Box = { x: gateway ? 520 : 470, y: 40, w: 190, h: 70 };
    const k8s: Box = { x: 40, y: 170, w: 620, h: 250 };
    return {
      W: 960,
      H: 540,
      apps: { x: 40, y: 40, w: 200, h: 70 },
      gw: { x: 290, y: 34, w: 190, h: 82 },
      ep,
      k8s,
      rep: (r: number): Box => ({ x: k8s.x + 16 + r * 194, y: k8s.y + 108, w: 180, h: 124 }),
      src: { x: 720, y: 200, w: 200, h: 110 },
      infra: { x: 40, y: k8s.y + k8s.h + 14, w: 620, h: 56 },
      total: { x: 720, y: k8s.y + k8s.h + 38 },
    };
  }
  const W = 440;
  const apps: Box = { x: 0, y: 36, w: W, h: 60 };
  const gw: Box = { x: 0, y: 122, w: W, h: 76 };
  const ep: Box = { x: 0, y: gateway ? 224 : 122, w: W, h: 60 };
  const k8sY = ep.y + ep.h + 30;
  const k8s: Box = { x: 0, y: k8sY, w: W, h: 108 + replicas * 82 };
  const infra: Box = { x: 0, y: k8s.y + k8s.h + 14, w: W, h: 56 };
  const src: Box = { x: 0, y: infra.y + infra.h + 20, w: W, h: 100 };
  return {
    W,
    H: src.y + src.h + 10,
    apps,
    gw,
    ep,
    k8s,
    rep: (r: number): Box => ({ x: 16, y: k8s.y + 108 + r * 82, w: W - 32, h: 72 }),
    src,
    infra,
    total: { x: W - 16, y: k8s.y + 24 },
  };
}

function Arch({ a, focus, deployed, narrow }: { a: ReturnType<typeof architecture>; focus: Focus; deployed: boolean; narrow: boolean }) {
  const c = a.choice;
  const hi = (f: Focus) => (focus === f || focus === 'all' ? ' ai-hi' : '');
  const L = layout(narrow, c.gateway, c.replicas);
  const { W, H, apps, gw, ep, k8s, src, infra } = L;
  const reps = Array.from({ length: c.replicas });
  const mid = (b: Box) => b.x + b.w / 2;
  // Connectors between the request-path boxes.
  const links = narrow
    ? [
        { x1: W / 2, y1: apps.y + apps.h, x2: W / 2, y2: c.gateway ? gw.y : ep.y },
        ...(c.gateway ? [{ x1: W / 2, y1: gw.y + gw.h, x2: W / 2, y2: ep.y }] : []),
        { x1: W / 2, y1: ep.y + ep.h, x2: W / 2, y2: k8s.y },
      ]
    : [
        { x1: apps.x + apps.w, y1: 75, x2: c.gateway ? gw.x : ep.x, y2: 75 },
        ...(c.gateway ? [{ x1: gw.x + gw.w, y1: 75, x2: ep.x, y2: 75 }] : []),
        { x1: mid(ep), y1: ep.y + ep.h, x2: mid(ep), y2: k8s.y },
      ];
  return (
    <svg class="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Architecture of the model endpoint on ${TARGET_LABEL[c.target]}`}>
      {c.airgap && (
        <g>
          <rect class="ai-airgap" x={narrow ? 0.75 : 4} y={narrow ? 0.75 : 4} width={narrow ? W - 1.5 : W - 8} height={narrow ? H - 1.5 : H - 8} />
          <text x={narrow ? 10 : 20} y={narrow ? 20 : 24} class="warn-fill" style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em' }}>
            AIR-GAPPED SITE · NO INTERNET CONNECTION
          </text>
        </g>
      )}
      {links.map((l, i) => (
        <line key={i} {...l} class="flow-stroke" stroke-width={2} />
      ))}
      {/* apps */}
      <g class={hi('access')}>
        <rect class="ai-box hit" x={apps.x} y={apps.y} width={apps.w} height={apps.h} />
        <text x={mid(apps)} y={apps.y + apps.h / 2 - 4} text-anchor="middle" style={{ fontWeight: 600, fontSize: '14.5px' }}>
          Your apps and agents
        </text>
        <text x={mid(apps)} y={apps.y + apps.h / 2 + 15} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
          call the endpoint with a token
        </text>
      </g>
      {c.gateway && (
        <g class={hi('access')}>
          <rect class="ai-box hit" x={gw.x} y={gw.y} width={gw.w} height={gw.h} />
          <text x={mid(gw)} y={gw.y + 26} text-anchor="middle" style={{ fontWeight: 600, fontSize: '14.5px' }}>
            Agent Gateway
          </text>
          <text x={mid(gw)} y={gw.y + 46} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
            MCP Gateway for tools
          </text>
          <text x={mid(gw)} y={gw.y + 64} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
            token tracking, quotas
          </text>
        </g>
      )}
      <g class={hi('access')}>
        <rect class="ai-box hit" x={ep.x} y={ep.y} width={ep.w} height={ep.h} />
        <text x={mid(ep)} y={ep.y + ep.h / 2 - 4} text-anchor="middle" style={{ fontWeight: 600, fontSize: '14.5px' }}>
          Inference endpoint
        </text>
        <text x={mid(ep)} y={ep.y + ep.h / 2 + 15} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
          HTTPS · API token · RBAC
        </text>
      </g>

      {/* Kubernetes cluster */}
      <g class={hi('where')}>
        <rect class="ai-k8s hit" x={k8s.x} y={k8s.y} width={k8s.w} height={k8s.h} />
        <text x={k8s.x + 16} y={k8s.y + 24} style={{ fontWeight: 600, fontSize: '14px' }}>
          {narrow ? `Kubernetes: ${c.target === 'nkp' ? 'NKP on NCI' : TARGET_LABEL[c.target]}` : `Kubernetes: ${TARGET_LABEL[c.target]}`}
        </text>
      </g>
      <rect class="ink-fill" x={k8s.x + 16} y={k8s.y + 40} width={k8s.w - 32} height={50} />
      <text x={k8s.x + 32} y={k8s.y + 62} style={{ fill: '#fff', fontWeight: 600, fontSize: '14.5px' }}>
        Nutanix Enterprise AI
      </text>
      <text x={k8s.x + 32} y={k8s.y + 80} style={{ fill: 'rgba(255,255,255,.8)', fontSize: '12px' }}>
        {narrow ? 'Endpoints, models, tokens · monitoring' : 'Endpoints, models, users and tokens · GPU and model monitoring'}
      </text>
      <g class={hi('size')}>
        {reps.map((_, r) => {
          const b = L.rep(r);
          const gx = narrow ? b.x + b.w - 6 - c.gpus * 40 : b.x + 12;
          const gy = narrow ? b.y + 30 : b.y + 58;
          return (
            <g key={r}>
              <rect class={`ai-rep hit${deployed ? ' ready' : ''}`} x={b.x} y={b.y} width={b.w} height={b.h} />
              <text x={b.x + 12} y={b.y + 22} style={{ fontWeight: 600, fontSize: '13.5px' }}>
                Replica {r + 1}
              </text>
              <text x={b.x + b.w - 12} y={b.y + 22} text-anchor="end" class={deployed ? 'ok-fill' : 'muted'} style={{ fontSize: '12px', fontWeight: 600 }}>
                {deployed ? '✓ Ready' : 'planned'}
              </text>
              <text x={b.x + 12} y={b.y + 42} class="muted" style={{ fontSize: '12px' }}>
                model server
              </text>
              {Array.from({ length: c.gpus }).map((__, g) => (
                <g key={g}>
                  <rect class="ai-gpu" x={gx + g * 40} y={gy} width={34} height={34} />
                  <text x={gx + 17 + g * 40} y={gy + 22} text-anchor="middle" class="mono" style={{ fontSize: '10.5px', fill: '#fff' }}>
                    GPU
                  </text>
                </g>
              ))}
              <text x={b.x + 12} y={narrow ? b.y + 60 : b.y + 112} class="muted" style={{ fontSize: '11.5px' }}>
                {c.gpus > 1 ? `model split across ${c.gpus} GPUs` : 'one GPU'}
              </text>
            </g>
          );
        })}
      </g>

      {/* model source */}
      <g class={hi('model')}>
        <rect class="ai-box hit" x={src.x} y={src.y} width={src.w} height={src.h} />
        <text x={mid(src)} y={src.y + 26} text-anchor="middle" class="muted" style={{ fontSize: '11px', letterSpacing: '0.08em' }}>
          {narrow ? 'MODEL SOURCE · LOADED INTO THE REPLICAS' : 'MODEL SOURCE'}
        </text>
        <text x={mid(src)} y={src.y + 52} text-anchor="middle" style={{ fontWeight: 600, fontSize: '15px' }}>
          {c.source === 'upload' ? 'Your own model' : SOURCE_LABEL[c.source]}
        </text>
        <text x={mid(src)} y={src.y + 74} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
          {c.source === 'nim' ? 'NVIDIA-optimized package' : c.source === 'hf' ? 'open model hub' : 'files you upload'}
          {narrow ? ` · ${c.source === 'hf' ? 'downloaded at deploy' : c.source === 'nim' && c.airgap ? 'air-gapped NIM' : 'stored with the cluster'}` : ''}
        </text>
        {!narrow && (
          <text x={mid(src)} y={src.y + 94} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
            {c.source === 'hf' ? 'downloaded at deploy' : c.source === 'nim' && c.airgap ? 'air-gapped NIM' : 'stored with the cluster'}
          </text>
        )}
      </g>
      {!narrow && <line x1={src.x} y1={255} x2={k8s.x + k8s.w} y2={255} class="flow-stroke" stroke-width={1.75} stroke-dasharray="5 3" />}

      {/* infrastructure */}
      <g class={hi('where')}>
        <rect class="ai-infra hit" x={infra.x} y={infra.y} width={infra.w} height={infra.h} />
        <text x={infra.x + 16} y={infra.y + 24} style={{ fontWeight: 600, fontSize: '14px' }}>
          {a.onPrem ? (narrow ? 'NCI: AHV nodes with GPUs' : 'Nutanix Cloud Infrastructure: AHV nodes with GPUs') : 'Cloud GPU instances in your account'}
        </text>
        <text x={infra.x + 16} y={infra.y + 43} class="muted" style={{ fontSize: '12px' }}>
          {a.onPrem
            ? narrow
              ? 'Prompts, responses and models stay on your hardware'
              : 'Your data center: prompts, responses and models stay on your hardware'
            : narrow
              ? 'Data stays in your cloud account and region'
              : 'Your chosen region: data stays in your cloud account'}
        </text>
      </g>
      {narrow ? (
        <text x={L.total.x} y={L.total.y} text-anchor="end" class="mono" style={{ fontSize: '13px', fontWeight: 600 }}>
          {a.totalGpus} GPU{a.totalGpus === 1 ? '' : 's'}
        </text>
      ) : (
        <>
          <text x={L.total.x} y={L.total.y} class="muted" style={{ fontSize: '12px' }}>
            Total GPUs
          </text>
          <text x={L.total.x} y={L.total.y + 24} class="mono" style={{ fontSize: '22px', fontWeight: 600 }}>
            {a.totalGpus}
          </text>
        </>
      )}
    </svg>
  );
}

function useNarrow(px = 700): boolean {
  const q = typeof matchMedia !== 'undefined' ? matchMedia(`(max-width: ${px}px)`) : null;
  const [n, setN] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return;
    const on = () => setN(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return n;
}

export default function Ai() {
  const [step, setStep] = useNum('s', 0, 0, 4);
  const [target, setTarget] = useEnum<Target>('tg', 'nkp', ['nkp', 'eks', 'aks', 'gke']);
  const [source, setSource] = useEnum<Source>('src', 'nim', ['nim', 'hf', 'upload']);
  const [gpus, setGpus] = useNum('g', 1, 1, 4);
  const [replicas, setReplicas] = useNum('r', 1, 1, 3);
  const [gateway, setGateway] = useBool('gw', false);
  const [airgap, setAirgap] = useBool('ag', false);
  const [deployed, setDeployed] = useBool('dep', false);

  const narrow = useNarrow();
  const g = (gpus >= 4 ? 4 : gpus >= 2 ? 2 : 1) as 1 | 2 | 4;
  const a = architecture({ target, source, gpus: g, replicas, gateway, airgap });
  const c = a.choice;
  // Any change after deploying means the drawing is a plan again.
  const change = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    if (deployed) setDeployed(false);
  };
  const agWhy = airgapBlocked({ target });

  return (
    <div class="lab">
      <div class="ctl">
        <ol class="ai-steps" aria-label="Wizard steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" aria-current={i === step ? 'step' : undefined} class={i === step ? 'on' : i < step ? 'past' : ''} onClick={() => setStep(i)}>
                <span class="n">{i < step ? '✓' : i + 1}</span>
                {s}
              </button>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <>
            <Field label="Kubernetes cluster" tip="NAI deploys onto CNCF-conformant Kubernetes: NKP in your data center, or EKS, AKS or GKE in public cloud." value={c.target === 'nkp' ? 'NKP' : c.target.toUpperCase()}>
              <Seg
                label="Kubernetes cluster"
                value={target}
                onChange={change(setTarget)}
                options={[
                  { value: 'nkp', label: 'NKP on NCI' },
                  { value: 'eks', label: 'EKS' },
                  { value: 'aks', label: 'AKS' },
                  { value: 'gke', label: 'GKE' },
                ]}
              />
            </Field>
            <Field label="Air-gapped site" tip="No connection to the internet at all, common in defense and regulated sites." why={agWhy}>
              <Toggle on={c.airgap} disabled={!!agWhy} onChange={change(setAirgap)}>
                No internet connection
              </Toggle>
            </Field>
          </>
        )}
        {step === 1 && (
          <Field label="Model source" tip="Where the model comes from: NVIDIA NIM packages, Hugging Face, or files you upload." value={SOURCE_LABEL[c.source]} why={sourceBlocked('hf', c)}>
            <div class="seg" role="group" aria-label="Model source">
              {(['nim', 'hf', 'upload'] as Source[]).map((s) => (
                <button type="button" key={s} aria-pressed={c.source === s} disabled={!!sourceBlocked(s, c)} onClick={() => change(setSource)(s)}>
                  {s === 'nim' ? 'NVIDIA NIM' : s === 'hf' ? 'Hugging Face' : 'Upload'}
                </button>
              ))}
            </div>
          </Field>
        )}
        {step === 2 && (
          <>
            <Field label="GPUs per replica" tip="More than one GPU splits a large model across GPUs (tensor-parallel serving, NAI 2.8)." value={c.gpus}>
              <Seg label="GPUs per replica" value={c.gpus} onChange={change(setGpus)} options={[1, 2, 4].map((n) => ({ value: n, label: String(n) }))} />
            </Field>
            <Field label="Replicas" tip="Copies of the model server sharing the traffic." value={c.replicas}>
              <Seg label="Replicas" value={c.replicas} onChange={change(setReplicas)} options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))} />
            </Field>
          </>
        )}
        {step === 3 && (
          <Field label="Agent Gateway" tip="An optional gateway in front of endpoints: token tracking and quotas, plus an MCP Gateway for agents’ tool access (GA in NAI 2.8).">
            <Toggle on={c.gateway} onChange={change(setGateway)}>
              Add the Agent Gateway
            </Toggle>
          </Field>
        )}
        {step === 4 && (
          <div class="field ai-review">
            <span class="field-label">Review</span>
            <Stat k="Cluster" v={c.target === 'nkp' ? 'NKP on NCI' : c.target.toUpperCase()} />
            <Stat k="Model" v={c.source === 'upload' ? 'Uploaded' : SOURCE_LABEL[c.source]} />
            <Stat k="GPUs" v={`${c.gpus} × ${c.replicas} = ${a.totalGpus}`} />
            <Stat k="Gateway" v={c.gateway ? 'Agent Gateway' : 'None'} />
            <Stat k="Air-gapped" v={c.airgap ? 'Yes' : 'No'} />
            <button type="button" class="btn primary block" style={{ marginTop: 'var(--sp-3)' }} onClick={() => setDeployed(true)} disabled={deployed}>
              <Icon name="zap" />
              {deployed ? 'Deployed' : 'Deploy endpoint'}
            </button>
          </div>
        )}
        <div class="hstack ai-nav">
          <button type="button" class="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <Icon name="back" /> Back
          </button>
          {step < 4 && (
            <button type="button" class="btn" onClick={() => setStep(step + 1)}>
              Next <Icon name="arrow" />
            </button>
          )}
        </div>
      </div>

      <div class="stage">
        <div class="spread" style={{ marginBottom: 'var(--sp-3)' }}>
          <strong>Resulting architecture</strong>
          <span class="hstack">
            {deployed ? <Chip tone="ok">Endpoint ready</Chip> : <Chip tone="neutral">Plan · not deployed</Chip>}
            <Illus why="A mock wizard. It shows the shape of what NAI creates, not its real screens, and leaves out supporting pieces such as storage for model files and ingress." />
          </span>
        </div>
        <div class={narrow ? 'ai-narrow' : 'diagram-scroll'}>
          <Arch a={a} focus={FOCUS[step]} deployed={deployed} narrow={narrow} />
        </div>
        <Follow tone={deployed ? 'ok' : 'ink'} k={deployed ? 'Deployed' : `Step ${step + 1} of 5 · ${STEPS[step]}`}>
          {a.notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </Follow>
      </div>

      <div class="rail">
        <div class="side-sec">
          <strong>Naming, as of this build</strong>
          <ul class="ai-list">
            <li>
              <strong>Nutanix Enterprise AI (NAI)</strong> is the product that deploys and runs these endpoints. Version 2.8 went GA in August 2026.
            </li>
            <li>
              <strong>Nutanix Agentic AI</strong> is the full-stack solution announced in March 2026: NAI, NKP, AHV, Flow and Nutanix Unified Storage with NVIDIA AI Enterprise. Parts are GA, parts early access; the full solution is targeted for the second half of 2026.
            </li>
            <li>
              <strong>GPT-in-a-Box</strong> is the earlier name for the bundle that NAI was part of.
            </li>
          </ul>
        </div>
        <div class="side-sec">
          <strong>Also in NAI 2.8</strong>
          <ul class="ai-list">
            <li>Batch inference and speculative decoding</li>
            <li>LoRA fine-tuning for models under 8B parameters</li>
            <li>Custom IAM roles</li>
            <li>Priced on infrastructure resources, not per token</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
