// Legacy vs Nutanix HCI: a three-tier design (servers on top-of-rack Ethernet switches, a Fibre
// Channel SAN and a dual-controller array, each tier run from its own console) and all that adding a
// host touches; then the tiers fold into one node on top-of-rack switches (one bar, drawn throughout),
// nodes join into a cluster with one storage pool and one Prism, data rebalances onto each new node,
// and storage controllers grow with the node count while the array keeps two. Every claim is checked in docs/facts.md section 14.
import './style.css';
import { paced, useClock } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Kpis, Points, Show, ease, flowDots, pathLength, phaseAt, prog, type Point } from '../../components/show';

const P = [0, 3.4, 6.8, 10.6, 14.0, 17.4, 21.2, 24.0, 26.4, 29.6];
const END = 32.8;

const PHASES = ['Three tiers', 'A console per tier', 'Adding a host', 'Three tiers, one node', 'Inside a node', 'Three nodes, one cluster', 'Adding a node', 'Data rebalances', 'Growing node by node', 'Controllers grow with it'];
const CAPTIONS = [
  'A traditional design runs three tiers: servers for compute on top-of-rack Ethernet switches, a separate storage network of two Fibre Channel switches, and a storage array with two controllers, LUNs and shelves of drives.',
  'Each tier is run on its own: a server console for hosts and VMs, a SAN console for the switches, and an array console for LUNs. Fibre Channel takes specialist skills.',
  'Adding a host touches every tier: cable its HBAs to both switches, zone it on each fabric, mask the array’s LUNs to it, then rescan its storage.',
  'Hyperconverged infrastructure folds the tiers into each server: the array’s controllers become software, the Controller VM (CVM), the drives move inside and three consoles become one, Prism.',
  'A node is a standard x86 server with local NVMe or SSD drives. It runs the AHV hypervisor, your VMs and its CVM, which owns the drives and serves the VMs’ storage.',
  'Three nodes on top-of-rack Ethernet switches make the smallest standard cluster. Their CVMs work as one Distributed Storage Fabric: a single storage pool across every node’s drives, with each write kept on two nodes.',
  'Need more? Add a node to the running cluster from Prism. It brings compute, drives and its own CVM, and the storage pool grows. No LUNs to mask, no fabric to zone.',
  'Once nodes are unevenly full, disk balancing evens them out in the background: Curator moves data onto the new node’s drives, with no migration project.',
  'Keep adding nodes, one or several at a time, as you grow. Each can lean toward drives or toward CPU and memory, and it stays one cluster with one storage pool and one Prism.',
  'Every node brings its own storage controller, so 5 nodes run 5 CVMs, while a 3-tier array keeps its 2 controllers however many hosts share them. Each CVM reserves some of its node’s CPU and memory, sized for the features you use.',
];

const POINTS: Point[] = [
  { k: 'Less to run', by: 'No SAN, no array', text: 'Compute and storage come in the same servers, so there is no separate storage network or array to cable, zone and manage.', tone: 'ink', at: P[3] },
  { k: 'One place to manage', by: 'Prism', text: 'VMs, storage and upgrades for the whole cluster in one console, instead of one per tier.', tone: 'ok', at: P[5] },
  { k: 'Grow a node at a time', by: 'Expand Cluster', text: 'Start with three nodes and add more as you need them; each brings compute, drives and its own controller.', tone: 'flow', at: P[6] },
];

// ── timeline (sim seconds) ──
const HOST_IN = [0.2, 0.5, 0.8, 7.0]; // host 4 is the one being added
const CABLE_IN = [1.8, 1.8, 1.8, 7.5];
const CON_IN = [3.6, 4.4, 5.2]; // server, SAN and array consoles
/** Adding host 4: when each console's task starts (server, SAN, array), numbered in the order they happen. */
const TASK = [
  { at: 9.6, n: 3 }, // rescan its storage
  { at: 8.0, n: 1 }, // zone it on both fabrics
  { at: 8.8, n: 2 }, // mask the LUNs to it
];
const TASK_LEN = 0.8;
const H4_VMS = 10.0;
const FOLD = 10.8; // the tiers start folding into one node
const FOLDED = 13.0; // the last drive is in
/** Cluster nodes: when each slides in, links up, joins the storage pool and gets its VMs. Node 1 is the folded host. */
const NODES = [
  { in: 0, link: 19.4, pool: 19.8, vms: 0 },
  { in: 18.4, link: 19.4, pool: 19.8, vms: 0 },
  { in: 18.8, link: 19.4, pool: 19.8, vms: 0 },
  { in: 21.4, link: 22.0, pool: 22.4, vms: 23.2 },
  { in: 26.6, link: 27.2, pool: 27.6, vms: 28.4 },
];
/** Copies start flowing to a node once the pool reaches it. */
const COPY_AT = NODES.map((n) => n.pool + 0.8);
/** Disk balancing after each join: data moves from the fuller nodes onto node `to`. */
const BAL = [
  { at: 24.0, len: 2.0, to: 3 },
  { at: 28.6, len: 1.0, to: 4 },
];
/** How full each node's drives look: the same data over 3, then 4, then 5 nodes (illustrative). */
function fillAt(i: number, t: number): number {
  const [b1, b2] = BAL.map((b) => ease(prog(t, b.at, b.at + b.len)));
  const [on3, on4, on5] = [0.72, 0.54, 0.432];
  if (i < 3) return lerp(lerp(on3, on4, b1), on5, b2);
  if (i === 3) return lerp(lerp(0, on4, b1), on5, b2);
  return lerp(0, on5, b2);
}

