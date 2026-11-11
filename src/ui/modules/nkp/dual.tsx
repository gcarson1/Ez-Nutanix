// Kubernetes Platform, Dual-native tab: one NKP management plane running Kubernetes workers as AHV
// virtual machines and on bare metal (NKP Metal), and managing AHV virtual machines themselves through
// Kubernetes APIs (VM Operator). Names and counts are examples; claims are in docs/facts.md (NKP-21).
import { prog } from '../../components/show';
import { Story, W, fly, pts, type Pt, type StoryStep } from '../ai/kit';
import { Row } from './parts';

const AT = [0, 5, 11, 17, 23];
const STEPS: StoryStep[] = [
  { tone: 'ink', k: 'Kubernetes on virtual machines', text: 'An NKP cluster on Nutanix runs its worker nodes as AHV virtual machines, created and replaced through Cluster API.' },
  {
    tone: 'flow',
    k: 'NKP Metal: Kubernetes on bare metal',
    text: 'NKP 2.19 introduces NKP Metal. Using Foundation Central and the NKP host inventory, administrators image and register physical servers, which then run Kubernetes directly.',
  },
  {
    tone: 'ok',
    k: 'Physical workers join the same cluster',
    text: 'A pool of physical workers can be added to a VM-based cluster. Workloads such as AI and GPU computing get direct access to compute, networking, storage and accelerators.',
  },
  {
    tone: 'flow',
    k: 'Virtual machines through Kubernetes APIs',
    text: 'With VM Operator, also new in NKP 2.19, platform teams provision, update, monitor and manage Linux and Windows VMs on AHV using Kubernetes APIs and declarative workflows.',
  },
  {
    tone: 'ok',
    k: 'One operating model',
    text: 'Containers run on virtual machines or natively on bare metal, and VMs sit beside them, all under one declarative Kubernetes control plane. The team learns one way of working.',
  },
];
const T = { image: [5.6, 7.4], register: [8.0, 8.6], join: [11.5, 12.3], vm: [17.6, 18.8] };
const COL = [16, 332, 648];
const CW = 296;
const TOP = { y: 16, h: 72 };
const BODY = { y: 124, h: 196 };
const down = (c: number): Pt[] => [
  [COL[c] + CW / 2, TOP.y + TOP.h],
  [COL[c] + CW / 2, BODY.y],
];

function Unit({ x, y, w = 132, title, sub, on = true, tone, cls = 'nk-wk' }: { x: number; y: number; w?: number; title: string; sub: string; on?: boolean; tone?: 'ok' | 'flow'; cls?: string }) {
  return (
    <g style={{ opacity: on ? 1 : 0.25 }}>
      <rect class={cls} x={x} y={y} width={w} height={48} rx={5} />
      <text class="d-sub" x={x + 10} y={y + 19} style={{ fontWeight: 600 }}>
        {title}
      </text>
      <text class={`d-fine ${tone ? `${tone}-fill` : 'muted'}`} x={x + 10} y={y + 36} style={{ fontWeight: tone ? 600 : 400 }}>
        {sub}
      </text>
    </g>
  );
}

