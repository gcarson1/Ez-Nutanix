// Kubernetes Platform (NKP): "from islands to one operating model", one loop in six scenes.
// Four Kubernetes environments start as islands, each run its own way; the NKP layer arrives above
// them without replacing them; one upgrade and one policy go out from it (the attached AKS cluster
// keeps Azure's upgrades); the platform team and a developer use the same layer; apps run
// everywhere. Kubernetes version upgrades themselves are on the LCM module's Kubernetes tab.
import { paced, useClock } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar } from '../../components/controls';
import { Kpis, Points, Show, ease, phaseAt, prog, type Point } from '../../components/show';
import './style.css';

const S = [0, 8, 16, 24, 33, 42];
const END = 50;

const SCENES: { tone: Point['tone']; k: string; label: string; text: string }[] = [
  { tone: 'ink', k: 'Islands', label: 'Kubernetes is powerful, but operating every cluster consistently is hard.', text: 'Four places run Kubernetes: Nutanix, VMware, AWS and Azure. Each cluster comes with its own upgrade scripts, monitoring, security and ticket queue, managed its own way.' },
  { tone: 'warn', k: 'Hidden work', label: 'Every cluster becomes its own project.', text: 'Behind every island the same work repeats: provisioning, upgrades, security policies, observability, storage and data protection, developer access and troubleshooting. Four environments, seven jobs each, 28 separate processes.' },
  { tone: 'flow', k: 'NKP arrives', label: 'NKP adds one consistent operating model across Kubernetes environments.', text: 'NKP sits above the environments without replacing them. The clusters stay where they are; NKP connects to each, built from upstream CNCF projects that Nutanix integrates and validates as one stack.' },
  { tone: 'flow', k: 'One fleet', label: 'One view. Consistent policy. Controlled change.', text: 'The clusters now share one status language. A policy goes to all four; an upgrade goes to the three NKP clusters, while the attached AKS cluster keeps following Azure’s own upgrades.' },
  { tone: 'ok', k: 'Two teams, one road', label: 'Platform teams govern the road. Developers use the road.', text: 'The platform team sees fleet health, compliance and upgrades in one place. A developer asks for a namespace, and it lands on an approved cluster with storage, networking, observability and policy already attached.' },
  { tone: 'ok', k: 'The outcome', label: 'Consistent cloud-native operations wherever the apps run.', text: 'Apps run across private cloud, VMware and public cloud, on the same Kubernetes, storage, data protection, observability and automation, operated one way.' },
];
const STEPS = paced(S, SCENES.map((s) => [s.k, s.text]));
const CARDS: Point[] = SCENES.map((s, i) => ({ at: S[i], tone: s.tone, k: s.k, text: s.label }));

const W = 960;
const H = 392;
const IW = 225;
const IG = 20;
const islX = (i: number) => i * (IW + IG);
const ISL = { y: 240, h: 146 };
const LAYER = { y: 104, h: 96 };
const ENVS = [
  { name: 'Nutanix (AHV)', sub: 'private cloud', nkp: true, shape: 0, color: 'var(--ink)' },
  { name: 'VMware vSphere', sub: 'on-premises', nkp: true, shape: 1, color: 'var(--warn)' },
  { name: 'AWS', sub: 'NKP cluster in your account', nkp: true, shape: 2, color: 'var(--flow)' },
  { name: 'Azure', sub: 'existing AKS, attached', nkp: false, shape: 3, color: 'var(--s2)' },
];
const TOOLS = ['upgrades', 'monitoring', 'security', 'tickets'];
const WORK = ['Provisioning', 'Upgrades', 'Security policies', 'Observability', 'Storage and data protection', 'Developer access', 'Troubleshooting'];
const BANDS = ['Provision and upgrade', 'Govern and secure', 'Observe and troubleshoot', 'Deliver with GitOps', 'Protect data and apps', 'Manage the fleet'];
const BW = (W - 24 - 5 * 8) / 6;
const bandX = (i: number) => 12 + i * (BW + 8);
const ATTACH = ['storage', 'network', 'observability', 'policy'];

/** One tool drawn in the island's own shape and color: every environment looks different. */
function Tool({ shape, color, x, y }: { shape: number; color: string; x: number; y: number }) {
  const r = 7;
  if (shape === 0) return <circle cx={x} cy={y} r={r} fill={color} />;
  if (shape === 1) return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} fill={color} />;
  if (shape === 2) return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y + r} ${x - r - 1},${y + r}`} fill={color} />;
  return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}`} fill={color} />;
}

