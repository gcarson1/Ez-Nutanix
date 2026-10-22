// AHV Networking: pick a bond type and whether a link fails, and watch packets from three VMs and
// the CVM leave one host through its virtual switch and two-link bond to the top-of-rack
// switches, on a loop. Bond behavior lives in src/engine/ahvnet.ts; this file only animates it.
import { useMemo } from 'preact/hooks';
import { useEnum } from '../../../state/route';
import { paced, useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, PlayBar, type Tone } from '../../components/controls';
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
const SRC = { x: 32, w: 150, h: 52 };
const srcY = (i: number) => 74 + i * 68;
const srcCY = (i: number) => srcY(i) + SRC.h / 2;
const BR = { x: 228, y: 64, w: 120, h: 276 };
const BX = BR.x + BR.w / 2;
const BOND = { x: 384, y: 64, w: 176, h: 276 };
const NIC = { x: 400, w: 144, h: 64 };
const nicY = (u: Uplink) => (u === 0 ? 100 : 228);
const nicCY = (u: Uplink) => nicY(u) + NIC.h / 2;
const SW = { x: 700, w: 230, h: 64 };
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

/** The small shape that marks each source and its packets. */
function Mark({ kind, x, y, r, cls, opacity }: { kind: number; x: number; y: number; r: number; cls: string; opacity?: number }) {
  if (kind === 0) return <circle class={cls} cx={x} cy={y} r={r} opacity={opacity} />;
  if (kind === 1) return <rect class={cls} x={x - r * 0.85} y={y - r * 0.85} width={r * 1.7} height={r * 1.7} opacity={opacity} />;
  const pts = kind === 2 ? [[0, -1.15], [1.05, 0.75], [-1.05, 0.75]] : [[0, -1.2], [1.2, 0], [0, 1.2], [-1.2, 0]];
  return <polygon class={cls} points={pts.map(([px, py]) => `${(x + px * r).toFixed(1)},${(y + py * r).toFixed(1)}`).join(' ')} opacity={opacity} />;
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
      {/* host */}
      <rect x={12} y={12} width={564} height={356} class="frame" />
      <text x={28} y={40} class="net-t">
        One AHV host
      </text>
      <text x={BX} y={40} text-anchor="middle" class="net-t">
        Virtual switch
      </text>
      <text x={BX} y={56} text-anchor="middle" class="net-xs muted">
        Open vSwitch
      </text>
      <text x={BOND.x + BOND.w / 2} y={40} text-anchor="middle" class="net-t">
        Bond
      </text>
      <text x={BOND.x + BOND.w / 2} y={56} text-anchor="middle" class="net-xs muted">
        two links act as one
      </text>

      {/* VMs and CVM */}
      {SOURCES.map((name, i) => {
        const cvm = name === 'CVM';
        return (
          <g key={name}>
            <line x1={SRC.x + SRC.w} y1={srcCY(i)} x2={BR.x} y2={srcCY(i)} class="net-link" />
            <rect x={SRC.x} y={srcY(i)} width={SRC.w} height={SRC.h} class={cvm ? 'cvm' : 'vm'} />
            <Mark kind={i} x={SRC.x + 24} y={srcCY(i)} r={7} cls="net-pkt" />
            <text x={SRC.x + 44} y={srcCY(i) + (cvm ? -2 : 5)} class="net-t" style={cvm ? { fill: '#fff' } : undefined}>
              {name}
            </text>
            {cvm && (
              <text x={SRC.x + 44} y={srcCY(i) + 14} class="net-xs" style={{ fill: 'rgba(255,255,255,.85)' }}>
                runs the storage
              </text>
            )}
          </g>
        );
      })}
      <rect x={BR.x} y={BR.y} width={BR.w} height={BR.h} class="net-br" />

      {/* bond, links and switches */}
      <rect x={BOND.x} y={BOND.y} width={BOND.w} height={BOND.h} class="frame-dash" />
      {bond === 'lacp' && (
        <g>
          <rect x={SW.x - 14} y={nicY(0) - 18} width={SW.w + 28} height={nicY(1) + NIC.h - nicY(0) + 36} class="net-lag" />
          <text x={SW.x + SW.w / 2} y={nicY(1) + NIC.h + 40} text-anchor="middle" class="net-s ink-text-fill">
            Both switches set up as one link group (LAG)
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
              <text x={(NIC.x + NIC.w + SW.x) / 2} y={y - 12} text-anchor="middle" class="net-s bad-fill halo" style={{ fontWeight: 600 }}>
                ✕ link lost
              </text>
            )}
            <rect x={NIC.x} y={nicY(u)} width={NIC.w} height={NIC.h} class={down ? 'node-box down' : 'bg2'} stroke={down ? undefined : 'var(--line-2)'} />
            <text x={NIC.x + NIC.w / 2} y={nicY(u) + 19} text-anchor="middle" class="net-s" style={{ fontWeight: 600 }}>
              NIC {letter} · 10 Gb/s
            </text>
            <text x={NIC.x + NIC.w / 2} y={nicY(u) + 55} text-anchor="middle" class={`net-xs ${down ? 'bad-fill' : busy ? 'ok-text-fill' : 'muted'}`} style={{ fontWeight: 600 }}>
              {ROLE_WORD[r]}
            </text>
            <rect x={SW.x} y={y - SW.h / 2} width={SW.w} height={SW.h} class="bg3" stroke="var(--line-2)" />
            <text x={SW.x + SW.w / 2} y={y - 4} text-anchor="middle" class="net-t">
              Switch {letter}
            </text>
            <text x={SW.x + SW.w / 2} y={y + 16} text-anchor="middle" class="net-xs muted">
              top of rack
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
  ab: { k: 'Active-backup', text: 'Everything from the VMs and the CVM leaves on NIC A. NIC B stays connected as the backup, and the switches need no special setup.' },
  slb: { k: 'Balance-SLB (MAC pinning)', text: 'Each VM and the CVM is pinned to one link by its MAC address. Both links carry traffic, but any one VM uses only one link at a time.' },
  lacp: { k: 'LACP', text: 'Each connection is spread over both links by its addresses and ports, so even one VM can use both. The two switches must be set up as one link group.' },
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
  const captions: { tone: Tone | 'ink'; k: string; text: string }[] = [
    { tone: 'ink' as const, ...STEADY[bond] },
    { tone: 'bad' as const, k: 'Link A fails', text: 'NIC A loses its link to switch A. The few packets on it are lost and sent again, and the bond stops using NIC A at once.' },
    { tone: 'ok' as const, k: 'Still connected, on one link', text: MOVED[bond] },
  ];
  // With both links up the loop is seamless, so its one caption needs no slowing down.
  const starts = [0, FAIL_AT, MOVED_AT];
  const steps = fail === 'none' ? undefined : paced(starts, captions.map((c) => [c.k, c.text]));
  const clock = useClock({ rate: 1, duration: DURATION[fail], hold: fail === 'none' ? 0 : undefined, keys: true, poster: fail === 'one' ? MOVED_AT + 3 : 3, steps });
  useRestartOn(clock, [bond, fail]);
  const t = clock.t;

  const phase = fail === 'none' ? 0 : phaseAt(starts, t);
  const now: LinkFail = phase > 0 ? 'one' : 'none';
  const lim = limits(bond, now);
  const inUse = ([0, 1] as Uplink[]).filter((u) => ['active', 'carrying'].includes(uplinkRole(bond, u, now, N))).length;
  const caption = captions[phase];

  return (
    <Show
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
      <PlayBar
        clock={clock}
        label="Network traffic animation"
        fmt={() => ['Both links up', 'Link fails', 'On one link'][phase]}
        extra={<Illus why="One host shown; every host in the cluster is cabled the same way. Which link a VM or connection gets is a simplified hash: real Open vSwitch hashes by MAC address or by connection and rebalances by load. Bond behavior follows AHV 11.2 guidance and can differ by release and switch setup." />}
      />
    </Show>
  );
}
