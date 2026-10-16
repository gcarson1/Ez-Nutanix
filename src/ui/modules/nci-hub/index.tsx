// NCI hub: the stack from hardware up, a "what's in a node" cutaway, and the sub-modules.
import { useState } from 'preact/hooks';
import { Icon } from '../../components/Icon';
import { Follow } from '../../components/controls';
import { go } from '../../shell/nav';

const SUBS = [
  { path: 'nci/cluster', icon: 'server', t: 'Cluster & DSF Lab', s: 'Build a cluster, watch data spread across every node, then add, remove and migrate.', pri: 'Centerpiece' },
  { path: 'nci/datapath', icon: 'zap', t: 'Data Path', s: 'Step through a write and a read: OpLog, replication, extent store, cache and locality.', pri: 'Write & read' },
  { path: 'nci/capacity', icon: 'shield', t: 'Protection & Capacity', s: 'RF2, RF3 and erasure coding: what you can store, and what failures you survive.', pri: 'Sizing' },
  { path: 'nci/failures', icon: 'power', t: 'Failure Gauntlet', s: 'Break a drive, a CVM, a node, a block or a rack and watch detection and self-healing.', pri: 'Resilience' },
  { path: 'nci/lcm', icon: 'upgrade', t: 'LCM Rolling Upgrade', s: 'Upgrade software and firmware one node at a time while workloads keep running.', pri: 'Day 2' },
  { path: 'nci/network', icon: 'net', t: 'AHV Networking', s: 'Open vSwitch, bridges, bonds and VLANs: how a node connects to the network.', pri: 'Networking' },
  { path: 'nci/flow', icon: 'lock', t: 'Flow', s: 'Microsegmentation by category, ransomware containment, and overlay VPCs.', pri: 'Security' },
  { path: 'nci/dr', icon: 'globe', t: 'Disaster Recovery', s: 'Async, NearSync and synchronous replication, recovery plans and failover.', pri: 'Protection' },
  { path: 'nci/snapshots', icon: 'clone', t: 'Snapshots & Clones', s: 'Metadata-only snapshots and instant clones with redirect-on-write.', pri: 'Data services' },
  { path: 'nci/security', icon: 'shield', t: 'Data Security', s: 'Encryption at rest, key management, hardening and where Flow fits.', pri: 'Security' },
  { path: 'nci/move', icon: 'move', t: 'Migration with Move', s: 'Bring VMs over from other hypervisors and clouds with minimal downtime.', pri: 'Adoption' },
  { path: 'nci/edge', icon: 'edge', t: 'Edge & ROBO', s: '1-, 2- and 3-node clusters for small sites, managed centrally.', pri: 'Edge' },
  { path: 'nci/scale', icon: 'plus', t: 'Scale-out vs 3-tier', s: 'Add a node, add a controller: linear growth and the honest overhead discussion.', pri: 'Architecture' },
];

type Layer = 'hw' | 'ahv' | 'cvm' | 'dsf' | 'flow' | 'dr';
const LAYERS: { id: Layer; label: string; sub: string; path: string; text: string }[] = [
  { id: 'dr', label: 'Disaster Recovery', sub: 'Snapshots, replication, recovery plans', path: 'nci/dr', text: 'Policy-based protection: pick an RPO, assign VMs by category, and recovery plans orchestrate failover to another site or cloud.' },
  { id: 'flow', label: 'Flow', sub: 'Microsegmentation and virtual networking', path: 'nci/flow', text: 'Security policies follow VMs by category, and overlay networks (VPCs) are created in software without changing the physical network.' },
  { id: 'dsf', label: 'AOS · Distributed Storage Fabric', sub: 'One storage pool from every node’s drives', path: 'nci/cluster', text: 'The CVMs pool every node’s local drives into one storage fabric and keep two or three copies (or parity) of all data on different nodes.' },
  { id: 'cvm', label: 'Controller VM on every node', sub: 'Runs the AOS services', path: 'nci/datapath', text: 'Each node runs a Controller VM (CVM). Together they are the storage controller, so adding a node adds controller capacity as well as drives.' },
  { id: 'ahv', label: 'AHV hypervisor', sub: 'Runs the VMs (ESXi also supported)', path: 'nci/network', text: 'AHV runs the virtual machines and is managed through Prism. Clusters can also run VMware ESXi; some features differ by hypervisor.' },
  { id: 'hw', label: 'Any supported server', sub: 'CPU, memory, local NVMe / SSD / HDD, NICs', path: 'nci/scale', text: 'Standard x86 servers from Nutanix and major OEM vendors, with local drives instead of a separate storage array.' },
];

