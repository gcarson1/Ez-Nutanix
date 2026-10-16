// Flow Virtual Networking: VPCs with overlapping ranges on a shared physical underlay,
// Geneve encapsulation between AHV hosts, NAT and floating IPs, and VLAN vs overlay effort.
import { useEffect } from 'preact/hooks';
import { Field, Follow, Illus, PlayBar, Seg, Slider, Stat, Tip, Toggle } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { useClock } from '../../components/clock';
import { useBool, useEnum, useNum } from '../../../state/route';

type Pt = { x: number; y: number };
type Hdr = 'inner' | 'encap' | 'snat' | 'ext-in' | 'fip';

interface Hop {
  pts: Pt[];
  label: string;
  detail: string;
  hdr: Hdr;
}

const HOST_X = [30, 320, 610];
const HOST_W = 260;
const VS_Y = 268;
const UL_Y = 362;
const HOST_IP = ['172.16.0.11', '172.16.0.12', '172.16.0.13'];

const VMS = {
  a1: { host: 0, y: 116, vpc: 'A', name: 'A-1', ip: '10.1.1.10' },
  b1: { host: 0, y: 182, vpc: 'B', name: 'B-1', ip: '10.1.1.10' },
  a2: { host: 1, y: 116, vpc: 'A', name: 'A-2', ip: '10.1.2.20' },
  b2: { host: 1, y: 182, vpc: 'B', name: 'B-2', ip: '10.1.1.20' },
} as const;
type VmId = keyof typeof VMS;

const vsC = (h: number): Pt => ({ x: HOST_X[h] + HOST_W / 2, y: VS_Y + 14 });
const ulC = (h: number): Pt => ({ x: HOST_X[h] + HOST_W / 2, y: UL_Y });
/** VM -> its host's virtual switch, routed down the side of the host so it never crosses another VM. */
const vmOut = (id: VmId): Pt[] => {
  const v = VMS[id];
  const x0 = HOST_X[v.host];
  const side = x0 + 11;
  return [
    { x: x0 + 20, y: v.y + 24 },
    { x: side, y: v.y + 24 },
    { x: side, y: VS_Y + 14 },
    { x: x0 + 10, y: VS_Y + 14 },
  ];
};
const vmIn = (id: VmId): Pt[] => [...vmOut(id)].reverse();
const EXT_VLAN_Y = 486;
const EXT: Pt = { x: 828, y: EXT_VLAN_Y };
const EXT_DROP = { x: HOST_X[2] + HOST_W / 2, y: EXT_VLAN_Y };
const EXT_EDGE = { x: EXT.x - 62, y: EXT_VLAN_Y };

