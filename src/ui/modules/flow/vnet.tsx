// Flow Virtual Networking: follow one packet through two VPCs that share the same addresses,
// wrapped in an envelope between hosts; or out to the internet through source NAT, or in
// through a floating IP. One choice, one looping picture.
import { useEnum } from '../../../state/route';
import { useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, PlayBar } from '../../components/controls';
import { Choice, Kpis, Show, ease, prog, type KpiItem } from '../../components/show';

type Preset = 'vpc' | 'nat' | 'fip';
type Pt = { x: number; y: number };

interface Hop {
  k: string;
  text: string;
  pts: Pt[];
  /** Source → destination on the packet itself. */
  addr: string;
  /** Shown first on a hop where an address is swapped. */
  was?: string;
  /** Outer envelope label while the packet travels between hosts. */
  wrap?: string;
  /** Where the packet is delivered at the end of this hop. */
  to?: string;
}

// ── geometry (viewBox units) ──
const W = 960;
const H = 346;
const HOST_X = [16, 376];
const HOST_W = 320;
const VM_Y = 56;
const VM_W = 140;
const VM_H = 68;
const SW_Y = 176;
const SW_C = SW_Y + 29;
const BAR_Y = 285;
const NET = { x: 760, y: 70, w: 180, h: 80 };
const NET_C = NET.x + NET.w / 2;

const VMS = [
  { id: 'a1', host: 0, vpc: 'A', name: 'A-1', ip: '10.1.1.10' },
  { id: 'b1', host: 0, vpc: 'B', name: 'B-1', ip: '10.1.1.10' },
  { id: 'a2', host: 1, vpc: 'A', name: 'A-2', ip: '10.1.1.20' },
  { id: 'b2', host: 1, vpc: 'B', name: 'B-2', ip: '10.1.1.20' },
] as const;

const vmX = (id: string) => {
  const v = VMS.find((m) => m.id === id)!;
  return HOST_X[v.host] + (v.vpc === 'A' ? 14 : 166);
};
const hostC = (h: number): Pt => ({ x: HOST_X[h] + HOST_W / 2, y: SW_C });
const vmHost = (id: string) => VMS.find((m) => m.id === id)!.host;
/** From just under a VM, down to its host's virtual switch. */
const out = (id: string): Pt[] => [{ x: vmX(id) + VM_W / 2, y: VM_Y + VM_H + 18 }, { x: vmX(id) + VM_W / 2, y: SW_C }, hostC(vmHost(id))];
const into = (id: string): Pt[] => [...out(id)].reverse();
/** Host to host across the physical network. */
const tunnel = (a: number, b: number): Pt[] => [hostC(a), { x: hostC(a).x, y: BAR_Y }, { x: hostC(b).x, y: BAR_Y }, hostC(b)];
const toNet: Pt[] = [hostC(1), { x: NET_C, y: SW_C }, { x: NET_C, y: NET.y + NET.h + 14 }];

