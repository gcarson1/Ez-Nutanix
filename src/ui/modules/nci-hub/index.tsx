// NCI hub: the sub-modules first, then a "what's in a node" cutaway for reference.
import { Icon } from '../../components/Icon';
import './style.css';
import { go } from '../../shell/nav';
import { MODULES } from '../registry';

// What each tile says. Its title and icon come from the registry, so a tile always matches the
// module it opens, and the registry's order (basics first) is the hub's order.
const TILES: Record<string, { s: string; pri: string }> = {
  'nci/hci': { s: 'Three tiers fold into one node; the cluster then grows node by node, each with its own storage controller.', pri: 'Architecture' },
  'nci/cluster': { s: 'One 4-node cluster: data placement, live migration, planned shutdown, VM failover and drive failure.', pri: 'Storage' },
  'nci/datapath': { s: 'Follow a write or a read from the VM through the controller to its copies.', pri: 'Storage' },
  'nci/capacity': { s: 'Copies, erasure coding and block or rack awareness: what protection costs and how it heals.', pri: 'Storage' },
  'nci/snapshots': { s: 'A snapshot copies the map, not the data; clones share blocks until they change.', pri: 'Storage' },
  'nci/failures': { s: 'Pick a failure, from one drive to two nodes at once, and watch the cluster heal.', pri: 'Resilience' },
  'nci/lcm': { s: 'Updates one node at a time while workloads keep running.', pri: 'Operations' },
  'nci/network': { s: 'How a node’s bonded uplinks carry traffic, and what happens when a link fails.', pri: 'Networking' },
  'nci/flow': { s: 'Rules that follow each VM by its labels, and private networks (VPCs) built in software.', pri: 'Microsegmentation' },
  'nci/security': { s: 'Encryption at rest and its keys, against a stolen drive or node.', pri: 'Encryption' },
  'nci/dr': { s: 'Async, NearSync / Sync or Metro Availability between sites, and a failover.', pri: 'Protection' },
  'nci/move': { s: 'VMs copied over, kept in sync, then cut over with minimal downtime.', pri: 'Adoption' },
  'nci/edge': { s: '1-, 2- and 3-node sites, and what each survives.', pri: 'Edge' },
};

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
      <text x={410} y={178} class="flow-fill" style={{ fontSize: '11px' }}>
        <tspan>drives passed</tspan>
        <tspan x={410} dy={14}>
          to the CVM
        </tspan>
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
  return (
    <>
      <h2 class="sec-h">Explore</h2>
      <div class="subgrid">
        {MODULES.filter((m) => m.parent === 'nci').map(({ content: c, icon }) => (
          <button type="button" class="subtile" key={c.path} data-path={c.path} onClick={(e) => go(c.path, undefined, e.currentTarget as HTMLElement)}>
            <span class="t">
              <Icon name={icon} />
              {c.title}
            </span>
            <span class="s">{TILES[c.path]?.s ?? c.summary}</span>
            {TILES[c.path] && <span class="pri">{TILES[c.path].pri}</span>}
          </button>
        ))}
      </div>
      <section class="hub-node" aria-labelledby="hub-node-h">
        <h2 class="sec-h" id="hub-node-h">
          What’s in a node
        </h2>
        <NodeCutaway />
        <p class="field-note">Every node runs the hypervisor, the user VMs and one CVM. The CVM talks to the node’s drives directly, and all CVMs together form the cluster’s storage controller.</p>
      </section>
    </>
  );
}