const SCENARIOS = {
  east: {
    label: 'Same VPC, across hosts',
    src: 'A-1 10.1.1.10',
    dst: 'A-2 10.1.2.20',
    hops: [
      { pts: [...vmOut('a1'), vsC(0)], label: 'A-1 sends to 10.1.2.20', detail: 'A different subnet in the same VPC. The VM just uses its default gateway, as on any network.', hdr: 'inner' },
      { pts: [vsC(0), ulC(0), ulC(1), vsC(1)], label: 'Host 1 routes it and wraps it in Geneve', detail: 'Routing for the VPC happens in the AHV virtual switch on Host 1. The original packet travels inside a Geneve tunnel from Host 1 to Host 2.', hdr: 'encap' },
      { pts: [vsC(1), ...vmIn('a2')], label: 'Host 2 unwraps and delivers', detail: 'Host 2 removes the outer header and hands the original packet to A-2. The physical network only ever saw Host 1 talking to Host 2.', hdr: 'inner' },
    ] as Hop[],
  },
  overlap: {
    label: 'Overlapping IPs (VPC B)',
    src: 'B-1 10.1.1.10',
    dst: 'B-2 10.1.1.20',
    hops: [
      { pts: [...vmOut('b1'), vsC(0)], label: 'B-1 (10.1.1.10) sends to 10.1.1.20', detail: 'A-1 in VPC A has the very same address. That is fine: each VPC is its own routing domain.', hdr: 'inner' },
      { pts: [vsC(0), ulC(0), ulC(1), vsC(1)], label: 'Tunneled as VPC B traffic', detail: 'The packet is kept inside VPC B. It can never be delivered to a VM in VPC A, even with identical addresses.', hdr: 'encap' },
      { pts: [vsC(1), ...vmIn('b2')], label: 'Delivered to B-2 only', detail: 'Two teams can reuse the same range (for example a cloned test copy of production) without renumbering.', hdr: 'inner' },
    ] as Hop[],
  },
  nat: {
    label: 'Out to the internet (NAT)',
    src: 'A-2 10.1.2.20',
    dst: 'Internet 198.51.100.7',
    hops: [
      { pts: [...vmOut('a2'), vsC(1)], label: 'A-2 sends to an internet address', detail: 'The VPC’s default route points to its external network.', hdr: 'inner' },
      { pts: [vsC(1), ulC(1), ulC(2), vsC(2)], label: 'Tunneled to the host doing NAT for VPC A', detail: 'Source NAT for a VPC is handled centrally on one host. Here that is Host 3.', hdr: 'encap' },
      { pts: [vsC(2), EXT_DROP, EXT_EDGE], label: 'Source NAT, then out on the external VLAN', detail: 'The private source 10.1.2.20 becomes the VPC’s external address 203.0.113.10. Replies to this connection come back the same way; outsiders cannot start a connection to A-2.', hdr: 'snat' },
    ] as Hop[],
  },
  fip: {
    label: 'In from outside (floating IP)',
    src: 'Internet 198.51.100.7',
    dst: 'Floating IP 203.0.113.50 → A-1',
    hops: [
      { pts: [EXT_EDGE, EXT_DROP, vsC(2)], label: 'A client connects to 203.0.113.50', detail: 'A floating IP is an external address mapped one-to-one to a VM’s private address, so outside clients can start connections to it.', hdr: 'ext-in' },
      { pts: [vsC(2), ulC(2), ulC(0), vsC(0)], label: 'Translated in the virtual switch, tunneled to Host 1', detail: 'The AHV virtual switch rewrites 203.0.113.50 to 10.1.1.10. The VM never needs to know its public address.', hdr: 'fip' },
      { pts: [vsC(0), ...vmIn('a1')], label: 'Delivered to A-1', detail: 'A-1 sees an ordinary packet addressed to 10.1.1.10.', hdr: 'inner' },
    ] as Hop[],
  },
};
type ScId = keyof typeof SCENARIOS;
const HOP_T = 2;

function along(pts: Pt[], f: number): Pt {
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    segs.push(d);
    total += d;
  }
  let target = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const r = segs[i] ? Math.min(1, target / segs[i]) : 1;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * r, y: pts[i].y + (pts[i + 1].y - pts[i].y) * r };
    }
    target -= segs[i];
  }
  return pts[pts.length - 1];
}