const PRESETS: Record<Preset, { label: string; poster: number; hops: Hop[] }> = {
  vpc: {
    label: 'Inside a VPC',
    poster: 1,
    hops: [
      { k: 'Leaves A-1', text: 'A-1 in VPC A sends a packet to 10.1.1.20, an address in its own private network.', pts: out('a1'), addr: '10.1.1.10 → 10.1.1.20' },
      { k: 'Wrapped, host to host', text: 'Host 1 wraps it in an envelope addressed to Host 2 and tagged VPC A. The physical network only sees Host 1 talking to Host 2.', pts: tunnel(0, 1), addr: '10.1.1.10 → 10.1.1.20', wrap: 'Host 1 → Host 2 · VPC A' },
      { k: 'Delivered to A-2', text: 'Host 2 unwraps it and hands the original packet to A-2. No switch or router was changed to build this network.', pts: into('a2'), addr: '10.1.1.10 → 10.1.1.20', to: 'a2' },
      { k: 'Same addresses in VPC B', text: 'B-1 in VPC B has the very same address, 10.1.1.10, and also sends to 10.1.1.20.', pts: out('b1'), addr: '10.1.1.10 → 10.1.1.20' },
      { k: 'Tagged VPC B', text: 'This envelope says VPC B, so the two networks never mix even though their addresses match.', pts: tunnel(0, 1), addr: '10.1.1.10 → 10.1.1.20', wrap: 'Host 1 → Host 2 · VPC B' },
      { k: 'Delivered to B-2 only', text: 'B-2 gets it and A-2 never sees it. Two teams can reuse the same range, such as a cloned copy of production.', pts: into('b2'), addr: '10.1.1.10 → 10.1.1.20', to: 'b2' },
    ],
  },
  nat: {
    label: 'Out to the internet',
    poster: 2,
    hops: [
      { k: 'Leaves A-1', text: 'A-1 sends a packet to a server on the internet. Its private address, 10.1.1.10, means nothing out there.', pts: out('a1'), addr: '10.1.1.10 → 198.51.100.7' },
      { k: 'Wrapped, to the NAT host', text: 'The packet is wrapped and sent to Host 2, which handles internet traffic for VPC A.', pts: tunnel(0, 1), addr: '10.1.1.10 → 198.51.100.7', wrap: 'Host 1 → Host 2 · VPC A' },
      { k: 'Address swapped', text: "Host 2 swaps the private source address for VPC A's one public address, 203.0.113.10. This is source NAT.", pts: [hostC(1)], was: '10.1.1.10 → 198.51.100.7', addr: '203.0.113.10 → 198.51.100.7' },
      { k: 'Out to the internet', text: 'It leaves on the external network as an ordinary packet. Replies come back the same way, but outsiders cannot start a connection to A-1.', pts: toNet, addr: '203.0.113.10 → 198.51.100.7', to: 'net' },
    ],
  },
  fip: {
    label: 'In from the internet',
    poster: 1,
    hops: [
      { k: 'A client connects', text: 'A client on the internet connects to 203.0.113.50, a floating IP: a public address reserved for one VM.', pts: [...toNet].reverse(), addr: '198.51.100.7 → 203.0.113.50' },
      { k: 'Address swapped', text: "Host 2 swaps the floating IP for A-1's private address, 10.1.1.10. A-1 never needs to know its public address.", pts: [hostC(1)], was: '198.51.100.7 → 203.0.113.50', addr: '198.51.100.7 → 10.1.1.10' },
      { k: 'Wrapped, host to host', text: 'The packet is wrapped, tagged VPC A and sent to Host 1, where A-1 runs.', pts: tunnel(1, 0), addr: '198.51.100.7 → 10.1.1.10', wrap: 'Host 2 → Host 1 · VPC A' },
      { k: 'Delivered to A-1', text: 'Host 1 unwraps it and A-1 sees an ordinary packet. Outsiders can reach A-1, and only A-1, this way.', pts: into('a1'), addr: '198.51.100.7 → 10.1.1.10', to: 'a1' },
    ],
  },
};

const HOP = 2.4;
const MOVE = 1.6;
const SWAP_AT = 0.8;

const NO_CHANGES_TIP =
  'A VLAN-backed network for a new project usually needs a VLAN ID, that VLAN on every host-facing switch port, a gateway and a unique IP range. A VPC is created in Prism Central, in software. One-time setup: an external network (VLAN) for traffic in and out of VPCs.';
const KPIS: Record<Preset, KpiItem[]> = {
  vpc: [
    { k: 'VPCs using the same addresses', v: 2 },
    { k: 'Physical network changes', v: 0, tone: 'ok', tip: NO_CHANGES_TIP },
    { k: 'Envelope size', v: '58 bytes', sub: 'added between hosts', tip: 'The envelope (Geneve) adds 58 bytes to each packet between hosts. With jumbo frames on the physical network, VMs keep a normal 1500-byte MTU; without them, VMs in a VPC use 1442.' },
  ],
  nat: [
    { k: 'Public addresses for VPC A', v: 1, sub: 'shared by all its VMs' },
    { k: 'Outsiders can start a connection', v: 'No' },
    { k: 'Physical network changes', v: 0, tone: 'ok', tip: NO_CHANGES_TIP },
  ],
  fip: [
    { k: 'Floating IPs', v: 1, sub: 'one public address for one VM' },
    { k: 'Outsiders can start a connection', v: 'Yes, to A-1' },
    { k: 'Changes inside A-1', v: 'None', sub: 'it only knows 10.1.1.10' },
  ],
};

