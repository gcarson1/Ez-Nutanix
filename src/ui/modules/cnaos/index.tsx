// Cloud Native AOS: the same AOS data services, delivered as pods in Kubernetes instead of a
// Controller VM on a hypervisor. Toggle the two to see what stays and what changes. The landing's
// "Any Bare Metal Linux" pane opens this module with on=metal.
import { useEffect, useState } from 'preact/hooks';
import { useEnum } from '../../../state/route';
import { Chip, Field, Follow, Illus, Seg, Tip } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { go } from '../../shell/nav';
import './style.css';

type Mode = 'vm' | 'cn';
type Target = 'eks' | 'metal';

interface Layer {
  label: string;
  sub: string;
  /** Same idea in both deployments. */
  same?: boolean;
}

const VM_STACK: Layer[] = [
  { label: 'VMs, plus containers on NKP', sub: 'Apps get virtual disks, or volumes through the CSI driver' },
  { label: 'AOS data services', sub: 'Replication, snapshots, encryption, QoS, DR', same: true },
  { label: 'Controller VM (CVM) on every node', sub: 'Runs AOS and owns the node’s local drives' },
  { label: 'Hypervisor: AHV or ESXi', sub: 'Runs the user VMs and the CVM' },
  { label: 'Servers with local drives', sub: 'Nutanix or OEM nodes, NVMe / SSD / HDD' },
];