export function VNet() {
  const [sc, setSc] = useEnum<ScId>('vp', 'east', ['east', 'overlap', 'nat', 'fip']);
  const [jumbo, setJumbo] = useBool('jb', true);
  const [extra, setExtra] = useNum('nv', 0, 0, 3);
  const [projects, setProjects] = useNum('pj', 5, 1, 20);
  const S = SCENARIOS[sc];
  const duration = S.hops.length * HOP_T;
  const clock = useClock({ rate: 1, duration, stepSize: HOP_T, keys: true, autoplay: false });
  useEffect(() => clock.reset(), [sc]);

  const t = clock.t;
  const hi = Math.min(S.hops.length - 1, Math.floor(t / HOP_T));
  const hop = S.hops[hi];
  const f = (t - hi * HOP_T) / (HOP_T * 0.8);
  const dot = along(hop.pts, t >= duration ? 1 : f);
  const started = t > 0;
  const vpcOf = sc === 'overlap' ? 'B' : 'A';
  const guestMtu = jumbo ? 1500 : 1442;

  return (
    <>
      <div class="lab">
        <div class="ctl">
          <Field label="Packet to follow" tip="Pick a path, then press Play (or Space) and step with the arrow keys.">
            <div class="fl-vlist">
              <Seg
                label="Packet path"
                value={sc}
                onChange={setSc}
                options={(Object.keys(SCENARIOS) as ScId[]).map((k) => ({ value: k, label: SCENARIOS[k].label }))}
              />
            </div>
          </Field>
          <Field
            label="Jumbo frames on the physical network"
            tip="Geneve adds 58 bytes to every packet. With jumbo frames end to end, guests keep a normal 1500-byte MTU. Without them, guests in a VPC use 1442 bytes so the wrapped packet still fits in 1500."
            value={`guest MTU ${guestMtu}`}
          >
            <Toggle on={jumbo} onChange={setJumbo}>
              Jumbo frames (9000)
            </Toggle>
          </Field>
          <Field label="Create another VPC" tip="A new VPC is created in Prism Central in seconds. It can reuse the same private range as the others." value={`${2 + extra} VPCs`}>
            <div class="hstack">
              <button type="button" class="btn" disabled={extra >= 3} onClick={() => setExtra(extra + 1)}>
                <Icon name="plus" />
                Add VPC
              </button>
              {extra > 0 && (
                <button type="button" class="tbtn" onClick={() => setExtra(0)}>
                  Reset
                </button>
              )}
            </div>
          </Field>
        </div>

        <div class="stage">
          <div class="spread">
            <span class="small muted">
              {S.src} → {S.dst}
            </span>
            <Illus why="Three hosts and two VPCs. Encapsulation between AHV hosts is Geneve; header fields are simplified and the host that handles NAT or receives floating-IP traffic depends on configuration." />
          </div>
          <div class="diagram-scroll">
            <svg class="diagram" viewBox="0 0 900 520" role="img" aria-label={`Flow Virtual Networking: ${hop.label}`}>
              {/* control plane */}
              <rect class="ink-fill" x={300} y={6} width={300} height={50} />
              <text x={450} y={27} text-anchor="middle" style={{ fill: '#fff', fontWeight: 600, fontSize: '14px' }}>
                Prism Central · Network Controller
              </text>
              <text x={450} y={45} text-anchor="middle" style={{ fill: 'rgba(255,255,255,.8)', fontSize: '11.5px' }}>
                control plane: defines VPCs, subnets, routes
              </text>
              {HOST_X.map((x, h) => (
                <path key={`c${h}`} d={`M450 56 L${x + HOST_W / 2} 88`} class="line" stroke-dasharray="3 4" fill="none" />
              ))}

              {/* hosts */}
              {HOST_X.map((x, h) => (
                <g key={h}>
                  <rect class="node-box" x={x} y={88} width={HOST_W} height={214} />
                  <text x={x + 12} y={106} style={{ fontSize: '13px', fontWeight: 600 }}>
                    AHV Host {h + 1}
                  </text>
                  <text x={x + HOST_W - 12} y={106} text-anchor="end" class="mono muted" style={{ fontSize: '11px' }}>
                    {HOST_IP[h]}
                  </text>
                  <rect class="ink-soft" x={x + 10} y={VS_Y} width={HOST_W - 20} height={28} stroke="var(--ink-line)" />
                  <text x={x + HOST_W / 2} y={VS_Y + 18} text-anchor="middle" style={{ fontSize: '11.5px' }}>
                    virtual switch · distributed routing
                  </text>
                </g>
              ))}
              {(Object.keys(VMS) as VmId[]).map((id) => {
                const v = VMS[id];
                const x = HOST_X[v.host] + 20;
                return (
                  <g key={id}>
                    <rect class={`fl-vpc ${v.vpc === 'A' ? 'a' : 'b'}`} x={x} y={v.y} width={HOST_W - 40} height={48} />
                    <text x={x + 12} y={v.y + 20} style={{ fontSize: '13px', fontWeight: 600 }}>
                      {v.name} · VPC {v.vpc}
                    </text>
                    <text x={x + 12} y={v.y + 38} class="mono muted" style={{ fontSize: '11.5px' }}>
                      {v.ip}
                    </text>
                  </g>
                );
              })}
              {/* Host 3 roles */}
              <g>
                <rect class="vm" x={HOST_X[2] + 20} y={116} width={HOST_W - 40} height={48} />
                <text x={HOST_X[2] + 32} y={136} style={{ fontSize: '12.5px', fontWeight: 600 }}>
                  NAT for VPC A
                </text>
                <text x={HOST_X[2] + 32} y={154} class="mono muted" style={{ fontSize: '11px' }}>
                  external IP 203.0.113.10
                </text>
                <rect class="vm" x={HOST_X[2] + 20} y={182} width={HOST_W - 40} height={48} stroke-dasharray="4 3" />
                <text x={HOST_X[2] + 32} y={202} style={{ fontSize: '12.5px', fontWeight: 600 }}>
                  Network Gateway VM
                </text>
                <text x={HOST_X[2] + 32} y={220} class="muted" style={{ fontSize: '11px' }}>
                  optional: VPN, VTEP (VXLAN), BGP
                </text>
              </g>

              {/* underlay */}
              <rect class="bg3" x={20} y={UL_Y - 16} width={860} height={32} stroke="var(--line-2)" />
              <text x={30} y={UL_Y + 36} style={{ fontSize: '12.5px', fontWeight: 600 }}>
                Physical network (underlay)
              </text>
              <text x={30} y={UL_Y + 54} class="muted" style={{ fontSize: '11.5px' }}>
                only needs host-to-host IP reachability
              </text>
              {HOST_X.map((x, h) => (
                <line key={`u${h}`} x1={x + HOST_W / 2} x2={x + HOST_W / 2} y1={302} y2={UL_Y - 16} class="line" stroke-width={1.5} />
              ))}
              {/* external network */}
              <line x1={EXT_DROP.x} x2={EXT_DROP.x} y1={UL_Y + 16} y2={EXT_VLAN_Y} class="line" stroke-width={1.5} />
              <line x1={EXT_DROP.x} x2={EXT.x - 62} y1={EXT_VLAN_Y} y2={EXT_VLAN_Y} class="line" stroke-width={1.5} />
              <text x={EXT_DROP.x - 10} y={EXT_VLAN_Y - 18} text-anchor="end" class="muted" style={{ fontSize: '11.5px' }}>
                external network (VLAN)
              </text>
              <text x={EXT_DROP.x - 10} y={EXT_VLAN_Y - 2} text-anchor="end" class="mono muted" style={{ fontSize: '11px' }}>
                203.0.113.0/24
              </text>
              <rect class="bg2" x={EXT.x - 62} y={EXT_VLAN_Y - 22} width={124} height={44} stroke="var(--line-2)" />
              <text x={EXT.x} y={EXT_VLAN_Y + 5} text-anchor="middle" style={{ fontSize: '12.5px', fontWeight: 600 }}>
                Router / internet
              </text>

              {/* path + packet */}
              {S.hops.map((h, i) => (
                <polyline key={i} points={h.pts.map((p) => `${p.x},${p.y}`).join(' ')} class={`fl-hop${i === hi && started ? ' on' : ''}${i < hi ? ' done' : ''}`} />
              ))}
              {started && (
                <g aria-hidden="true">
                  <rect x={dot.x - 9} y={dot.y - 9} width={18} height={18} class={hop.hdr === 'encap' || hop.hdr === 'fip' ? 'fl-pkt encap' : 'fl-pkt'} />
                  {(hop.hdr === 'encap' || hop.hdr === 'fip') && <rect x={dot.x - 5} y={dot.y - 5} width={10} height={10} class="flow-fill" />}
                </g>
              )}
            </svg>
          </div>
          <PlayBar clock={clock} label="Packet walkthrough controls" fmt={() => `Hop ${started ? hi + 1 : 0} of ${S.hops.length}`} scrub />
          <Follow tone="flow" k={started ? `Hop ${hi + 1} · ${hop.label}` : 'Ready'}>
            <p>{started ? hop.detail : 'Press Play to follow the packet.'}</p>
          </Follow>
        </div>

        <div class="rail">
          <div class="side-sec">
            <div class="eyebrow">
              <Tip text="What the packet looks like on the wire at this hop. Inside a host, the VM's own packet. Between hosts, the same packet wrapped in an outer header addressed host to host.">Headers on the wire</Tip>
            </div>
            <Headers hdr={started ? hop.hdr : 'inner'} sc={sc} vpc={vpcOf} mtu={guestMtu} />
          </div>
          <div class="side-sec">
            <div class="eyebrow">No physical network changes</div>
            <Stat k="VPCs" v={2 + extra} />
            <Stat k="Using 10.1.0.0/16" v={`${2 + extra} of ${2 + extra}`} tip="Every VPC here reuses the same private range. Addresses only need to be unique inside one VPC." />
            <Stat k="Switch or router changes" v="0" tone="ok" />
            <p class="small muted">New VPCs and subnets are software objects. The physical switches keep carrying host-to-host traffic and the one external VLAN.</p>
          </div>
        </div>
      </div>

      <h2 class="sec-h">VLAN-backed vs overlay: what each new project costs the network team</h2>
      <Compare projects={projects} setProjects={setProjects} />
    </>
  );
}