function along(pts: Pt[], f: number): Pt {
  if (pts.length === 1) return pts[0];
  const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  let d = Math.max(0, Math.min(1, f)) * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const r = seg[i] ? Math.min(1, d / seg[i]) : 1;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * r, y: pts[i].y + (pts[i + 1].y - pts[i].y) * r };
    }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}

/** The packet: its addresses on a label, inside an envelope while it travels between hosts. */
function Packet({ p, addr, wrap, swapped }: { p: Pt; addr: string; wrap?: string; swapped: boolean }) {
  const pw = addr.length * 6.9 + 18;
  if (wrap) {
    const ew = Math.max(pw, wrap.length * 6.3) + 18;
    return (
      <g aria-hidden="true">
        <rect class="fl-pbg" x={p.x - ew / 2} y={p.y - 25} width={ew} height={50} />
        <rect class={`fl-wrap${wrap.endsWith('VPC B') ? ' b' : ''}`} x={p.x - ew / 2} y={p.y - 25} width={ew} height={50} />
        <text x={p.x} y={p.y - 9} text-anchor="middle" class="fl-wrap-t">
          {wrap}
        </text>
        <rect class="fl-pkt" x={p.x - pw / 2} y={p.y - 1} width={pw} height={20} />
        <text x={p.x} y={p.y + 13} text-anchor="middle" class="mono" style={{ fontSize: '11.5px' }}>
          {addr}
        </text>
      </g>
    );
  }
  return (
    <g aria-hidden="true">
      <rect class="fl-pbg" x={p.x - pw / 2} y={p.y - 11} width={pw} height={22} />
      <rect class={`fl-pkt${swapped ? ' swap' : ''}`} x={p.x - pw / 2} y={p.y - 11} width={pw} height={22} />
      <text x={p.x} y={p.y + 4} text-anchor="middle" class="mono" style={{ fontSize: '11.5px', fontWeight: swapped ? 600 : 400 }}>
        {addr}
      </text>
    </g>
  );
}

