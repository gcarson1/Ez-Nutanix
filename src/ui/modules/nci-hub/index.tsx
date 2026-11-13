// NCI hub (N2-021): the intro beside a "what's in a node" cutaway, then the sub-modules in four
// labeled groups.
import { Icon } from '../../components/Icon';
import { ProductFacts } from '../../components/show';
import './style.css';
import { go } from '../../shell/nav';
import { MODULES } from '../registry';
import { content } from './content';

// What each tile says. Its title and icon come from the registry, so a tile always matches the
// module it opens.
const TILES: Record<string, string> = {
  'nci/hci': 'Three tiers fold into one node; the cluster then grows node by node, each with its own storage controller.',
  'nci/cluster': 'One 4-node cluster: data placement, live migration, planned shutdown, VM failover and drive failure.',
  'nci/datapath': 'Follow a write or a read from the VM through the controller to its copies.',
  'nci/capacity': 'Copies, erasure coding and block or rack awareness: what protection costs and how it heals.',
  'nci/snapshots': 'A snapshot copies the map, not the data; clones share blocks until they change.',
  'nci/failures': 'Pick a failure, from one drive to two nodes at once, and watch the cluster heal.',
  'nci/lcm': 'Updates one node at a time while workloads keep running.',
  'nci/network': 'How a node’s bonded uplinks carry traffic, and what happens when a link fails.',
  'nci/flow': 'Rules that follow each VM by its labels, and private networks (VPCs) built in software.',
  'nci/security': 'Encryption at rest and its keys, against a stolen drive or node.',
  'nci/dr': 'Async, NearSync / Sync or Metro Availability between sites, and a failover.',
  'nci/move': 'VMs copied over, kept in sync, then cut over with minimal downtime.',
  'nci/edge': '1-, 2- and 3-node sites, and what each survives.',
};

const GROUPS: { label: string; paths: string[] }[] = [
  { label: 'Foundations', paths: ['nci/hci', 'nci/cluster', 'nci/datapath'] },
  { label: 'Protection', paths: ['nci/capacity', 'nci/snapshots', 'nci/failures', 'nci/dr', 'nci/security'] },
  { label: 'Operations', paths: ['nci/lcm', 'nci/move', 'nci/edge'] },
  { label: 'Networking', paths: ['nci/network', 'nci/flow'] },
];

function NodeCutaway() {
  // One node: hypervisor hosting user VMs and the CVM; CVM owns the local drives (passthrough).
  return (
    <svg class="diagram" viewBox="0 0 520 300" role="img" aria-label="What is in a node: user VMs and a Controller VM on the hypervisor, local drives passed to the CVM, and network ports">
      <rect class="frame" x={1} y={1} width={518} height={298} />
      <text x={14} y={22} class="muted d-sub">
        One node
      </text>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect class="vm" x={20 + i * 92} y={40} width={80} height={56} />
          <text class="d-label" x={60 + i * 92} y={73} text-anchor="middle">
            VM {i + 1}
          </text>
        </g>
      ))}
      <rect class="ink-fill" x={300} y={40} width={200} height={56} />
      <text class="d-title" x={400} y={64} text-anchor="middle" style={{ fill: '#fff', fontWeight: 600 }}>
        Controller VM (CVM)
      </text>
      <text class="d-sub" x={400} y={83} text-anchor="middle" style={{ fill: 'rgba(255,255,255,.8)' }}>
        Stargate, Curator and more
      </text>
      <rect class="bg3" x={20} y={112} width={480} height={36} stroke="var(--line-2)" />
      <text class="d-label" x={260} y={135} text-anchor="middle" style={{ fontWeight: 600 }}>
        AHV hypervisor
      </text>
      <rect class="bg2" x={20} y={164} width={480} height={118} stroke="var(--line-2)" />
      <text x={34} y={184} class="muted d-sub">
        Hardware: CPU · memory · local drives · NICs
      </text>
      {['NVMe', 'NVMe', 'SSD', 'SSD', 'SSD', 'SSD'].map((d, i) => (
        <g key={i}>
          <rect class="disk" x={34 + i * 56} y={198} width={48} height={34} />
          <text x={58 + i * 56} y={219} text-anchor="middle" class="d-fine">
            {d}
          </text>
        </g>
      ))}
      <path d="M400 96 V 112 M400 148 V 190 H 190 V 198" class="flow-stroke" fill="none" stroke-width={1.5} stroke-dasharray="4 3" />
      <text x={410} y={178} class="flow-fill d-fine">
        <tspan>drives passed</tspan>
        <tspan x={410} dy={14}>
          to the CVM
        </tspan>
      </text>
      {[0, 1].map((i) => (
        <g key={i}>
          <rect x={380 + i * 56} y={244} width={44} height={26} fill="none" stroke="var(--line-2)" />
          <text x={402 + i * 56} y={261} text-anchor="middle" class="d-fine">
            NIC
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function NciHub() {
  const byPath = new Map(MODULES.map((m) => [m.content.path, m]));
  return (
    <>
      <div class="hub-top">
        <div class="hub-intro">
          <p class="hub-lede">{content.summary}</p>
          <p class="field-note">Every node runs the hypervisor, the user VMs and one Controller VM (CVM). The CVM talks to the node’s drives directly, and all CVMs together form the cluster’s storage controller.</p>
          <ProductFacts release={content.facts.release} license={content.facts.license} />
        </div>
        <figure class="hub-node" aria-labelledby="hub-node-h">
          <figcaption class="side-sec-h" id="hub-node-h">
            What’s in a node
          </figcaption>
          <NodeCutaway />
        </figure>
      </div>
      {GROUPS.map((g) => (
        <section class="hub-group" key={g.label} aria-labelledby={`hub-${g.label}`}>
          <h2 class="sec-h" id={`hub-${g.label}`}>
            {g.label}
          </h2>
          <div class="subgrid">
            {g.paths.map((p) => {
              const m = byPath.get(p);
              if (!m) return null;
              return (
                <button type="button" class="subtile" key={p} data-path={p} onClick={(e) => go(p, undefined, e.currentTarget as HTMLElement)}>
                  <span class="t">
                    <Icon name={m.icon} />
                    {m.content.title}
                  </span>
                  <span class="s">{TILES[p] ?? m.content.summary}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
