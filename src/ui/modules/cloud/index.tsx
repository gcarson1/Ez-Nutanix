// Hybrid and public cloud: Nutanix Cloud Clusters (NC2) on AWS, Azure and Google Cloud
// (all GA per the research note), use cases (DR, burst, migration, data-center exit),
// and the cloud-native alternative (NKP, Cloud Native AOS) with per-provider availability.
import { Chip, Field, Follow, Illus, PlayBar, Seg, Slider, Tip, type Tone } from '../../components/controls';
import { useClock } from '../../components/clock';
import { Icon } from '../../components/Icon';
import { useEnum, useNum } from '../../../state/route';
import { go } from '../../shell/nav';
import './style.css';

type Prov = 'aws' | 'azure' | 'gcp';
type Mode = 'nc2' | 'k8s';
type Use = 'dr' | 'burst' | 'mig' | 'exit';

const PROV: Record<Prov, { name: string; short: string; k8s: string; nc2: string; extra: string }> = {
  aws: {
    name: 'Amazon Web Services',
    short: 'AWS',
    k8s: 'Amazon EKS',
    nc2: 'NC2 on AWS is generally available. GC2 (Government Cloud Clusters) runs on AWS GovCloud (US). An offering on the AWS European Sovereign Cloud has been announced as coming later in 2026.',
    extra: 'Cloud Native AOS 1.0 is generally available on Amazon EKS.',
  },
  azure: {
    name: 'Microsoft Azure',
    short: 'Azure',
    k8s: 'Azure AKS',
    nc2: 'NC2 on Azure is generally available.',
    extra: 'NKP Ultimate fleet management can attach and manage AKS clusters. Cloud Native AOS on AKS is not confirmed.',
  },
  gcp: {
    name: 'Google Cloud',
    short: 'Google Cloud',
    k8s: 'Google GKE',
    nc2: 'NC2 on Google Cloud became generally available on Dec 9, 2025, on Z3 and C4 bare-metal instances in 17 regions, with NKP and Move supported. Hyperdisk and C3 bare-metal support is planned for 2H 2026.',
    extra: 'Nutanix Enterprise AI runs on GKE. Cloud Native AOS on GKE is not confirmed.',
  },
};

const USES: Record<Use, { label: string; k: string; text: string; tone: Tone }> = {
  dr: { label: 'DR target', k: 'Cloud as the second site', tone: 'flow', text: 'Protection policies replicate VMs to the NC2 cluster, the same way they would to a second data center. On failover, the recovery plan powers them on in the cloud. The cloud cluster can start small and be expanded when you fail over (depending on cloud and configuration), instead of paying for a full standby site.' },
  burst: { label: 'Burst capacity', k: 'Extra capacity, same operations', tone: 'flow', text: 'When the data center runs short (a seasonal peak, a hardware delay, a new project), add NC2 nodes without buying hardware and run the extra VMs there. Same AHV, same Prism, same policies; shrink the cluster again afterwards.' },
  mig: { label: 'Migration', k: 'Lift and shift, no refactoring', tone: 'flow', text: 'Move VMs to the cloud as they are. Nutanix Move or cross-cluster replication carries them over; VMs keep their configuration, and with the right network setup their IP and MAC addresses, so applications do not need rework.' },
  exit: { label: 'Data-center exit', k: 'Close the building, keep the platform', tone: 'warn', text: 'Move every workload to NC2 and retire the data center on your timeline. Teams keep the tools and runbooks they know. Later, individual apps can be modernized to native cloud services one by one.' },
};

const PHASE_T = [0, 3, 8, 10]; // idle, action, result