export default function DualView() {
  return (
    <Story
      steps={STEPS}
      at={AT}
      end={29}
      poster={28}
      label="Dual-native infrastructure"
      why="Example clusters, servers and VMs, with times compressed. NKP Metal and VM Operator are new in NKP 2.19; what each needs by edition and hardware is in the release documentation."
      legend={[
        { color: 'var(--flow)', label: 'A declaration from the management plane' },
        { color: 'var(--ok)', label: 'Ready' },
      ]}
      kpis={(t) => {
        const metal = [0, 1].filter((i) => t >= T.join[i]).length;
        const vms = [0, 1].filter((i) => t >= T.vm[i]).length;
        return [
          { k: 'Workers on virtual machines', v: 3 },
          { k: 'Workers on bare metal', v: metal, tone: metal === 2 ? 'ok' : undefined, sub: metal ? 'in the same cluster' : undefined },
          { k: 'AHV VMs managed', v: vms, tone: vms === 2 ? 'ok' : undefined, sub: vms ? 'Linux and Windows' : undefined },
          { k: 'Managed through', v: 'Kubernetes APIs', sub: 'one declarative model' },
        ];
      }}
    >
      {(t, phase) => {
        const imaged = (i: number) => prog(t, T.image[i], T.image[i] + 0.8);
        const registered = (i: number) => t >= T.register[i];
        const joined = (i: number) => t >= T.join[i];
        const vm = (i: number) => t >= T.vm[i];
        const lit = [phase === 0 || phase === 4, (phase >= 1 && phase <= 2) || phase === 4, phase >= 3];
        return (
          <svg
            class="diagram nk-svg"
            viewBox={`0 0 ${W} 336`}
            role="img"
            aria-label="One NKP management plane. It runs Kubernetes workers as AHV virtual machines, adds bare-metal workers imaged through Foundation Central to the same cluster with NKP Metal, and manages AHV virtual machines through Kubernetes APIs with VM Operator."
          >
            <rect class="ai-ep" x={16} y={TOP.y} width={928} height={TOP.h} rx={8} />
            <text class="ai-site-t" x={30} y={TOP.y + 22}>
              NKP management plane
            </text>
            <text class="d-sub muted" x={930} y={TOP.y + 22} text-anchor="end">
              one declarative Kubernetes control plane
            </text>
            <Row x={COL[0] + 14} y={TOP.y + 54} label="Cluster API · VM workers" on={lit[0]} />
            <Row x={COL[1] + 14} y={TOP.y + 54} label="NKP Metal · host inventory" on={lit[1]} />
            <Row x={COL[2] + 14} y={TOP.y + 54} label="VM Operator · AHV VMs" on={lit[2]} />
            {[0, 1, 2].map((c) => (
              <polyline key={c} points={pts(down(c))} class={`ai-wire${(c === 1 && phase < 1) || (c === 2 && phase < 3) ? ' idle' : ''}`} />
            ))}

            {/* the cluster spans the first two columns: VM workers, then physical workers */}
            <rect class="nk-isl" x={COL[0]} y={BODY.y} width={COL[1] + CW - COL[0]} height={BODY.h} rx={6} />
            <text class="d-label" x={COL[0] + 14} y={BODY.y + 22} style={{ fontWeight: 600 }}>
              Kubernetes cluster: retail-prod
            </text>
            <text class="d-fine muted" x={COL[0] + 14} y={BODY.y + 46}>
              Workers on AHV virtual machines
            </text>
            {[0, 1, 2].map((i) => (
              <Unit key={i} x={COL[0] + 14 + (i % 2) * 140} y={BODY.y + 54 + Math.floor(i / 2) * 56} title={`worker-${i + 1}`} sub="AHV VM · containers" />
            ))}
            <text class="d-fine muted" x={COL[1] + 14} y={BODY.y + 46}>
              {phase >= 2 ? 'Workers on bare metal (NKP Metal)' : 'Physical servers'}
            </text>
            {[0, 1].map((i) => (
              <Unit
                key={i}
                x={COL[1] + 14 + i * 140}
                y={BODY.y + 54}
                title={joined(i) ? `metal-${i + 1}` : `server ${i + 1}`}
                sub={joined(i) ? '✓ worker · direct GPU' : registered(i) ? 'registered in inventory' : imaged(i) > 0 ? 'being imaged' : 'not in use'}
                on={phase >= 1}
                tone={joined(i) ? 'ok' : imaged(i) > 0 ? 'flow' : undefined}
                cls={`nk-wk${joined(i) ? '' : imaged(i) > 0 ? ' new' : ''}`}
              />
            ))}
            {phase >= 1 && (
              <text class="d-fine muted" x={COL[1] + 14} y={BODY.y + 126}>
                {phase >= 2 ? 'no hypervisor between Kubernetes and the hardware' : 'imaged through Foundation Central'}
              </text>
            )}

            {/* AHV virtual machines, managed as Kubernetes resources */}
            <rect class="nk-isl" x={COL[2]} y={BODY.y} width={CW} height={BODY.h} rx={6} style={{ opacity: phase >= 3 ? 1 : 0.4 }} />
            <text class="d-label" x={COL[2] + 14} y={BODY.y + 22} style={{ fontWeight: 600, opacity: phase >= 3 ? 1 : 0.4 }}>
              AHV virtual machines
            </text>
            <text class="d-fine muted" x={COL[2] + 14} y={BODY.y + 46} style={{ opacity: phase >= 3 ? 1 : 0.4 }}>
              declared with Kubernetes APIs
            </text>
            <Unit x={COL[2] + 14} y={BODY.y + 54} w={268} title="billing-db" sub={vm(0) ? '✓ Linux VM · running' : 'Linux VM'} on={vm(0)} tone={vm(0) ? 'ok' : undefined} />
            <Unit x={COL[2] + 14} y={BODY.y + 110} w={268} title="reports-app" sub={vm(1) ? '✓ Windows VM · running' : 'Windows VM'} on={vm(1)} tone={vm(1) ? 'ok' : undefined} />
            {phase === 4 && (
              <text class="d-sub ok-fill" x={COL[0] + 14} y={BODY.y + 182} style={{ fontWeight: 600 }}>
                ✓ VMs, containers and bare metal, run one way
              </text>
            )}
            {[0, 1].map((i) => {
              const a = fly(t, T.image[i] - 0.6, T.image[i], down(1));
              const b = fly(t, T.vm[i] - 0.6, T.vm[i], down(2));
              return (
                <g key={i}>
                  {a && <circle cx={a[0]} cy={a[1]} r={6} class="ai-req" />}
                  {b && <circle cx={b[0]} cy={b[1]} r={6} class="ai-req" />}
                </g>
              );
            })}
          </svg>
        );
      }}
    </Story>
  );
}