// ── geometry ──
const W = 720;
const H = 364;
/** Room left of the drawing for the 3-tier labels (COMPUTE, NETWORKING, STORAGE). */
const GUT = 170;
type R = { x: number; y: number; w: number; h: number };
type Pt = [number, number];
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpR = (a: R, b: R, k: number): R => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });
const box = (r: R) => ({ x: r.x, y: r.y, width: r.w, height: r.h });
const pts = (p: Pt[]) => p.map(([x, y]) => `${x},${y}`).join(' ');

// consoles, and Prism, which they become
const con = (j: number): R => ({ x: 244 * j, y: 0, w: 232, h: 30 });
const PRISM: R = { x: 0, y: 0, w: W, h: 30 };
const CON = [
  { t: 'Server console', s: 'hosts · VMs' },
  { t: 'SAN console', s: 'switches · zoning' },
  { t: 'Array console', s: 'LUNs · masking' },
];
/** The tier each console runs, outlined as the console arrives and labeled on the left. */
const TIER_L = ['Compute', 'Networking', 'Storage'];
const TIER: R[] = [
  { x: 1, y: 78, w: W - 2, h: 96 },
  { x: 34, y: 192, w: 652, h: 36 },
  { x: 34, y: 244, w: 652, h: 119 },
];

// 3-tier: hosts under the top-of-rack switches, two SAN switches, one array
const CW = 171;
const CH = 84;
const HOST_Y = 84;
function hostGeom(i: number, dx = 0, dy = 0) {
  const x = 183 * i + dx;
  const y = HOST_Y + dy;
  const r = (a: number, b: number, w: number, h: number): R => ({ x: x + a, y: y + b, w, h });
  return { frame: r(0, 0, CW, CH), vms: [10, 52, 94].map((a) => r(a, 26, 34, 18)), hv: r(10, 52, CW - 20, 16), hba: [CW - 62, CW - 34].map((a) => r(a, 74, 24, 8)) };
}
type HostGeom = ReturnType<typeof hostGeom>;
/** Where a host's cable to fabric f leaves its HBA. */
const port = (g: HostGeom, f: number): Pt => [g.hba[f].x + 12, g.hba[f].y + 8];
const SW_X = [40, 388];
const SW_W = 292;
const SW_Y = 198;
const SW_H = 24;
/** Where host i's cable lands on switch f. */
const swTop = (f: number, i: number): Pt => [(f ? 418 : 70) + 72 * i, SW_Y];
/** Each fabric's cables to controllers A and B: [x on the switch, x on the controller]. */
const UPLINK = [
  [[110, 150], [262, 440]],
  [[458, 280], [610, 570]],
];
const ARR: R = { x: 40, y: 250, w: 640, h: 112 };
const CTL: R[] = [
  { x: 54, y: 260, w: 300, h: 24 },
  { x: 366, y: 260, w: 300, h: 24 },
];
const lun = (k: number): R => ({ x: 54 + 64 * k, y: 292, w: 56, h: 18 });
const SHELF: R[] = [
  { x: 54, y: 318, w: 300, h: 18 },
  { x: 366, y: 318, w: 300, h: 18 },
];
const shelfDrive = (s: number, k: number): R => ({ x: SHELF[s].x + 8 + 29 * k, y: SHELF[s].y + 4, w: 22, h: 10 });
/** The drives that move into the node: the first two of each shelf. */
const MOVING = [shelfDrive(0, 0), shelfDrive(0, 1), shelfDrive(1, 0), shelfDrive(1, 1)];
/** A storage path: host port, through its switch, to a controller (host i uses fabric and controller i % 2). */
function sanPath(g: HostGeom, i: number, f = i % 2, c = i % 2): Pt[] {
  const [sx, cx] = UPLINK[f][c];
  return [port(g, f), swTop(f, i), [sx, SW_Y + SW_H], [cx, CTL[c].y]];
}

// the top-of-rack switches (one bar for the redundant pair), which both designs use, then the node and the cluster
const NW = 134.4;
const NH = 150;
const TOR: R = { x: 0, y: 38, w: W, h: 30 };
/** Data crosses the switches in a lane under their label. */
const TOR_LANE = TOR.y + 23;
const NODE_Y = 84;
const nx = (i: number) => i * (NW + 12);
/** A node's uplink runs up its right edge, clear of the VMs. */
const UP = NW - 5;
/** Where a host's or node's uplink to the top-of-rack switches leaves its frame. */
const upX = (r: R) => r.x + r.w * (UP / NW);
const BIG = { x: 96, y: NODE_Y, s: 1.6 }; // the one node, before the cluster

/** Every part of a node at (ox, oy), scaled by s; the morph, the big node and the cluster all use it. */
function nodeGeom(ox: number, oy: number, s: number) {
  const r = (x: number, y: number, w: number, h: number): R => ({ x: ox + x * s, y: oy + y * s, w: w * s, h: h * s });
  return {
    frame: r(0, 0, NW, NH),
    vms: [10, 51, 92].map((x) => r(x, 26, 32, 20)),
    cvm: r(10, 54, NW - 20, 20),
    ahv: r(10, 80, NW - 20, 18),
    drives: [0, 1, 2, 3].map((d) => r(10 + d * 29.6, 108, 24, 14)),
    pt: (x: number, y: number): Pt => [ox + x * s, oy + y * s],
    fs: (n: number) => n * s,
  };
}
type NodeGeom = ReturnType<typeof nodeGeom>;
/** Passthrough from the drives up the node's right edge to the CVM, and a VM's I/O along it (node-local). */
const PASS: Pt[] = [[122.8, 115], [129.4, 115], [129.4, 64]];
const LOCAL: Pt[] = [[108, 46], [108, 64], [129.4, 64], [129.4, 115], [122.8, 115]];
/** Data from node i's CVM, up its uplink, across the top-of-rack switches and down into node j's drives. */
function copyPath(i: number, j: number): Pt[] {
  const a = nx(i) + UP;
  const b = nx(j) + UP;
  return [[nx(i) + NW - 10, NODE_Y + 64], [a, NODE_Y + 64], [a, TOR_LANE], [b, TOR_LANE], [b, NODE_Y + 115], [nx(j) + NW - 10, NODE_Y + 115]];
}