function Scene({ prov, mode, use, t, burstVms }: { prov: Prov; mode: Mode; use: Use; t: number; burstVms: number }) {
  const P = PROV[prov];
  const W = 920;
  const H = 360;
  const act = t >= PHASE_T[1];
  const done = t >= PHASE_T[2];
  const prog = Math.max(0, Math.min(1, (t - PHASE_T[1]) / (PHASE_T[2] - PHASE_T[1])));
  const onpremVms = 8;
  // which on-prem VMs have moved
  const moving = use === 'mig' ? 3 : use === 'exit' ? onpremVms : 0;
  const moved = Math.floor(prog * moving);
  const cloudVms = mode === 'k8s' ? 0 : use === 'dr' ? (done ? 4 : 0) : use === 'burst' ? (act ? Math.ceil(prog * burstVms) : 0) : moved;
  const drReplicas = use === 'dr' ? 4 : 0;
  const onDown = use === 'dr' && done;
  const vm = (x: number, y: number, label: string, cls: string, key: string | number) => (
    <g key={key}>
      <rect x={x} y={y} width={56} height={30} rx={3} class={cls} />
      <text x={x + 28} y={y + 19} text-anchor="middle" style={{ fontSize: '11px' }}>
        {label}
      </text>
    </g>
  );
  return (
    <svg class="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`On-premises cluster and ${P.name}: ${USES[use].label}`}>
      {/* on-prem */}
      <rect x={10} y={20} width={380} height={300} rx={6} class="node-box" style={{ opacity: use === 'exit' && done ? 0.35 : 1 }} />
      <text x={26} y={46} style={{ fontWeight: 650, fontSize: '15px' }}>
        Your data center
      </text>
      <text x={26} y={66} class="muted" style={{ fontSize: '12px' }}>
        Nutanix Cloud Infrastructure · AOS + AHV
      </text>
      {Array.from({ length: onpremVms }, (_, i) => {
        const gone = i < moved;
        const isDr = i < drReplicas;
        const cls = onDown && isDr ? 'vm failed' : gone ? 'vm' : 'vm hl';
        return gone ? (
          <rect key={i} x={26 + (i % 4) * 64} y={84 + Math.floor(i / 4) * 40} width={56} height={30} rx={3} fill="none" stroke="var(--line-2)" stroke-dasharray="3 3" />
        ) : (
          vm(26 + (i % 4) * 64, 84 + Math.floor(i / 4) * 40, onDown && isDr ? '✕ site' : `VM ${i + 1}`, cls, i)
        );
      })}
      {use === 'burst' && mode === 'nc2' && (
        <g>
          <rect x={26} y={180} width={340} height={12} class="bg3" />
          <rect x={26} y={180} width={340 * 0.94} height={12} class="warn-fill" />
          <text x={26} y={210} class="warn-fill" style={{ fontSize: '12px', fontWeight: 600 }}>
            ⚠ 94% of capacity used
          </text>
        </g>
      )}
      {use === 'exit' && done && (
        <text x={200} y={250} text-anchor="middle" class="muted" style={{ fontSize: '14px', fontWeight: 600 }}>
          Data center retired
        </text>
      )}
      <rect x={26} y={272} width={348} height={32} class="ink-fill" rx={3} />
      <text x={200} y={293} text-anchor="middle" style={{ fill: '#fff', fontSize: '12.5px', fontWeight: 600 }}>
        Prism Central: one console for both sides
      </text>

      {/* link */}
      <line x1={390} x2={530} y1={170} y2={170} class={act ? 'xfer' : 'line'} stroke-width={2} stroke-dasharray={act ? `6 6` : '3 5'} stroke-dashoffset={-t * 30} />
      <text x={460} y={156} text-anchor="middle" class="muted" style={{ fontSize: '11.5px' }}>
        {mode === 'k8s' ? 'apps via CI/CD, NKP' : use === 'dr' ? 'replication' : use === 'burst' ? 'extended network' : 'Move / replication'}
      </text>

      {/* cloud */}
      <rect x={530} y={20} width={380} height={300} rx={6} class="bg2" stroke="var(--line-2)" stroke-dasharray="6 4" />
      <text x={546} y={46} style={{ fontWeight: 650, fontSize: '15px' }}>
        {P.name}
      </text>
      {mode === 'nc2' ? (
        <>
          <text x={546} y={66} class="muted" style={{ fontSize: '12px' }}>
            NC2 · the same AOS + AHV on bare-metal instances
          </text>
          {Array.from({ length: 8 }, (_, i) => {
            const x = 546 + (i % 4) * 64;
            const y = 84 + Math.floor(i / 4) * 40;
            if (i < cloudVms) return vm(x, y, use === 'dr' ? `VM ${i + 1}` : use === 'burst' ? `new ${i + 1}` : `VM ${i + 1}`, 'vm hl', i);
            if (use === 'dr' && i < drReplicas)
              return (
                <g key={i}>
                  <rect x={x} y={y} width={56} height={30} rx={3} fill="none" stroke="var(--flow)" stroke-dasharray="3 3" />
                  <text x={x + 28} y={y + 19} text-anchor="middle" class="flow-fill" style={{ fontSize: '10.5px' }}>
                    replica
                  </text>
                </g>
              );
            return null;
          })}
          {Array.from({ length: use === 'burst' && act ? 4 : 3 }, (_, i) => (
            <g key={i}>
              <rect x={546 + i * 86} y={220} width={78} height={34} class="node-box" style={{ opacity: use === 'burst' && i === 3 ? prog : 1 }} />
              <rect x={552 + i * 86} y={226} width={20} height={22} class="cvm" />
              <text x={580 + i * 86} y={242} style={{ fontSize: '11px' }}>
                node {i + 1}
              </text>
            </g>
          ))}
          <text x={546} y={276} class="muted" style={{ fontSize: '11.5px' }}>
            {use === 'burst' && act ? 'node added for the burst' : 'NC2 cluster: bare-metal nodes, each with a CVM'}
          </text>
        </>
      ) : (
        <>
          <text x={546} y={66} class="muted" style={{ fontSize: '12px' }}>
            {P.k8s} · no hypervisor, no CVMs
          </text>
          <rect x={546} y={84} width={348} height={110} rx={4} class="node-box" />
          <text x={560} y={106} style={{ fontWeight: 600, fontSize: '13px' }}>
            Kubernetes cluster, managed by NKP
          </text>
          {Array.from({ length: 10 }, (_, i) => (
            <rect key={i} x={560 + i * 32} y={120} width={24} height={24} rx={12} class="ink-soft" stroke="var(--ink-line)" />
          ))}
          <text x={560} y={176} class="muted" style={{ fontSize: '11.5px' }}>
            containerized apps (pods)
          </text>
          <rect x={546} y={206} width={348} height={48} rx={4} class={prov === 'aws' ? 'ink-fill' : 'bg3'} stroke="var(--line-2)" stroke-dasharray={prov === 'aws' ? undefined : '5 4'} />
          <text x={720} y={227} text-anchor="middle" style={{ fontWeight: 600, fontSize: '12.5px', fill: prov === 'aws' ? '#fff' : undefined }}>
            {prov === 'aws' ? 'Cloud Native AOS (GA on EKS)' : 'Cloud Native AOS: not confirmed here'}
          </text>
          <text x={720} y={244} text-anchor="middle" class={prov === 'aws' ? '' : 'muted'} style={{ fontSize: '11px', fill: prov === 'aws' ? 'rgba(255,255,255,.8)' : undefined }}>
            {prov === 'aws' ? 'AOS storage as pods; DR via NDK' : 'use the provider’s storage classes'}
          </text>
        </>
      )}
      <text x={546} y={306} class="muted" style={{ fontSize: '11.5px' }}>
        {mode === 'nc2' ? 'Registered to the same Prism Central' : 'Fleet-managed from NKP alongside on-prem clusters'}
      </text>
    </svg>
  );
}

