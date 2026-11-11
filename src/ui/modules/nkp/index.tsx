// Kubernetes Platform (NKP), four tabs. Overview, below: "from islands to one operating model", one loop in six scenes.
// Cluster lifecycle, Fleet and Day-2 services: lifecycle.tsx, fleet.tsx, services.tsx.
// Four Kubernetes environments start as islands, each run its own way; the NKP layer arrives above
// them without replacing them; one upgrade and one policy go out from it (the attached AKS cluster
// keeps Azure's upgrades); the platform team and a developer use the same layer; apps run
// everywhere. Kubernetes version upgrades themselves are on LCM Rolling Upgrade's Kubernetes (NKP) tab.
import { paced, useClock } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar } from '../../components/controls';
import { Kpis, Show, Tabs, ease, phaseAt, prog, type Point } from '../../components/show';
import { useEnum } from '../../../state/route';
import FleetView from './fleet';
import LifecycleView from './lifecycle';
import ServicesView from './services';
import './style.css';

const S = [0, 8, 16, 24, 33, 42];
const END = 50;

const SCENES: { tone: Point['tone']; k: string; label: string; text: string }[] = [
  { tone: 'ink', k: 'Islands', label: 'Kubernetes is powerful, but operating every cluster consistently is hard.', text: 'Four places run Kubernetes: Nutanix, VMware, AWS and Azure. Each cluster comes with its own upgrade scripts, monitoring, security and ticket queue, managed its own way.' },
  { tone: 'warn', k: 'Hidden work', label: 'Every cluster becomes its own project.', text: 'Behind every island the same work repeats: provisioning, upgrades, security policies, observability, storage and data protection, developer access and troubleshooting. Four environments, seven jobs each, 28 separate processes.' },
  { tone: 'flow', k: 'NKP arrives', label: 'NKP adds one consistent operating model across Kubernetes environments.', text: 'NKP sits above the environments without replacing them and connects to each. It is open, upstream Kubernetes built from CNCF projects with open-source APIs, so apps and automation stay portable. EKS and AKS each tie you to one cloud, and OpenShift to RHEL and the Red Hat stack; NKP runs across all of these environments, with no lock-in to NKP.' },
  { tone: 'flow', k: 'One fleet', label: 'One view. Consistent policy. Controlled change.', text: 'The clusters now share one status language. A policy goes to all four; an upgrade goes to the three NKP clusters, while the attached AKS cluster keeps following Azure’s own upgrades.' },
  { tone: 'ok', k: 'Two teams, one road', label: 'Platform teams govern the road. Developers use the road.', text: 'The platform team sees fleet health, compliance and upgrades in one place. A developer asks for a namespace, and it lands on an approved cluster with storage, networking, observability and policy already attached.' },
  { tone: 'ok', k: 'The outcome', label: 'Consistent cloud-native operations wherever the apps run.', text: 'Apps run across private cloud, VMware and public cloud, on the same Kubernetes, storage, data protection, observability and automation, operated one way.' },
];
const STEPS = paced(S, SCENES.map((s) => [s.k, s.text]));
/** When the islands' own tools have faded out after NKP arrives; the legend switches then. */
const TOOLS_GONE = S[2] + 2.2;

const W = 960;
const H = 424;
const IW = 225;
const IG = 20;
const islX = (i: number) => i * (IW + IG);
const ISL = { y: 262, h: 156 };
const LAYER = { y: 104, h: 128 };
const ENVS = [
  { name: 'Nutanix (AHV)', sub: 'private cloud', nkp: true, tools: ['upgrade script v3', 'Prometheus', 'infra ticket queue'] },
  { name: 'VMware vSphere', sub: 'on-premises', nkp: true, tools: ['runbook upgrades', 'vendor monitor', 'email alerts'] },
  { name: 'AWS', sub: 'NKP cluster in your account', nkp: true, tools: ['console upgrades', 'CloudWatch', 'cloud support cases'] },
  { name: 'Azure', sub: 'existing AKS, attached', nkp: false, tools: ['portal upgrades', 'Azure Monitor', 'separate ticket queue'] },
];
const WORK = ['Provisioning', 'Upgrades', 'Security policies', 'Observability', 'Storage and data protection', 'Developer access', 'Troubleshooting'];
const BANDS = ['Provision and upgrade', 'Govern and secure', 'Observe and troubleshoot', 'Deliver with GitOps', 'Protect data and apps', 'Manage the fleet'];
/** Example components under each band; a band with no sourced component stays empty (facts NKP-5 to NKP-9). */
const COMPS = ['Cluster API', '', 'Prometheus, Grafana', 'Flux', 'Velero', ''];
const BW = (W - 24 - 5 * 8) / 6;
const bandX = (i: number) => 12 + i * (BW + 8);
const ATTACH = ['storage', 'network', 'observability', 'policy'];

