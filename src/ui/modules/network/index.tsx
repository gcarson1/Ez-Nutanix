// AHV Networking: pick a bond type and whether a link fails, and watch packets from three VMs and
// the CVM leave one host through its virtual switch and two-link bond to the top-of-rack
// switches, on a loop. Bond behavior lives in src/engine/ahvnet.ts; this file only animates it.
import { useMemo } from 'preact/hooks';
import { useEnum } from '../../../state/route';
import { paced, useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, phaseAt } from '../../components/show';
import { BONDS, BOND_ORDER, limits, uplinkFor, uplinkRole, type BondMode, type LinkFail, type Uplink, type UplinkRole } from '../../../engine/ahvnet';
import './style.css';

const SOURCES = ['VM 1', 'VM 2', 'VM 3', 'CVM'];
const N = SOURCES.length;
const EVERY = 1.2; // each source sends a packet this often (sim seconds)
const SPEED = 320; // px per sim second
const FAIL_AT = 4;
const LOST_FOR = 0.9;
const MOVED_AT = FAIL_AT + 1.2;
/** Loop lengths are multiples of 2 × EVERY, so the steady loop has no visible seam. */
const DURATION: Record<LinkFail, number> = { none: 7.2, one: 12 };

// ── geometry ──
const W = 960;
const H = 380;
// Three columns: the host (VMs, CVM, bridge br0, bond br0-up), the two NICs, the two switches.
const COLS = { host: { x: 12, w: 428 }, nic: { x: 464, w: 162 }, sw: { x: 680, w: 268 } };
const SRC = { x: 28, w: 150, h: 52 };
const srcY = (i: number) => 74 + i * 68;
const srcCY = (i: number) => srcY(i) + SRC.h / 2;
const BR = { x: 214, y: 64, w: 58, h: 276 };
const BX = BR.x + BR.w / 2;
const BOND = { x: 316, y: 64, w: 108, h: 276 };
const NIC = { x: 480, w: 130, h: 64 };
const nicY = (u: Uplink) => (u === 0 ? 100 : 228);
const nicCY = (u: Uplink) => nicY(u) + NIC.h / 2;
const SW = { x: 696, w: 236, h: 64 };
/** Example VLANs on the VM vNICs; the CVM is untagged. */
const VLAN = ['VLAN 10', 'VLAN 10', 'VLAN 20', 'untagged'];
const FIRST_LEG = BX - (SRC.x + SRC.w);

function route(src: number, u: Uplink): [number, number][] {
  const y = srcCY(src);
  const yu = nicCY(u);
  return [
    [SRC.x + SRC.w, y],
    [BX, y],
    [BX, yu],
    [NIC.x, yu],
    [NIC.x + NIC.w, yu],
    [SW.x, yu],
  ];
}

function length(pts: [number, number][]): number {
  return pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
}

function along(pts: [number, number][], d: number): [number, number] {
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= seg || i === pts.length - 1) {
      const f = seg ? Math.min(1, d / seg) : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
    }
    d -= seg;
  }
  return pts[pts.length - 1];
}

interface Pkt {
  key: string;
  src: number;
  /** When it leaves the VM or CVM. */
  e: number;
  pts: [number, number][];
  len: number;
  /** Set when the packet was on NIC A's link as it failed. */
  lost: boolean;
}

/** Every packet of one loop. Each source alternates between two connections (flows). */
function plan(bond: BondMode, fail: LinkFail): Pkt[] {
  const dur = DURATION[fail];
  const out: Pkt[] = [];
  for (let i = 0; i < N; i++)
    for (let k = -3; k * EVERY <= dur; k++) {
      const e = k * EVERY + (i * EVERY) / N;
      const flow = ((k % 2) + 2) % 2;
      const afterFail = fail === 'one' && e >= FAIL_AT;
      let u = uplinkFor(bond, i, flow, afterFail ? 'one' : 'none');
      let lost = false;
      if (fail === 'one' && !afterFail && u === 0) {
        const at = (FAIL_AT - e) * SPEED;
        // still on its way into the virtual switch: it simply goes out the other link
        if (at < FIRST_LEG) u = uplinkFor(bond, i, flow, 'one');
        else lost = at < length(route(i, 0));
      }
      const pts = route(i, u);
      out.push({ key: `${i}:${k}`, src: i, e, pts, len: length(pts), lost });
    }
  return out;
}