function NkpDiagram({ t }: { t: number }) {
  const sc = phaseAt(S, t);
  const islandsIn = (i: number) => ease(prog(t, 0.2 + i * 0.35, 0.9 + i * 0.35));
  const toolsOut = 1 - ease(prog(t, S[2] + 1, S[2] + 2.2));
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
        <text x={W / 2} y={sc === 0 ? 150 : 24} text-anchor="middle" class="halo" style={{ fontSize: sc === 0 ? '19px' : '15px', fontWeight: 600, opacity: sc === 0 ? ease(prog(t, 1.4, 2.4)) : 1 }}>
          {SCENES[sc].label}
        </text>
      )}

      {/* scene 2: the same work, repeated behind every island */}
      {sc === 1 &&
        ENVS.map((_, i) =>
          WORK.map((w, row) => (
            <g key={`${i}${w}`} style={{ opacity: workIn(row) }}>
              <rect x={islX(i) + 8} y={40 + row * 27} width={IW - 16} height={22} rx={3} class="nk-task" />
              <text x={islX(i) + 18} y={55 + row * 27} style={{ fontSize: '11.5px' }}>
                {w}
              </text>
              <Tool shape={ENVS[i].shape} color={ENVS[i].color} x={islX(i) + IW - 22} y={51 + row * 27} />
            </g>
          )),
        )}

      {/* scene 5: the platform team and a developer */}
      {sc >= 4 && (
        <g style={{ opacity: peopleIn }}>
          <rect x={0} y={4} width={470} height={88} class="nk-card" />
          <text x={14} y={26} style={{ fontSize: '14px', fontWeight: 600 }}>
            Platform team
          </text>
          {['✓ Fleet health: 4 of 4 clusters', '✓ Policy applied: 4 of 4', '✓ Upgraded: 3 of 3 NKP clusters'].map((l, k) => (
            <text key={l} x={14} y={48 + k * 17} class="ok-fill" style={{ fontSize: '12.5px', fontWeight: 600 }}>
              {l}
            </text>
          ))}
          <rect x={490} y={4} width={470} height={88} class="nk-card" />
          <text x={504} y={26} style={{ fontSize: '14px', fontWeight: 600 }}>
            Developer
          </text>
          <text x={504} y={48} class="muted" style={{ fontSize: '12.5px' }}>
            asks for a namespace for team-a
          </text>
          <text x={504} y={66} class={nsIn ? 'ok-fill' : 'muted'} style={{ fontSize: '12.5px', fontWeight: 600 }}>
            {nsIn ? '✓ Ready on an approved cluster' : t >= reqAt ? 'Through the platform’s guardrails…' : ''}
          </text>
        </g>
      )}

      {/* the NKP layer: above the clusters, not in place of them */}
      {layerIn > 0 && (
        <g style={{ opacity: layerIn, transform: `translateY(${(1 - layerIn) * -20}px)` }}>
          <rect x={0} y={LAYER.y} width={W} height={LAYER.h} class="nk-layer" />
          <text x={12} y={LAYER.y + 22} style={{ fontSize: '14.5px', fontWeight: 650 }}>
            Nutanix Kubernetes Platform
          </text>
          <text x={W - 12} y={LAYER.y + 22} text-anchor="end" class="muted" style={{ fontSize: '12px' }}>
            upstream CNCF projects, integrated and validated
          </text>
          {BANDS.map((b, k) => {
            const on = bandOn(k);
            const [l1, l2] = b.split(/ (?=and |with )/);
            return (
              <g key={b}>
                <rect x={bandX(k)} y={LAYER.y + 34} width={BW} height={52} rx={4} class={`nk-band${on ? ' on' : ''}`} />
                <text x={bandX(k) + 10} y={LAYER.y + 56} class={`nk-band-t${on ? ' on' : ''}`}>
                  {l1}
                </text>
                <text x={bandX(k) + 10} y={LAYER.y + 72} class={`nk-band-t${on ? ' on' : ''}`} style={{ fontWeight: 400 }}>
                  {l2}
                </text>
              </g>
            );
          })}
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
        const bob = sc < 2 ? Math.sin(t * 1.3 + i * 1.7) * 3 : 0;
        const ver = upgraded(i) ? '1.36' : '1.35';
        return (
          <g key={e.name} style={{ opacity: k, transform: `translateY(${bob + (1 - k) * 14}px)` }}>
            <rect x={x} y={ISL.y} width={IW} height={ISL.h} rx={sc < 2 ? 14 : 4} class={`nk-isl${sc < 2 ? ' loose' : ''}`} />
            <text x={x + 12} y={ISL.y + 20} style={{ fontSize: '13.5px', fontWeight: 600 }}>
              {e.name}
            </text>
            <text x={x + 12} y={ISL.y + 35} class="muted" style={{ fontSize: '11px' }}>
              {e.sub}
            </text>
            <rect x={x + 10} y={ISL.y + 44} width={IW - 20} height={58} rx={4} class={`nk-cl${sc >= 3 ? ' on' : ''}`} />
            <text x={x + 20} y={ISL.y + 61} style={{ fontSize: '12px', fontWeight: 600 }}>
              Kubernetes
            </text>
            <text x={x + IW - 20} y={ISL.y + 61} text-anchor="end" class={upgraded(i) ? 'ink-fill mono' : 'muted mono'} style={{ fontSize: '11.5px', fontWeight: upgraded(i) ? 700 : 400 }}>
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
                <text x={x + 136} y={ISL.y + 84} style={{ fontSize: '11px', fontWeight: 600 }}>
                  team-a
                </text>
              </g>
            )}

            {/* scenes 1–2: each island's own tools; later, one shared status language */}
            {toolsOut > 0 &&
              TOOLS.map((tool, n) => (
                <g key={tool} style={{ opacity: toolsOut * ease(prog(t, 1 + i * 0.3 + n * 0.15, 1.5 + i * 0.3 + n * 0.15)) }}>
                  <Tool shape={e.shape} color={e.color} x={x + 32 + n * 54} y={ISL.y + 118} />
                  <text x={x + 32 + n * 54} y={ISL.y + 138} text-anchor="middle" class="muted" style={{ fontSize: '10px' }}>
                    {tool}
                  </text>
                  {t >= 3 + i * 0.4 + n * 0.3 && <circle cx={x + 40 + n * 54} cy={ISL.y + 110} r={4} class="nk-warn" />}
                </g>
              ))}
            {sc >= 3 && (
              <g>
                <rect x={x + 10} y={ISL.y + 110} width={96} height={24} rx={3} class={`nk-chip${policyDone(i) ? ' ok' : ''}`} />
                <text x={x + 20} y={ISL.y + 126} class={policyDone(i) ? 'ok-fill' : 'muted'} style={{ fontSize: '11.5px', fontWeight: 600 }}>
                  {policyDone(i) ? '✓ policy' : 'policy'}
                </text>
                <rect x={x + 114} y={ISL.y + 110} width={IW - 124} height={24} rx={3} class={`nk-chip${t >= S[3] + 0.6 ? ' ok' : ''}`} />
                <text x={x + 124} y={ISL.y + 126} class={t >= S[3] + 0.6 ? 'ok-fill' : 'muted'} style={{ fontSize: '11.5px', fontWeight: 600 }}>
                  ● healthy
                </text>
              </g>
            )}
          </g>
        );
      })}
      {sc === 4 && nsIn && (
        <text x={cx(0) + IW / 2 + IG / 2} y={ISL.y - 8} class="flow-fill halo" style={{ fontSize: '11.5px', fontWeight: 600 }}>
          {`team-a gets ${ATTACH.join(', ')} attached`}
        </text>
      )}
    </svg>
  );
}