function NkpDiagram({ t }: { t: number }) {
  const sc = phaseAt(S, t);
  const islandsIn = (i: number) => ease(prog(t, 0.2 + i * 0.35, 0.9 + i * 0.35));
  const toolsOut = 1 - ease(prog(t, S[2] + 1, TOOLS_GONE));
  const workIn = (row: number) => (sc === 1 ? ease(prog(t, S[1] + 0.6 + row * 0.6, S[1] + 1.1 + row * 0.6)) : 0);
  const layerIn = ease(prog(t, S[2], S[2] + 1.4));
  const linkIn = (i: number) => ease(prog(t, S[2] + 1.6 + i * 0.3, S[2] + 2.2 + i * 0.3));
  const policyAt = S[3] + 1.5;
  const upgradeAt = S[3] + 4;
  const policyDone = (i: number) => t >= policyAt + 1.2 + i * 0.2;
  const upgraded = (i: number) => ENVS[i].nkp && t >= upgradeAt + 1.4 + i * 0.4;
  const peopleIn = ease(prog(t, S[4], S[4] + 1));
  const reqAt = S[4] + 2.5;
  const nsIn = t >= reqAt + 2.6;
  const appsIn = (i: number) => (sc >= 5 ? ease(prog(t, S[5] + 0.4 + i * 0.3, S[5] + 1.2 + i * 0.3)) : 0);
  const bandOn = (b: number) =>
    sc === 5 || (sc === 3 && (t < upgradeAt ? b === 1 || b === 5 : b === 0 || b === 5)) || (sc === 4 && t >= reqAt && (b === 1 || b === 3));
  const cx = (i: number) => islX(i) + IW / 2;

  // a dot that drops from the layer to an island
  const drop = (i: number, at: number) => {
    const f = prog(t, at + i * 0.2, at + 1.2 + i * 0.2);
    return f > 0 && f < 1 ? <circle key={`d${i}${at}`} cx={cx(i)} cy={LAYER.y + LAYER.h + (ISL.y + 40 - LAYER.y - LAYER.h) * ease(f)} r={5} class="nk-dot" /> : null;
  };
  // the developer's request: down into the layer, through its guardrails, onto the Nutanix cluster
  const req = (() => {
    const f = prog(t, reqAt, reqAt + 2.6);
    if (sc !== 4 || f <= 0 || f >= 1) return null;
    const pts: [number, number][] = [[725, 92], [725, LAYER.y + 62], [cx(0), LAYER.y + 62], [cx(0), ISL.y + 44]];
    const seg = pts.slice(1).map((p, k) => Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]));
    let d = ease(f) * seg.reduce((a, b) => a + b, 0);
    let k = 0;
    while (k < seg.length - 1 && d > seg[k]) d -= seg[k++];
    const r = Math.min(1, d / seg[k]);
    return <circle cx={pts[k][0] + (pts[k + 1][0] - pts[k][0]) * r} cy={pts[k][1] + (pts[k + 1][1] - pts[k][1]) * r} r={6} class="nk-dot req" />;
  })();

  return (
    <svg class="diagram nk-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Four Kubernetes environments, Nutanix, VMware vSphere, AWS and an attached Azure AKS cluster, each start out managed separately. The NKP layer arrives above them with six capabilities, connects to every cluster, sends one policy to all four and one upgrade to the three NKP clusters, gives the platform team one view and lands a developer's namespace on an approved cluster.">
      {/* the on-screen label for the first two scenes, where the NKP layer will be */}
      {sc < 2 && (
        <text x={W / 2} y={sc === 0 ? 150 : 24} text-anchor="middle" class="halo d-title" style={{ fontWeight: 600, opacity: sc === 0 ? ease(prog(t, 1.4, 2.4)) : 1 }}>
          {SCENES[sc].label}
        </text>
      )}

      {/* scene 2: the same work, repeated behind every island */}
      {sc === 1 &&
        ENVS.map((_, i) =>
          WORK.map((w, row) => (
            <g key={`${i}${w}`} style={{ opacity: workIn(row) }}>
              <rect x={islX(i) + 8} y={40 + row * 27} width={IW - 16} height={22} rx={3} class="nk-task" />
              <text class="d-sub" x={islX(i) + 18} y={55 + row * 27}>
                {w}
              </text>
            </g>
          )),
        )}

      {/* scene 5: the platform team and a developer */}
      {sc >= 4 && (
        <g style={{ opacity: peopleIn }}>
          <rect x={0} y={4} width={470} height={88} class="nk-card" />
          <text class="d-title" x={14} y={26} style={{ fontWeight: 600 }}>
            Platform team
          </text>
          {['✓ Fleet health: 4 of 4 clusters', '✓ Policy applied: 4 of 4', '✓ Upgraded: 3 of 3 NKP clusters'].map((l, k) => (
            <text key={l} x={14} y={48 + k * 17} class="ok-fill d-label" style={{ fontWeight: 600 }}>
              {l}
            </text>
          ))}
          <rect x={490} y={4} width={470} height={88} class="nk-card" />
          <text class="d-title" x={504} y={26} style={{ fontWeight: 600 }}>
            Developer
          </text>
          <text x={504} y={48} class="muted d-label">
            asks for a namespace for team-a
          </text>
          <text x={504} y={66} class={`${nsIn ? 'ok-fill' : 'muted'} d-label`} style={{ fontWeight: 600 }}>
            {nsIn ? '✓ Ready on an approved cluster' : t >= reqAt ? 'Through the platform’s guardrails…' : ''}
          </text>
        </g>
      )}

      {/* the NKP layer: above the clusters, not in place of them */}
      {layerIn > 0 && (
        <g style={{ opacity: layerIn, transform: `translateY(${(1 - layerIn) * -20}px)` }}>
          <rect x={0} y={LAYER.y} width={W} height={LAYER.h} class="nk-layer" />
          <text class="d-title" x={12} y={LAYER.y + 22} style={{ fontWeight: 650 }}>
            Nutanix Kubernetes Platform
          </text>
          <text x={W - 12} y={LAYER.y + 22} text-anchor="end" class="muted d-sub">
            open, upstream Kubernetes · no lock-in
          </text>
          {BANDS.map((b, k) => {
            const on = bandOn(k);
            const [l1, l2] = b.split(/ (?=and |with )/);
            return (
              <g key={b}>
                <rect x={bandX(k)} y={LAYER.y + 34} width={BW} height={68} rx={4} class={`nk-band${on ? ' on' : ''}`} />
                <text x={bandX(k) + 10} y={LAYER.y + 56} class={`nk-band-t${on ? ' on' : ''}`}>
                  {l1}
                </text>
                <text x={bandX(k) + 10} y={LAYER.y + 72} class={`nk-band-t${on ? ' on' : ''}`} style={{ fontWeight: 400 }}>
                  {l2}
                </text>
                <text x={bandX(k) + 10} y={LAYER.y + 92} class={`d-fine nk-comp${on ? ' on' : ''}`}>
                  {COMPS[k]}
                </text>
              </g>
            );
          })}
          <text x={12} y={LAYER.y + 119} class="muted d-fine">
            <tspan style={{ fontWeight: 600 }}>Example components.</tspan> What is included and on by default depends on the NKP release and edition.
          </text>
        </g>
      )}
      {ENVS.map((_, i) => linkIn(i) > 0 && <line key={i} x1={cx(i)} x2={cx(i)} y1={LAYER.y + LAYER.h} y2={LAYER.y + LAYER.h + (ISL.y - LAYER.y - LAYER.h) * linkIn(i)} class="nk-link" />)}
      {sc === 3 && ENVS.map((_, i) => drop(i, policyAt))}
      {sc === 3 && ENVS.map((e, i) => e.nkp && drop(i, upgradeAt))}
      {req}

      {/* the environments */}
      {ENVS.map((e, i) => {
        const x = islX(i);
        const k = islandsIn(i);
        const ver = upgraded(i) ? '1.36' : '1.35';
        return (
          <g key={e.name} style={{ opacity: k, transform: `translateY(${(1 - k) * 14}px)` }}>
            <rect x={x} y={ISL.y} width={IW} height={ISL.h} rx={sc < 2 ? 14 : 4} class={`nk-isl${sc < 2 ? ' loose' : ''}`} />
            <text class="d-label" x={x + 12} y={ISL.y + 20} style={{ fontWeight: 600 }}>
              {e.name}
            </text>
            <text x={x + 12} y={ISL.y + 35} class="muted d-fine">
              {e.sub}
            </text>
            <rect x={x + 10} y={ISL.y + 44} width={IW - 20} height={58} rx={4} class={`nk-cl${sc >= 3 ? ' on' : ''}`} />
            <text class="d-sub" x={x + 20} y={ISL.y + 61} style={{ fontWeight: 600 }}>
              Kubernetes
            </text>
            <text x={x + IW - 20} y={ISL.y + 61} text-anchor="end" class={`${upgraded(i) ? 'ink-fill mono' : 'muted mono'} d-sub`} style={{ fontWeight: upgraded(i) ? 700 : 400 }}>
              {e.nkp ? ver : 'AKS-managed'}
            </text>
            {[0, 1, 2, 3].map((n) => (
              <rect key={n} x={x + 20 + n * 26} y={ISL.y + 70} width={20} height={20} rx={3} class={`nk-node${upgraded(i) ? ' new' : ''}`} />
            ))}
            {Array.from({ length: 4 }, (_, p) => (
              <circle key={p} cx={x + 140 + (p % 2) * 22} cy={ISL.y + 74 + Math.floor(p / 2) * 14} r={5} class="nk-pod" style={{ opacity: appsIn(i) }} />
            ))}
            {i === 0 && nsIn && (
              <g>
                <rect x={x + 128} y={ISL.y + 66} width={IW - 146} height={28} rx={3} class="nk-ns" />
                <text class="d-fine" x={x + 136} y={ISL.y + 84} style={{ fontWeight: 600 }}>
                  team-a
                </text>
              </g>
            )}

            {/* scenes 1–2: each island's own tools; later, one shared status language */}
            {toolsOut > 0 &&
              e.tools.map((tool, n) => (
                <g key={tool} style={{ opacity: toolsOut * ease(prog(t, 1 + i * 0.3 + n * 0.15, 1.5 + i * 0.3 + n * 0.15)) }}>
                  {t >= 3 + i * 0.4 + n * 0.3 ? <circle cx={x + 20} cy={ISL.y + 115 + n * 14} r={4} class="nk-warn" /> : <circle cx={x + 20} cy={ISL.y + 115 + n * 14} r={2} class="nk-tick" />}
                  <text x={x + 32} y={ISL.y + 119 + n * 14} class="muted d-fine">
                    {tool}
                  </text>
                </g>
              ))}
            {sc >= 3 && (
              <g>
                <rect x={x + 10} y={ISL.y + 110} width={96} height={24} rx={3} class={`nk-chip${policyDone(i) ? ' ok' : ''}`} />
                <text x={x + 20} y={ISL.y + 126} class={`${policyDone(i) ? 'ok-fill' : 'muted'} d-sub`} style={{ fontWeight: 600 }}>
                  {policyDone(i) ? '✓ policy' : 'policy'}
                </text>
                <rect x={x + 114} y={ISL.y + 110} width={IW - 124} height={24} rx={3} class={`nk-chip${t >= S[3] + 0.6 ? ' ok' : ''}`} />
                <text x={x + 124} y={ISL.y + 126} class={`${t >= S[3] + 0.6 ? 'ok-fill' : 'muted'} d-sub`} style={{ fontWeight: 600 }}>
                  ● healthy
                </text>
              </g>
            )}
          </g>
        );
      })}
      {sc === 4 && nsIn && (
        <text x={cx(0) + IW / 2 + IG / 2} y={ISL.y - 8} class="flow-fill halo d-sub" style={{ fontWeight: 600 }}>
          {`team-a gets ${ATTACH.join(', ')} attached`}
        </text>
      )}
    </svg>
  );
}