const MATRIX: { what: string; aws: string; azure: string; gcp: string; tip?: string }[] = [
  { what: 'Nutanix Cloud Clusters (NC2)', aws: 'GA', azure: 'GA', gcp: 'GA (Dec 2025)', tip: 'Also GA on OVHcloud.' },
  { what: 'Nutanix Move into NC2', aws: 'Yes', azure: 'Yes', gcp: 'Yes' },
  { what: 'Database Service (NDB) on NC2', aws: 'Yes', azure: 'Yes', gcp: 'Yes' },
  { what: 'Cloud Native AOS', aws: 'GA on EKS', azure: 'Not confirmed', gcp: 'Not confirmed' },
  { what: 'NKP fleet management attaches', aws: 'EKS', azure: 'AKS', gcp: 'Not listed', tip: 'NKP Ultimate fleet management can attach and manage EKS and AKS clusters. NKP Pro can deploy clusters on public cloud.' },
  { what: 'Enterprise AI endpoints', aws: 'EKS', azure: 'AKS', gcp: 'GKE' },
  { what: 'Files Smart Tiering target', aws: 'AWS S3', azure: 'Azure Blob', gcp: 'Google Cloud Storage (NUS 5.3+)' },
];
const cellTone = (v: string): Tone => (/^Not/.test(v) ? 'neutral' : 'ok');