function Headers({ hdr, sc, vpc, mtu }: { hdr: Hdr; sc: ScId; vpc: string; mtu: number }) {
  const inner: Record<ScId, [string, string]> = {
    east: ['10.1.1.10', '10.1.2.20'],
    overlap: ['10.1.1.10', '10.1.1.20'],
    nat: ['10.1.2.20', '198.51.100.7'],
    fip: ['198.51.100.7', '10.1.1.10'],
  };
  const outer: Record<ScId, [string, string]> = {
    east: ['172.16.0.11', '172.16.0.12'],
    overlap: ['172.16.0.11', '172.16.0.12'],
    nat: ['172.16.0.12', '172.16.0.13'],
    fip: ['172.16.0.13', '172.16.0.11'],
  };
  let rows: { k: string; v: string; cls?: string }[] = [];
  if (hdr === 'encap' || hdr === 'fip') {
    rows = [
      { k: 'Outer IP', v: `${outer[sc][0]} → ${outer[sc][1]}`, cls: 'outer' },
      { k: 'UDP + Geneve', v: `tunnel header · VPC ${vpc}`, cls: 'outer' },
      { k: 'Inner IP', v: `${inner[sc][0]} → ${inner[sc][1]}` },
      { k: 'Payload', v: 'application data' },
    ];
  } else if (hdr === 'snat') {
    rows = [
      { k: 'IP', v: '203.0.113.10 → 198.51.100.7', cls: 'nat' },
      { k: 'Payload', v: 'application data' },
    ];
  } else if (hdr === 'ext-in') {
    rows = [
      { k: 'IP', v: '198.51.100.7 → 203.0.113.50', cls: 'nat' },
      { k: 'Payload', v: 'application data' },
    ];
  } else {
    rows = [
      { k: 'IP', v: `${inner[sc][0]} → ${inner[sc][1]}` },
      { k: 'Payload', v: 'application data' },
    ];
  }
  const wrapped = hdr === 'encap' || hdr === 'fip';
  return (
    <div>
      <div class="fl-hdrs">
        {rows.map((r) => (
          <div key={r.k} class={`fl-hdr ${r.cls ?? ''}`}>
            <span class="k">{r.k}</span>
            <span class="mono">{r.v}</span>
          </div>
        ))}
      </div>
      <p class="small muted" style={{ marginTop: 'var(--sp-2)' }}>
        {wrapped
          ? `Geneve adds 58 bytes. Guest MTU ${mtu} + 58 = ${mtu + 58} bytes on the wire${mtu === 1500 ? ', which is why jumbo frames are recommended.' : ', which fits a standard 1500-byte network.'}`
          : hdr === 'snat' || hdr === 'ext-in'
            ? 'On the external network the packet is an ordinary, unwrapped IP packet.'
            : 'Inside the host the VM’s packet is untouched.'}
      </p>
    </div>
  );
}