function Stack({ sel, onSel }: { sel: Layer; onSel: (l: Layer) => void }) {
  const W = 640;
  const h = 52;
  const gap = 8;
  return (
    <svg class="diagram" viewBox={`0 0 ${W} ${LAYERS.length * (h + gap)}`} role="group" aria-label="The NCI stack">
      {LAYERS.map((l, i) => {
        const y = i * (h + gap);
        const on = l.id === sel;
        const strong = l.id === 'cvm' || l.id === 'dsf';
        return (
          <g
            key={l.id}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={l.label}
            onClick={() => onSel(l.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSel(l.id))}
            onDblClick={() => go(l.path)}
          >
            <rect class={`hit ${strong ? 'ink-fill' : 'bg3'}`} x={0} y={y} width={W} height={h} stroke={on ? 'var(--text)' : 'var(--line-2)'} stroke-width={on ? 2 : 1} style={{ opacity: strong ? (on ? 1 : 0.85) : 1 }} />
            <text x={16} y={y + 22} style={{ fontWeight: 600, fontSize: '15px', fill: strong ? '#fff' : undefined }}>
              {l.label}
            </text>
            <text x={16} y={y + 40} class={strong ? '' : 'muted'} style={{ fontSize: '12.5px', fill: strong ? 'rgba(255,255,255,.78)' : undefined }}>
              {l.sub}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function NodeCutaway() {
  // One node: hypervisor hosting user VMs and the CVM; CVM owns the local drives (passthrough).
  return (
    <svg class="diagram" viewBox="0 0 520 300" role="img" aria-label="What is in a node: user VMs and a Controller VM on the hypervisor, local drives passed to the CVM, and network ports">
      <rect class="frame" x={1} y={1} width={518} height={298} />
      <text x={14} y={22} class="muted" style={{ fontSize: '12px', letterSpacing: '0.08em' }}>
        ONE NODE
      </text>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect class="vm" x={20 + i * 92} y={40} width={80} height={56} />
          <text x={60 + i * 92} y={73} text-anchor="middle" style={{ fontSize: '13px' }}>
            VM {i + 1}
          </text>
        </g>
      ))}
      <rect class="ink-fill" x={300} y={40} width={200} height={56} />
      <text x={400} y={64} text-anchor="middle" style={{ fill: '#fff', fontWeight: 600, fontSize: '14px' }}>
        Controller VM (CVM)
      </text>
      <text x={400} y={83} text-anchor="middle" style={{ fill: 'rgba(255,255,255,.8)', fontSize: '11.5px' }}>
        AOS services · Stargate, Curator…
      </text>
      <rect class="bg3" x={20} y={112} width={480} height={36} stroke="var(--line-2)" />
      <text x={260} y={135} text-anchor="middle" style={{ fontWeight: 600, fontSize: '13.5px' }}>
        AHV hypervisor
      </text>
      <rect class="bg2" x={20} y={164} width={480} height={118} stroke="var(--line-2)" />
      <text x={34} y={184} class="muted" style={{ fontSize: '12px' }}>
        Hardware: CPU · memory · local drives · NICs
      </text>
      {['NVMe', 'NVMe', 'SSD', 'SSD', 'SSD', 'SSD'].map((d, i) => (
        <g key={i}>
          <rect class="disk" x={34 + i * 56} y={198} width={48} height={34} />
          <text x={58 + i * 56} y={219} text-anchor="middle" class="mono" style={{ fontSize: '10.5px' }}>
            {d}
          </text>
        </g>
      ))}
      <path d="M400 96 V 112 M400 148 V 190 H 190 V 198" class="flow-stroke" fill="none" stroke-width={1.5} stroke-dasharray="4 3" />
      <text x={410} y={176} class="flow-fill" style={{ fontSize: '11px' }}>
        drives passed to the CVM
      </text>
      {[0, 1].map((i) => (
        <g key={i}>
          <rect x={380 + i * 56} y={244} width={44} height={26} fill="none" stroke="var(--line-2)" />
          <text x={402 + i * 56} y={261} text-anchor="middle" class="mono" style={{ fontSize: '10.5px' }}>
            NIC
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function NciHub() {
  const [sel, setSel] = useState<Layer>('dsf');
  const layer = LAYERS.find((l) => l.id === sel)!;
  return (
    <>
      <div class="cols-2">
        <div>
          <h2 class="sec-h">The stack</h2>
          <Stack sel={sel} onSel={setSel} />
          <Follow tone="ink" k={layer.label}>
            <p>{layer.text}</p>
            <p>
              <button type="button" class="tbtn" onClick={() => go(layer.path)}>
                Open the related module <Icon name="arrow" />
              </button>
            </p>
          </Follow>
        </div>
        <div>
          <h2 class="sec-h">What’s in a node</h2>
          <NodeCutaway />
          <p class="field-note" style={{ marginTop: 'var(--sp-3)' }}>
            Every node runs the hypervisor, the user VMs and one CVM. The CVM talks to the node’s drives directly, and all CVMs together form the cluster’s storage controller.
          </p>
        </div>
      </div>
      <h2 class="sec-h">Explore</h2>
      <div class="subgrid">
        {SUBS.map((s) => (
          <button type="button" class="subtile" key={s.path} onClick={(e) => go(s.path, undefined, e.currentTarget as HTMLElement)}>
            <span class="t">
              <Icon name={s.icon} />
              {s.t}
            </span>
            <span class="s">{s.s}</span>
            <span class="pri">{s.pri}</span>
          </button>
        ))}
      </div>
    </>
  );
}