export default function Cloud() {
  const [prov, setProv] = useEnum<Prov>('c', 'aws', ['aws', 'azure', 'gcp']);
  const [mode, setMode] = useEnum<Mode>('m', 'nc2', ['nc2', 'k8s']);
  const [use, setUse] = useEnum<Use>('u', 'dr', ['dr', 'burst', 'mig', 'exit']);
  const [burstVms, setBurst] = useNum('bv', 6, 2, 8);
  const clock = useClock({ rate: 1, duration: PHASE_T[3], stepSize: 1, keys: true });
  const P = PROV[prov];
  const U = USES[use];
  const phase = clock.t >= PHASE_T[2] ? 'Result' : clock.t >= PHASE_T[1] ? 'In progress' : 'Before';
  return (
    <>
      <div class="cld-prov" role="group" aria-label="Cloud provider">
        {(['aws', 'azure', 'gcp'] as Prov[]).map((p) => (
          <button type="button" key={p} class="cld-tile" aria-pressed={prov === p} onClick={() => (setProv(p), clock.reset())}>
            <span class="n">{PROV[p].short}</span>
            <span class="s">
              <Chip tone="ok">NC2 GA</Chip>
            </span>
          </button>
        ))}
      </div>
      <div class="lab">
        <div class="ctl">
          <Field label="How it runs" tip="NC2 runs the full Nutanix stack on bare-metal cloud instances. The cloud-native path runs Nutanix software on the provider’s Kubernetes instead.">
            <Seg label="Deployment" value={mode} onChange={(v) => (setMode(v), clock.reset())} options={[{ value: 'nc2', label: 'NC2 (VMs)' }, { value: 'k8s', label: 'Cloud-native (Kubernetes)' }]} />
          </Field>
          <Field label="Use case" why={mode === 'k8s' ? 'These four use cases are shown for NC2. The cloud-native path is for containerized apps.' : null}>
            <Seg label="Use case" value={use} onChange={(v) => (setUse(v), clock.reset())} options={(Object.keys(USES) as Use[]).map((u) => ({ value: u, label: USES[u].label, disabled: mode === 'k8s' }))} />
          </Field>
          {use === 'burst' && mode === 'nc2' && (
            <Field label="VMs to burst" value={burstVms}>
              <Slider label="Burst VMs" value={burstVms} min={2} max={8} onChange={setBurst} />
            </Field>
          )}
          <Field label="Go deeper">
            <div class="stack-sm">
              <button type="button" class="tbtn" onClick={() => go('nci/dr')}>
                Disaster Recovery <Icon name="arrow" />
              </button>
              <button type="button" class="tbtn" onClick={() => go('nci/move')}>
                Migration with Move <Icon name="arrow" />
              </button>
              <button type="button" class="tbtn" onClick={() => go('nkp')}>
                Kubernetes Platform <Icon name="arrow" />
              </button>
              <button type="button" class="tbtn" onClick={() => go('cnaos')}>
                Cloud Native AOS <Icon name="arrow" />
              </button>
            </div>
          </Field>
        </div>
        <div class="stage">
          <div class="spread">
            <h2 class="sec-h" style={{ margin: 0 }}>
              {mode === 'nc2' ? `${U.label} on ${P.short}` : `Cloud-native on ${P.k8s}`}
            </h2>
            <span class="hstack">
              <Chip tone={clock.t >= PHASE_T[2] ? 'ok' : clock.t >= PHASE_T[1] ? 'flow' : 'neutral'}>{mode === 'nc2' ? phase : 'Kubernetes'}</Chip>
              <Illus why="A simplified picture: VM counts, timing and network paths are examples, not sizing." />
            </span>
          </div>
          <div class="diagram-scroll">
            <Scene prov={prov} mode={mode} use={use} t={clock.t} burstVms={burstVms} />
          </div>
          {mode === 'nc2' && <PlayBar clock={clock} label="Scenario" fmt={() => phase} />}
          {mode === 'nc2' ? (
            <Follow tone={U.tone} k={U.k}>
              <p>{U.text}</p>
            </Follow>
          ) : (
            <Follow tone="ink" k="The cloud-native alternative">
              <p>
                For containerized apps, Nutanix Kubernetes Platform (NKP) manages Kubernetes clusters across data center, edge and cloud from one place. Cloud Native AOS brings AOS storage and data services into Kubernetes itself, with no hypervisor and no CVMs; with Nutanix Data Services for Kubernetes (NDK) it adds app-level snapshots, replication and DR.
              </p>
              <p class="rest">{P.extra}</p>
            </Follow>
          )}
        </div>
        <div class="rail">
          <div class="side-sec">
            <div class="eyebrow">{P.name}</div>
            <p class="small">{P.nc2}</p>
          </div>
          <div class="side-sec">
            <div class="eyebrow">{mode === 'nc2' ? 'Same operating model' : 'Cloud-native pieces'}</div>
            {mode === 'nc2' ? (
              <ul class="small cld-list">
                <li>Same AOS and AHV as on-premises</li>
                <li>Managed in Prism Central next to your other clusters</li>
                <li>Same DR and LCM workflows (some features vary by cloud)</li>
                <li>Runs in your own cloud account, next to native services</li>
              </ul>
            ) : (
              <ul class="small cld-list">
                <li>NKP: Kubernetes lifecycle and fleet management (fleet management is NKP Ultimate)</li>
                <li>Cloud Native AOS: AOS storage as pods, no hypervisor; GA on EKS</li>
                <li>NDK: app-level snapshots, replication and DR for Kubernetes</li>
                <li>Enterprise AI: inference endpoints on EKS, AKS or GKE</li>
              </ul>
            )}
          </div>
        </div>
      </div>
      <h2 class="sec-h">What runs where</h2>
      <div class="cld-tblwrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Capability</th>
              {(['aws', 'azure', 'gcp'] as Prov[]).map((p) => (
                <th key={p} class={p === prov ? 'cld-on' : ''}>
                  {PROV[p].short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((r) => (
              <tr key={r.what}>
                <td>{r.tip ? <Tip text={r.tip}>{r.what}</Tip> : r.what}</td>
                {(['aws', 'azure', 'gcp'] as Prov[]).map((p) => (
                  <td key={p} class={p === prov ? 'cld-on' : ''}>
                    <span class={cellTone(r[p]) === 'ok' ? '' : 'muted'}>
                      {cellTone(r[p]) === 'ok' ? '✓ ' : '– '}
                      {r[p]}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="field-note" style={{ marginTop: 'var(--sp-3)' }}>
        Status as researched in October 2026. NC2 is also generally available on OVHcloud. Regions, instance types and features change often; confirm for your region before you plan.
      </p>
    </>
  );
}
