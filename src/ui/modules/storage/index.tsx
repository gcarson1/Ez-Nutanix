// Nutanix Unified Storage: Files (an FSVM fails and a survivor takes over its folders), Volumes
// (an iSCSI host is redirected to a healthy CVM) and Objects (a lifecycle rule tiers old objects
// to a cheaper S3-compatible store). Each tab is one looping picture; the models are in engine/unistore.ts.
import { useMemo } from 'preact/hooks';
import { useEnum } from '../../../state/route';
import { paced, stepsFrom, useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, ease, flowDots, pathLength, phaseAt, prog, Tabs } from '../../components/show';
import { iscsiTargets, loadPerFsvm, makeFiles, ownership, tierSplit } from '../../../engine/unistore';
import './style.css';

type Svc = 'files' | 'vol' | 'obj';
type Cap = { tone: Tone | 'ink'; k: string; text: string };

const W = 960;

/** Point at fraction f along a polyline. */
function along(pts: [number, number][], f: number): [number, number] {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = Math.max(0, Math.min(1, f)) * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const r = seg[i] ? d / seg[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r];
    }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}

/** The fabric under every service: one strip at the bottom of each picture. */
function Fabric({ y, h, note }: { y: number; h: number; note: string }) {
  return (
    <g>
      <rect class="sto-dsf" x={20} y={y} width={W - 40} height={h} />
      <text x={36} y={y + h - 10} class="muted d-sub">
        Distributed storage fabric
      </text>
      <text x={W - 36} y={y + h - 10} text-anchor="end" class="muted d-sub">
        {note}
      </text>
    </g>
  );
}

// ── Files ──
const F = { fail: 3, take: 4, taken: 5.2, back: 9.5, give: 10.3, given: 11.5, end: 13.5 };
const F_STARTS = [0, F.fail, F.take, F.taken, F.back, F.give, F.given];
const NS = { x: W / 2 - 210, y: 8, w: 420, h: 50 };
const FS_Y = 96;
const FS_H = 190;
const CHIP_H = 24;
const REQ_PERIOD = 3;
const REQ_TRAVEL = 0.9;