const NOTES = [
  { y: 190, was: 'Array controllers', now: 'the CVM, in software', at: 14.2, lead: true },
  { y: 230, was: 'Server tier', now: 'the same x86 server, with AHV', at: 14.8, lead: true },
  { y: 272, was: 'Drive shelves', now: 'NVMe or SSD drives inside', at: 15.4, lead: true },
  { y: 314, was: 'SAN and HBAs', now: 'none; nodes use top-of-rack Ethernet', at: 16.0, lead: false },
];

// shortcut: Enterprise AI has its own along(); move both into show.tsx.
/** A point a fraction f of the way along a polyline. */
function along(p: Pt[], f: number): Pt {
  const seg = p.slice(1).map((q, i) => Math.hypot(q[0] - p[i][0], q[1] - p[i][1]));
  let d = f * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const r = seg[i] ? Math.min(1, d / seg[i]) : 0;
      return [p[i][0] + (p[i + 1][0] - p[i][0]) * r, p[i][1] + (p[i + 1][1] - p[i][1]) * r];
    }
    d -= seg[i];
  }
  return p[p.length - 1];
}

/** Dots looping along a polyline at the shared calm speed. */
function Dots({ path, t, o = 1 }: { path: Pt[]; t: number; o?: number }) {
  return (
    <>
      {flowDots(t, pathLength((f) => along(path, f))).map((f, k) => {
        const [x, y] = along(path, f);
        return <circle key={k} cx={x} cy={y} r={4} class="hci-io" style={{ opacity: o }} />;
      })}
    </>
  );
}

function Vm({ r, fs }: { r: R; fs: number }) {
  return (
    <>
      <rect {...box(r)} class="vm" />
      <text x={r.x + r.w / 2} y={r.y + r.h / 2 + fs * 0.36} text-anchor="middle" class="muted" style={{ fontSize: `${fs}px` }}>
        VM
      </text>
    </>
  );
}

function Hba({ g }: { g: HostGeom }) {
  return (
    <>
      {g.hba.map((h, f) => (
        <rect key={f} {...box(h)} rx={1.5} class="hci-hba" />
      ))}
      <text x={g.frame.x + 10} y={g.frame.y + 81} class="faint d-fine">
        HBAs
      </text>
    </>
  );
}

const HostHead = ({ r, i, o }: { r: R; i: number; o?: number }) => (
  <text class="d-label" x={r.x + 10} y={r.y + 18} style={{ fontWeight: 600, opacity: o }}>
    Host {i + 1}
  </text>
);
const HvLabel = ({ r, o }: { r: R; o?: number }) => (
  <text x={r.x + 8} y={r.y + 12} class="muted d-fine" style={{ opacity: o }}>
    hypervisor
  </text>
);
const CtlLabel = ({ r, c, o }: { r: R; c: number; o?: number }) => (
  <text x={r.x + r.w / 2} y={r.y + 16} text-anchor="middle" class="hci-on-ink d-sub" style={{ fontWeight: 600, opacity: o }}>
    Controller {c ? 'B' : 'A'}
  </text>
);

/** A 3-tier host. Host 1 is drawn the same way by NodeBody once the fold starts, so nothing blinks. */
function Host({ g, i, sel, vms, note }: { g: HostGeom; i: number; sel: boolean; vms: number; note?: string }) {
  return (
    <>
      <rect {...box(g.frame)} class={`node-box${sel ? ' sel' : ''}`} />
      <Hba g={g} />
      <HostHead r={g.frame} i={i} />
      {note && (
        <text x={g.frame.x + CW - 10} y={g.frame.y + 18} text-anchor="end" class="mono muted d-sub">
          {note}
        </text>
      )}
      {vms > 0 && (
        <g style={{ opacity: vms }}>
          {g.vms.map((v, j) => (
            <Vm key={j} r={v} fs={11} />
          ))}
        </g>
      )}
      <rect {...box(g.hv)} class="bg3" />
      <HvLabel r={g.hv} />
    </>
  );
}

/** How far host 1's parts have come on their way into the node (0..1), and how much of its SAN side is left. */
interface Fold {
  host: number;
  ctl: number;
  san: number;
  src: HostGeom;
}

const fadeOut = (k: number) => 1 - prog(k, 0, 0.3); // a 3-tier label fades as its part starts to move
const fadeIn = (k: number) => prog(k, 0.7, 1); // the node's label fades in as the part arrives