function Compare({ projects, setProjects }: { projects: number; setProjects: (n: number) => void }) {
  const vlanTasks = [
    { t: 'Allocate a VLAN ID', tip: 'Each isolated network needs its own VLAN number.' },
    { t: 'Add the VLAN to every host-facing switch port', tip: 'Every switch port connected to a cluster host must carry the new VLAN, or VMs lose connectivity after migrating.' },
    { t: 'Create a gateway (router interface) for the subnet', tip: 'Something on the physical network must route for the new subnet.' },
    { t: 'Find a unique IP range', tip: 'VLAN-backed subnets share one routing space, so ranges cannot overlap.' },
    { t: 'Update firewall rules for the new range', tip: 'Address-based rules elsewhere must learn about the new subnet.' },
  ];
  const overlayTasks = [{ t: 'Create the VPC and subnets in Prism Central', tip: 'Done by the platform team in software. The range may overlap other VPCs.' }];
  const oneTime = [
    'An external network (VLAN) for traffic in and out of VPCs',
    'Host-to-host IP reachability; jumbo frames recommended',
    'Prism Central with the Network Controller enabled (not available on the smallest Prism Central size)',
  ];
  return (
    <div>
      <div class="hstack" style={{ maxWidth: '32rem' }}>
        <Field label="New projects this year" value={projects}>
          <Slider value={projects} min={1} max={20} onChange={setProjects} label="New projects" />
        </Field>
      </div>
      <div class="cols-2">
        <div>
          <div class="spread">
            <h3 class="fl-h3">VLAN-backed networks</h3>
            <span class="mono">{vlanTasks.length * projects} physical-network tasks</span>
          </div>
          <table class="tbl">
            <thead>
              <tr>
                <th>Per new project</th>
                <th class="num">Who</th>
              </tr>
            </thead>
            <tbody>
              {vlanTasks.map((x) => (
                <tr key={x.t}>
                  <td>
                    <Tip text={x.tip}>{x.t}</Tip>
                  </td>
                  <td class="num">Network team</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div class="spread">
            <h3 class="fl-h3">Overlay networks (VPCs)</h3>
            <span class="mono ok-text">0 physical-network tasks</span>
          </div>
          <table class="tbl">
            <thead>
              <tr>
                <th>Per new project</th>
                <th class="num">Who</th>
              </tr>
            </thead>
            <tbody>
              {overlayTasks.map((x) => (
                <tr key={x.t}>
                  <td>
                    <Tip text={x.tip}>{x.t}</Tip>
                  </td>
                  <td class="num">Platform team</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="small muted" style={{ marginTop: 'var(--sp-3)' }}>
            One-time setup instead:
          </p>
          <ul class="small fl-ul">
            {oneTime.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
      </div>
      <p class="field-note" style={{ marginTop: 'var(--sp-3)' }}>
        <Illus why="Typical tasks, not an exhaustive change process. Many organizations still use VLAN-backed networks for some workloads; both can run on the same cluster." /> VLAN-backed networks remain a good fit when a workload must sit directly on an existing physical segment.
      </p>
    </div>
  );
}