/** Each packet is a small labeled block naming its source (N2-009): VM1, VM2, VM3 or CVM. */
const PKT_LABEL = ['VM1', 'VM2', 'VM3', 'CVM'];
function Mark({ kind, x, y, cls, opacity }: { kind: number; x: number; y: number; r?: number; cls: string; opacity?: number }) {
  const w = 30;
  const h = 15;
  return (
    <g class={`${cls}${kind === 3 ? ' cvm' : ''}`} opacity={opacity}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={3} />
      <text x={x} y={y + 3.5} text-anchor="middle" class="net-pkt-t">
        {PKT_LABEL[kind]}
      </text>
    </g>
  );
}

const ROLE_WORD: Record<UplinkRole, string> = { active: 'active', standby: 'standby (backup)', carrying: 'in use', idle: 'idle', down: '✕ link down' };

function HostDiagram({ bond, fail, t, pkts }: { bond: BondMode; fail: LinkFail; t: number; pkts: Pkt[] }) {
  const now: LinkFail = fail === 'one' && t >= FAIL_AT ? 'one' : 'none';
  const role = (u: Uplink) => uplinkRole(bond, u, now, N);
  return (
    <svg
      class="diagram net-dia"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`One AHV host: VM 1 to 3 and the CVM send through the virtual switch and a ${BONDS[bond].short} bond of two links to switches A and B.${fail === 'one' ? ' Partway through, NIC A loses its link and all traffic moves to NIC B.' : ''}`}
    >
      {/* columns */}
      <rect x={COLS.host.x} y={12} width={COLS.host.w} height={356} class="frame" />
      <rect x={COLS.nic.x} y={12} width={COLS.nic.w} height={356} class="frame" />
      <rect x={COLS.sw.x} y={12} width={COLS.sw.w} height={356} class="frame" />
      <text x={SRC.x} y={40} class="d-title">
        One AHV host
      </text>
      <text x={BX} y={56} text-anchor="middle" class="d-sub muted">
        bridge
      </text>
      <text x={BOND.x + BOND.w / 2} y={40} text-anchor="middle" class="d-title mono">
        br0-up
      </text>
      <text x={BOND.x + BOND.w / 2} y={56} text-anchor="middle" class="d-sub muted">
        bond · tags VLANs
      </text>
      <text x={COLS.nic.x + COLS.nic.w / 2} y={40} text-anchor="middle" class="d-title">
        Physical NICs
      </text>
      <text x={COLS.sw.x + COLS.sw.w / 2} y={40} text-anchor="middle" class="d-title">
        Top-of-rack switches
      </text>

      {/* VMs and CVM */}
      {SOURCES.map((name, i) => {
        const cvm = name === 'CVM';
        return (
          <g key={name}>
            <line x1={SRC.x + SRC.w} y1={srcCY(i)} x2={BR.x} y2={srcCY(i)} class="net-link" />
            <rect x={SRC.x} y={srcY(i)} width={SRC.w} height={SRC.h} class={cvm ? 'cvm' : 'vm'} />
            <Mark kind={i} x={SRC.x + 24} y={srcCY(i)} r={7} cls="net-pkt" />
            <text x={SRC.x + 44} y={srcCY(i) - 2} class="d-title" style={cvm ? { fill: '#fff' } : undefined}>
              {name}
            </text>
            <text x={SRC.x + 44} y={srcCY(i) + 15} class="d-sub" style={cvm ? { fill: 'rgba(255,255,255,.9)' } : undefined}>
              {cvm ? 'storage · ' : 'vNIC · '}
              {VLAN[i]}
            </text>
          </g>
        );
      })}
      <rect x={BR.x} y={BR.y} width={BR.w} height={BR.h} class="net-br" />
      <text x={BX} y={40} text-anchor="middle" class="d-title mono">
        br0
      </text>

      {/* bond, links and switches */}
      <rect x={BOND.x} y={BOND.y} width={BOND.w} height={BOND.h} class="frame" />
      {bond === 'lacp' && (
        <g>
          <rect x={SW.x - 12} y={nicY(0) - 18} width={SW.w + 24} height={nicY(1) + NIC.h - nicY(0) + 36} class="net-lag" />
          <text x={SW.x + SW.w / 2} y={nicY(1) + NIC.h + 40} text-anchor="middle" class="d-label ink-text-fill">
            Switches set up as one LAG
          </text>
        </g>
      )}
      {([0, 1] as Uplink[]).map((u) => {
        const r = role(u);
        const down = r === 'down';
        const busy = r === 'active' || r === 'carrying';
        const y = nicCY(u);
        const letter = u === 0 ? 'A' : 'B';
        return (
          <g key={u}>
            <line x1={BR.x + BR.w} y1={y} x2={NIC.x} y2={y} class="net-link" />
            <line x1={NIC.x + NIC.w} y1={y} x2={SW.x} y2={y} class={`net-wire ${down ? 'down' : busy ? 'on' : 'wait'}`} />
            {down && (
              <text x={(NIC.x + NIC.w + SW.x) / 2} y={y - 12} text-anchor="middle" class="d-label bad-fill halo" style={{ fontWeight: 600 }}>
                ✕ link lost
              </text>
            )}
            <rect x={NIC.x} y={nicY(u)} width={NIC.w} height={NIC.h} class={down ? 'node-box down' : 'bg2'} stroke={down ? undefined : 'var(--line-2)'} />
            <text x={NIC.x + NIC.w / 2} y={nicY(u) + 19} text-anchor="middle" class="d-label" style={{ fontWeight: 600 }}>
              NIC {letter} · 10 Gb/s
            </text>
            <text x={NIC.x + NIC.w / 2} y={nicY(u) + 55} text-anchor="middle" class={`d-sub ${down ? 'bad-fill' : busy ? 'ok-text-fill' : 'muted'}`} style={{ fontWeight: 600 }}>
              {ROLE_WORD[r]}
            </text>
            <rect x={SW.x} y={y - SW.h / 2} width={SW.w} height={SW.h} class="bg3" stroke="var(--line-2)" />
            <text x={SW.x + SW.w / 2} y={y - 4} text-anchor="middle" class="d-title">
              Switch {letter}
            </text>
            <text x={SW.x + SW.w / 2} y={y + 16} text-anchor="middle" class="d-sub muted">
              trunk · VLANs 10, 20
            </text>
          </g>
        );
      })}

      {/* packets */}
      {pkts.map((p) => {
        if (p.lost) {
          if (t < FAIL_AT) {
            const d = (t - p.e) * SPEED;
            if (d < 0) return null;
            const [x, y] = along(p.pts, d);
            return <Mark key={p.key} kind={p.src} x={x} y={y} r={7} cls="net-pkt" />;
          }
          if (t > FAIL_AT + LOST_FOR) return null;
          const [x, y] = along(p.pts, (FAIL_AT - p.e) * SPEED);
          return <Mark key={p.key} kind={p.src} x={x} y={y} r={7} cls="net-pkt lost" opacity={1 - (t - FAIL_AT) / LOST_FOR} />;
        }
        const d = (t - p.e) * SPEED;
        if (d < 0 || d > p.len) return null;
        const [x, y] = along(p.pts, d);
        return <Mark key={p.key} kind={p.src} x={x} y={y} r={7} cls="net-pkt" />;
      })}
    </svg>
  );
}

