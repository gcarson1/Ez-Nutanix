// Cloud Native AOS: the same AOS data services, delivered as pods in Kubernetes instead of a
// Controller VM on a hypervisor. Pick where it runs and watch the stack build from the servers up,
// with what differs and what stays the same marked. The landing's "Any Bare Metal Linux" pane opens
// this module with on=metal.
import { useEnum } from '../../../state/route';
import { useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, phaseAt, prog } from '../../components/show';
import './style.css';

type On = 'vm' | 'eks' | 'metal';

interface Layer {
  label: string;
  sub: string;
  /** Same idea in both deployments. */
  same?: boolean;
}

const STACK: Record<On, Layer[]> = {
  vm: [
    { label: 'VMs, plus containers on NKP', sub: 'Apps get virtual disks, or volumes through the CSI driver' },
    { label: 'AOS data services', sub: 'Replication, snapshots, encryption, QoS, DR', same: true },
    { label: 'Controller VM (CVM) on every node', sub: 'Runs AOS and owns the node’s local drives' },
    { label: 'Hypervisor: AHV or ESXi', sub: 'Runs the user VMs and the CVM' },
    { label: 'Servers with local drives', sub: 'Nutanix or OEM nodes, NVMe / SSD / HDD' },
  ],
  eks: [
    { label: 'Containerized apps', sub: 'Pods claim persistent volumes through Kubernetes' },
    { label: 'AOS data services', sub: 'Resilience, snapshots, encryption, QoS, DR', same: true },
    { label: 'AOS as pods on each worker node', sub: 'Microservices; no CVM' },
    { label: 'Amazon EKS worker nodes', sub: 'No hypervisor layer to run or manage' },
    { label: 'EC2 instances with local NVMe', sub: 'i3en, i4i, m6id or m5d in release 1.0' },
  ],
  metal: [
    { label: 'Containers, and VMs alongside', sub: 'Both on the same Kubernetes platform' },
    { label: 'AOS data services', sub: 'Storage via Cloud Native AOS (or a CSI driver)', same: true },
    { label: 'AOS as pods on each node', sub: 'Microservices; no CVM' },
    { label: 'NKP Metal: Linux and Kubernetes', sub: 'Directly on the server; no hypervisor' },
    { label: 'Bare-metal servers', sub: 'Provisioned through Foundation and LCM' },
  ],
};

const SIDE: Record<On, { mgmt: string; mgmtSub: string; dr: string; drSub: string }> = {
  vm: { mgmt: 'Prism and Prism Central', mgmtSub: 'UI and v4 APIs', dr: 'Protection policies', drSub: 'Async, NearSync or synchronous replication' },
  eks: { mgmt: 'Kubernetes API', mgmtSub: 'kubectl and GitOps tools', dr: 'NDK app-level DR', drSub: 'Snapshots and replication per app; RPO\u00a01\u00a0h or more in 1.0' },
  metal: { mgmt: 'Kubernetes API, NKP', mgmtSub: 'Fleet and lifecycle through NKP', dr: 'App-level DR', drSub: 'Expected through NDK; details not published' },
};

const TITLE: Record<On, string> = {
  vm: 'VM-based AOS on Nutanix Cloud Infrastructure',
  eks: 'Cloud Native AOS on Amazon EKS',
  metal: 'Cloud Native AOS on bare metal (NKP Metal)',
};

const CAPTION: Record<On, [string, string, string]> = {
  vm: [
    'Each server runs a hypervisor, AHV or ESXi, and one Controller VM (CVM) that runs AOS and owns the node’s local drives.',
    'The CVMs pool the drives of every node into one storage system and run the data services: replication, snapshots, encryption, QoS and DR.',
    'VMs get virtual disks, and containers on NKP get volumes through the CSI driver. This is the Nutanix cluster most customers know.',
  ],
  eks: [
    'Amazon EKS workers on EC2 instances with local NVMe. There is no hypervisor layer to run and no CVM: AOS runs as pods on each worker.',
    'The storage engine and its data services are the same AOS; only the packaging changed. Release 1.0 keeps two copies (RF2) on up to 15 workers.',
    'Pods claim persistent volumes through Kubernetes, and you manage it all through the Kubernetes API. App-level snapshots, replication and DR come from NDK.',
  ],
  metal: [
    'NKP Metal runs Linux and Kubernetes straight on the servers, provisioned through Foundation and LCM. AOS runs as pods on each node, with no hypervisor and no CVM.',
    'The same AOS data services as on any Nutanix cluster, delivered by Cloud Native AOS (or a CSI driver for other storage).',
    'Containers and VMs run side by side on one Kubernetes platform. NKP Metal was announced in April 2026 as early access, with GA targeted for the second half of 2026.',
  ],
};

const W = 960;
const SW = 600;
const LH = 50;
const GAP = 8;
const Y0 = 4;
const DOT_X = 452;
/** Layers land bottom first; index 0 is the top (apps) layer. */
const LAND = [6.0, 3.8, 2.4, 1.4, 0.4];
const DROP = 0.5;
const DOTS = [6.7, 7.5, 8.3];
const DOT_T = 1.5;
const END = 10.8;
const PHASE_STARTS = [0, LAND[1], LAND[0]];

