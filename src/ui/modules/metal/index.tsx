// Kubernetes on Bare Metal: the landing's "Any Bare Metal Linux" pane. The hardware partners named
// for NKP Metal are listed above one loop: the servers, Foundation deploying them, Kubernetes on
// top, LCM keeping firmware and OS current, then the pre-provisioned alternative.
// Claims: docs/facts.md section 17.
import { paced, useClock } from '../../components/clock';
import { Follow, Illus, PlayBar, type Tone } from '../../components/controls';
import { Kpis, Names, Show, ease, phaseAt, prog } from '../../components/show';
import './style.css';

const VENDORS = [
  { name: 'Cisco', sub: 'Unified Edge · Intersight' },
  { name: 'Lenovo', sub: 'ThinkSystem servers' },
  { name: 'Supermicro', sub: 'servers' },
];

const P = [0, 3.4, 7, 10.6, 14.2];
const END = 18;
const LINES: { tone: Tone | 'ink'; k: string; text: string }[] = [
  { tone: 'ink', k: 'Your servers', text: 'NKP Metal runs Kubernetes straight on bare-metal servers, with no hypervisor. Cisco, Lenovo and Supermicro were named as its hardware partners at launch, with Intel Xeon processors.' },
  { tone: 'flow', k: 'Foundation deploys the nodes', text: 'Nutanix Foundation, the same tool that builds Nutanix clusters, discovers the servers and deploys them as nodes. Ubuntu, from Canonical, is the Linux named at launch.' },
  { tone: 'flow', k: 'Kubernetes runs on top', text: 'NKP builds the Kubernetes cluster on the nodes and runs it like any other NKP cluster. Cloud Native AOS can be its storage.' },
  { tone: 'ok', k: 'LCM keeps them current', text: 'Life Cycle Manager, the same one that updates Nutanix clusters, patches the operating system and updates firmware on the bare-metal nodes.' },
  { tone: 'ink', k: 'Or bring your own servers', text: 'NKP has long run on pre-provisioned bare metal too: servers you prepare yourself, where you install and patch the operating system and firmware.' },
];
const STEPS = paced(P, LINES.map((l) => [l.k, l.text]));

const W = 960;
const H = 316;
const SX = 200;
const SW = 160;
const SG = 24;
const srvX = (i: number) => SX + i * (SW + SG);
const SPAN = { x: SX, w: 3 * SW + 2 * SG };
const SRV = { y: 204, h: 100 };
const OS = { y: 156, h: 36 };
const K8S = { y: 104, h: 40 };
const APPS = { y: 28, h: 64 };
const TOOL = { w: 160, h: 72, y: 174 };
const FND = { x: 12 };
const LCM = { x: W - 12 - TOOL.w };