const STEADY: Record<BondMode, { k: string; text: string }> = {
  ab: { k: 'Active-Backup uses one link', text: 'Everything from the VMs and the CVM leaves on NIC A. NIC B stays connected as the backup, and the switches need no special setup.' },
  slb: { k: 'Balance-SLB pins each VM', text: 'Each VM and the CVM is pinned to one link by its MAC address. Both links carry traffic, but any one VM uses only one link at a time.' },
  lacp: { k: 'LACP spreads connections', text: 'Each connection is spread over both links by its addresses and ports, so even one VM can use both. The two switches must be set up as one link group.' },
};

const MOVED: Record<BondMode, string> = {
  ab: 'NIC B takes over all traffic. VMs keep their addresses and networks; nothing changes inside them.',
  slb: 'The VMs pinned to NIC A move to NIC B. Everyone keeps working, now sharing one 10 Gb/s link.',
  lacp: 'Every connection now uses NIC B. Everything keeps working, with half the bandwidth until the link is back.',
};

export default function Network() {
  const [bond, setBond] = useEnum<BondMode>('bond', 'ab', BOND_ORDER);
  const [fail, setFail] = useEnum<LinkFail>('lf', 'none', ['none', 'one']);
  const pkts = useMemo(() => plan(bond, fail), [bond, fail]);
  // Both views are a walk-through. With no failure: send, pick a link, arrive. With a failure:
  // traffic flows, a link fails, traffic moves.
  const captions: { tone: Tone | 'ink'; k: string; text: string }[] =
    fail === 'none'
      ? [
          { tone: 'ink', k: 'VMs and the CVM send', text: 'Each VM sends ordinary frames from its vNIC. The VLAN is a setting on the vNIC; the CVM is untagged. All of it enters bridge br0.' },
          { tone: 'ink', ...STEADY[bond] },
          { tone: 'ink', k: 'Switches receive it', text: `Bond br0-up tags each frame with its VLAN, and the trunk ports on the switches carry it on. Switch setup needed: ${BONDS[bond].switchSetup === 'None' ? 'nothing special' : 'dynamic LACP and a link group'}.` },
        ]
      : [
          { tone: 'ink', ...STEADY[bond] },
          { tone: 'bad', k: 'NIC A loses its link', text: 'NIC A loses its link to switch A. The few packets on it are lost and sent again, and the bond stops using NIC A at once.' },
          { tone: 'ok', k: 'Traffic moves to NIC B', text: MOVED[bond] },
        ];
  const starts = fail === 'none' ? [0, 2.4, 4.8] : [0, FAIL_AT, MOVED_AT];
  const steps = paced(starts, captions.map((c) => [c.k, c.text]));
  const clock = useClock({ rate: 1, duration: DURATION[fail], hold: fail === 'none' ? 0 : undefined, keys: true, poster: fail === 'one' ? MOVED_AT + 3 : 3, steps });
  useRestartOn(clock, [bond, fail]);
  const t = clock.t;

  const phase = phaseAt(starts, t);
  const now: LinkFail = fail === 'one' && phase > 0 ? 'one' : 'none';
  const lim = limits(bond, now);
  const inUse = ([0, 1] as Uplink[]).filter((u) => ['active', 'carrying'].includes(uplinkRole(bond, u, now, N))).length;
  const caption = captions[phase];

  return (
    <Show clock={clock}
      top={
        <>
          <Choice<BondMode>
            label="Bond type"
            value={bond}
            onChange={setBond}
            why={bond === 'slb' ? 'Nutanix no longer recommends it (multicast issues).' : null}
            options={BOND_ORDER.map((m) => ({ value: m, label: BONDS[m].short, title: `Prism: ${BONDS[m].prism}` }))}
          />
          <Choice<LinkFail>
            label="Link failure"
            value={fail}
            onChange={setFail}
            options={[
              { value: 'none', label: 'None' },
              { value: 'one', label: 'One link fails' },
            ]}
          />
        </>
      }
      foot={
        <>
          <Follow tone={caption.tone} k={caption.k}>
            <p>{caption.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Links in use', v: `${inUse} of 2`, tone: now === 'one' ? 'warn' : undefined, sub: now === 'one' ? 'no spare left' : bond === 'ab' ? 'the other is the spare' : undefined },
              { k: 'Host can send', v: `${lim.host} Gb/s`, tip: 'With two 10 Gb/s links. Limits, not measurements.' },
              { k: 'One VM can use', v: `${lim.vm} Gb/s`, sub: bond === 'lacp' && now === 'none' ? 'one connection: 10 Gb/s' : undefined },
              { k: 'Switch setup', v: BONDS[bond].switchSetup, tip: bond === 'lacp' ? 'Dynamic LACP and a LAG, MLAG or vPC on the top-of-rack switches.' : 'Only trunk ports carrying the VLANs you use.' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <HostDiagram bond={bond} fail={fail} t={t} pkts={pkts} />
      </div>
      <Legend
        items={[
          { color: 'var(--flow)', label: 'Packet, labeled with its VM or the CVM' },
          { color: 'var(--s2)', label: 'Link in use' },
          ...(bond === 'ab' ? [{ color: 'var(--line-2)', dashed: true, label: 'Link waiting as the backup' }] : []),
          ...(bond === 'lacp' ? [{ color: 'var(--ink)', dashed: true, label: 'Link group (LAG) on the switches' }] : []),
          ...(fail === 'one' ? [{ color: 'var(--bad)', dashed: true, label: 'Failed link and the packets lost on it' }] : []),
        ]}
      />
      <PlayBar
        clock={clock}
        label="Network traffic animation"
        extra={<Illus why="One host shown; every host in the cluster is cabled the same way. VLAN numbers are examples. Packets are few and slow so you can follow them. Which link a VM or connection gets is a simplified hash: real Open vSwitch hashes by MAC address or by connection and rebalances by load. Bond behavior follows AHV 11.2 guidance and can differ by release and switch setup." />}
      />
    </Show>
  );
}