/** A node's box, VMs, CVM and AHV (its drives are drawn later, over the storage pool). */
function NodeBody({ g, n, sel, vms = 1, fold }: { g: NodeGeom; n: number; sel?: boolean; vms?: number; fold?: Fold }) {
  const kh = fold ? fold.host : 1;
  const kc = fold ? fold.ctl : 1;
  const frame = fold ? lerpR(fold.src.frame, g.frame, ease(kh)) : g.frame;
  const vmR = fold ? g.vms.map((v, j) => lerpR(fold.src.vms[j], v, ease(kh))) : g.vms;
  const hv = fold ? lerpR(fold.src.hv, g.ahv, ease(kh)) : g.ahv;
  const ctl = fold ? CTL.map((c) => lerpR(c, g.cvm, ease(kc))) : [g.cvm];
  const head = g.pt(10, 18);
  const cvmAt = g.pt(18, 68);
  const ahvAt = g.pt(18, 93);
  return (
    <>
      <rect {...box(frame)} class={`node-box${sel ? ' sel' : ''}`} />
      {fold && fold.san > 0 && (
        <g style={{ opacity: fold.san }}>
          <Hba g={fold.src} />
        </g>
      )}
      {fold && fadeOut(kh) > 0 && <HostHead r={frame} i={0} o={fadeOut(kh)} />}
      {fadeIn(kh) > 0 && (
        <text x={head[0]} y={head[1]} style={{ fontSize: `${g.fs(13)}px`, fontWeight: 600, opacity: fadeIn(kh) }}>
          Node {n}
        </text>
      )}
      {vms > 0 && (
        <g style={{ opacity: vms }}>
          {vmR.map((v, j) => (
            <Vm key={j} r={v} fs={lerp(11, g.fs(11), ease(kh))} />
          ))}
        </g>
      )}
      <rect {...box(hv)} class="bg3" />
      {fold && fadeOut(kh) > 0 && <HvLabel r={hv} o={fadeOut(kh)} />}
      {fadeIn(kh) > 0 && (
        <text x={ahvAt[0]} y={ahvAt[1]} style={{ fontSize: `${g.fs(11.5)}px`, fontWeight: 600, opacity: fadeIn(kh) }}>
          AHV
        </text>
      )}
      {ctl.map((c, j) => (
        <rect key={j} {...box(c)} class="cvm" />
      ))}
      {fold && fadeOut(kc) > 0 && ctl.map((c, j) => <CtlLabel key={j} r={c} c={j} o={fadeOut(kc)} />)}
      {fadeIn(kc) > 0 && (
        <text x={cvmAt[0]} y={cvmAt[1]} class="hci-on-ink" style={{ fontSize: `${g.fs(11.5)}px`, fontWeight: 600, opacity: fadeIn(kc) }}>
          CVM
        </text>
      )}
    </>
  );
}

/**
 * A node's drives; while host 1 folds, `fold` (0..1) is how far they have come from the array's shelves.
 * `label` fades the drive-type label (it goes once the storage pool's own label takes over), and
 * `used` (0..1) fills each drive from the bottom to show how full it is.
 */
function Drives({ g, fold, label = 1, used }: { g: NodeGeom; fold?: number; label?: number; used?: number }) {
  const k = fold ?? 1;
  const at = g.pt(10, 140);
  return (
    <>
      {g.drives.map((d, j) => (
        <rect key={j} {...box(fold === undefined ? d : lerpR(MOVING[j], d, ease(k)))} class="disk" />
      ))}
      {used !== undefined && used > 0 && g.drives.map((d, j) => <rect key={`u${j}`} x={d.x + 2} y={d.y + d.h - 2 - (d.h - 4) * used} width={d.w - 4} height={(d.h - 4) * used} class="hci-used" />)}
      {fadeIn(k) * label > 0 && (
        <text x={at[0]} y={at[1]} class="faint" style={{ fontSize: `${g.fs(11)}px`, opacity: fadeIn(k) * label }}>
          NVMe / SSD
        </text>
      )}
    </>
  );
}

/** Storage controllers side by side: one CVM per node in the cluster, against the array's fixed pair. */
function Controllers({ n, o, hl }: { n: number; o: number; hl: boolean }) {
  const y = 318;
  const row = (dy: number, label: string, count: number, note: string) => (
    <g>
      <text x={2} y={y + dy + 11} class={`${hl ? undefined : 'muted'} d-sub`} style={{ fontWeight: hl ? 600 : undefined }}>
        {label}
      </text>
      {Array.from({ length: count }, (_, k) => (
        <rect key={k} x={118 + k * 20} y={y + dy} width={14} height={14} class="cvm" />
      ))}
      <text x={118 + count * 20 + 6} y={y + dy + 11} class="mono d-sub">
        {count} <tspan class="muted">{note}</tspan>
      </text>
    </g>
  );
  return (
    <g style={{ opacity: o }}>
      <text x={2} y={y - 8} class="muted d-fine">
        Storage controllers
      </text>
      {row(0, 'Nutanix cluster', n, 'one CVM per node')}
      {row(20, '3-tier array', 2, 'however many hosts share them')}
    </g>
  );
}