export function VNet() {
  const [preset, setPreset] = useEnum<Preset>('vp', 'vpc', ['vpc', 'nat', 'fip']);
  const P = PRESETS[preset];
  const clock = useClock({ rate: 1, duration: P.hops.length * HOP, keys: true, poster: P.poster * HOP + 1.2 });
  useRestartOn(clock, [preset]);

  const t = clock.t;
  const i = Math.min(P.hops.length - 1, Math.floor(t / HOP));
  const hop = P.hops[i];
  const local = t - i * HOP;
  const pos = along(hop.pts, ease(prog(local, 0, MOVE)));
  const swapped = hop.was !== undefined && local >= SWAP_AT;
  const addr = hop.was !== undefined && !swapped ? hop.was : hop.addr;
  const got = hop.to !== undefined && local >= MOVE ? hop.to : null;
  const sw2 = preset === 'nat' ? 'Virtual switch · NAT for VPC A' : preset === 'fip' ? 'Virtual switch · floating IP for A-1' : 'Virtual switch';

  return (
    <Show
      top={
        <Choice<Preset>
          label="Follow a packet"
          value={preset}
          onChange={setPreset}
          options={(Object.keys(PRESETS) as Preset[]).map((k) => ({ value: k, label: PRESETS[k].label }))}
        />
      }
      foot={
        <>
          <Follow tone={got ? 'ok' : 'flow'} k={hop.k}>
            <p>{hop.text}</p>
          </Follow>
          <Kpis items={KPIS[preset]} />
        </>
      }
    >
      <div class="diagram-scroll">
        <svg class="diagram fl-net" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Two hosts running VMs in two private networks, VPC A and VPC B, over one physical network. ${hop.k}: ${hop.text}`}>
          {/* physical network and the way out */}
          <rect class="bg3" x={16} y={BAR_Y - 15} width={680} height={30} stroke="var(--line-2)" />
          <text x={16} y={BAR_Y + 46} style={{ fontSize: '12.5px', fontWeight: 600 }}>
            Physical network
          </text>
          <text x={128} y={BAR_Y + 46} class="muted" style={{ fontSize: '12px' }}>
            only ever sees host-to-host traffic
          </text>
          {HOST_X.map((_, h) => (
            <line key={h} x1={hostC(h).x} x2={hostC(h).x} y1={SW_Y + 40} y2={BAR_Y - 15} class="line" stroke-width={2} />
          ))}
          <polyline points={toNet.map((p) => `${p.x},${p.y}`).join(' ')} class="fl-extline" />
          <text x={712} y={SW_C + 20} class="muted" style={{ fontSize: '11.5px' }}>
            External network (VLAN)
          </text>
          <rect class={`fl-netbox${got === 'net' ? ' got' : ''}`} x={NET.x} y={NET.y} width={NET.w} height={NET.h} />
          <text x={NET_C} y={NET.y + 28} text-anchor="middle" style={{ fontSize: '14px', fontWeight: 600 }}>
            Internet
          </text>
          <text x={NET_C} y={NET.y + 48} text-anchor="middle" class="mono muted" style={{ fontSize: '11.5px' }}>
            client 198.51.100.7
          </text>
          {got === 'net' && (
            <text x={NET_C} y={NET.y + 68} text-anchor="middle" class="ok-fill" style={{ fontSize: '11px', fontWeight: 600 }}>
              ✓ received
            </text>
          )}

          {/* hosts */}
          {HOST_X.map((x, h) => (
            <g key={h}>
              <rect class="node-box" x={x} y={16} width={HOST_W} height={216} />
              <text x={x + 14} y={40} style={{ fontSize: '14px', fontWeight: 600 }}>
                Host {h + 1}
              </text>
              <text x={x + HOST_W - 14} y={40} text-anchor="end" class="mono muted" style={{ fontSize: '11.5px' }}>
                172.16.0.1{h + 1}
              </text>
              <rect class="fl-sw" x={x + 14} y={SW_Y} width={HOST_W - 28} height={40} />
              <text x={x + HOST_W / 2} y={SW_Y + 14} text-anchor="middle" style={{ fontSize: '12px' }}>
                {h === 1 ? sw2 : 'Virtual switch'}
              </text>
            </g>
          ))}
          {VMS.map((v) => {
            const x = vmX(v.id);
            return (
              <g key={v.id}>
                <rect class={`fl-vpc ${v.vpc === 'A' ? 'a' : 'b'}${got === v.id ? ' got' : ''}`} x={x} y={VM_Y} width={VM_W} height={VM_H} />
                <text x={x + 12} y={VM_Y + 22} style={{ fontSize: '13.5px', fontWeight: 600 }}>
                  {v.name} · VPC {v.vpc}
                </text>
                <text x={x + 12} y={VM_Y + 43} class="mono muted" style={{ fontSize: '11.5px' }}>
                  {v.ip}
                </text>
                {got === v.id && (
                  <text x={x + 12} y={VM_Y + 60} class="ok-fill" style={{ fontSize: '11px', fontWeight: 600 }}>
                    ✓ received
                  </text>
                )}
              </g>
            );
          })}

          {/* route and packet */}
          {P.hops.map((h, k) => h.pts.length > 1 && <polyline key={k} points={h.pts.map((p) => `${p.x},${p.y}`).join(' ')} class="fl-route" />)}
          {hop.pts.length > 1 && <polyline points={hop.pts.map((p) => `${p.x},${p.y}`).join(' ')} class="fl-hop" />}
          <Packet p={pos} addr={addr} wrap={hop.wrap} swapped={swapped} />
        </svg>
      </div>
      <PlayBar
        clock={clock}
        label="Virtual networking animation"
        fmt={() => hop.k}
        extra={<Illus why="Two hosts and two VPCs. Between AHV hosts the envelope is Geneve. Which host handles NAT and floating IPs depends on configuration, and the addresses are examples." />}
      />
    </Show>
  );
}