function MetalDiagram({ t }: { t: number }) {
  const ph = phaseAt(P, t);
  const own = ph === 4;
  const srvIn = (i: number) => ease(prog(t, 0.3 + i * 0.4, 1 + i * 0.4));
  const fnd = ph === 1;
  const osIn = ease(prog(t, P[1] + 0.8, P[1] + 2));
  const k8sIn = ease(prog(t, P[2] + 0.2, P[2] + 1.2));
  const podsIn = (k: number) => t >= P[2] + 1.2 + k * 0.15;
  const lcm = ph === 3;
  const pulse = (a: number) => ((t - a) % 1.2) / 1.2;
  return (
    <svg class="diagram mt-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Three bare-metal servers from Cisco, Lenovo and Supermicro. Nutanix Foundation deploys them as nodes with Ubuntu Linux, NKP runs Kubernetes on top with no hypervisor, and Life Cycle Manager updates their firmware and operating system.">
      <defs>
        <marker id="mt-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--flow)" />
        </marker>
      </defs>

      {/* apps and Kubernetes */}
      <g style={{ opacity: k8sIn }}>
        <rect x={SPAN.x} y={APPS.y} width={SPAN.w} height={APPS.h} class="mt-layer" />
        <text x={SPAN.x + 14} y={APPS.y + 20} style={{ fontSize: '13px', fontWeight: 600 }}>
          Your containerized apps
        </text>
        {Array.from({ length: 12 }, (_, k) => (
          <rect key={k} x={SPAN.x + 14 + k * 44} y={APPS.y + 30} width={36} height={22} rx={4} class="mt-pod" style={{ opacity: podsIn(k) ? 1 : 0 }} />
        ))}
        <rect x={SPAN.x} y={K8S.y} width={SPAN.w} height={K8S.h} class="mt-layer k8s" />
        <text x={SPAN.x + 14} y={K8S.y + 25} style={{ fill: '#fff', fontSize: '14px', fontWeight: 600 }}>
          Kubernetes · Nutanix Kubernetes Platform
        </text>
        <text x={SPAN.x + SPAN.w - 14} y={K8S.y + 25} text-anchor="end" style={{ fill: 'rgba(255,255,255,.85)', fontSize: '12.5px' }}>
          no hypervisor
        </text>
      </g>

      {/* the operating system */}
      <g style={{ opacity: own ? 1 : osIn }}>
        <rect x={SPAN.x} y={OS.y} width={SPAN.w} height={OS.h} class="mt-layer os" />
        <text x={SPAN.x + 14} y={OS.y + 23} style={{ fontSize: '13.5px', fontWeight: 600 }}>
          Linux operating system <tspan class="muted" style={{ fontWeight: 400 }}>· Ubuntu named at launch</tspan>
        </text>
        <text x={SPAN.x + SPAN.w - 14} y={OS.y + 23} text-anchor="end" class={own ? 'warn-fill' : lcm ? 'ok-fill' : 'muted'} style={{ fontSize: '12.5px', fontWeight: 600 }}>
          {own ? 'you install and patch it' : lcm ? '↻ patched by LCM' : ''}
        </text>
      </g>

      {/* the servers */}
      {VENDORS.map((v, i) => {
        const x = srvX(i);
        const k = srvIn(i);
        return (
          <g key={v.name} style={{ opacity: k, transform: `translateY(${(1 - k) * 16}px)` }}>
            <rect x={x} y={SRV.y} width={SW} height={SRV.h} class={`mt-srv${lcm ? ' on' : ''}`} />
            <text x={x + 14} y={SRV.y + 28} class="mt-name">
              {own ? 'Your server' : v.name}
            </text>
            <text x={x + 14} y={SRV.y + 46} class="muted" style={{ fontSize: '11.5px' }}>
              {own ? 'prepared by you' : v.sub}
            </text>
            {[0, 1].map((r) => (
              <g key={r}>
                <line x1={x + 14} x2={x + SW - 30} y1={SRV.y + 64 + r * 14} y2={SRV.y + 64 + r * 14} class="mt-ru" />
                <circle cx={x + SW - 20} cy={SRV.y + 64 + r * 14} r={3} class={`mt-led${t >= P[1] + 0.8 ? ' on' : ''}`} />
              </g>
            ))}
            <text x={x + 14} y={SRV.y + SRV.h - 8} class={lcm ? 'ok-fill' : 'faint'} style={{ fontSize: '11px', fontWeight: lcm ? 600 : 400 }}>
              {lcm ? '↻ firmware updated by LCM' : own ? 'firmware: yours to update' : 'bare-metal server'}
            </text>
          </g>
        );
      })}

      {/* Foundation on the left, LCM on the right */}
      <rect x={FND.x} y={TOOL.y} width={TOOL.w} height={TOOL.h} class={`mt-tool${fnd ? ' on' : ''}`} style={{ opacity: own ? 0.35 : 1 }} />
      <text x={FND.x + 14} y={TOOL.y + 26} style={{ fontSize: '14px', fontWeight: 600, opacity: own ? 0.35 : 1 }}>
        Nutanix Foundation
      </text>
      <text x={FND.x + 14} y={TOOL.y + 46} class="muted" style={{ fontSize: '12px', opacity: own ? 0.35 : 1 }}>
        discovers and deploys
      </text>
      {fnd && <line x1={FND.x + TOOL.w + 2} x2={SX - 6} y1={TOOL.y + TOOL.h / 2} y2={TOOL.y + TOOL.h / 2} class="mt-arrow" marker-end="url(#mt-ar)" />}
      {fnd && <circle cx={FND.x + TOOL.w + 2 + (SX - 8 - FND.x - TOOL.w) * pulse(P[1])} cy={TOOL.y + TOOL.h / 2} r={5} class="mt-dot" />}

      <rect x={LCM.x} y={TOOL.y} width={TOOL.w} height={TOOL.h} class={`mt-tool${lcm ? ' on' : ''}`} style={{ opacity: own ? 0.35 : 1 }} />
      <text x={LCM.x + 14} y={TOOL.y + 26} style={{ fontSize: '14px', fontWeight: 600, opacity: own ? 0.35 : 1 }}>
        Life Cycle Manager
      </text>
      <text x={LCM.x + 14} y={TOOL.y + 46} class="muted" style={{ fontSize: '12px', opacity: own ? 0.35 : 1 }}>
        firmware and OS updates
      </text>
      {lcm && <line x1={LCM.x - 2} x2={SPAN.x + SPAN.w + 6} y1={TOOL.y + TOOL.h / 2} y2={TOOL.y + TOOL.h / 2} class="mt-arrow" marker-end="url(#mt-ar)" />}
      {lcm && <circle cx={LCM.x - 2 - (LCM.x - 8 - SPAN.x - SPAN.w) * pulse(P[3])} cy={TOOL.y + TOOL.h / 2} r={5} class="mt-dot" />}
    </svg>
  );
}

export default function Metal() {
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: P[3] + 1, steps: STEPS });
  const t = clock.t;
  const ph = phaseAt(P, t);
  const line = LINES[ph];
  return (
    <Show
      top={
        <>
          <Names label="Hardware partners for NKP Metal" items={VENDORS.map((v) => v.name)} />
          <Names label="Named with them" items={['Intel Xeon processors', 'Ubuntu (Canonical)']} />
        </>
      }
      foot={
        <>
          <Follow tone={line.tone} k={line.k}>
            <p>{line.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'NKP Metal', v: 'Early access', tone: 'warn', sub: 'NKP Pro and Ultimate' },
              { k: 'GA target', v: '2nd half 2026' },
              { k: 'Hypervisor', v: 'None' },
              { k: 'Pre-provisioned', v: 'Supported', tone: 'ok', sub: 'you run the OS and firmware' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <MetalDiagram t={t} />
      </div>
      <PlayBar
        clock={clock}
        label="Bare-metal Kubernetes animation"
        extra={<Illus why="The partners are those named in Nutanix’s NKP Metal announcement (April 2026); exact supported models and firmware levels are on Nutanix’s compatibility lists. NKP Metal is in early access, so steps may change before general availability." />}
      />
    </Show>
  );
}