const CN_STACK: Record<Target, Layer[]> = {
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

const SIDE: Record<'vm' | Target, { mgmt: string; mgmtSub: string; dr: string; drSub: string }> = {
  vm: { mgmt: 'Prism and Prism Central', mgmtSub: 'UI and v4 APIs', dr: 'Protection policies', drSub: 'Async, NearSync or synchronous replication' },
  eks: { mgmt: 'Kubernetes API', mgmtSub: 'kubectl and GitOps tools', dr: 'NDK app-level DR', drSub: 'Snapshots and replication per app; RPO 1 h or more in 1.0' },
  metal: { mgmt: 'Kubernetes API, NKP', mgmtSub: 'Fleet and lifecycle through NKP', dr: 'App-level DR', drSub: 'Expected through NDK; details not published' },
};

function StackDiagram({ mode, target, narrow }: { mode: Mode; target: Target; narrow: boolean }) {
  const stack = mode === 'vm' ? VM_STACK : CN_STACK[target];
  const side = SIDE[mode === 'vm' ? 'vm' : target];
  // Wide: stack with management and DR beside it. Narrow (phone): side boxes go below.
  const W = narrow ? 440 : 960;
  const sw = narrow ? 440 : 600;
  const h = 62;
  const gap = 10;
  const y0 = 40;
  const title = mode === 'vm' ? 'VM-based AOS on Nutanix Cloud Infrastructure' : target === 'eks' ? 'Cloud Native AOS on Amazon EKS' : 'Cloud Native AOS on bare metal (NKP Metal)';
  const stackEnd = y0 + stack.length * (h + gap);
  const H = narrow ? stackEnd + 6 + 2 * (h + 40 + gap) : stackEnd + 20;
  const bx = narrow ? 0 : sw + 40;
  const bw = narrow ? W : W - sw - 40;
  return (
    <svg class="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: layers from apps down to hardware`}>
      <text x={0} y={22} style={{ fontWeight: 600, fontSize: '16px' }}>
        {title}
      </text>
      {stack.map((l, i) => {
        const y = y0 + i * (h + gap);
        const changed = !l.same;
        const pending = mode === 'cn' && target === 'metal';
        return (
          <g key={l.label}>
            <rect class={l.same ? 'ink-fill' : pending ? 'cn-layer pending' : 'cn-layer'} x={0} y={y} width={sw} height={h} />
            <text x={18} y={y + 27} style={{ fontWeight: 600, fontSize: '15px', fill: l.same ? '#fff' : undefined }}>
              {l.label}
            </text>
            <text x={18} y={y + 47} style={{ fontSize: '12.5px', fill: l.same ? 'rgba(255,255,255,.8)' : 'var(--muted)' }}>
              {l.sub}
            </text>
            <text x={sw - 16} y={y + (narrow ? 26 : 37)} text-anchor="end" class="mono" style={{ fontSize: '12px', fill: l.same ? 'rgba(255,255,255,.85)' : 'var(--muted)' }}>
              {changed ? '≠ differs' : '= same'}
            </text>
          </g>
        );
      })}
      {/* side: management and DR */}
      {[
        { y: narrow ? stackEnd + 6 : y0, t: 'Managed through', v: side.mgmt, s: side.mgmtSub },
        { y: narrow ? stackEnd + 6 + h + 40 + gap : y0 + 2 * (h + gap), t: 'Disaster recovery', v: side.dr, s: side.drSub },
      ].map((b) => (
        <g key={b.t}>
          {!narrow && <line x1={sw} y1={b.y + h / 2} x2={sw + 40} y2={b.y + h / 2} class="line" stroke-dasharray="3 3" />}
          <rect class="cn-side" x={bx} y={b.y} width={bw} height={h + 40} />
          <text x={bx + 16} y={b.y + 22} class="muted" style={{ fontSize: '11px', letterSpacing: '0.08em' }}>
            {b.t.toUpperCase()}
          </text>
          <text x={bx + 16} y={b.y + 46} style={{ fontWeight: 600, fontSize: '15px' }}>
            {b.v}
          </text>
          <text x={bx + 16} y={b.y + 68} class="muted" style={{ fontSize: '12px' }}>
            {b.s.length > 40 ? b.s.slice(0, b.s.lastIndexOf(' ', 40)) : b.s}
          </text>
          {b.s.length > 40 && (
            <text x={bx + 16} y={b.y + 86} class="muted" style={{ fontSize: '12px' }}>
              {b.s.slice(b.s.lastIndexOf(' ', 40) + 1)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

const ROWS: { k: string; vm: string; eks: string; metal: string; same?: boolean }[] = [
  { k: 'Storage engine', vm: 'AOS', eks: 'AOS', metal: 'AOS', same: true },
  { k: 'Data services', vm: 'Replication, snapshots, encryption, QoS, DR', eks: 'Resilience, app-centric snapshots, encryption, QoS, DR', metal: 'Same AOS services', same: true },
  { k: 'Where AOS runs', vm: 'A Controller VM on each node', eks: 'Pods on each Kubernetes worker', metal: 'Pods on each node' },
  { k: 'Hypervisor', vm: 'AHV or ESXi', eks: 'None', metal: 'None' },
  { k: 'Who uses the storage', vm: 'VMs, and containers on NKP', eks: 'Containers', metal: 'Containers and VMs' },
  { k: 'Managed through', vm: 'Prism, Prism Central', eks: 'Kubernetes API', metal: 'Kubernetes API, NKP' },
  { k: 'Data copies', vm: 'RF2 or RF3', eks: 'RF2 in release 1.0', metal: 'Not published yet' },
  { k: 'Scale', vm: 'Cluster of nodes', eks: 'Up to 15 worker nodes in 1.0', metal: 'Not published yet' },
  { k: 'DR', vm: 'Async, NearSync, synchronous', eks: 'Through NDK, RPO 1 h or more in 1.0', metal: 'Not published yet' },
  { k: 'Status', vm: 'Generally available', eks: 'Generally available (1.0.0, July 2025)', metal: 'Early access; GA targeted 2H 2026' },
];

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

export default function Cnaos() {
  const narrow = useNarrow();
  const [mode, setMode] = useEnum<Mode>('m', 'cn', ['vm', 'cn']);
  const [target, setTarget] = useEnum<Target>('on', 'eks', ['eks', 'metal']);
  const col = mode === 'vm' ? 'vm' : target;

  return (
    <div class="lab ctl-only cn-lab">
      <div class="ctl">
        <Field label="AOS deployment" tip="The same AOS storage engine, either as a VM on a hypervisor or as pods inside Kubernetes." value={mode === 'vm' ? 'VM-based' : 'Cloud Native'}>
          <Seg
            label="AOS deployment"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'vm', label: 'VM-based' },
              { value: 'cn', label: 'Cloud Native' },
            ]}
          />
        </Field>
        <Field
          label="Runs on"
          tip="Where Cloud Native AOS is deployed."
          detail="Release 1.0.0 (July 2025) supports Amazon EKS. Bare metal comes through NKP Metal, which was in early access in 2026. Azure AKS and Google GKE support has not been confirmed."
          value={mode === 'vm' ? '—' : target === 'eks' ? 'Amazon EKS' : 'Bare-metal Linux'}
          why={mode === 'vm' ? 'VM-based AOS always runs on Nutanix Cloud Infrastructure nodes. Switch to Cloud Native AOS to choose a Kubernetes target.' : null}
          note={mode === 'cn' && target === 'metal' ? 'Early access, not generally available yet.' : undefined}
        >
          <div class="seg" role="group" aria-label="Runs on">
            {(
              [
                ['eks', 'Amazon EKS'],
                ['metal', 'Bare-metal Linux'],
              ] as const
            ).map(([v, l]) => (
              <button type="button" key={v} aria-pressed={mode === 'cn' && target === v} disabled={mode === 'vm'} onClick={() => setTarget(v)}>
                {l}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Status">
          {mode === 'vm' ? (
            <Chip tone="ok">Generally available</Chip>
          ) : target === 'eks' ? (
            <Chip tone="ok">GA on EKS · 1.0.0</Chip>
          ) : (
            <Chip tone="warn" icon="warn">
              Early access
            </Chip>
          )}
        </Field>
      </div>

      <div class="stage">
        <div class={narrow ? 'cn-narrow' : 'diagram-scroll'}>
          <StackDiagram mode={mode} target={target} narrow={narrow} />
        </div>
        <div class="legend">
          <span>
            <i class="sw" style={{ background: 'var(--ink)' }} />= same in both deployments
          </span>
          <span>
            <i class="sw" style={{ border: '1.5px solid var(--line-2)' }} />≠ differs
          </span>
          <Illus why="Layers are simplified to show what moves where. Exact component lists vary by release." />
        </div>

        {mode === 'vm' ? (
          <Follow tone="ink" k="VM-based AOS">
            <p>Every node runs a hypervisor and a Controller VM. The CVMs pool the local drives and run the data services. This is the Nutanix Cloud Infrastructure most customers know.</p>
          </Follow>
        ) : target === 'eks' ? (
          <Follow tone="ink" k="Cloud Native AOS on EKS">
            <p>
              The storage engine and its data services are the same AOS. What changes is the packaging: AOS runs as pods on the Kubernetes worker nodes and uses their local NVMe drives. There is no hypervisor and no CVM, and you manage it through the Kubernetes API. App-level snapshots, replication and DR come from{' '}
              <Tip text="Nutanix Data Services for Kubernetes: app-level snapshots, replication and DR for Kubernetes apps. GA since March 2024.">NDK</Tip>.
            </p>
          </Follow>
        ) : (
          <Follow tone="warn" k="Bare metal: a direction with dates, not a shipping product yet">
            <p>
              Running Nutanix storage straight on bare-metal Linux, with no hypervisor, is delivered through <strong>NKP Metal</strong>: Kubernetes on bare metal with servers provisioned through Foundation and LCM, storage from Cloud Native AOS or a CSI driver, and VMs alongside containers.
            </p>
            <p>NKP Metal was announced in April 2026 as early access, with general availability targeted for the second half of 2026. The Cloud Native AOS product page still lists bare metal as future development, and we have not seen a GA announcement.</p>
            <p class="rest">
              Separately, NKP Pro and Ultimate already run on pre-provisioned bare-metal Linux servers where you install and patch the OS yourself.{' '}
              <button type="button" class="tbtn" onClick={() => go('nkp')}>
                Kubernetes Platform <Icon name="arrow" />
              </button>
            </p>
          </Follow>
        )}

        <h2 class="sec-h" style={{ marginTop: 'var(--sp-8)' }}>
          Side by side
        </h2>
        <div class="diagram-scroll">
          <table class="tbl cn-tbl">
            <thead>
              <tr>
                <th scope="col"> </th>
                <th scope="col" class={col === 'vm' ? 'cn-cur' : ''}>VM-based AOS</th>
                <th scope="col" class={col === 'eks' ? 'cn-cur' : ''}>Cloud Native · EKS</th>
                <th scope="col" class={col === 'metal' ? 'cn-cur' : ''}>Cloud Native · bare metal</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.k}>
                  <th scope="row">
                    {r.same ? <span class="cn-mark" aria-label="same">=</span> : <span class="cn-mark diff" aria-label="differs">≠</span>}
                    {r.k}
                  </th>
                  <td class={col === 'vm' ? 'cn-cur' : ''}>{r.vm}</td>
                  <td class={col === 'eks' ? 'cn-cur' : ''}>{r.eks}</td>
                  <td class={col === 'metal' ? 'cn-cur' : ''}>{r.metal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p class="field-note" style={{ marginTop: 'var(--sp-3)' }}>
          Azure AKS and Google GKE support for Cloud Native AOS has not been confirmed by Nutanix, so they are not shown.
        </p>
      </div>
    </div>
  );
}