function wrap(s: string, n: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of s.split(' ')) {
    if ((cur + ' ' + w).trim().length > n && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

function StackDiagram({ on, t }: { on: On; t: number }) {
  const stack = STACK[on];
  const side = SIDE[on];
  const H = Y0 + stack.length * (LH + GAP) + 2;
  const ly = (i: number) => Y0 + i * (LH + GAP);
  const sideIn = prog(t, LAND[0], LAND[0] + DROP);
  return (
    <svg class="diagram cn-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${TITLE[on]}: layers from the servers up to the apps. The AOS data services layer is the same in every deployment.`}>
      {stack.map((l, i) => {
        const k = prog(t, LAND[i], LAND[i] + DROP);
        if (k <= 0) return <rect key={l.label} class="cn-slot" x={0} y={ly(i)} width={SW} height={LH} />;
        const y = ly(i) - (1 - k) * 16;
        const pending = on === 'metal' && !l.same;
        return (
          <g key={l.label} style={{ opacity: k }}>
            <rect class={l.same ? 'ink-fill' : pending ? 'cn-layer pending' : 'cn-layer'} x={0} y={y} width={SW} height={LH} />
            <text x={18} y={y + 21} class={l.same ? 'cn-on-ink' : undefined} style={{ fontWeight: 600, fontSize: '15px' }}>
              {l.label}
            </text>
            <text x={18} y={y + 39} class={l.same ? 'cn-on-ink soft' : 'muted'} style={{ fontSize: '12.5px' }}>
              {l.sub}
            </text>
            <text x={SW - 16} y={y + 30} text-anchor="end" class={`mono ${l.same ? 'cn-on-ink' : 'muted'}`} style={{ fontSize: '12px' }}>
              {l.same ? '= same' : '≠ differs'}
            </text>
          </g>
        );
      })}
      {DOTS.map((a) => {
        if (t < a || t > a + DOT_T) return null;
        const y = ly(0) + LH / 2 + (ly(4) - ly(0)) * prog(t, a, a + DOT_T);
        return <circle key={a} cx={DOT_X} cy={y} r={6} class="cn-dot" />;
      })}
      {sideIn > 0 &&
        [
          { y: Y0, t: 'Managed through', v: side.mgmt, s: side.mgmtSub },
          { y: Y0 + 2 * (LH + GAP), t: 'Disaster recovery', v: side.dr, s: side.drSub },
        ].map((b) => (
          <g key={b.t} style={{ opacity: sideIn }}>
            <line x1={SW} y1={b.y + LH / 2} x2={SW + 40} y2={b.y + LH / 2} class="line" stroke-dasharray="3 3" />
            <rect class="cn-side" x={SW + 40} y={b.y} width={W - SW - 40} height={LH + 42} />
            <text x={SW + 56} y={b.y + 20} class="muted" style={{ fontSize: '11px', letterSpacing: '0.08em' }}>
              {b.t.toUpperCase()}
            </text>
            <text x={SW + 56} y={b.y + 42} style={{ fontWeight: 600, fontSize: '15px' }}>
              {b.v}
            </text>
            {wrap(b.s, 40).map((ln, j) => (
              <text key={j} x={SW + 56} y={b.y + 62 + j * 17} class="muted" style={{ fontSize: '12px' }}>
                {ln}
              </text>
            ))}
          </g>
        ))}
    </svg>
  );
}

const PHASES = ['What changes', 'What stays the same', 'Apps on top'];

export default function Cnaos() {
  const [on, setOn] = useEnum<On>('on', 'eks', ['vm', 'eks', 'metal']);
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: END });
  useRestartOn(clock, [on]);
  const phase = phaseAt(PHASE_STARTS, clock.t);
  const tone: Tone | 'ink' = phase === 1 ? 'ink' : on === 'metal' ? 'warn' : phase === 2 ? 'ok' : 'flow';

  return (
    <Show
      top={
        <Choice<On>
          label="Where AOS runs"
          value={on}
          onChange={setOn}
          why={on === 'eks' ? 'Azure AKS and Google GKE are not confirmed yet.' : on === 'metal' ? 'Early access, not generally available yet.' : null}
          options={[
            { value: 'vm', label: 'On a hypervisor (VM-based)' },
            { value: 'eks', label: 'Amazon EKS' },
            { value: 'metal', label: 'Bare metal' },
          ]}
        />
      }
      foot={
        <>
          <Follow tone={tone} k={PHASES[phase]}>
            <p>{CAPTION[on][phase]}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Hypervisor', v: on === 'vm' ? 'AHV or ESXi' : 'None' },
              { k: 'AOS runs as', v: on === 'vm' ? 'A VM per node' : 'Pods' },
              on === 'metal' ? { k: 'Status', v: 'Early access', tone: 'warn', sub: 'GA targeted 2H 2026' } : { k: 'Status', v: on === 'vm' ? 'GA' : 'GA · 1.0', tone: 'ok', sub: on === 'eks' ? 'since July 2025' : undefined },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <StackDiagram on={on} t={clock.t} />
      </div>
      <PlayBar clock={clock} label="Stack animation" fmt={() => PHASES[phase]} />
      <div class="cn-legend">
        <Legend
          items={[
            { color: 'var(--ink)', label: '= same in both deployments' },
            { color: 'var(--line-2)', label: '≠ differs', dashed: true },
            { color: 'var(--flow)', label: 'App data going to the drives' },
          ]}
        />
        <Illus why="Layers are simplified to show what moves where. Exact component lists vary by release." />
      </div>
    </Show>
  );
}