function Files() {
  const [nS, setN] = useEnum<'3' | '1'>('fv', '3', ['3', '1']);
  const n = Number(nS);
  const failed = n === 1 ? 0 : 1;
  const base = useMemo(() => makeFiles(n), [n]);
  const home = useMemo(() => ownership(base), [base]);
  const taken = useMemo(() => ownership({ ...base, down: [failed] }), [base, failed]);
  const survivor = taken.find((o) => o.moved)?.servedBy ?? null;
  // Takeover only happens with a survivor: it slides in after the failure and back after the return.
  const ha = n > 1;
  const capAt = (t: number): Cap => {
    const down = t >= F.fail && t < F.back;
    return ha
      ? [
          { tone: 'ink' as const, k: 'One namespace', text: 'Three file server VMs (FSVMs) share the work. Users connect to one path and never need to know which FSVM serves a folder.' },
          { tone: 'bad' as const, k: 'An FSVM fails', text: `FSVM-${failed + 1} goes down. Its folders are out of reach for a moment.` },
          { tone: 'warn' as const, k: 'A survivor takes over', text: `FSVM-${(survivor ?? 0) + 1} takes over FSVM-${failed + 1}’s volume group and IP address, so its folders come back at the same path.` },
          { tone: 'ok' as const, k: 'Folders still reachable', text: 'Every folder is reachable. Users may have seen a short pause or reconnect, but the path never changed.' },
          { tone: 'flow' as const, k: `FSVM-${failed + 1} is back`, text: `FSVM-${failed + 1} is running again and ready to take its work back.` },
          { tone: 'flow' as const, k: 'Folders handed back', text: `FSVM-${failed + 1} takes its volume group and IP address back, and the work is spread evenly again.` },
          { tone: 'ok' as const, k: 'Back to normal', text: 'All three FSVMs serve their own folders again. Nobody had to change a path or a drive mapping.' },
        ][phaseAt(F_STARTS, t)]
      : t < F.fail
        ? { tone: 'ink', k: 'A single FSVM', text: 'A single file server VM serves every folder. It works, but nothing can take over if it fails.' }
        : down
          ? { tone: 'bad', k: 'The only FSVM fails', text: 'The only FSVM is down, so every folder is out of reach until it comes back. Three FSVMs is the minimum for high availability.' }
          : { tone: 'ok', k: 'The FSVM is back', text: 'The FSVM is back and serves every folder again.' };
  };
  const steps = useMemo(() => stepsFrom(F.end, capAt), [n, survivor]);
  const clock = useClock({ rate: 1, duration: F.end, keys: true, poster: F.end - 0.5, steps });
  useRestartOn(clock, [n]);
  const t = clock.t;
  const down = t >= F.fail && t < F.back;
  const k = !ha ? 0 : t < F.take ? 0 : t < F.taken ? ease(prog(t, F.take, F.taken)) : t < F.give ? 1 : t < F.given ? 1 - ease(prog(t, F.give, F.given)) : 0;
  const load = loadPerFsvm({ ...base, down: down ? [failed] : [] });
  const unreachable = (home: number) => down && home === failed && !(ha && t >= F.taken);
  const reachable = home.filter((o) => !unreachable(o.home)).length;

  const colW = n === 1 ? 420 : 270;
  const gap = 30;
  const x0 = (W - (n * colW + (n - 1) * gap)) / 2;
  const fx = (i: number) => x0 + i * (colW + gap);
  const chipCols = n === 1 ? 3 : 2;
  const chipW = (colW - 20 - (chipCols - 1) * 8) / chipCols;
  const slot = (fs: number, s: number) => ({ x: fx(fs) + 10 + (s % chipCols) * (chipW + 8), y: FS_Y + 56 + Math.floor(s / chipCols) * (CHIP_H + 6) });
  const homeSlot = home.map((o, i) => slot(o.home, home.slice(0, i).filter((q) => q.home === o.home).length));
  const ownCount = (fs: number) => home.filter((o) => o.home === fs).length;
  const takenSlot = taken.map((o, i) => (o.moved ? slot(o.servedBy!, ownCount(o.servedBy!) + taken.slice(0, i).filter((q) => q.moved && q.servedBy === o.servedBy).length) : homeSlot[i]));
  const cap = capAt(t);
  // Each folder gets a request once per period, evenly staggered, so the dots arrive at a steady beat.
  const reqPhase = (i: number) => (t + (i * REQ_PERIOD) / home.length) % REQ_PERIOD;
  const servedBy = (i: number) => (k > 0.5 ? taken[i].servedBy! : home[i].home);

  const H = FS_Y + FS_H + 94;
  const DSF_Y = FS_Y + FS_H + 26;
  return (
    <Show clock={clock}
      top={
        <Choice<'3' | '1'>
          label="File server"
          value={nS}
          onChange={setN}
          options={[
            { value: '3', label: '3 FSVMs' },
            { value: '1', label: '1 FSVM' },
          ]}
        />
      }
      foot={
        <>
          <Follow tone={cap.tone} k={cap.k}>
            <p>{cap.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Folders reachable', v: `${reachable} of ${home.length}`, tone: reachable === home.length ? 'ok' : 'bad' },
              { k: 'FSVMs up', v: `${n - (down ? 1 : 0)} of ${n}`, tone: down ? 'warn' : 'ok' },
              ...(ha ? [{ k: 'Folders per FSVM', v: load.join(' · '), tip: 'How many top-level folders each FSVM serves right now.' }] : []),
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <svg class="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ha ? 'Nutanix Files: users see one path. Three file server VMs serve the folders. When one fails, another takes over its volume group and IP address, and hands them back when it returns.' : 'Nutanix Files with a single file server VM: when it fails, every folder is out of reach until it returns.'}>
          <rect class="sto-ns" x={NS.x} y={NS.y} width={NS.w} height={NS.h} />
          <text class="d-title" x={W / 2} y={NS.y + 21} text-anchor="middle" style={{ fontWeight: 600 }}>
            Users see one path
          </text>
          <text x={W / 2} y={NS.y + 39} text-anchor="middle" class="mono d-label">
            \\files01\corp
          </text>
          <text x={NS.x + NS.w + 14} y={NS.y + 21} class="muted d-sub">
            SMB · NFS · parallel NFS for HPC
          </text>
          <text x={NS.x + NS.w + 14} y={NS.y + 39} class="muted d-sub">
            exabyte-scale unstructured data
          </text>
          {Array.from({ length: n }, (_, i) => {
            const isDown = down && i === failed;
            const x = fx(i);
            const ip = i === survivor && k > 0.5 ? `IP .${11 + i} + .${11 + failed}` : isDown ? (ha && k > 0.5 ? 'IP moved away' : 'IP unreachable') : `IP .${11 + i}`;
            return (
              <g key={i}>
                <path d={`M${W / 2} ${NS.y + NS.h} V ${FS_Y - 18} H ${x + colW / 2} V ${FS_Y}`} fill="none" class={isDown ? 'bad-stroke' : 'line'} stroke-dasharray={isDown ? '4 4' : undefined} />
                <rect class={`node-box${isDown ? ' down' : ''}`} x={x} y={FS_Y} width={colW} height={FS_H} />
                <rect x={x} y={FS_Y} width={colW} height={30} class={isDown ? 'bad-fill' : 'ink-fill'} />
                <text class="d-label" x={x + 12} y={FS_Y + 20} style={{ fill: '#fff', fontWeight: 600 }}>
                  FSVM-{i + 1}
                </text>
                <text class="d-label" x={x + colW - 12} y={FS_Y + 20} text-anchor="end" style={{ fill: '#fff', fontWeight: 600 }}>
                  {isDown ? '✕ down' : 'running'}
                </text>
                <text x={x + 12} y={FS_Y + 46} class={`${i === survivor && k > 0.5 ? 'warn-fill mono' : 'muted mono'} d-sub`}>
                  {ip}
                </text>
              </g>
            );
          })}
          {home.map((o, i) => {
            const a = homeSlot[i];
            const b = takenSlot[i];
            const x = a.x + (b.x - a.x) * k;
            const y = a.y + (b.y - a.y) * k;
            const lost = unreachable(o.home) && k < 0.02;
            const moving = taken[i].moved && k > 0;
            const q = reqPhase(i);
            const hit = !lost && !unreachable(o.home) && q >= REQ_TRAVEL && q < REQ_TRAVEL + 0.4;
            return (
              <g key={o.name}>
                <rect class={`sto-chip${lost ? ' lost' : moving ? ' moved' : ''}${hit ? ' hit' : ''}`} x={x} y={y} width={chipW} height={CHIP_H} />
                <path d={`M${x + 8} ${y + 8} h4 l1.5 1.5 h6.5 v8 h-12 z`} class={lost ? 'sto-folder lost' : 'sto-folder'} />
                <text x={x + 28} y={y + 16} class={`${`mono${lost ? ' faint' : ''}`} d-sub`}>
                  /{o.name}
                </text>
                {lost && (
                  <text x={x + chipW - 8} y={y + 16} text-anchor="end" class="bad-fill d-sub" style={{ fontWeight: 700 }}>
                    ✕
                  </text>
                )}
              </g>
            );
          })}
          {/* requests: users opening files, one folder after another, along the line to the FSVM serving it */}
          {home.map((o, i) => {
            const q = reqPhase(i);
            if (q >= REQ_TRAVEL || unreachable(o.home)) return null;
            const cx = fx(servedBy(i)) + colW / 2;
            const [dx, dy] = along([[W / 2, NS.y + NS.h], [W / 2, FS_Y - 18], [cx, FS_Y - 18], [cx, FS_Y]], q / REQ_TRAVEL);
            return <circle key={o.name} class="sto-dot" cx={dx} cy={dy} r={4} />;
          })}
          <Fabric y={DSF_Y} h={64} note="each FSVM keeps its folders in its own volume group" />
          {Array.from({ length: n }, (_, i) => {
            const x = fx(i);
            const owner = down && i === failed ? (ha && t >= F.taken ? survivor : null) : i;
            const vx = x + colW / 2;
            const ox = owner === null ? vx : fx(owner) + colW / 2 + (owner !== i ? 30 : 0);
            return (
              <g key={i}>
                <path d={`M${vx} ${DSF_Y + 10} C ${vx} ${DSF_Y - 10}, ${ox} ${DSF_Y - 8}, ${ox} ${FS_Y + FS_H}`} fill="none" class={owner === null ? 'line' : owner !== i ? 'warn-stroke' : 'flow-stroke'} stroke-width={1.5} stroke-dasharray={owner === null ? '3 3' : undefined} />
                <rect class="disk" x={vx - 60} y={DSF_Y + 10} width={120} height={24} />
                <text x={vx} y={DSF_Y + 26} text-anchor="middle" class="mono d-sub">
                  VG-{i + 1} {owner === null ? '· no owner' : owner !== i ? `→ FSVM-${owner + 1}` : ''}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <Legend
        items={[
          { color: 'var(--line-2)', label: 'Folder' },
          ...(ha ? [{ color: 'var(--warn)', label: 'Served by another FSVM' }] : []),
          { color: 'var(--bad)', dashed: true, label: 'Out of reach' },
          { color: 'var(--flow)', label: 'A user opening a file' },
        ]}
      />
      <PlayBar clock={clock} label="File server failover animation" extra={<Illus why="Simplified: timings are compressed, and a real file server has many more folders and users. How long a takeover or hand-back takes depends on the load, and SMB clients may see a short pause." />} />
    </Show>
  );
}

// ── Volumes ──
const V = { work: 1.6, fail: 5, relog: 6, back: 7.4, end: 11.5 };
const V_STARTS = [0, V.work, V.fail, V.relog, V.back];
const CVMS = 4;
const HOSTS = 2;
const HOST_Y = 10;
const IP_Y = 100;
const CVM_Y = 192;
const VG_Y = 296;
const cvmW = 190;
const cvmX = (i: number) => (W - (CVMS * cvmW + (CVMS - 1) * 30)) / 2 + i * (cvmW + 30);
const hostX = (c: number) => [180, 580][c];
const HOST_W = 200;

function sessionPath(c: number, cvm: number): [number, number][] {
  const hx = hostX(c) + HOST_W / 2;
  const cx = cvmX(cvm) + cvmW / 2;
  const pts: [number, number][] = [[hx, HOST_Y + 52], [hx, IP_Y + 36]];
  for (let s = 1; s <= 8; s++) {
    const u = s / 8;
    pts.push([hx + (cx - hx) * ease(u), IP_Y + 36 + (CVM_Y - IP_Y - 36) * u]);
  }
  return pts;
}

function Volumes() {
  const before = useMemo(() => iscsiTargets(HOSTS, CVMS, []), []);
  const after = useMemo(() => iscsiTargets(HOSTS, CVMS, [0]), []);
  const lostHost = before.findIndex((c) => c === 0);
  const newCvm = after[lostHost]!;
  const caps: Cap[] = [
    { tone: 'ink' as const, k: 'One address', text: 'Hosts outside the cluster log in to one Data Services IP. The cluster points each host to a CVM that will serve it.' },
    { tone: 'ok' as const, k: 'Hosts connected', text: 'Each host’s disk reads and writes go to its CVM. Every CVM can reach every disk in the volume group, because the data is spread across all nodes.' },
    { tone: 'bad' as const, k: 'A CVM fails', text: `CVM-1 goes down and Host ${lostHost + 1} loses its session.` },
    { tone: 'warn' as const, k: 'Host redirected', text: `Host ${lostHost + 1} logs in again to the same address and is sent to a healthy CVM. No multipath setup is needed on the host.` },
    { tone: 'ok' as const, k: 'Work carries on', text: `Host ${lostHost + 1} carries on through CVM-${newCvm + 1}. The data never moved: CVM-${newCvm + 1} reads and writes the same disks.` },
  ];
  const clock = useClock({ rate: 1, duration: V.end, keys: true, poster: V.back + 1.5, steps: paced(V_STARTS, caps.map((c) => [c.k, c.text])) });
  const t = clock.t;
  const ph = phaseAt(V_STARTS, t);
  const cvmDown = t >= V.fail;
  // Every CVM but one stays up, so each host always has a CVM to go to.
  const target = (c: number) => (t >= V.relog ? after[c] : before[c]) ?? 0;
  const connected = (c: number) => (c === lostHost ? !cvmDown || t >= V.back : true) && t >= V.work;
  const nConn = Array.from({ length: HOSTS }, (_, c) => c).filter(connected).length;

  const cap = caps[ph];

  const H = VG_Y + 92;
  return (
    <Show clock={clock}
      foot={
        <>
          <Follow tone={cap.tone} k={cap.k}>
            <p>{cap.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Hosts connected', v: `${nConn} of ${HOSTS}`, tone: nConn === HOSTS ? 'ok' : 'warn' },
              { k: 'CVMs up', v: `${CVMS - (cvmDown ? 1 : 0)} of ${CVMS}`, tone: cvmDown ? 'warn' : 'ok' },
              { k: 'Data moved', v: 'None', tone: 'ok', tip: 'A redirected session is served by another CVM. The disks stay where they are; every CVM can reach them.' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <svg class="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Nutanix Volumes: hosts log in to one Data Services IP and are sent to a CVM. When that CVM fails, the host logs in again and is redirected to a healthy CVM that reaches the same disks.">
          {Array.from({ length: HOSTS }, (_, c) => {
            const cvm = target(c);
            const pts = sessionPath(c, cvm);
            const broken = c === lostHost && cvmDown && t < V.back;
            const loggingIn = t < V.work || (c === lostHost && t >= V.relog && t < V.back);
            const live = connected(c);
            const p0 = t < V.work ? 0 : V.relog;
            const p1 = t < V.work ? V.work : V.back;
            return (
              <g key={c}>
                <rect class="vm" x={hostX(c)} y={HOST_Y} width={HOST_W} height={52} />
                <text class="d-label" x={hostX(c) + HOST_W / 2} y={HOST_Y + 22} text-anchor="middle" style={{ fontWeight: 600 }}>
                  Host {c + 1}
                </text>
                <text x={hostX(c) + HOST_W / 2} y={HOST_Y + 40} text-anchor="middle" class={`${broken ? (t < V.relog ? 'bad-fill' : 'warn-fill') : 'muted'} d-sub`} style={{ fontWeight: broken ? 600 : 400 }}>
                  {broken ? (t < V.relog ? '✕ lost its session' : 'logging in again') : 'server outside the cluster'}
                </text>
                {(live || loggingIn || broken) && (
                  <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" class={broken && t < V.relog ? 'bad-stroke' : c === lostHost && t >= V.relog ? 'warn-stroke' : 'flow-stroke'} stroke-width={2} stroke-dasharray={broken || loggingIn ? '5 4' : undefined} />
                )}
                {loggingIn &&
                  (() => {
                    const [x, y] = along(pts, ease(prog(t, p0, p1)));
                    return <circle class="sto-dot login" cx={x} cy={y} r={5} />;
                  })()}
                {live &&
                  !loggingIn &&
                  flowDots(t + c * 1.3, pathLength((p) => along(pts, p)), 3).map((f, k) => {
                    const [x, y] = along(pts, f);
                    return <circle key={k} class="sto-dot" cx={x} cy={y} r={4} />;
                  })}
              </g>
            );
          })}
          <rect class="sto-ip" x={40} y={IP_Y} width={W - 80} height={36} />
          <text class="d-label" x={W / 2} y={IP_Y + 23} text-anchor="middle" style={{ fontWeight: 600 }}>
            Data Services IP: one address for the whole cluster
          </text>
          {Array.from({ length: CVMS }, (_, i) => {
            const isDown = cvmDown && i === 0;
            const x = cvmX(i);
            const sessions = Array.from({ length: HOSTS }, (_, c) => c).filter((c) => connected(c) && target(c) === i).length;
            return (
              <g key={i}>
                <rect class={`node-box${isDown ? ' down' : ''}`} x={x} y={CVM_Y} width={cvmW} height={64} />
                <rect class={isDown ? 'cvm down' : 'cvm'} x={x + 10} y={CVM_Y + 10} width={72} height={44} />
                <text class="d-label" x={x + 46} y={CVM_Y + 37} text-anchor="middle" style={{ fill: '#fff', fontWeight: 600 }}>
                  CVM-{i + 1}
                </text>
                <text x={x + 94} y={CVM_Y + 28} class={`${isDown ? 'bad-fill' : ''} d-label`} style={{ fontWeight: 600 }}>
                  {isDown ? '✕ down' : 'up'}
                </text>
                <text x={x + 94} y={CVM_Y + 46} class="muted d-sub">
                  {isDown ? '' : `${sessions} host${sessions === 1 ? '' : 's'}`}
                </text>
                <line x1={x + cvmW / 2} y1={CVM_Y + 64} x2={x + cvmW / 2} y2={VG_Y} class={isDown ? 'line' : 'sto-reach'} stroke-dasharray="3 3" />
              </g>
            );
          })}
          <Fabric y={VG_Y} h={78} note="every CVM can reach every disk" />
          <text class="d-label" x={36} y={VG_Y + 34} style={{ fontWeight: 600 }}>
            Volume group
          </text>
          {Array.from({ length: 4 }, (_, d) => {
            const x = 170 + d * 190;
            return (
              <g key={d}>
                <rect class="disk" x={x} y={VG_Y + 12} width={150} height={34} />
                <text x={x + 75} y={VG_Y + 34} text-anchor="middle" class="mono d-sub">
                  Disk {d + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <Legend
        items={[
          { color: 'var(--flow)', label: 'Live session' },
          { color: 'var(--warn)', label: 'Redirected session (dashed while logging in)' },
          { color: 'var(--bad)', dashed: true, label: 'Session lost' },
        ]}
      />
      <PlayBar clock={clock} label="iSCSI redirection animation" extra={<Illus why="Simplified: timings are compressed, and two hosts, four CVMs and four disks are an example. How quickly a host logs in again depends on its iSCSI initiator settings." />} />
    </Show>
  );
}

// ── Objects ──
/** The bucket has one example lifecycle rule: objects older than 30 days move to an S3-compatible tier. */
const DAYS = 30;
const YEAR = 365;
const TILES = 24;
const TOTAL_TB = 200;
const ARRIVE = 8;
const MOVE = 12;
const ROWS = 5;
const ROW_H = 26;
const arriveAt = (i: number) => (i + 0.5) * (YEAR / TILES);
const BKT = { x: 40, y: 76, w: 540, h: 262 };
const TGT = { x: 660, y: 76, w: 260, h: 262 };
const SRC = { x: 40, y: 8, w: 540, h: 40 };
const RULE_H = 50;
const ROWS_Y = BKT.y + 40 + RULE_H + 12;
const objName = (i: number) => `backup-${String(101 + i).padStart(4, '0')}`;

/** The Objects caption on day d. */
function objectsCap(d: number): Cap {
  const today = Math.min(YEAR, d);
  const split = tierSplit((TOTAL_TB * today) / YEAR, DAYS, today);
  return d >= YEAR
    ? { tone: 'ok', k: 'After one year', text: `${Math.round(split.localTB)} TB of recent data stays on the cluster and ${Math.round(split.remoteTB)} TB sits on the cheaper store. AWS S3, Azure Blob or another S3-compatible endpoint can be the target, depending on release and endpoint. Reading a tiered object back retrieves it from the tiering target; any request, retrieval or transfer charges depend on the provider, tier, region and account terms.` }
    : today < DAYS
      ? { tone: 'ink', k: 'The bucket fills', text: 'Apps and backup software write objects over the S3 API, and the bucket fills up on the cluster. This bucket has one example lifecycle rule; no object moves until it is older than the rule says.' }
      : { tone: 'flow', k: 'Old objects move', text: `The example lifecycle rule on this bucket has Objects move only the rows older than ${DAYS} days to a cheaper object store or S3-compatible endpoint, in your data center or a public cloud. Newer rows stay put. The bucket keeps the metadata of the moved objects. Tiering is set per bucket, so not every bucket does this.` };
}
const OBJECT_STEPS = stepsFrom(YEAR + 30, objectsCap);

function Objects() {
  const clock = useClock({ rate: 24, duration: YEAR + 30, keys: true, poster: YEAR, steps: OBJECT_STEPS });
  const d = clock.t;
  const today = Math.min(YEAR, d);
  const written = (TOTAL_TB * today) / YEAR;
  const split = tierSplit(written, DAYS, today);
  const month = Math.min(12, Math.floor(today / (YEAR / 12)) + 1);

  const cap = objectsCap(d);
  // Rows list the newest objects, newest at the bottom; each new arrival pushes the older rows up one slot.
  const rows = Array.from({ length: TILES }, (_, i) => {
    const a = arriveAt(i);
    if (d < a) return null;
    const born = ease(prog(d, a, a + ARRIVE));
    let shift = 0;
    for (let k = i + 1; k < TILES; k++) shift += ease(prog(d, arriveAt(k), arriveAt(k) + ARRIVE));
    const age = d - a;
    const q = age >= DAYS ? ease(prog(age, DAYS, DAYS + MOVE)) : 0;
    const vis = Math.min(born, 1 - Math.max(0, Math.min(1, shift - (ROWS - 1))));
    return vis > 0.01 ? { i, y: ROWS_Y + (ROWS - 1 - shift) * ROW_H, vis, age, q } : null;
  }).filter((r) => r !== null);

  const H = BKT.y + BKT.h + 78;
  const DSF_Y = BKT.y + BKT.h + 16;
  return (
    <Show clock={clock}
      foot={
        <>
          <Follow tone={cap.tone} k={cap.k}>
            <p>{cap.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Written so far', v: `${Math.round(written)} TB` },
              { k: 'On the cluster', v: `${Math.round(split.localTB)} TB` },
              { k: 'On cheaper storage', v: `${Math.round(split.remoteTB)} TB`, tone: split.remoteTB > 0.5 ? 'flow' : undefined },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <svg class="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Nutanix Objects: apps write objects over S3 into a bucket on the cluster. One example lifecycle rule on the bucket transitions objects older than ${DAYS} days to an S3-compatible tier; only the objects that match move, and the bucket keeps their metadata. AWS S3, Azure Blob and other S3 clouds are optional targets.`}>
          <defs>
            <marker id="sto-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" class="flow-fill" />
            </marker>
          </defs>
          <rect class="sto-ns" x={SRC.x} y={SRC.y} width={SRC.w} height={SRC.h} />
          <text class="d-label" x={SRC.x + SRC.w / 2} y={SRC.y + 25} text-anchor="middle" style={{ fontWeight: 600 }}>
            Apps and backup software write over the S3 API
          </text>
          <path d={`M${SRC.x + SRC.w / 2} ${SRC.y + SRC.h} V ${BKT.y}`} class="line" />
          <rect class="node-box" x={BKT.x} y={BKT.y} width={BKT.w} height={BKT.h} />
          <text class="d-title" x={BKT.x + 20} y={BKT.y + 26} style={{ fontWeight: 600 }}>
            Bucket on the cluster
          </text>
          <text x={BKT.x + BKT.w - 20} y={BKT.y + 26} text-anchor="end" class="muted d-sub">
            object workers · 3 or more VMs
          </text>
          <rect class="sto-rule" x={BKT.x + 16} y={BKT.y + 40} width={BKT.w - 32} height={RULE_H} />
          <text class="d-label" x={BKT.x + 30}>
            <tspan y={BKT.y + 40 + 20} style={{ fontWeight: 600 }}>Lifecycle rule (example):</tspan>
            <tspan x={BKT.x + 30} y={BKT.y + 40 + 40}>transition objects older than {DAYS} days to an S3-compatible tier</tspan>
          </text>
          <rect class="sto-tgt" x={TGT.x} y={TGT.y} width={TGT.w} height={TGT.h} />
          <text class="d-title" x={TGT.x + TGT.w / 2} y={TGT.y + 26} text-anchor="middle" style={{ fontWeight: 600 }}>
            S3-compatible tier
          </text>
          <text x={TGT.x + TGT.w / 2} y={TGT.y + 44} text-anchor="middle" class="muted d-fine">
            optional: AWS S3, Azure Blob, other S3 clouds
          </text>
          <path d={`M${BKT.x + BKT.w + 4} ${ROWS_Y + (ROWS * ROW_H) / 2} H ${TGT.x - 4}`} class="xfer" marker-end="url(#sto-arr)" />
          <text text-anchor="middle" class="muted d-sub">
            <tspan x={(BKT.x + BKT.w + TGT.x) / 2} y={ROWS_Y + (ROWS * ROW_H) / 2 - 24}>
              rule
            </tspan>
            <tspan x={(BKT.x + BKT.w + TGT.x) / 2} y={ROWS_Y + (ROWS * ROW_H) / 2 - 8}>
              matches
            </tspan>
          </text>
          {rows.map((r) => {
            const rx = BKT.x + 16;
            const rw = BKT.w - 32;
            const match = r.age >= DAYS;
            const days = Math.floor(r.age);
            const status = r.q <= 0 ? 'on the cluster' : r.q < 1 ? 'moving' : 'data on tier · metadata here';
            return (
              <g key={r.i} opacity={r.vis}>
                <rect class={`sto-row${match ? ' match' : ''}`} x={rx} y={r.y} width={rw} height={ROW_H - 4} />
                <path d={`M${rx + 8} ${r.y + 5} h8 l4 4 v9 h-12 z`} class="sto-folder" />
                <text x={rx + 30} y={r.y + 16} class="mono d-sub">
                  {objName(r.i)}
                </text>
                <text x={rx + 190} y={r.y + 16} class={`${match ? 'flow-fill' : ''} d-sub`}>
                  {days} {days === 1 ? 'day' : 'days'} old{match ? ' · matches' : ''}
                </text>
                <text x={rx + rw - 10} y={r.y + 16} text-anchor="end" class={`${r.q >= 1 ? 'flow-fill' : 'muted'} d-sub`}>
                  {status}
                </text>
                {r.q > 0 && (
                  <g>
                    <rect class="sto-row tiered" x={TGT.x + 16 + 40 * (1 - r.q)} y={r.y} width={TGT.w - 32 - 40 * (1 - r.q)} height={ROW_H - 4} style={{ opacity: r.q }} />
                    <text x={TGT.x + 28 + 40 * (1 - r.q)} y={r.y + 16} class="mono d-sub" style={{ opacity: r.q }}>
                      {objName(r.i)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          <text x={BKT.x + 20} y={BKT.y + BKT.h - 10} class="muted d-fine">
            The five newest objects are shown; the bucket holds many more.
          </text>
          <Fabric y={DSF_Y} h={56} note="the bucket gets the container’s copies, erasure coding and compression" />
          <text class="d-label" x={36} y={DSF_Y + 22}>
            Object data and metadata live in vDisks like any VM’s data; on hybrid nodes AOS also moves it between flash and HDD.
          </text>
        </svg>
      </div>
      <Legend
        items={[
          { color: 'var(--bg-3)', label: 'Object on the cluster' },
          { color: 'var(--flow)', label: 'Matches the rule: data moves to the tier' },
        ]}
      />
      <PlayBar clock={clock} label="Object tiering over one year" fmt={() => (d >= YEAR ? 'One year' : `Month ${month}`)} extra={<Illus why="A year of writes plays in seconds. The 30-day rule, the object names and the data volumes are examples; you set your own lifecycle rules and targets." />} />
    </Show>
  );
}

const TABS: [Svc, string][] = [
  ['files', 'Files · SMB / NFS'],
  ['vol', 'Volumes · iSCSI block'],
  ['obj', 'Objects · S3'],
];

export default function Storage() {
  const [tab, setTab] = useEnum<Svc>('tab', 'files', ['files', 'vol', 'obj']);
  return (
    <Tabs label="Storage services" value={tab} tabs={TABS.map(([id, label]) => ({ id, label }))} onChange={setTab}>
      {tab === 'files' && <Files />}
      {tab === 'vol' && <Volumes />}
      {tab === 'obj' && <Objects />}
    </Tabs>
  );
}