function HciDiagram({ t }: { t: number }) {
  const phase = phaseAt(P, t);
  const tiers = t < FOLD; // before the fold, host 1, the controllers and the shelf drives belong to the 3-tier scene
  const out = (a: number, len: number) => 1 - prog(t, a, a + len);
  // the fold: 3-tier parts fade or fly into the node
  const sanOut = out(FOLD, 0.8);
  const hostOut = out(FOLD, 0.6);
  const arrOut = out(11.6, 1.0);
  const prismK = prog(t, 11.8, 13.2);
  const fold: Fold | undefined = t < FOLDED ? { host: prog(t, 11.0, 12.4), ctl: prog(t, 11.4, 12.8), san: sanOut, src: hostGeom(0) } : undefined;
  const drvK = prog(t, 11.6, FOLDED);

  const hostK = HOST_IN.map((a) => prog(t, a, a + 0.5));
  const hosts = hostK.map((k, i) => (i < 3 ? hostGeom(i, 0, -14 * (1 - ease(k))) : hostGeom(i, 40 * (1 - ease(k)))));
  const retract = 1 - ease(prog(t, FOLD, FOLD + 0.8));
  const cable = CABLE_IN.map((a, i) => Math.min(ease(prog(t, a, a + (i < 3 ? 0.8 : 0.5))), retract));
  const uplink = Math.min(ease(prog(t, 2.2, 2.8)), retract);
  const sw = prog(t, 1.0, 1.5) * sanOut;
  const arr = prog(t, 1.3, 1.9) * arrOut;
  const zoning = t >= TASK[1].at && t < TASK[1].at + TASK_LEN;
  const zone = prog(t, TASK[1].at, TASK[1].at + 0.3) * out(TASK[1].at + TASK_LEN, 0.3);
  const sanFlow = prog(t, 2.8, 3.1) * out(FOLD, 0.3);

  // the single node, then node 1 of the cluster
  const shrink = ease(prog(t, 17.6, 18.6));
  const nodes = NODES.map((nd, i) => {
    const k = i === 0 ? 1 : prog(t, nd.in, nd.in + 0.6);
    const g = i === 0 ? nodeGeom(lerp(BIG.x, nx(0), shrink), lerp(BIG.y, NODE_Y, shrink), lerp(BIG.s, 1, shrink)) : nodeGeom(nx(i) + 40 * (1 - ease(k)), NODE_Y, 1);
    return { k, g };
  });
  const present = nodes.filter((n) => n.k > 0).length;
  const passDraw = prog(t, FOLDED, FOLDED + 0.6);
  const passOut = out(P[5], 0.4);
  const slots = prog(t, 18.6, 19.0);
  const firstEmpty = nodes.findIndex((n, i) => i >= 3 && n.k <= 0);
  const net = ease(prog(t, 19.4, 20.0));
  const tor = ease(prog(t, 0, 0.5));
  // host 1's uplink stays with it as it folds into the node; hosts 2-4 fade with their tier
  const upK = HOST_IN.map((a) => ease(prog(t, a + 0.5, a + 0.9)));
  const frame1 = tiers ? hosts[0].frame : fold ? lerpR(fold.src.frame, nodes[0].g.frame, ease(fold.host)) : nodes[0].g.frame;
  // the pool stretches over to each node as it joins: 3 nodes first, then 4 and 5
  let pool = 0;
  for (const [i, nd] of [[2, NODES[0]], [3, NODES[3]], [4, NODES[4]]] as const) pool += (nx(i) + NW - pool) * ease(prog(t, nd.pool, nd.pool + 0.8));
  const inPool = NODES.filter((nd) => t >= nd.pool).length;
  const linked = NODES.filter((nd) => t >= nd.link).length;
  const copies = COPY_AT.filter((a) => t >= a).length;
  const joining = NODES.findIndex((nd, i) => i >= 3 && t >= nd.in && t < nd.vms + 0.4);

  return (
    <svg
      class="diagram hci-dia"
      viewBox={`${-GUT} 0 ${W + GUT} ${H}`}
      role="img"
      aria-label={
        phase < 3
          ? `Three-tier design: ${hostK[3] > 0 ? 4 : 3} hosts on top-of-rack Ethernet switches, each also cabled to two Fibre Channel SAN switches, which connect to a storage array with two controllers, LUNs and drive shelves. Three separate consoles manage them.`
          : phase < 5
            ? 'One Nutanix node on top-of-rack Ethernet switches: an x86 server running AHV, VMs and a Controller VM that owns the local NVMe or SSD drives and serves the VMs’ storage. One console, Prism, replaces the three.'
            : `A ${Math.max(3, present)}-node Nutanix cluster on top-of-rack Ethernet switches, managed by one Prism: the CVMs pool every node’s drives into one storage pool, each write is kept on two nodes, and there are ${Math.max(3, linked)} storage controllers against a 3-tier array’s 2.${phase === 7 ? ' Data moves onto the new node’s drives.' : ''}`
      }
    >
      {/* each tier labeled on the left as it appears, until the tiers fold into one node */}
      {TIER.map((r, j) => {
        const o = prog(t, [0, 1.0, 1.3][j], [0, 1.0, 1.3][j] + 0.5) * out(FOLD, 0.6);
        return (
          o > 0 && (
            <text key={j} x={-20} y={r.y + r.h / 2 + 7} text-anchor="end" class="hci-tier-l" style={{ opacity: o }}>
              {TIER_L[j]}
            </text>
          )
        );
      })}

      {/* each tier outlined as its console arrives */}
      {TIER.map((r, j) => {
        const o = prog(t, CON_IN[j], CON_IN[j] + 0.3) * out(CON_IN[j] + 1.0, 0.3);
        return o > 0 && <rect key={j} {...box(r)} rx={8} class="hci-focus" style={{ opacity: o }} />;
      })}

      {/* Fibre Channel cabling, host 4's zoning, and storage traffic (it disappears into the switches) */}
      {hosts.map((g, i) =>
        cable[i] > 0
          ? [0, 1].map((f) => {
              const [x1, y1] = port(g, f);
              const [x2, y2] = swTop(f, i);
              return <line key={`${i}-${f}`} x1={x1} y1={y1} x2={lerp(x1, x2, cable[i])} y2={lerp(y1, y2, cable[i])} class="hci-fc" />;
            })
          : null,
      )}
      {uplink > 0 &&
        UPLINK.map((f) =>
          f.map(([sx, cx], c) => <line key={sx} x1={sx} y1={SW_Y + SW_H} x2={lerp(sx, cx, uplink)} y2={lerp(SW_Y + SW_H, CTL[c].y, uplink)} class="hci-fc" />),
        )}
      {zone > 0 && (
        <g style={{ opacity: zone }}>
          {[0, 1].map((f) => [0, 1].map((c) => <polyline key={`${f}-${c}`} points={pts(sanPath(hosts[3], 3, f, c))} class="hci-zone" />))}
        </g>
      )}
      {sanFlow > 0 && [0, 1, 2].map((i) => <Dots key={i} path={sanPath(hosts[i], i)} t={t + i * 1.9} o={sanFlow} />)}

      {/* hosts */}
      {hosts.map((g, i) => {
        if (i === 0 && !tiers) return null; // host 1 is folding into the node, drawn with it below
        const o = hostK[i] * (i === 0 ? 1 : hostOut);
        if (o <= 0)
          return (
            i === 3 &&
            tiers && (
              <g key={i} style={{ opacity: hostK[2] }}>
                <rect {...box(hostGeom(3).frame)} rx={6} class="frame-dash" />
                <text x={hostGeom(3).frame.x + CW / 2} y={HOST_Y + CH / 2 + 4} text-anchor="middle" class="faint d-sub">
                  room for another host
                </text>
              </g>
            )
          );
        return (
          <g key={i} style={{ opacity: o }}>
            <Host g={g} i={i} sel={i === 3} vms={i === 3 ? prog(t, H4_VMS, H4_VMS + 0.4) : 1} note={i === 3 && t >= TASK[0].at && t < TASK[0].at + TASK_LEN ? 'rescanning…' : undefined} />
          </g>
        );
      })}

      {/* SAN switches */}
      {sw > 0 && (
        <g style={{ opacity: sw }}>
          {SW_X.map((x, f) => (
            <g key={f}>
              <rect x={x} y={SW_Y} width={SW_W} height={SW_H} rx={3} class="hci-sw" />
              <text class="d-sub" x={x + 12} y={SW_Y + 16}>
                SAN switch · fabric {f ? 'B' : 'A'}
              </text>
              <text x={x + SW_W - 12} y={SW_Y + 16} text-anchor="end" class={`${zoning ? 'mono' : 'mono muted'} d-fine`} style={{ fontWeight: zoning ? 600 : undefined }}>
                {t >= TASK[1].at ? 'zone: host 4' : 'FC'}
              </text>
            </g>
          ))}
        </g>
      )}

      {/* the array */}
      {arr > 0 && (
        <g style={{ opacity: arr }}>
          <rect {...box(ARR)} rx={4} class="hci-array" />
          {tiers &&
            CTL.map((c, j) => (
              <g key={j}>
                <rect {...box(c)} class="cvm" />
                <CtlLabel r={c} c={j} />
              </g>
            ))}
          {SHELF.map((s, j) => (
            <rect key={j} {...box(s)} rx={2} class="hci-shelf" />
          ))}
          {SHELF.map((_, s) => Array.from({ length: 10 }, (_, k) => (tiers || k > 1) && <rect key={`${s}-${k}`} {...box(shelfDrive(s, k))} class="disk" />))}
          <text x={54} y={354} class="muted d-sub">
            Storage array · 2 controllers · LUNs · drive shelves
          </text>
        </g>
      )}
      {Array.from({ length: 6 }, (_, k) => {
        const o = prog(t, 2.3 + 0.12 * k, 2.6 + 0.12 * k) * hostOut;
        const hl = t >= TASK[2].at + 0.12 * k && t < TASK[2].at + TASK_LEN;
        const r = lun(k);
        return (
          o > 0 && (
            <g key={k} style={{ opacity: o }}>
              <rect {...box(r)} rx={2} class={`hci-lun${hl ? ' hl' : ''}`} />
              <text x={r.x + r.w / 2} y={r.y + 13} text-anchor="middle" class="mono d-fine">
                LUN {k + 1}
              </text>
            </g>
          )
        );
      })}
      {prog(t, 2.9, 3.2) * hostOut > 0 && (
        <text x={446} y={305} class="muted d-fine" style={{ opacity: prog(t, 2.9, 3.2) * hostOut }}>
          masked to hosts 1–{t >= TASK[2].at ? 4 : 3}
        </text>
      )}

      {/* three consoles, converging into one Prism */}
      {prismK < 1 &&
        CON.map((c, j) => {
          const k = prog(t, CON_IN[j], CON_IN[j] + 0.4);
          if (k <= 0) return <rect key={j} {...box(con(j))} rx={3} class="frame-dash" />;
          const r = lerpR(con(j), PRISM, ease(prismK));
          const task = TASK[j];
          const lab = fadeOut(prismK);
          return (
            <g key={j} style={{ opacity: k }}>
              <rect {...box(r)} class={`hci-con${t >= task.at && t < task.at + TASK_LEN ? ' on' : ''}`} />
              {lab > 0 && (
                <g style={{ opacity: lab }}>
                  {t >= task.at && (
                    <g style={{ opacity: prog(t, task.at, task.at + 0.2) }}>
                      <circle cx={r.x + 15} cy={15} r={8} class="hci-badge" />
                      <text x={r.x + 15} y={19} text-anchor="middle" class="hci-badge-t">
                        {task.n}
                      </text>
                    </g>
                  )}
                  <text class="d-label" x={r.x + 30} y={20} style={{ fontWeight: 600 }}>
                    {c.t}
                  </text>
                  <text x={r.x + r.w - 12} y={20} text-anchor="end" class="muted d-fine">
                    {c.s}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      {prismK > 0 && (
        <g style={{ opacity: ease(prismK) }}>
          <rect {...box(PRISM)} rx={3} class={`ink-fill hci-prism${joining >= 0 ? ' on' : ''}`} />
          {fadeIn(prismK) > 0 && (
            <g style={{ opacity: fadeIn(prismK) }}>
              {joining >= 0 && (
                <g style={{ opacity: prog(t, NODES[joining].in, NODES[joining].in + 0.2) }}>
                  <circle cx={15} cy={15} r={8} class="hci-badge" />
                  <text x={15} y={19} text-anchor="middle" class="hci-badge-t">
                    1
                  </text>
                </g>
              )}
              <text x={30} y={20} class="hci-on-ink d-title" style={{ fontWeight: 600 }}>
                Prism
              </text>
              <text x={W - 12} y={20} text-anchor="end" class="hci-on-ink soft d-sub">
                {joining >= 0 ? `Expand Cluster · adding node ${joining + 1}` : phase >= 5 ? 'one console for the cluster' : 'one console instead of three'}
              </text>
            </g>
          )}
        </g>
      )}

      {/* both designs uplink to the top-of-rack switches: the 3-tier hosts, then host 1 as it becomes node 1 */}
      {hostOut > 0 &&
        hosts.map(
          (g, i) =>
            i > 0 &&
            upK[i] > 0 && <line key={i} x1={upX(g.frame)} x2={upX(g.frame)} y1={g.frame.y} y2={lerp(g.frame.y, TOR.y + TOR.h, upK[i])} class="hci-link" style={{ opacity: hostK[i] * hostOut }} />,
        )}
      {upK[0] > 0 && <line x1={upX(frame1)} x2={upX(frame1)} y1={frame1.y} y2={lerp(frame1.y, TOR.y + TOR.h, upK[0])} class="hci-link" style={{ opacity: hostK[0] }} />}
      {/* Prism reaches each node over the network, and nodes 2-5 uplink as they join */}
      {NODES.map((nd, i) => {
        const k = ease(prog(t, nd.link, nd.link + 0.4));
        const cx = nx(i) + NW / 2;
        return (
          k > 0 && (
            <g key={i}>
              <line x1={cx} x2={cx} y1={PRISM.h} y2={lerp(PRISM.h, TOR.y, k)} class="ink-stroke" stroke-dasharray="3 3" />
              {i > 0 && <line x1={nx(i) + UP} x2={nx(i) + UP} y1={NODE_Y} y2={lerp(NODE_Y, TOR.y + TOR.h, k)} class="hci-link" />}
            </g>
          )
        );
      })}
      {tor > 0 && (
        <g>
          <rect x={TOR.x} y={TOR.y} width={TOR.w * tor} height={TOR.h} rx={3} class="hci-net" />
          <text class="d-sub" x={12} y={TOR.y + 13} style={{ fontWeight: 600, opacity: tor }}>
            Top-of-rack switches <tspan class="muted" style={{ fontWeight: 400 }}>· standard Ethernet</tspan>
          </text>
          {/* in 3-tier the switches carry VM and management traffic beside a SAN; in HCI, storage too */}
          {out(FOLD, 0.4) > 0 && (
            <text x={W - 12} y={TOR.y + 13} text-anchor="end" class="muted d-sub" style={{ opacity: tor * out(FOLD, 0.4) }}>
              redundant pair · VM and management traffic
            </text>
          )}
          {t >= FOLD + 0.4 && (
            <text x={W - 12} y={TOR.y + 13} text-anchor="end" class="muted d-sub" style={{ opacity: prog(t, FOLD + 0.4, FOLD + 0.8) }}>
              redundant pair · no SAN, no HBAs
            </text>
          )}
        </g>
      )}

      {/* nodes, the storage pool across them, then their drives inside it */}
      {!tiers && (
        <>
          {nodes.map(({ k, g }, i) => {
            if (i === 0) return <NodeBody key={i} g={g} n={1} fold={fold} />;
            if (k <= 0)
              return (
                i >= 3 &&
                slots > 0 && (
                  <g key={i} style={{ opacity: slots }}>
                    <rect x={nx(i)} y={NODE_Y} width={NW} height={NH} rx={6} class="frame-dash" />
                    {i === firstEmpty && (
                      <text x={nx(i) + NW / 2} y={NODE_Y + NH / 2 + 4} text-anchor="middle" class="faint d-sub">
                        room to grow
                      </text>
                    )}
                  </g>
                )
              );
            const nd = NODES[i];
            return (
              <g key={i} style={{ opacity: k }}>
                <NodeBody g={g} n={i + 1} sel={i >= 3 && t < nd.vms + 0.4} vms={prog(t, nd.vms, nd.vms + 0.4)} />
              </g>
            );
          })}
          {pool > 0 && <rect x={0} y={NODE_Y + 102} width={pool} height={26} rx={3} class="ink-soft" stroke="var(--ink-line)" />}
          {nodes.map(
            ({ k, g }, i) =>
              k > 0 && (
                <g key={i} style={{ opacity: k }}>
                  <Drives g={g} fold={i === 0 && t < FOLDED ? drvK : undefined} label={1 - prog(t, NODES[0].pool - 0.4, NODES[0].pool)} used={pool > 0 ? fillAt(i, t) * prog(t, NODES[0].pool, NODES[0].pool + 0.8) : undefined} />
                </g>
              ),
          )}
        </>
      )}

      {/* inside the node: passthrough and where each tier went */}
      {passDraw > 0 && passOut > 0 && (
        <g style={{ opacity: passOut }}>
          <polyline points={pts([nodes[0].g.pt(...PASS[0]), nodes[0].g.pt(...PASS[1]), nodes[0].g.pt(PASS[2][0], lerp(PASS[1][1], PASS[2][1], passDraw))])} class="hci-pass" />
          {passDraw >= 1 && <polyline points={pts([nodes[0].g.pt(...PASS[2]), nodes[0].g.pt(NW - 10, PASS[2][1])])} class="hci-pass" />}
        </g>
      )}
      {NOTES.map((n) => {
        const o = prog(t, n.at, n.at + 0.4) * passOut;
        return (
          o > 0 && (
            <g key={n.y} style={{ opacity: o }}>
              {n.lead && <line x1={315} x2={330} y1={n.y - 4} y2={n.y - 4} class="hci-lead" />}
              <text class="d-label" x={336} y={n.y}>
                <tspan class="muted">{n.was} →</tspan> {n.now}
              </text>
            </g>
          )
        );
      })}

      {/* a VM's I/O through its CVM to the local drives, then copies between nodes */}
      {passDraw >= 1 && passOut > 0 && <Dots path={LOCAL.map(([x, y]) => nodes[0].g.pt(x, y))} t={t} o={prog(t, FOLDED + 0.6, FOLDED + 0.9) * passOut} />}
      {Array.from({ length: copies }, (_, i) => {
        // the newest node copies to node 1 until another joins; that dot fades out and back in while it switches
        const from = i === copies - 2 ? COPY_AT[copies - 1] : COPY_AT[i];
        const o = Math.min(prog(t, from, from + 0.4), i === copies - 1 && copies < NODES.length ? out(COPY_AT[copies] - 0.4, 0.4) : 1);
        return o > 0 && <Dots key={i} path={copyPath(i, (i + 1) % copies)} t={t + i * 1.9} o={o} />;
      })}
      {BAL.map((b) => {
        const o = prog(t, b.at, b.at + 0.3) * out(b.at + b.len - 0.3, 0.3);
        return o > 0 && Array.from({ length: b.to }, (_, i) => <Dots key={`${b.to}-${i}`} path={copyPath(i, b.to)} t={t + i * 0.7} o={o} />);
      })}
      {/* the pool's labels are drawn last, so no copy dot crosses the words */}
      {!tiers && pool > 0 && (
        <text x={2} y={NODE_Y + NH + 20} class="hci-ink halo d-label" style={{ opacity: prog(t, NODES[0].pool, NODES[0].pool + 0.8) }}>
          Distributed Storage Fabric: one storage pool across {inPool} nodes’ drives
        </text>
      )}
      {!tiers && t >= COPY_AT[0] && (
        <text x={2} y={NODE_Y + NH + 38} class="muted halo d-sub" style={{ opacity: prog(t, COPY_AT[0], COPY_AT[0] + 0.4) }}>
          each write kept on two nodes (RF2)
        </text>
      )}
      {!tiers && net > 0 && <Controllers n={linked} o={net} hl={phase === PHASES.length - 1} />}
    </svg>
  );
}

const STEPS = paced(P, PHASES.map((k, i) => [k, CAPTIONS[i]]));

export default function Hci() {
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: END, steps: STEPS });
  const t = clock.t;
  const phase = phaseAt(P, t);
  const hci = phase >= 3;
  const tone: Tone | 'ink' | undefined = phase < 3 ? undefined : phase < 5 ? 'ink' : phase === 5 ? 'ok' : 'flow';
  const nodes = phase < 5 ? 1 : 3 + NODES.slice(3).filter((n) => t >= n.link).length;

  return (
    <Show
      top={<Points label="Why customers choose it" items={POINTS} t={t} />}
      foot={
        <>
          <Follow tone={tone} k={PHASES[phase]}>
            <p>{CAPTIONS[phase]}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Tiers to run', v: hci ? 1 : 3, tone: hci ? 'ok' : undefined, sub: hci ? 'nodes on Ethernet' : 'servers · SAN · array', tip: 'A tier is hardware run on its own: servers, storage network, array. Servers in both designs also connect to Ethernet switches.' },
              { k: 'Consoles', v: hci ? 1 : 3, tone: hci ? 'ok' : undefined, sub: hci ? 'Prism' : phase === 2 ? '3 touched to add a host' : 'one per tier' },
              { k: 'Storage controllers', v: hci ? nodes : 2, tone: hci && nodes > 2 ? 'ok' : undefined, sub: hci ? 'one CVM per node' : 'the array’s pair, shared by every host', tip: 'Each CVM reserves some of its node’s CPU and memory; how much depends on the features you enable and the node size, so take it from Nutanix sizing.' },
              hci
                ? { k: 'Nodes', v: nodes, sub: phase < 5 ? 'the building block' : phase === 5 ? 'smallest standard cluster' : 'one cluster, one storage pool', tip: 'Three nodes is the smallest standard cluster, with each write on two of them (RF2). One- and two-node clusters exist for edge sites.' }
                : { k: 'Hosts', v: t >= HOST_IN[3] ? 4 : 3, sub: 'plus a SAN and an array' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <HciDiagram t={t} />
      </div>
      <Legend
        items={[
          { color: 'var(--ink)', label: 'Storage controller' },
          { color: 'var(--flow)', label: 'Storage traffic' },
          ...(phase < 3 ? [{ color: 'var(--s2)', label: 'Fibre Channel cabling' }] : []),
          ...(phase === 3 || phase === 4 ? [{ color: 'var(--line-2)', label: 'Drives passed through to the CVM', dashed: true }] : []),
          ...(phase >= 5 ? [{ color: 'var(--s2)', label: 'Data on a drive' }] : []),
        ]}
      />
      <PlayBar
        clock={clock}
        label="Legacy vs HCI animation"
        extra={<Illus why="The 3-tier side is a generic Fibre Channel design: two switches and one dual-controller array. Arrays and fabrics vary by vendor, and iSCSI SANs run on Ethernet. Both designs’ redundant top-of-rack Ethernet switches are drawn as one bar, and the 3-tier side’s switches carry VM and management traffic beside the SAN. Counts and how full the drives look are examples; disk balancing runs once nodes are unevenly full, on Curator’s schedule." />}
      />
    </Show>
  );
}