// What NKP 2.19 also does that has no scene of its own (facts NKP-18).
const ALSO = [
  { k: 'Bare metal (NKP Metal)', text: 'Kubernetes directly on physical servers, imaged and registered through Foundation Central.' },
  { k: 'VMs beside containers', text: 'AHV virtual machines, Linux and Windows, managed with Kubernetes APIs through VM Operator.' },
  { k: 'AI and GPUs', text: 'Direct GPU access, and a curated AI catalog for Pro and Ultimate: Kubeflow Pipelines, JupyterHub, Milvus and more.' },
  { k: 'Air-gapped sites', text: 'Production Kubernetes in isolated environments with no internet connection.' },
  { k: 'Cost management', text: 'Part of NKP Ultimate, with fleet management, GitOps and multitenancy.' },
];

function Also() {
  return (
    <section class="nk-also">
      <h2 class="side-sec-h">Also in NKP 2.19</h2>
      <ul>
        {ALSO.map((a) => (
          <li key={a.k}>
            <b>{a.k}</b>
            <p>{a.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OverviewView() {
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: S[3] + 6.5, steps: STEPS });
  const t = clock.t;
  const sc = phaseAt(S, t);
  const scene = SCENES[sc];
  const ways = sc < 2 ? 4 : 1;
  const policy = sc < 3 ? 0 : Math.min(4, Math.max(0, Math.floor((t - (S[3] + 2.7)) / 0.2) + 1));
  return (
    <Show clock={clock}
      side={<Also />}
      foot={
        <>
          <Follow tone={scene.tone} k={scene.k}>
            <p>{scene.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Environments', v: 4, sub: 'Nutanix, vSphere, AWS, Azure' },
              { k: 'Ways of operating', v: ways, tone: ways > 1 ? 'warn' : 'ok', sub: sc === 1 ? '28 separate processes' : undefined },
              { k: 'Clusters on one policy', v: `${sc >= 3 ? policy : 0} of 4`, tone: policy === 4 ? 'ok' : undefined },
              { k: 'Lock-in', v: sc >= 2 ? 'Open' : 'Per platform', tone: sc >= 2 ? 'ok' : 'warn', sub: sc >= 2 ? 'no NKP lock-in: upstream, open APIs' : 'each stack its own way', tip: 'NKP is upstream, CNCF-conformant Kubernetes with no forks and no proprietary APIs. In Nutanix’s comparison, EKS and AKS each run in one cloud, and OpenShift ties you to RHEL and the Red Hat ecosystem.' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <NkpDiagram t={t} />
      </div>
      <Legend
        items={
          t < TOOLS_GONE
            ? [
                { color: 'var(--muted)', label: 'Each environment’s own tools, listed by name' },
                { color: 'var(--warn)', label: 'An issue in one of them' },
              ]
            : [
                { color: 'var(--ink)', label: 'NKP and what it sends out' },
                { color: 'var(--flow)', label: 'Apps and the developer’s request' },
              ]
        }
      />
      <PlayBar
        clock={clock}
        label="NKP operating model animation"
        extra={<Illus why="A simplified story. Fleet management, GitOps and multitenancy are in NKP Ultimate, and managing EKS or AKS needs a separate NKP Cloud Kubernetes SKU. Attached EKS and AKS clusters keep their cloud’s own Kubernetes upgrades. NKP also runs on bare metal. Versions are examples; the Kubernetes upgrade itself is shown on LCM Rolling Upgrade’s Kubernetes (NKP) tab." />}
      />
    </Show>
  );
}

type TabId = 'ov' | 'life' | 'fleet' | 'ops';
const TABS: { id: TabId; label: string }[] = [
  { id: 'ov', label: 'Overview' },
  { id: 'life', label: 'Cluster lifecycle' },
  { id: 'fleet', label: 'Fleet' },
  { id: 'ops', label: 'Day-2 services' },
];

export default function Nkp() {
  const [tab, setTab] = useEnum<TabId>('tab', 'ov', ['ov', 'life', 'fleet', 'ops']);
  return (
    <Tabs label="Kubernetes Platform topics" value={tab} tabs={TABS} onChange={setTab}>
      {tab === 'ov' && <OverviewView />}
      {tab === 'life' && <LifecycleView />}
      {tab === 'fleet' && <FleetView />}
      {tab === 'ops' && <ServicesView />}
    </Tabs>
  );
}