export default function Nkp() {
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: S[3] + 6.5, steps: STEPS });
  const t = clock.t;
  const sc = phaseAt(S, t);
  const scene = SCENES[sc];
  const ways = sc < 2 ? 4 : 1;
  const policy = sc < 3 ? 0 : Math.min(4, Math.max(0, Math.floor((t - (S[3] + 2.7)) / 0.2) + 1));
  return (
    <Show
      top={<Points label="From islands to one operating model" items={CARDS} t={t} />}
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
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <NkpDiagram t={t} />
      </div>
      <Legend
        items={[
          { color: 'var(--ink)', label: 'NKP and what it sends out' },
          { color: 'var(--flow)', label: 'Apps and the developer’s request' },
          { color: 'var(--warn)', label: 'Separate tools, each with its own issues' },
        ]}
      />
      <PlayBar
        clock={clock}
        label="NKP operating model animation"
        extra={<Illus why="A simplified story. Fleet management, GitOps and multitenancy are in NKP Ultimate, and managing EKS or AKS needs a separate NKP Cloud Kubernetes SKU. Attached EKS and AKS clusters keep their cloud’s own Kubernetes upgrades. NKP also runs on bare metal. Versions are examples; the Kubernetes upgrade itself is shown on the LCM module’s Kubernetes tab." />}
      />
    </Show>
  );
}
